from fastapi import HTTPException
from supabase import create_client, Client
from dotenv import load_dotenv
import os

load_dotenv()


def get_supabase_client(access_token: str = None) -> Client:
    """Get a Supabase client - either admin or user-context"""
    url = os.getenv("SUPABASE_URL")
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

    print(f"[DEBUG] Using URL: {url}")
    print(f"[DEBUG] Service key starts with: {service_key[:20]}...")

    if not url or not service_key:
        raise Exception("Missing Supabase credentials")

    client = create_client(url, service_key)

    # Test the connection
    try:
        test_query = client.table("documents").select("count").execute()
        print(f"[DEBUG] Connection test result: {test_query}")
    except Exception as e:
        print(f"[DEBUG] Connection test error: {str(e)}")
        raise

    return client


# Default admin client
supabase = get_supabase_client()


def verify_token(token: str) -> dict:
    try:
        return supabase.auth.get_user(token)
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid token")
