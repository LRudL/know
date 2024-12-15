import asyncio
import os
import traceback
from datetime import datetime
from typing import AsyncGenerator

import anthropic

from src.api.ai.prompts import get_node_complete_prompt, get_session_system_prompt
from src.api.data import (
    get_chat_history,
    graph_id_and_node_order_index_to_node_id,
    session_id_to_graph_id,
    store_chat_message,
)
from src.api.graph import get_unlocked_nodes
from src.api.learning_progress import update_learning_progress
from src.api.models import LearningProgressUpdateData, LearningProgressUpdateRequest
from src.services import get_supabase_client
from src.services.security import get_user_id_from_token

MODEL_NAME = "claude-3-5-sonnet-20241022"
TOOLS = [
    {
        "name": "node_complete",
        "description": "Mark a node as complete with a judgement of 'easy', 'good', 'hard' or 'failed'.",
        "input_schema": {
            "type": "object",
            "properties": {
                "node_id": {"type": "integer"},
                "judgement": {
                    "type": "string",
                    "enum": ["easy", "good", "hard", "failed"],
                },
            },
            "required": ["node_id", "judgement"],
        },
    }
]


async def post_process_ai_response(
    node_order_index: int, judgement: str, session_id: str, supabase, token: str
):
    # Get the graph id from the session id
    graph_id = session_id_to_graph_id(session_id, supabase)

    # Get the node id from the graph id and node order index
    node_id = graph_id_and_node_order_index_to_node_id(graph_id, node_order_index, supabase)

    # Create a learning progress update request
    learning_progress_update_request = LearningProgressUpdateRequest(
        node_id=node_id,
        graph_id=graph_id,
        created_at=datetime.now(),
        update_data=LearningProgressUpdateData(quality=judgement),
        user_id=get_user_id_from_token(token),
    )

    # Update the learning progress
    await update_learning_progress(learning_progress_update_request, supabase)


def sanitize_for_stream(text: str) -> str:
    """
    Sanitize text for SSE streaming by:
    1. Replacing newlines with escaped newlines
    2. Escaping any already-escaped newlines
    3. Removing any characters that could break SSE format
    """
    return (
        text.replace("\n", "\\n")  # escape newlines
        .replace("\\n", "\\\\n")  # escape any pre-existing escaped newlines
        .replace("\r", "")  # remove carriage returns
    )


async def get_or_create_system_prompt(messages: list, session_id: str, supabase) -> tuple[str, list]:
    """
    Get system prompt from chat history or create and store it.
    Returns (system_prompt, updated_messages).
    """
    system_messages = [msg for msg in messages if msg["role"] == "system"]
    assert len(system_messages) <= 1, "Expected at most one system message"
    
    if len(system_messages) == 0:
        # No system prompt yet - create and store it
        system_prompt = await get_session_system_prompt(session_id, supabase)
        system_message = {"role": "system", "content": system_prompt}
        messages = await add_to_chat_history(session_id, system_message, messages, supabase)
        system_messages = [system_message]

    system_prompt = system_messages[0]["content"]
    messages = [msg for msg in messages if msg["role"] != "system"]
    return system_prompt, messages


async def add_to_chat_history(session_id: str, message: dict, messages: list, supabase) -> list:
    """
    Store a message in the database and return updated message list.
    Returns the complete message history including the new message.
    """
    await store_chat_message(session_id, message, supabase)
    return [*messages, message]


async def stream_chunks(
    stream, prefix: str = "", suffix: str = ""
) -> AsyncGenerator[tuple[str, str], None]:
    """
    Stream chunks from an Anthropic stream with logging.

    Args:
        stream: Anthropic stream object
        prefix: Optional prefix for streamed chunks (e.g. "<tool_use>")
        suffix: Optional suffix for streamed chunks (e.g. "</tool_use>")
    """
    for text in stream.text_stream:
        timestamp = datetime.now().isoformat()
        print(f"[{timestamp}] Sending chunk: {text}")
        safe_text = sanitize_for_stream(text)
        yield f"data: {prefix}{safe_text}{suffix}\n\n"
        await asyncio.sleep(0.1)

