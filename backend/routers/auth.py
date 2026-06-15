from fastapi import APIRouter, Depends

from config import college_from_domain
from deps import get_current_student
from services.supabase_client import supabase

router = APIRouter()


@router.get("/detect-college")
def detect_college(email: str):
    """Auto-detect a known college from an email domain.

    Returns {known: true, college: "..."} for recognised domains
    (e.g. @kiet.edu -> "KIET Group of Institutions"), otherwise
    {known: false, college: null} so the frontend can show a free-text input.
    """
    college = college_from_domain(email)
    domain = email.split("@")[-1].lower() if "@" in email else ""
    return {"known": college is not None, "college": college, "domain": domain}


@router.get("/me")
def get_me(student: dict = Depends(get_current_student)):
    """Return the current student's profile and digital twin (or nulls if not created yet)."""
    profile_res = (
        supabase.table("profiles").select("*").eq("student_id", student["id"]).maybe_single().execute()
    )
    twin_res = (
        supabase.table("digital_twin").select("*").eq("student_id", student["id"]).maybe_single().execute()
    )

    return {
        "profile": profile_res.data if profile_res else None,
        "digital_twin": twin_res.data if twin_res else None,
    }
