from dataclasses import dataclass
import uuid


class ContentMapNode:
    def __init__(
        self, summary: str, content: str, supporting_quotes: list[str], order_index: int
    ):
        self.id = f"node_{uuid.uuid4().hex}"
        self.summary = summary
        self.content = content
        self.supporting_quotes = supporting_quotes
        self.order_index = order_index


@dataclass
class ContentMapEdgePreID:
    parent_index: int
    child_index: int


# NOTE: parent_index and child_index have to be converted to parent_id and child_id
# (this happens in prompts.py)
# also: the .id on ContentMapNode has to be converted into an actual id
@dataclass
class ContentMapEdge:
    parent_id: str
    child_id: str
