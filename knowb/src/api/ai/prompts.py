import json

from src.api.structs import ContentMapEdge, ContentMapEdgePreID, ContentMapNode


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
