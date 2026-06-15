import traceback
from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from deps import get_current_student
from services.supabase_client import supabase

router = APIRouter()


class CreateEventPayload(BaseModel):
    club_name: str
    event_name: str
    event_date: date
    venue: str
    description: str
    registration_deadline: date
    eligibility: str
    category: str = "general"
    open_to: str = "all"


@router.get("/events")
def get_club_events(student: dict = Depends(get_current_student)):
    try:
        # Get student's college
        profile_res = (
            supabase.table("profiles")
            .select("college")
            .eq("student_id", student["id"])
            .maybe_single()
            .execute()
        )
        profile = profile_res.data if profile_res else None
        if not profile or not profile.get("college"):
            # If student profile hasn't set their college, return empty list
            return []

        college = profile["college"]
        today = date.today().isoformat()

        # Query all upcoming events for this college
        res = (
            supabase.table("club_events")
            .select("*")
            .eq("college", college)
            .gte("event_date", today)
            .order("event_date")
            .execute()
        )

        return res.data or []
    except Exception as e:
        print(f"ERROR in get_club_events: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/events")
def create_club_event(
    payload: CreateEventPayload, student: dict = Depends(get_current_student)
):
    try:
        # Get student's college
        profile_res = (
            supabase.table("profiles")
            .select("college")
            .eq("student_id", student["id"])
            .maybe_single()
            .execute()
        )
        profile = profile_res.data if profile_res else None
        if not profile or not profile.get("college"):
            raise HTTPException(
                status_code=400,
                detail="Your profile is not complete. Please complete onboarding first.",
            )

        college = profile["college"]

        data = payload.dict()
        data["college"] = college
        data["uploaded_by"] = student["id"]
        # Convert date objects to string format for Postgres
        data["event_date"] = data["event_date"].isoformat()
        data["registration_deadline"] = data["registration_deadline"].isoformat()

        res = supabase.table("club_events").insert(data).execute()
        if not res.data:
            raise HTTPException(status_code=500, detail="Failed to create club event")

        return res.data[0]
    except HTTPException:
        raise
    except Exception as e:
        print(f"ERROR in create_club_event: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
