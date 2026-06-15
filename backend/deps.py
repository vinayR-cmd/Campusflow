from fastapi import Header, HTTPException
from services.supabase_client import supabase


def get_current_student(authorization: str = Header(...)) -> dict:
    """Validate the Supabase JWT from the Authorization header and return {id, email}."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")

    token = authorization.split(" ", 1)[1]
    try:
        user_response = supabase.auth.get_user(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    user = user_response.user if user_response else None
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    return {"id": user.id, "email": user.email}
