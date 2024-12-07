import base64
from datetime import datetime
import json

from fastapi import HTTPException
from supabase import Client

from src.api.pdf2text import convert_base64_pdf_to_text
from src.api.learning_progress import get_graph_learning_state
from src.api.routes.content_map import get_document_content
from src.api.models import ContentMapEdge, ContentMapEdgePreID, ContentMapNode


BRAINSTORM_PROMPT = """
We are going to convert the attached document into a graph structure. The nodes will be individual concepts, though perhaps containing a few distinct facts or facets. The edges will be prerequisite relationships. There should be an edge between node A and node B if node B is a concept that requires node A to understand, or if any sensible path to learning these concepts puts node A before node B. Do not use edges for just nodes being related to each other. You can assume edges are transitive; if an A-->B edge exists and B-->C edge exists, then the A-->C prerequisite is implicit and should not be listed separately.

We are going to convert EVERYTHING in the attached document. Be comprehensive. We want to create a brilliant, insightful concept map that an intelligent learner could follow to quickly grasp the key concrete points.

You are going to start by thinking out-loud about the best approach to use. What's the underlying structure of the concepts in the document? What are the key things that need to be understood about it? What is a path someone might follow to invent it for themselves, node-by-node, if they had a helpful socratic tutor guiding them along with the right questions and prods through the concept map? You want to AVOID a generic, "here's a list of vague concepts" approach. You want to instead imagine you're a brilliant tutor for an intelligent student, doing preparation work for an extended, detailed deep-dive into the material where you focus on key concrete points, and really *grok* the material and its connections at a deep level. 

Reflect on the material in light of the above, develop your understanding of it, list key concepts and dependencies. This is the initial brainstorm (later, you will generate the graph based on this, but for now stick to just outlining your thoughts and getting the greatest possible mental clarity).
""".strip()

FINAL_PROMPT = """
Now it is time to actually create the graph. The most important thing is that you should be thorough, concrete, and specific. Do not put down vague things. Always include some specific point, of the sort where if you saw it later in the context of giving a lesson, it would give you lots of points to grab onto, and information to spring from.

Output a single line with "NODES", followed by a set of JSON-formatted nodes like the following example:
{ "order_index": 1, "summary": "A brief title-like summary describing the main concept", "content": "Up to a few paragraphs or half a dozen bullet points that are the key things to understand about this concept. It is better to have too much than too little.", "supporting_quotes": [ "A quote that is verbatim from the material, supporting the content above", "Another quote that is verbatim from the material and supports the content, if there are non-contiguous ones. Feel free to have long quotes." ] }
The "order_index" property should show in which order the concepts the nodes represent appear in the text. You should start at 1, and then increment by 1 for each following node.
Then, output a single line saying "EDGES", followed by a set of JSON-formatted edges describing prerequisite relationships, as defined above, like the following example:
{"parent_index": 1, "child_index": 2}
where "parent_index" is the order_index of the parent, and the "child_index" is the order index of the child.

If you need to finish some lines of thought, you can brainstorm at the start of your response. In particular, you want to be prepared to get specific and concrete, especially for each node's "content" field. But after that, output "NODES" on a single line, and after that your output must be entirely structured: list the nodes, output a blank line and then "EDGES", list the edges, and end. You should keep going as long as you need to, but every node and edge needs to be valid JSON.
""".strip()


SESSION_SYSTEM_PROMPT = """
You are a helpful socratic tutor guiding a learner through various concepts. You are given the ground truth pdf document that contains information about all concepts, and a list of "knowledge nodes" that the learner wants to learn about the document. You should ask questions to the user to help them learn the concepts, and give them feedback on their responses. Your questions should be clear, such that the answer is unambiguous. Imagine you are asking an Anki flashcard question. You should not mention the existence of nodes to the user.

Each node is equipped with a summary, content and supporting quotes from the original document. You will be given a list of nodes that the learner has already learned at least once, that they should review. You will also be given a list of nodes that the learner has not yet learned, that they should learn.

You have judgement over which nodes should be addressed, and in what order. You should try and ensure the reader understand the more basic concepts before progressing to the more complex ones. Your goal is to maximise the learner's understanding of the document. The learner can go on tangents, but you should try to keep them focused on the main concepts. 

You should output tags indicating which nodes are currently being studied at the start of each of your responses. For instance <current_node>1</current_node> would indicate that node 1 is currently being studied. Once a node is complete, you should output <node_complete>1 judgement</node_complete> where judgement is one of "easy", "good", "hard" or "failed". For instance, if the learner struggled to understand a node, you might output <node_complete>1 hard</node_complete>, but if they understood it well, you might output <node_complete>1 good</node_complete>. 

If a user struggles with a concept, you should move on after a few attempts. If they understand it well, you should move on to the next concept immediately.

Here is the document content:
{document_content}

Here are the nodes to address in this session. You don't need to address all of them. You should only try and address one node at a time.

NODES TO REVIEW:
{nodes_to_review}

NODES TO LEARN:
{nodes_to_learn}
""".strip()


