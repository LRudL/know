import base64
import json

from supabase import Client

from src.api.data import session_id_to_document_id
from src.api.graph import get_unlocked_nodes
from src.api.pdf2text import convert_base64_pdf_to_text
from src.api.routes.content_map import get_document_content
from src.api.models import ContentMapEdge, ContentMapEdgePreID, ContentMapNode

SESSION_SYSTEM_PROMPT = """
You are a helpful socratic tutor guiding a learner through various concepts. You are given the ground truth document that contains information about all concepts, and a list of "knowledge nodes" that the learner wants to learn about the document. You should ask questions to the learner to help them learn the knowledge nodes, and give them feedback on their responses. You should not mention the existence of nodes to the learner, except for within <thinking> tags, which will not be shown to the learner.

Each node is equipped with an id, summary, content and supporting quotes from the original document. You will be given a list of nodes that the learner has not yet learned, that they should learn. For these nodes, you should aim to cover all of the content thoroughly. Ask learners socratic questions. If you ask a question and the learner does not know the answer, try to help them discover the answer from first principles rather than telling them. If the learner still cannot discover the information, or it is information they could not discover from first principles, briefly provide the information and integrate it into your next question.

You may also be given a list of nodes that the learner has already learned at least once, that they should review. Reviews should be much briefer than concepts that the learner has not yet learned. Ask less questions, focused on recalling what the learner has already learned. Use these questions to ensure the learner still understands the concepts. If they do not, help them rediscover it from first principles.

You have judgement over which nodes should be addressed, and in what order. You should try and ensure the learner understands the more basic concepts before progressing to the more complex ones. Your goal is to maximise the learner's understanding of the document. The learner can go on tangents, but you should address them quickly and link them back to the main concepts.

In this environment you have access to a tool called "node_complete". You should use this tool when you wish to move on to to teaching a new topic, and after the user has satisfactorily answered, or spent significant effort on, a node. You can pass in a judgement of "easy", "good", "hard" or "failed", with the following meanings:
- easy: learner answered correctly with minimal guidance
- good: learner answered correctly but needed some hints
- hard: learner required significant help but eventually understood
- failed: learner couldn't grasp the concept despite assistance
Upon using this tool, you will be returned a new set of nodes to teach next. After receiving the outputs of this tool, you should think through your next set of questions once more in <thinking> tags, and then respond with your next set of questions. It is very important that you ask a question after receiving this tool's output.

Here is the document content:
{document_content}

Here are the nodes you could choose from to address first.

NODES TO ADDRESS:
{nodes_to_address}

Use <thinking> tags to indicate your initial plan. Before each response, feel free to use <thinking> tags to change your plans.
""".strip()

TOOL_USE_ATTACHMENT = """
NODES TO ADDRESS:
{nodes_to_address}
""".strip()

BRAINSTORM_PROMPT = """
We are going to convert the attached document into a graph structure. The nodes will be individual concepts, though perhaps containing a few distinct facts or facets. The edges will be prerequisite relationships. There should be an edge between node A and node B if node B is a concept that requires node A to understand, or if any sensible path to learning these concepts puts node A before node B. Do not use edges for just nodes being related to each other. You can assume edges are transitive; if an A-->B edge exists and B-->C edge exists, then the A-->C prerequisite is implicit and should not be listed separately.

We are going to convert EVERYTHING in the attached document. Be comprehensive. We want to create a brilliant, insightful concept map that an intelligent learner could follow to quickly grasp the key concrete points.

You are going to start by thinking out-loud about the best approach to use. What's the underlying structure of the concepts in the document? What are the key things that need to be understood about it? What is a path someone might follow to invent it for themselves, node-by-node, if they had a helpful socratic tutor guiding them along with the right questions and prods through the concept map? You want to AVOID a generic, "here's a list of vague concepts" approach. You want to instead imagine you're a brilliant tutor for an intelligent student, doing preparation work for an extended, detailed deep-dive into the material where you focus on key concrete points, and really *grok* the material and its connections at a deep level. 

Reflect on the material in light of the above, develop your understanding of it, list key concepts and dependencies. This is the initial brainstorm (later, you will generate the graph based on this, but for now stick to just outlining your thoughts and getting the greatest possible mental clarity).
""".strip()

