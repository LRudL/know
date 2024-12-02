def generate_content_map(graph_id: str, document) -> tuple[list[dict], list[dict]]:
    # Create nodes (using the test data for now)
    nodes = [
        {
            "id": f"node_{i+1}",
            "graph_id": graph_id,
            "summary": f"node {i+1}",
            "content": "testing" * (i + 1),
            "supporting_quotes": ["I returned..."] if i == 0 else [],
            "order_index": i,
        }
        for i in range(3)
    ]

    # Create edges
    edges = [
        {
            "parent_id": "node_1",
            "child_id": "node_2",
            "graph_id": graph_id,  # Add graph_id to edges
        }
    ]

    return nodes, edges
