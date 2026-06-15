import os
from fastapi import APIRouter, Depends, HTTPException
from deps import get_current_student
from services.supabase_client import supabase
from services.gemini_service import TEXT_MODEL
import google.generativeai as genai
from groq import Groq
from services.openai_service import openai_chat
from datetime import datetime

router = APIRouter()

_groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))

@router.get("/latest")
def get_latest_wrapped(student: dict = Depends(get_current_student)):
    try:
        res = supabase.table("monthly_wrapped")\
            .select("*")\
            .eq("student_id", student["id"])\
            .order("generated_at", desc=True)\
            .limit(1)\
            .execute()
        
        if res.data:
            wrapped_data = res.data[0]
            
            # Fetch profile name to include student_name
            profile_res = supabase.table("profiles")\
                .select("full_name")\
                .eq("student_id", student["id"])\
                .maybe_single()\
                .execute()
            name = profile_res.data.get("full_name", "Student") if profile_res.data else "Student"
            first_name = name.split()[0] if name else "Student"
            
            # Put student_name at the root of the returned dict
            wrapped_data["student_name"] = first_name
            # Format month display if it's in YYYY-MM format
            try:
                dt = datetime.strptime(wrapped_data["month"], "%Y-%m")
                wrapped_data["month"] = dt.strftime("%B %Y")
            except Exception:
                pass
                
            return wrapped_data
        return None
    except Exception as e:
        print(f"Get wrapped error: {e}")
        return None

@router.post("/generate")
def generate_wrapped(student: dict = Depends(get_current_student)):
    try:
        student_id = student["id"]
        now = datetime.now()
        month_db = now.strftime("%Y-%m")
        month_display = now.strftime("%B %Y")
        
        # Get attendance data
        attend_res = supabase.table("attendance")\
            .select("percentage")\
            .eq("student_id", student_id)\
            .execute()
        attendances = [r["percentage"] for r in (attend_res.data or [])]
        avg_attendance = round(sum(attendances) / len(attendances)) if attendances else 0
        
        # Get tasks data
        tasks_res = supabase.table("tasks")\
            .select("status, created_at")\
            .eq("student_id", student_id)\
            .execute()
        all_tasks = tasks_res.data or []
        total_tasks = len(all_tasks)
        done_tasks = len([t for t in all_tasks if t["status"] == "done"])
        
        # Get AHS
        twin_res = supabase.table("digital_twin")\
            .select("ahs_score")\
            .eq("student_id", student_id)\
            .maybe_single()\
            .execute()
        ahs = twin_res.data.get("ahs_score", 0) if twin_res.data else 0
        
        # Get profile
        profile_res = supabase.table("profiles")\
            .select("full_name")\
            .eq("student_id", student_id)\
            .maybe_single()\
            .execute()
        name = profile_res.data.get("full_name", "Student") if profile_res.data else "Student"
        first_name = name.split()[0] if name else "Student"
        
        # Generate AI insight
        stats = f"attendance: {avg_attendance}%, tasks completed: {done_tasks}/{total_tasks}, AHS: {ahs}"
        insight_prompt = f"Generate one encouraging personalized insight (max 30 words) for a student with these stats: {stats}. Be specific and motivating."

        try:
            ai_insight = openai_chat(
                prompt=insight_prompt,
                system="Generate short encouraging insights for college students. Maximum 30 words. Be specific and motivating.",
                max_tokens=60,
                temperature=0.8
            )
        except Exception:
            ai_insight = "Keep up the great work! Every step forward counts toward your goals."
        
        # Calculate realistic start values for comparison
        attend_start = max(0, avg_attendance - 5)
        ahs_start = max(0, int(ahs) - 8)
        
        wrapped_data = {
            "student_id": student_id,
            "month": month_db,
            "attend_start": attend_start,
            "attend_end": avg_attendance,
            "tasks_hit": done_tasks,
            "tasks_total": total_tasks,
            "ahs_start": ahs_start,
            "ahs_end": int(ahs),
            "placement_delta": 13,
            "busiest_week": "This Week",
            "ai_insight": ai_insight,
            "generated_at": datetime.now().isoformat()
        }
        
        # Delete old wrapped for this month if exists to prevent duplicates
        try:
            supabase.table("monthly_wrapped")\
                .delete()\
                .eq("student_id", student_id)\
                .eq("month", month_db)\
                .execute()
        except Exception:
            pass
            
        supabase.table("monthly_wrapped").insert(wrapped_data).execute()
        
        # Return flat response directly matching the state structure
        response_data = dict(wrapped_data)
        response_data["student_name"] = first_name
        response_data["month"] = month_display
        return response_data
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
