from datetime import datetime
from typing import Literal

from pydantic import BaseModel
from supabase import Client

from src.api.data import document_id_to_graph_id, session_id_to_document_id
from src.api.learning_progress import GraphLearningState, NodeState
from src.api.models import ContentMapNode, LearningProgress

Graph = dict[str, "GraphNode"]
State = Literal["not_yet_learned", "past", "to_review"]


class GraphNode(BaseModel):
    node: ContentMapNode
    state: State
    children: list["GraphNode"]
    parents: list["GraphNode"]
    unlocked: bool = False


def get_state(learning_progress: LearningProgress | None) -> State:
    if learning_progress is None:
        # no learning progress exists
        return "not_yet_learned"
    elif learning_progress.spaced_rep_state.next_review.replace(
        tzinfo=None
    ) > datetime.now().replace(tzinfo=None):
        # next review is in the past
        return "past"
    else:
        # next review is in the future
        return "to_review"


def build_graph(graph_id: str, client: Client) -> Graph:
    # this is a bit cursed but it works

    graph: Graph = {}

    # get learning progress
    learning_progress_result = (
        client.from_("learning_progress").select("*").eq("graph_id", graph_id).execute()
    )
    learning_progresses = [
        LearningProgress.model_validate(item) for item in learning_progress_result.data
    ]

    # get the nodes
    nodes_result = client.from_("graph_nodes").select("*").eq("graph_id", graph_id).execute()
    nodes = [ContentMapNode.model_validate(node) for node in nodes_result.data]

    # Get the edges
    edges_result = client.from_("graph_edges").select("*").eq("graph_id", graph_id).execute()

    # Create lookup dict for learning progress by node_id
    state_by_node_id = {lp.node_id: get_state(lp) for lp in learning_progresses}

    print(f"[DEBUG] State by node ID: {state_by_node_id.keys()}")

    # Create nodes dict
    nodes_by_id = {node.id: node for node in nodes}

    print(f"[DEBUG] Nodes by ID: {nodes_by_id.keys()}")

    # create all nodes
    for node in nodes:
        graph[node.id] = GraphNode(
            node=node,
            state=state_by_node_id.get(node.id, "not_yet_learned"),
            children=[],
            parents=[],
        )

    # add all children
    for edge in edges_result.data:
        parent_id = edge["parent_id"]
        child_id = edge["child_id"]
        graph[parent_id].children.append(graph[child_id])
        graph[child_id].parents.append(graph[parent_id])

    # iterate over all nodes. mark them as unlocked if they either have no parent nodes or all their parent nodes have state "past", but if their state is "past" then they should not be unlocked
    for node_id in graph.keys():
        node = graph[node_id]
        # if no parents, then it is unlocked
        if not node.parents:
            node.unlocked = True
        # if all parents are past, then it is unlocked
        if all(parent.state == "past" for parent in node.parents):
            node.unlocked = True
        # if the node itself is past, then it is not unlocked, as we don't want to revisit it
        if node.state == "past":
            node.unlocked = False

    return graph


async def get_unlocked_nodes(session_id: str, client: Client) -> list[ContentMapNode]:
    """Get the list of valid nodes for a session"""
    graph_id = document_id_to_graph_id(session_id_to_document_id(session_id, client), client)
    unlocked_nodes = [node.node for node in build_graph(graph_id, client).values() if node.unlocked]
    print(f"[DEBUG] Unlocked node IDs: {[node.id for node in unlocked_nodes]}")
    return unlocked_nodes


"""
Want to deprecate this but cant yet
"""


async def get_graph_learning_state(
    graph_id: str, date: datetime, client: Client
) -> GraphLearningState:
    """Get learning state for all nodes in a graph"""
    learning_progress_result = (
        client.from_("learning_progress").select("*").eq("graph_id", graph_id).execute()
    )
    # Use model_validate instead of manual conversion for converting SQL rows to LearningProgress
    learning_progresses = [
        LearningProgress.model_validate(item) for item in learning_progress_result.data
    ]

    # get the nodes
    nodes_result = client.from_("graph_nodes").select("*").eq("graph_id", graph_id).execute()
    # Use model_validate for nodes too
    nodes = [ContentMapNode.model_validate(node) for node in nodes_result.data]

    # Create lookup dict for learning progress by node_id
    progress_by_node = {lp.node_id: lp for lp in learning_progresses}

    past = []
    to_review = []
    not_yet_learned = []

    # Categorize each node
    for node in nodes:
        progress = progress_by_node.get(node.id)

        if not progress:
            # No learning progress exists
            not_yet_learned.append(NodeState(node=node, spaced_rep_state=None))
            continue

        state = progress.spaced_rep_state
        if not state.next_review:
            # No next review scheduled yet
            not_yet_learned.append(NodeState(node=node, spaced_rep_state=state))
        elif state.next_review > date:
            # Next review is in the future
            past.append(NodeState(node=node, spaced_rep_state=state))
        else:
            # Next review is due (in the past or present)
            to_review.append(NodeState(node=node, spaced_rep_state=state))

    # sort by node.order_index in each list
    past.sort(key=lambda x: x.node.order_index)
    to_review.sort(key=lambda x: x.node.order_index)
    not_yet_learned.sort(key=lambda x: x.node.order_index)

    return GraphLearningState(past=past, to_review=to_review, not_yet_learned=not_yet_learned)