def parse_graph_output(
    output: str,
) -> tuple[list[ContentMapNode], list[ContentMapEdge]]:
    nodes = []
    edges_pre = []

    lines = output.splitlines()
    # Skip empty lines and only parse lines that look like JSON
    node_start = next(i for i, line in enumerate(lines) if line.strip() == "NODES")
    node_end = next(
        i for i, line in enumerate(lines[node_start:]) if line.strip() == "EDGES"
    )

    for line in lines[
        node_start + 1 : node_start + node_end
    ]:  # Added +1 to skip "NODES" line
        if line.strip() and line.strip().startswith("{"):  # Only parse JSON lines
            nodes.append(ContentMapNode(**json.loads(line)))

    edge_start = next(i for i, line in enumerate(lines) if line.strip() == "EDGES")
    for line in lines[edge_start + 1 :]:  # Added +1 to skip "EDGES" line
        if line.strip() and line.strip().startswith("{"):  # Only parse JSON lines
            edges_pre.append(ContentMapEdgePreID(**json.loads(line)))

    # now, note that above we only have an order_index on nodes
    # but when creating a ContentMapNode, the actual final ID is auto-generated
    # so for the edges, we need to map the order_index to the actual ID

    node_index_to_id = {node.order_index: node.id for node in nodes}
    edges = []
    for edge in edges_pre:
        edges.append(
            ContentMapEdge(
                parent_id=node_index_to_id[edge.parent_index],
                child_id=node_index_to_id[edge.child_index],
            )
        )

    return nodes, edges


def format_node_for_session_prompt(node: ContentMapNode) -> str:
    node_dict = {
        "id": node.order_index,
        "content": node.content,
        "summary": node.summary,
        "supporting_quotes": node.supporting_quotes,
    }
    return json.dumps(node_dict, indent=2)

async def get_session_system_prompt(chat_session_id: str, client: Client):
    
    # Get document_id from chat_sessions table
    session_result = client.from_("chat_sessions").select("document_id").eq("id", chat_session_id).single().execute()
    if not session_result.data:
        raise HTTPException(status_code=404, detail="Chat session not found")
    document_id = session_result.data["document_id"]

    # Get document content
    document_content = get_document_content(document_id, client)
    base64_document_content = base64.b64encode(document_content).decode("utf-8")
    string_document_content = convert_base64_pdf_to_text(base64_document_content)

    # Get graph id
    graph_result = (
        client.from_("knowledge_graphs")
        .select("id")
        .eq("document_id", document_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    if not graph_result.data:
        raise HTTPException(status_code=404, detail="No knowledge graph found for document")
    graph_id = graph_result.data[0]["id"]
    # Get learning state
    learning_state = await get_graph_learning_state(graph_id, datetime.now(), client)
    nodes_to_review = [x.node for x in learning_state.to_review]
    nodes_not_yet_learned = [x.node for x in learning_state.not_yet_learned]
    
    formatted_nodes_to_review = "\n".join(format_node_for_session_prompt(node) for node in nodes_to_review)
    formatted_nodes_not_yet_learned = "\n".join(format_node_for_session_prompt(node) for node in nodes_not_yet_learned)

    return SESSION_SYSTEM_PROMPT.format(nodes_to_review=formatted_nodes_to_review, nodes_to_learn=formatted_nodes_not_yet_learned, document_content=string_document_content)
