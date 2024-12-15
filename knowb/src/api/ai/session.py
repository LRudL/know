import asyncio
import os
import traceback
from datetime import datetime

import anthropic
from fastapi import HTTPException

from src.api.ai.prompts import get_node_complete_prompt, get_session_system_prompt
from src.api.data import (
    graph_id_and_node_order_index_to_node_id,
    session_id_to_graph_id,
)
from src.api.graph import get_unlocked_nodes
from src.api.learning_progress import update_learning_progress
from src.api.models import LearningProgressUpdateData, LearningProgressUpdateRequest
from src.services import get_supabase_client
from src.services.security import get_user_id_from_token

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
    node_id = graph_id_and_node_order_index_to_node_id(
        graph_id, node_order_index, supabase
    )

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


def wrap_message(session_id: str, message: str):
    return {
        "session_id": session_id,
        "content": message,
    }


async def handle_chat_stream(message: str, session_id: str, token: str):
    client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    supabase = get_supabase_client()

    # Get chat history
    history_response = (
        supabase.table("chat_messages")
        .select("content")
        .eq("session_id", session_id)
        .order("created_at")
        .execute()
    )
    if hasattr(history_response, "error") and history_response.error:
        raise HTTPException(status_code=500, detail="Failed to fetch chat history")

    # Get system prompt
    system_prompt = await get_session_system_prompt(session_id, supabase)
    system_prompt = system_prompt[:100]
    system_message = {"role": "user", "content": system_prompt}

    # Combine system prompt with chat history (so we dont have to add the long pdf content to the chat history)
    messages = [system_message] + [msg["content"] for msg in history_response.data]

    # Store user message
    user_message = {"role": "user", "content": message}
    user_msg_response = (
        supabase.table("chat_messages")
        .insert(wrap_message(session_id, user_message))
        .execute()
    )
    if hasattr(user_msg_response, "error") and user_msg_response.error:
        raise HTTPException(status_code=500, detail="Failed to store user message")

    # Create AI message entry
    ai_message = {"role": "assistant", "content": ""}
    ai_msg_response = (
        supabase.table("chat_messages")
        .insert(wrap_message(session_id, ai_message))
        .execute()
    )
    if hasattr(ai_msg_response, "error") and ai_msg_response.error:
        raise HTTPException(status_code=500, detail="Failed to create AI message entry")

    ai_message_id = ai_msg_response.data[0]["id"]

    for msg in messages:
        print(f"[DEBUG] Message: {msg}")
        print("\n\n")

    print(f"[DEBUG] User message: {user_message}")

    try:
        # set up a stream
        stream = client.beta.prompt_caching.messages.stream(
            max_tokens=1024,
            messages=[*messages, {"role": "user", "content": message}],
            model="claude-3-5-sonnet-20241022",
            tools=TOOLS,
        ).__enter__()

        # Stream the response
        for text in stream.text_stream:
            timestamp = datetime.now().isoformat()
            print(f"[{timestamp}] Sending chunk: {text}")
            # Replace newlines with escaped newlines and escape any existing escaped newlines
            safe_text = text.replace("\n", "\\n").replace("\\n", "\\\\n")
            yield f"data: {safe_text}\n\n"
            await asyncio.sleep(0.1)

        # Get the final message
        final_message = stream.get_final_message()
        print(f"[DEBUG] Final message: {final_message}")
        text_response = [x for x in final_message.content if x.type == "text"][0].text
        tool_use = [x for x in final_message.content if x.type == "tool_use"]

        # Update the AI message with complete response
        supabase.table("chat_messages").update(
            {
                "content": {
                    "role": "assistant",
                    "content": [x.model_dump() for x in final_message.content],
                }
            }
        ).eq("id", ai_message_id).execute()

        # Update the chat history with the final message
        messages.append({"role": "assistant", "content": final_message.content})

        # If the AI used a tool, we need to post process the response
        if len(tool_use) > 0:
            print(f"[DEBUG] Tool use: {tool_use}")
            tool_use = tool_use[0]
            tool_use_id = tool_use.id
            tool_use_input = tool_use.input
            node_id = int(tool_use_input["node_id"])
            judgement = tool_use_input["judgement"].lower()
            await post_process_ai_response(
                node_id, judgement, session_id, supabase, token
            )

            unlocked_nodes = await get_unlocked_nodes(session_id, supabase)
            node_complete_prompt = get_node_complete_prompt(unlocked_nodes)

            # create a new user message with the node complete prompt
            user_message = {
                "role": "user",
                "content": [
                    {
                        "type": "tool_result",
                        "tool_use_id": tool_use_id,
                        "content": node_complete_prompt,
                    }
                ],
            }

            # Store the user message
            supabase.table("chat_messages").insert(
                wrap_message(session_id, user_message)
            ).execute()
            messages.append(user_message)

            # stream the new user message
            safe_text = node_complete_prompt.replace("\n", "\\n").replace(
                "\\n", "\\\\n"
            )
            yield f"data: <tool_use>{safe_text}</tool_use>\n\n"

            for msg in messages:
                print(f"[DEBUG] Message: {msg}")
                print("\n\n")

            # stream ai responses to this in the same way we did before
            stream = client.beta.prompt_caching.messages.stream(
                max_tokens=1024,
                messages=[*messages],
                model="claude-3-5-sonnet-20241022",
                tools=TOOLS,
            ).__enter__()

            for text in stream.text_stream:
                timestamp = datetime.now().isoformat()
                print(f"[{timestamp}] Sending chunk: {text}")
                safe_text = text.replace("\n", "\\n").replace("\\n", "\\\\n")
                yield f"data: {safe_text}\n\n"
                await asyncio.sleep(0.1)

        yield "data: [END]\n\n"

    except Exception as e:
        print(f"[ERROR] Exception in generate: {str(e)}")
        print("[ERROR] Traceback:")
        print(traceback.format_exc())
        yield f"data: Error occurred: {str(e)}\n\n"