FINAL_PROMPT = """
Now it is time to actually create the graph. The most important thing is that you should be thorough, concrete, and specific. Do not put down vague things. Always include some specific point, of the sort where if you saw it later in the context of giving a lesson, it would give you lots of points to grab onto, and information to spring from.

Output a single line with "NODES", followed by a JSON list containing nodes. For example: 
[
    { "order_index": 1, "summary": "A brief title-like summary describing the main concept", "content": "Up to a few paragraphs or half a dozen bullet points that are the key things to understand about this concept. It is better to have too much than too little.", "supporting_quotes": [ "A quote that is verbatim from the material, supporting the content above", "Another quote that is verbatim from the material and supports the content, if there are non-contiguous ones. Feel free to have long quotes." ] },
    { "order_index": 2, "summary": "Another example title", "content": "Some more bullet points on this concept", "supporting_quotes": [ "Feel free to include long quotes from the material." ] }
]

The "order_index" property should show in which order the concepts the nodes represent appear in the text. You should start at 1, and then increment by 1 for each following node, going in the order they appear in the text.

Then, output a single line saying "EDGES", followed by a JSON list of edges describing prerequisite relationships, as defined above, in the following format:
[
    {"parent_index": 1, "child_index": 2},
    {"parent_index": 1, "child_index": 2},
    {"parent_index": 2, "child_index": 3}
]
where "parent_index" is the order_index of the parent, and the "child_index" is the order index of the child.

If you need to finish some lines of thought, you can brainstorm at the start of your response. In particular, you want to be prepared to get specific and concrete, especially for each node's "content" field. But after that, output "NODES" on a single line, and after that your output must be entirely structured: list the nodes, output a blank line and then "EDGES", list the edges, and end. You should keep going as long as you need to, but every node and edge needs to be valid JSON.
""".strip()


def parse_graph_output(
    output: str,
) -> tuple[list[ContentMapNode], list[ContentMapEdge]]:
    # Split into nodes and edges sections
    sections = output.split("EDGES")
    if len(sections) != 2:
        raise ValueError("Output must contain exactly one 'EDGES' delimiter")

    # Find and parse the nodes JSON array
    nodes_section = sections[0].split("NODES")[1].strip()
    try:
        nodes = [ContentMapNode(**node) for node in json.loads(nodes_section)]
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid JSON in nodes section: {e}")

    # Parse the edges JSON array
    edges_section = sections[1].strip()
    try:
        edges_pre = [ContentMapEdgePreID(**edge) for edge in json.loads(edges_section)]
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid JSON in edges section: {e}")

    # Map order_index to actual IDs
    node_index_to_id = {node.order_index: node.id for node in nodes}
    edges = [
        ContentMapEdge(
            parent_id=node_index_to_id[edge.parent_index],
            child_id=node_index_to_id[edge.child_index],
        )
        for edge in edges_pre
    ]

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
    document_id = session_id_to_document_id(chat_session_id, client)

    # Get document content
    document_content = get_document_content(document_id, client)
    base64_document_content = base64.b64encode(document_content).decode("utf-8")
    string_document_content = convert_base64_pdf_to_text(base64_document_content)[:1000]

    # Get learning state
    unlocked_nodes = await get_unlocked_nodes(chat_session_id, client)

    formatted_nodes_to_address = "\n".join(
        format_node_for_session_prompt(node) for node in unlocked_nodes
    )

    return SESSION_SYSTEM_PROMPT.format(
        nodes_to_address=formatted_nodes_to_address,
        document_content=string_document_content,
    )


def get_node_complete_prompt(nodes_to_address: list[ContentMapNode]) -> str:
    formatted_nodes_to_address = "\n".join(
        format_node_for_session_prompt(node) for node in nodes_to_address
    )
    return TOOL_USE_ATTACHMENT.format(nodes_to_address=formatted_nodes_to_address)
