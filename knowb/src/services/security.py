from fastapi.security import HTTPBearer
from fastapi import HTTPException
from src.services import get_supabase_client

security = HTTPBearer()


def get_user_id_from_token(token: str) -> str:
    """Extract user_id from a Supabase JWT token using the Supabase client."""
    try:
        # Get Supabase client with the token
        client = get_supabase_client(token)

        # Get user data from Supabase
        user = client.auth.get_user(token.credentials)

        if not user or not user.user.id:
            raise HTTPException(
                status_code=401, detail="Invalid token: no user ID found"
            )

        return user.user.id
    except Exception as e:
        print("Token validation error:", str(e))
        raise HTTPException(
            status_code=401, detail=f"Token validation failed: {str(e)}"
        )
