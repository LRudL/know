from fastapi.security import HTTPBearer
from fastapi import HTTPException
import jwt
import os

security = HTTPBearer()


def get_user_id_from_token(token: str) -> str:
    """Extract user_id from a JWT token using SUPABASE_JWT_SECRET."""
    try:
        jwt_secret = os.getenv("SUPABASE_JWT_SECRET")
        if jwt_secret is None:
            raise HTTPException(status_code=500, detail="JWT secret not configured")

        payload = jwt.decode(
            token.credentials,
            jwt_secret,
            algorithms=["HS256"],
            audience="authenticated",
        )
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=401, detail="Invalid token: no user ID found"
            )
        return user_id
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")
