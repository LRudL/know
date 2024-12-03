from dataclasses import dataclass
from src.services import supabase


@dataclass
class UserPrompt:
    id: str
    prompt_texts: dict


async def get_user_prompt(user_id: str | None) -> UserPrompt:
    """Get the user's current prompt (or default), returning both ID and texts."""

    # Get prompt_id from user settings if it exists
    if user_id:
        settings = (
            supabase.from_("user_settings")
            .select("current_prompt_id")
            .eq("user_id", user_id)
            .single()
            .execute()
        )
        prompt_id = settings.data.get("current_prompt_id") if settings.data else None
    else:
        prompt_id = None

    # Get the prompt data (either user-selected or default)
    prompt_query = supabase.from_("prompts").select("id, prompt_texts")

    if prompt_id:
        prompt_query = prompt_query.eq("id", prompt_id)
    else:
        prompt_query = prompt_query.is_("user_id", None)

    result = prompt_query.single().execute()

    if not result.data:
        raise ValueError("No prompt found (neither user-selected nor default)")

    return UserPrompt(id=result.data["id"], prompt_texts=result.data["prompt_texts"])