async def handle_ai_response(
    messages: list, system_prompt: str, client, session_id: str, supabase, prefix: str = "", suffix: str = ""
) -> AsyncGenerator[tuple[str, str], None]:
    stream = client.beta.prompt_caching.messages.stream(
        max_tokens=1024,
        system=system_prompt,
        messages=messages,
        model=MODEL_NAME,
        tools=TOOLS,
    ).__enter__()

    # Stream the response
    async for chunk in stream_chunks(stream, prefix=prefix, suffix=suffix):
        yield ("chunk", chunk)

    # Get the final message
    final_message = stream.get_final_message()

    messages = await add_to_chat_history(
        session_id,
        {
            "role": "assistant",
            "content": [x.model_dump() for x in final_message.content],
        },
        messages,
        supabase,
    )
    
    tool_use = [x for x in final_message.content if x.type == "tool_use"]
    
    yield ("final", (messages, tool_use))


async def handle_tool_use_response(
    tool_use: list,
    session_id: str,
    messages: list,
    system_prompt: str,
    client,
    supabase,
    token: str,
):
    """
    Handle tool use and get follow-up AI response.
    Yields chunks and updates messages list.
    """
    if len(tool_use) > 1:
        print("TOOL USE", tool_use)
        raise Exception("Expected at most one tool use")
    tool_use = tool_use[0]
    tool_use_id = tool_use.id
    tool_use_input = tool_use.input
    node_id = int(tool_use_input["node_id"])
    judgement = tool_use_input["judgement"].lower()
    await post_process_ai_response(node_id, judgement, session_id, supabase, token)

    unlocked_nodes = await get_unlocked_nodes(session_id, supabase)
    node_complete_prompt = get_node_complete_prompt(unlocked_nodes)

    # Store tool result message
    tool_result_message = {
        "role": "user",
        "content": [
            {
                "type": "tool_result",
                "tool_use_id": tool_use_id,
                "content": node_complete_prompt,
            }
        ],
    }
    messages = await add_to_chat_history(session_id, tool_result_message, messages, supabase)
    
    # Stream the tool use message
    yield ("chunk", sanitize_for_stream(f"<tool_use>TOOL_USE_ID: {tool_use_id}\n{node_complete_prompt}</tool_use>"))
    
    # Get second AI response
    async for result_type, result in handle_ai_response(
        messages, system_prompt, client, session_id, supabase
    ):
        if result_type == "chunk":
            yield ("chunk", result)
        elif result_type == "final":
            messages, tool_use = result
            if len(tool_use) > 0:
                raise Exception("Tool use should not be returned")
            yield ("final", messages)




async def handle_chat_stream(message: str, session_id: str, token: str):
    client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    supabase = get_supabase_client()
    
    # Get chat history and system prompt
    messages = await get_chat_history(session_id, supabase)
    system_prompt, messages = await get_or_create_system_prompt(messages, session_id, supabase)

    # Store user message
    user_message = {"role": "user", "content": message}
    messages = await add_to_chat_history(session_id, user_message, messages, supabase)

    try:
        # Get first AI response
        async for result_type, result in handle_ai_response(messages, system_prompt, client, session_id, supabase):
            if result_type == "chunk":
                yield result
            elif result_type == "final":
                messages, tool_use = result
                if len(tool_use) == 0:
                    print("No tool use")
                    continue
                # Deal with tool use
                async for result_type, result in handle_tool_use_response(
                    tool_use, session_id, messages, system_prompt, client, supabase, token
                ):
                    if result_type == "chunk":
                        yield result
                    elif result_type == "final":
                        messages = result



        yield "data: [END]\n\n"

    except Exception as e:
        print(f"[ERROR] Exception in generate: {str(e)}")
        print("[ERROR] Traceback:")
        print(traceback.format_exc())
        yield f"data: Error occurred: {str(e)}\n\n"
