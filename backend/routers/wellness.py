import datetime
import traceback
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from deps import get_current_student
from services.supabase_client import supabase

router = APIRouter()


class MoodPayload(BaseModel):
    stress_score: int
    emoji: str
    note: str = ""


class ToggleExamPayload(BaseModel):
    exam_week: bool


class ToggleWellnessPayload(BaseModel):
    wellness_flag: bool


def get_current_week_str() -> str:
    today = datetime.date.today()
    year, week_num, _ = today.isocalendar()
    return f"{year}-W{week_num:02d}"


@router.post("/mood")
def log_mood(payload: MoodPayload, student: dict = Depends(get_current_student)):
    try:
        if not (1 <= payload.stress_score <= 10):
            raise HTTPException(status_code=400, detail="Stress score must be between 1 and 10")

        week_str = get_current_week_str()
        
        data = {
            "student_id": student["id"],
            "stress_score": payload.stress_score,
            "emoji": payload.emoji.strip(),
            "note": payload.note.strip(),
            "week": week_str,
            "logged_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
        }

        res = supabase.table("mood_logs").insert(data).execute()
        if not res.data:
            raise HTTPException(status_code=500, detail="Failed to log mood")

        # After logging mood, recalculate twin stats
        recalculate_twin_wellness(student["id"])

        return res.data[0]
    except HTTPException:
        raise
    except Exception as e:
        print(f"ERROR in log_mood: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/history")
def get_mood_history(student: dict = Depends(get_current_student)):
    try:
        res = (
            supabase.table("mood_logs")
            .select("*")
            .eq("student_id", student["id"])
            .order("logged_at", desc=True)
            .limit(7)
            .execute()
        )
        return res.data or []
    except Exception as e:
        print(f"ERROR in get_mood_history: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/twin")
def get_twin_wellness(student: dict = Depends(get_current_student)):
    try:
        student_id = student["id"]
        
        # 1. Query digital twin
        twin_res = supabase.table("digital_twin").select("*").eq("student_id", student_id).maybe_single().execute()
        
        if not twin_res or not twin_res.data:
            # Create a default digital twin if it doesn't exist
            from services.ahs_service import compute_ahs
            ahs_data = compute_ahs(student_id)
            
            insert_res = supabase.table("digital_twin").insert({
                "student_id": student_id,
                "ahs_score": ahs_data["ahs_score"],
                "data": ahs_data,
                "wellness_flag": False,
                "exam_week": False
            }).execute()
            twin = insert_res.data[0] if insert_res.data else {}
        else:
            twin = twin_res.data

        # 2. Get average stress score for the current week
        week_str = get_current_week_str()
        mood_res = supabase.table("mood_logs").select("stress_score").eq("student_id", student_id).eq("week", week_str).execute()
        mood_logs = mood_res.data or []
        
        avg_stress = 0.0
        if mood_logs:
            avg_stress = sum(log["stress_score"] for log in mood_logs) / len(mood_logs)

        return {
            "wellness_flag": twin.get("wellness_flag", False),
            "exam_week": twin.get("exam_week", False),
            "ahs_score": twin.get("ahs_score", 0),
            "cognitive_load": twin.get("data", {}).get("cognitive_load", 20) if twin.get("data") else 20,
            "average_stress_score": round(avg_stress, 1)
        }
    except Exception as e:
        print(f"ERROR in get_twin_wellness: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/twin/toggle-exam")
def toggle_exam(payload: ToggleExamPayload, student: dict = Depends(get_current_student)):
    try:
        student_id = student["id"]
        
        # Check if digital_twin row exists
        twin_res = supabase.table("digital_twin").select("*").eq("student_id", student_id).maybe_single().execute()
        if not twin_res or not twin_res.data:
            # Create it
            supabase.table("digital_twin").insert({
                "student_id": student_id,
                "exam_week": payload.exam_week
            }).execute()
        else:
            supabase.table("digital_twin").update({
                "exam_week": payload.exam_week
            }).eq("student_id", student_id).execute()

        recalculate_twin_wellness(student_id)
        
        return {"success": True, "exam_week": payload.exam_week}
    except Exception as e:
        print(f"ERROR in toggle_exam: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/twin/toggle-wellness")
