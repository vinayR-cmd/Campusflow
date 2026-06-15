import os
from fastapi import APIRouter, Depends, HTTPException
from deps import get_current_student
from services.supabase_client import supabase
from services.gemini_service import TEXT_MODEL
import google.generativeai as genai
from groq import Groq
from services.openai_service import openai_chat
from datetime import datetime, date

router = APIRouter()

_groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))

@router.get("/today")
def get_today_briefing(student: dict = Depends(get_current_student)):
    try:
        student_id = student["id"]
        today = date.today().isoformat()
        
        # Check cache
        cached = supabase.table("morning_briefings")\
            .select("*")\
            .eq("student_id", student_id)\
            .eq("briefing_date", today)\
            .maybe_single()\
            .execute()
        
        if cached and cached.data:
            return {
                "briefing": cached.data["content"],
                "tone": "normal",
                "generated_at": cached.data["created_at"]
            }
        
        # Get student data
        profile_res = supabase.table("profiles")\
            .select("full_name, branch, year, goal, college")\
            .eq("student_id", student_id)\
            .maybe_single()\
            .execute()
        profile = profile_res.data or {}
        name = profile.get("full_name", "Student")
        first_name = name.split()[0] if name else "Student"
        
        # Get today's classes
        today_name = datetime.now().strftime("%A")
        classes_res = supabase.table("timetable_slots")\
            .select("subject, time_start, time_end, room")\
            .eq("student_id", student_id)\
            .eq("day", today_name)\
            .order("time_start")\
            .execute()
        classes = classes_res.data or []
        
        # Get pending tasks due in 48hrs
        tasks_res = supabase.table("tasks")\
            .select("task, deadline, priority")\
            .eq("student_id", student_id)\
            .eq("status", "pending")\
            .limit(3)\
            .execute()
        tasks = tasks_res.data or []
        
        # Get attendance risks
        attend_res = supabase.table("attendance")\
            .select("subject, percentage")\
            .eq("student_id", student_id)\
            .eq("risk_level", "danger")\
            .execute()
        at_risk = attend_res.data or []
        
        # Get AHS
        twin_res = supabase.table("digital_twin")\
            .select("ahs_score")\
            .eq("student_id", student_id)\
            .maybe_single()\
            .execute()
        ahs = twin_res.data.get("ahs_score", 0) if twin_res.data else 0
        
        # Build briefing
        classes_text = ", ".join([f"{c['subject']} at {c['time_start']}" for c in classes[:3]]) if classes else "No classes today"
        tasks_text = ", ".join([t["task"][:30] for t in tasks[:2]]) if tasks else "No urgent deadlines"
        risk_text = ", ".join([r["subject"] for r in at_risk]) if at_risk else "None"
        
        prompt = f"""Generate a warm morning briefing for {first_name}, a {profile.get('branch','CSE')} student.
Today: {datetime.now().strftime('%A, %d %B %Y')}
Classes: {classes_text}
Urgent tasks: {tasks_text}
Attendance risk: {risk_text}
AHS Score: {ahs}/100
Goal: {profile.get('goal', 'Placement')}

Write 2-3 sentences maximum. Be warm, personal, and mention one specific thing from their day.
Do not use markdown. Plain text only."""

        try:
            briefing_text = openai_chat(
                prompt=prompt,
                system="You are a warm personal assistant for Indian college students. Generate concise personalized morning briefings in plain text.",
                model="gpt-4o-mini",
                max_tokens=200,
                temperature=0.7
            )
        except Exception as groq_err:
            print(f"OpenAI briefing generator hit error: {groq_err}")
            # Corrected fallback variable to profile.get('goal', 'Placement')
            briefing_text = f"Good morning, {first_name}! You have {len(classes)} classes scheduled for today. Keep an eye on your AHS score of {ahs}/100 and work towards your goal of {profile.get('goal', 'Placement')}."
        
        # Cache it
        try:
            supabase.table("morning_briefings").insert({
                "student_id": student_id,
                "briefing_date": today,
                "content": briefing_text,
            }).execute()
        except Exception:
            pass
        
        return {
            "briefing": briefing_text,
            "tone": "normal",
            "generated_at": datetime.now().isoformat()
        }
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/generate")
def regenerate_briefing(student: dict = Depends(get_current_student)):
    try:
        # Delete today's cache
        today = date.today().isoformat()
        supabase.table("morning_briefings")\
            .delete()\
            .eq("student_id", student["id"])\
            .eq("briefing_date", today)\
            .execute()
        # Generate fresh
        return get_today_briefing(student)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
