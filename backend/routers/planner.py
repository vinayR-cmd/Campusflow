import json
import traceback
from datetime import date, timedelta
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
import google.generativeai as genai
from services.openai_service import openai_chat

from deps import get_current_student
from services.supabase_client import supabase
from services.gemini_service import _extract_json, TEXT_MODEL

router = APIRouter()


class ApprovePayload(BaseModel):
    approved: bool


def generate_weekly_plan_with_gemini(student_id: str) -> list:
    """Generate weekly study plan using Gemini 2.5 Flash."""
    try:
        # 1. Fetch student profile
        profile_res = (
            supabase.table("profiles")
            .select("goal, skills, target_companies")
            .eq("student_id", student_id)
            .maybe_single()
            .execute()
        )
        profile = profile_res.data if profile_res else {}

        # 2. Fetch timetable slots
        slots_res = (
            supabase.table("timetable_slots")
            .select("day, time_start, time_end, subject")
            .eq("student_id", student_id)
            .execute()
        )
        slots = slots_res.data or []

        # 3. Fetch pending tasks
        tasks_res = (
            supabase.table("tasks")
            .select("task, subject, deadline, priority")
            .eq("student_id", student_id)
            .eq("status", "pending")
            .execute()
        )
        tasks = tasks_res.data or []

        # 4. Fetch digital twin wellness properties
        twin_res = (
            supabase.table("digital_twin")
            .select("ahs_score, data, exam_week")
            .eq("student_id", student_id)
            .maybe_single()
            .execute()
        )
        twin = twin_res.data if twin_res else {}

        # Format inputs for the prompt
        timetable_summary = {}
        for s in slots:
            day = s.get("day")
            if day not in timetable_summary:
                timetable_summary[day] = []
            timetable_summary[day].append(
                f"{s.get('time_start')}-{s.get('time_end')}: {s.get('subject')}"
            )

        task_summary = []
        for t in tasks:
            dl_str = f", Deadline: {t.get('deadline')[:10]}" if t.get("deadline") else ""
            task_summary.append(
                f"- {t.get('task')} (Subject: {t.get('subject') or 'General'}{dl_str}, Priority: {t.get('priority')})"
            )

        cog_load = 20
        if twin and twin.get("data"):
            cog_load = twin["data"].get("cognitive_load", 20)
        exam_week = twin.get("exam_week", False) if twin else False

        prompt = f"""You are CampusFlow's Academic Twin Planner. Based on the student's current information:
- Goal: {profile.get("goal", "Placement")}
- Target Companies: {', '.join(profile.get("target_companies", [])) or "Any Tech Company"}
- Skills: {', '.join(profile.get("skills", [])) or "None specified yet"}
- Weekly Class Timetable:
{json.dumps(timetable_summary, indent=2)}
- Pending Tasks & Deadlines:
{chr(10).join(task_summary) or "No pending tasks"}
- Cognitive Load: {cog_load}%
- Exam Week Mode: {"ACTIVE" if exam_week else "INACTIVE"}

Generate a customized weekly study plan (Monday to Sunday) for the student.
If Exam Week Mode is ACTIVE:
  - Focus the plan heavily on studying exam subjects, solving mock papers, notes revision, and getting rest.
  - De-prioritize regular skill-building or company preparation.
If Exam Week Mode is INACTIVE and Cognitive Load is low (< 40%):
  - Allocate dedicated blocks for learning new skills, coding practice for target companies, and working on projects.
If Cognitive Load is high (>= 70%):
  - Prioritize completing the pending tasks/deadlines.
  - Add explicit tasks for breaks, mental recovery, and lighter self-study.

Return ONLY a valid JSON array of objects representing days. Do not write any markdown blocks, explaining text, or html code.
Example format:
[
  {{
    "day": "Monday",
    "tasks": ["Attend classes", "Revise operating systems", "Complete CN Assignment"]
  }}
]
"""

        response_text = openai_chat(
            prompt=prompt,
            system="You are an academic twin planner. Return only valid JSON array of daily study plan.",
            max_tokens=1500,
            temperature=0.3
        )
        plan_data = _extract_json(response_text)

        if not isinstance(plan_data, list):
            raise ValueError("Gemini did not return a list for the weekly plan")

        return plan_data

    except Exception as e:
        print(f"Error generating weekly plan: {e}")
        traceback.print_exc()
        # Fallback empty plan format
        days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
        return [{"day": d, "tasks": ["Attend classes", "Self study", "Review tasks"]} for d in days]


@router.get("/weekly")
def get_weekly_plan(student: dict = Depends(get_current_student)):
    try:
        # Determine the Monday of the current week
        today = date.today()
        monday = today - timedelta(days=today.weekday())
        week_start_str = monday.isoformat()

        # Query weekly plans
        plan_res = (
            supabase.table("weekly_plans")
            .select("*")
            .eq("student_id", student["id"])
            .eq("week_start", week_start_str)
            .maybe_single()
            .execute()
        )

        if plan_res and plan_res.data:
            return plan_res.data

        # If it doesn't exist, auto-generate it using Gemini
        plan = generate_weekly_plan_with_gemini(student["id"])

        # Upsert plan into database to handle race conditions gracefully
        insert_res = (
            supabase.table("weekly_plans")
            .upsert(
                {
                    "student_id": student["id"],
                    "week_start": week_start_str,
                    "plan": plan,
                    "approved": False,
                },
                on_conflict="student_id,week_start",
            )
            .execute()
        )

        if not insert_res.data:
            raise HTTPException(status_code=500, detail="Failed to save generated plan")

        return insert_res.data[0]

    except HTTPException:
        raise
    except Exception as e:
        print(f"ERROR in get_weekly_plan: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/weekly/approve")
def approve_weekly_plan(
    payload: ApprovePayload, student: dict = Depends(get_current_student)
):
    try:
        today = date.today()
        monday = today - timedelta(days=today.weekday())
        week_start_str = monday.isoformat()

        res = (
            supabase.table("weekly_plans")
            .update({"approved": payload.approved})
            .eq("student_id", student["id"])
            .eq("week_start", week_start_str)
            .execute()
        )

        if not res.data:
            raise HTTPException(status_code=404, detail="No weekly plan found to approve")

        return res.data[0]
    except HTTPException:
        raise
    except Exception as e:
        print(f"ERROR in approve_weekly_plan: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/weekly/regenerate")
def regenerate_weekly_plan(student: dict = Depends(get_current_student)):
    try:
        today = date.today()
        monday = today - timedelta(days=today.weekday())
        week_start_str = monday.isoformat()

        plan = generate_weekly_plan_with_gemini(student["id"])

        # Upsert: delete existing for this week and insert new, or use upsert
        res = (
            supabase.table("weekly_plans")
            .upsert(
                {
                    "student_id": student["id"],
                    "week_start": week_start_str,
                    "plan": plan,
                    "approved": False,
                },
                on_conflict="student_id,week_start",
            )
            .execute()
        )

        if not res.data:
            raise HTTPException(status_code=500, detail="Failed to regenerate plan")

        return res.data[0]
    except Exception as e:
        print(f"ERROR in regenerate_weekly_plan: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