def toggle_wellness(payload: ToggleWellnessPayload, student: dict = Depends(get_current_student)):
    try:
        student_id = student["id"]
        
        # Check if digital_twin row exists
        twin_res = supabase.table("digital_twin").select("*").eq("student_id", student_id).maybe_single().execute()
        if not twin_res or not twin_res.data:
            # Create it
            supabase.table("digital_twin").insert({
                "student_id": student_id,
                "wellness_flag": payload.wellness_flag
            }).execute()
        else:
            supabase.table("digital_twin").update({
                "wellness_flag": payload.wellness_flag
            }).eq("student_id", student_id).execute()

        return {"success": True, "wellness_flag": payload.wellness_flag}
    except Exception as e:
        print(f"ERROR in toggle_wellness: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


def recalculate_twin_wellness(student_id: str):
    """Update digital twin metrics in DB."""
    try:
        from services.ahs_service import compute_ahs
        ahs_data = compute_ahs(student_id)
        
        # Fetch current digital twin to check exam_week and wellness_flag
        twin_res = supabase.table("digital_twin").select("exam_week, wellness_flag").eq("student_id", student_id).maybe_single().execute()
        twin = twin_res.data if twin_res else {}
        
        exam_week = twin.get("exam_week", False)
        
        # Adjust cognitive load and AHS breakdown message based on mood, exam mode, etc.
        # Average stress score
        week_str = get_current_week_str()
        mood_res = supabase.table("mood_logs").select("stress_score").eq("student_id", student_id).eq("week", week_str).execute()
        mood_logs = mood_res.data or []
        avg_stress = sum(log["stress_score"] for log in mood_logs) / len(mood_logs) if mood_logs else 3.0
        
        # Calculate digital twin cognitive load adjustment
        # Base load is calculated in ahs_service, but we can override or adjust it
        base_cog_load = ahs_data.get("cognitive_load", 20)
        
        # Stress level of 7+ adds cognitive load
        stress_adjustment = max(0, int((avg_stress - 5.0) * 8))
        # Exam week adds significant cognitive load
        exam_adjustment = 30 if exam_week else 0
        
        new_cog_load = min(100, max(0, base_cog_load + stress_adjustment + exam_adjustment))
        ahs_data["cognitive_load"] = new_cog_load
        
        # Re-calculate aggregate AHS score taking adjusted cognitive load into account
        # AHS component weights: Attendance 30%, Deadlines 25%, Placement 25%, Cog Load 20%
        att_w = ahs_data.get("attendance_score", 50) * 0.3
        dead_w = ahs_data.get("deadline_score", 50) * 0.25
        place_w = ahs_data.get("placement_score", 0) * 0.25
        cog_w = (100 - new_cog_load) * 0.2
        
        new_ahs_score = int(att_w + dead_w + place_w + cog_w)
        
        # Format custom breakdown message
        exam_str = " | Exam Mode ACTIVE" if exam_week else ""
        mood_str = f" | Weekly Stress: {round(avg_stress, 1)}/10" if mood_logs else ""
        ahs_data["breakdown"] = f"Attendance {int(ahs_data.get('attendance_score', 0))}% • Deadlines {int(ahs_data.get('deadline_score', 0))}% • Load {new_cog_load}%{exam_str}{mood_str}"
        
        supabase.table("digital_twin").update({
            "ahs_score": new_ahs_score,
            "data": ahs_data,
            "updated_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
        }).eq("student_id", student_id).execute()
        
    except Exception as e:
        print(f"Error in recalculate_twin_wellness: {e}")
        traceback.print_exc()
