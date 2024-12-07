import asyncio
from datetime import datetime
import os
import anthropic
from fastapi import HTTPException

from src.services.security import get_user_id_from_token
from src.api.graph import get_unlocked_nodes
from src.api.learning_progress import update_learning_progress
from src.api.data import graph_id_and_node_order_index_to_node_id, session_id_to_graph_id
from src.api.models import LearningProgressUpdateData, LearningProgressUpdateRequest
from src.api.ai.prompts import get_node_complete_prompt, get_session_system_prompt
from src.services import get_supabase_client


async def post_process_ai_response(full_ai_response: str, session_id: str, supabase, token: str) -> bool:
    # If the AI response contains a "node complete" tag, we need to update the knowledge graph with the new node.
    if "<node_complete>" not in full_ai_response:
        return False
        
    print("[DEBUG] Node complete tag found in AI response")
    
    # Get the tag contents
    node_complete_tag = full_ai_response.split("<node_complete>")[1].split("</node_complete>")[0]
    print(f"[DEBUG] Node complete tag contents: {node_complete_tag}")
    
    node_order_index = int(node_complete_tag.split(" ")[0])
    node_quality = node_complete_tag.split(" ")[1]
    
    # Get the graph id from the session id
    graph_id = session_id_to_graph_id(session_id, supabase)
    
    # Get the node id from the graph id and node order index
    node_id = graph_id_and_node_order_index_to_node_id(graph_id, node_order_index, supabase)
    
    # Create a learning progress update request
    learning_progress_update_request = LearningProgressUpdateRequest(
        node_id=node_id,
        graph_id=graph_id,
        created_at=datetime.now(),
        update_data=LearningProgressUpdateData(quality=node_quality),
        user_id=get_user_id_from_token(token)
    )

    # Update the learning progress
    await update_learning_progress(learning_progress_update_request, supabase)
    
    return True

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
    system_message = {
        "session_id": session_id,
        "content": {
            "role": "user",
            "content": [
                {"type": "text", "text": system_prompt}
            ],
        },
    }

    # Combine system prompt with chat history (so we dont have to add the long pdf content to the chat history)
    messages = [system_message["content"]] + [msg["content"] for msg in history_response.data]
    print(f"[DEBUG] Messages: {messages}")

    # Store user message
    user_message = {
        "session_id": session_id,
        "content": {"role": "user", "content": message},
    }
    user_msg_response = supabase.table("chat_messages").insert(user_message).execute()
    if hasattr(user_msg_response, "error") and user_msg_response.error:
        raise HTTPException(status_code=500, detail="Failed to store user message")

    # Create AI message entry
    ai_message = {
        "session_id": session_id,
        "content": {"role": "assistant", "content": ""},
    }
    ai_msg_response = supabase.table("chat_messages").insert(ai_message).execute()
    if hasattr(ai_msg_response, "error") and ai_msg_response.error:
        raise HTTPException(status_code=500, detail="Failed to create AI message entry")

    ai_message_id = ai_msg_response.data[0]["id"]
    full_ai_response = ""

    try:
        with client.beta.prompt_caching.messages.stream(
            max_tokens=1024,
            # betas=["pdfs-2024-09-25"],
            messages=[*messages, {"role": "user", "content": message}],
            model="claude-3-5-sonnet-20241022",
        ) as stream:
            for text in stream.text_stream:
                timestamp = datetime.now().isoformat()
                print(f"[{timestamp}] Sending chunk: {text}")
                full_ai_response += text
                # Replace newlines with escaped newlines and escape any existing escaped newlines
                safe_text = text.replace("\n", "\\n").replace("\\n", "\\\\n")
                yield f"data: {safe_text}\n\n"
                await asyncio.sleep(0.1)

        # Update the AI message with complete response
        supabase.table("chat_messages").update(
            {"content": {"role": "assistant", "content": full_ai_response}}
        ).eq("id", ai_message_id).execute()

        # Do some post processing depending on the full response
        node_complete = await post_process_ai_response(full_ai_response, session_id, supabase, token)
        
        print(f"[DEBUG] Node complete: {node_complete}")
        
        # If the node is complete, we need to grab the new list of valid nodes
        if node_complete:
            unlocked_nodes = await get_unlocked_nodes(session_id, supabase)
            node_complete_prompt = get_node_complete_prompt(unlocked_nodes)
            
            # create a new user message with the node complete prompt
            user_message = {
                "session_id": session_id,
                "content": {"role": "user", "content": node_complete_prompt},
            }
            supabase.table("chat_messages").insert(user_message).execute()
            
            # stream the new user message
            safe_text = node_complete_prompt.replace("\n", "\\n").replace("\\n", "\\\\n")
            yield f"data: {safe_text}\n\n"
            
            # stream ai responses to this in the same way we did before
            with client.beta.prompt_caching.messages.stream(
                max_tokens=1024,
                messages=[*messages, {"role": "user", "content": node_complete_prompt}],
                model="claude-3-5-sonnet-20241022",
            ) as stream:
                for text in stream.text_stream:
                    safe_text = text.replace("\n", "\\n").replace("\\n", "\\\\n")
                    yield f"data: {safe_text}\n\n"
                    await asyncio.sleep(0.1)
        
        yield "data: [END]\n\n"
        
        
    except Exception as e:
        print(f"[ERROR] Exception in generate: {str(e)}")
        yield f"data: Error occurred: {str(e)}\n\n"
