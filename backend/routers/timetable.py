from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel

from deps import get_current_student
from services.gemini_service import extract_timetable_from_file
from services.supabase_client import supabase

router = APIRouter()

VALID_DAYS = {
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
}


class TimetableSlot(BaseModel):
    day: str
    time_start: str
    time_end: str
    subject: str
    room: str = ""
    faculty: str = ""


class ConfirmPayload(BaseModel):
    slots: list[TimetableSlot]


@router.post("/upload")
async def upload_timetable(
    file: UploadFile = File(...),
    student: dict = Depends(get_current_student),
):
    """Read an uploaded timetable file, extract slots via Gemini Vision, and store them."""
    file_bytes = await file.read()
    mime_type = file.content_type or "application/octet-stream"

    try:
        raw_slots = extract_timetable_from_file(file_bytes, mime_type)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to parse timetable: {exc}")

    slots = []
    for item in raw_slots:
        day = str(item.get("day", "")).strip().title()
        if day not in VALID_DAYS:
            continue
        slots.append(
            {
                "student_id": student["id"],
                "day": day,
                "time_start": str(item.get("time_start", "")).strip(),
                "time_end": str(item.get("time_end", "")).strip(),
                "subject": str(item.get("subject", "")).strip(),
                "room": str(item.get("room", "")).strip(),
                "faculty": str(item.get("faculty", "")).strip(),
            }
        )

    if not slots:
        raise HTTPException(status_code=422, detail="No valid timetable entries were extracted")

    # Replace any previously stored slots for this student
    supabase.table("timetable_slots").delete().eq("student_id", student["id"]).execute()
    insert_res = supabase.table("timetable_slots").insert(slots).execute()

    return {"slots": insert_res.data}


@router.post("/confirm")
def confirm_timetable(payload: ConfirmPayload, student: dict = Depends(get_current_student)):
    """Save the (possibly edited) slots and mark the student's timetable as confirmed."""
    slots = []
    for item in payload.slots:
        day = item.day.strip().title()
        if day not in VALID_DAYS:
            raise HTTPException(status_code=422, detail=f"Invalid day: {item.day}")
        slots.append(
            {
                "student_id": student["id"],
                "day": day,
                "time_start": item.time_start.strip(),
                "time_end": item.time_end.strip(),
                "subject": item.subject.strip(),
                "room": item.room.strip(),
                "faculty": item.faculty.strip(),
            }
        )

    supabase.table("timetable_slots").delete().eq("student_id", student["id"]).execute()
    if slots:
        supabase.table("timetable_slots").insert(slots).execute()

    supabase.table("profiles").update({"timetable_uploaded": True}).eq(
        "student_id", student["id"]
    ).execute()

    return {"status": "confirmed", "count": len(slots)}


@router.get("/today")
def today_classes(student: dict = Depends(get_current_student)):
    """Return today's timetable slots for the student, sorted by start time."""
    today_name = datetime.now().strftime("%A")
    res = (
        supabase.table("timetable_slots")
        .select("*")
        .eq("student_id", student["id"])
        .eq("day", today_name)
        .order("time_start")
        .execute()
    )
    return {"day": today_name, "slots": res.data}
