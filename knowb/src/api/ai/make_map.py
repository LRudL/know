import base64
from anthropic import Anthropic
import os

from src.api.structs import ContentMapEdge, ContentMapNode
from src.api.ai.prompts import BRAINSTORM_PROMPT, FINAL_PROMPT, parse_graph_output


def make_content_map(
    pdf_content: bytes,
) -> tuple[list[ContentMapNode], list[ContentMapEdge]]:
    # Ensure we have valid PDF content
    if not pdf_content.startswith(b"%PDF"):
        raise ValueError("Invalid PDF content received")

    # Use the exact same encoding process as the working example
    pdf_base64 = base64.b64encode(pdf_content).decode("utf-8")

    # Initialize Anthropic client
    client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

    # If we get here, proceed with brainstorming call
    interim_response = client.beta.messages.create(
        model="claude-3-5-sonnet-20240620",
        betas=["pdfs-2024-09-25"],
        max_tokens=4096,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "document",
                        "source": {
                            "type": "base64",
                            "media_type": "application/pdf",
                            "data": pdf_base64,
                        },
                    },
                    {
                        "type": "text",
                        "text": BRAINSTORM_PROMPT,
                    },
                ],
            }
        ],
    )

    print("INTERIM RESPONSE")
    print(interim_response.content[0].text)

    # Make final call with the brainstorming results
    final_response = client.beta.messages.create(
        model="claude-3-5-sonnet-20240620",
        betas=["pdfs-2024-09-25"],
        max_tokens=4096,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "document",
                        "source": {
                            "type": "base64",
                            "media_type": "application/pdf",
                            "data": pdf_base64,
                        },
                    },
                    {
                        "type": "text",
                        "text": BRAINSTORM_PROMPT,
                    },
                ],
            },
            {
                "role": "assistant",
                "content": interim_response.content[0].text,
            },
            {"role": "user", "content": FINAL_PROMPT},
        ],
    )

    print("FINAL RESPONSE")
    print(final_response.content[0].text)

    print("DONE")

    # Parse the response into nodes and edges
    nodes, edges = parse_graph_output(final_response.content[0].text)
    return nodes, edges
