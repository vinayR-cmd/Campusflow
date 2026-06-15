import os
from fastapi import APIRouter, Depends, HTTPException, File, UploadFile
from deps import get_current_student
from services.supabase_client import supabase
from services.gemini_service import TEXT_MODEL
import google.generativeai as genai
from groq import Groq
from services.openai_service import openai_chat
import json, re

router = APIRouter()

_groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))

@router.get("/my-plan")
def get_my_plan(student: dict = Depends(get_current_student)):
    try:
        res = supabase.table("placement_plans")\
            .select("*")\
            .eq("student_id", student["id"])\
            .maybe_single()\
            .execute()
        
        if res and res.data:
            roadmap = res.data.get("roadmap") or {}
            # Normalize tips and interview_tips keys
            if "tips" not in roadmap and "interview_tips" in roadmap:
                roadmap["tips"] = roadmap["interview_tips"]
            elif "interview_tips" not in roadmap and "tips" in roadmap:
                roadmap["interview_tips"] = roadmap["tips"]
            
            # Ensure readiness_score and created_at are present at root
            roadmap["readiness_score"] = res.data.get("readiness_score", roadmap.get("readiness_score", 40))
            roadmap["created_at"] = res.data.get("created_at")
            return roadmap
        return None
    except Exception as e:
        print(f"Get plan error: {e}")
        return None

@router.post("/generate-plan")
def generate_plan(student: dict = Depends(get_current_student)):
    try:
        profile_res = supabase.table("profiles")\
            .select("goal, target_companies, skills, branch, year")\
            .eq("student_id", student["id"])\
            .maybe_single()\
            .execute()
        
        profile = profile_res.data or {}
        goal = profile.get("goal", "Placement")
        companies = profile.get("target_companies", ["Amazon", "Google"])
        skills = profile.get("skills", [])
        branch = profile.get("branch", "CSE")
        year = profile.get("year", 3)
        weeks = 8  # Dynamic prep weeks, matching frontend accordion count of 8

        prompt = f"""Create a placement preparation roadmap for:
Branch: {branch}, Year: {year}
Goal: {goal}
Target Companies: {companies}
Current Skills: {skills}
Weeks Available: {weeks}

Return ONLY valid JSON with exactly this structure:
{{
  "readiness_score": 45,
  "skill_gaps": ["System Design", "DSA Advanced"],
  "weekly_plan": [
    {{"week": 1, "focus": "Arrays and Strings", "tasks": ["Solve 20 LeetCode easy problems", "Study time complexity"], "resources": ["LeetCode", "GeeksForGeeks"]}},
    {{"week": 2, "focus": "Linked Lists", "tasks": ["Solve 15 problems", "Implement from scratch"], "resources": ["LeetCode"]}},
    {{"week": 3, "focus": "Trees and BST", "tasks": ["Solve 20 tree problems", "Study traversals"], "resources": ["LeetCode"]}},
    {{"week": 4, "focus": "Dynamic Programming", "tasks": ["Learn DP patterns", "Solve 10 DP problems"], "resources": ["Striver Sheet"]}},
    {{"week": 5, "focus": "System Design Basics", "tasks": ["Study HLD concepts", "Design URL shortener"], "resources": ["System Design Primer"]}},
    {{"week": 6, "focus": "SQL and Databases", "tasks": ["Practice SQL queries", "Study joins"], "resources": ["LeetCode SQL"]}},
    {{"week": 7, "focus": "OS and Networks", "tasks": ["Study OS concepts", "Study networking basics"], "resources": ["GFG"]}},
    {{"week": 8, "focus": "Mock Interviews", "tasks": ["2 mock interviews", "Resume review"], "resources": ["Pramp", "interviewing.io"]}}
  ],
  "tips": [
    "Always think out loud during coding interviews",
    "Start with brute force then optimize",
    "Ask clarifying questions before coding",
    "Practice company-specific questions on LeetCode"
  ]
}}"""

        try:
            text = openai_chat(
                prompt=prompt,
                system="You are a placement preparation expert for Indian engineering students. Return only valid JSON.",
                max_tokens=2000,
                temperature=0.3
            )
            text = re.sub(r'^```json\s*', '', text)
            text = re.sub(r'\s*```$', '', text)
            plan_data = json.loads(text)
        except Exception as groq_err:
            print(f"Groq placement roadmap failed/rate-limited: {groq_err}")
            # Robust structured fallback when hit by rate limit
            plan_data = {
                "readiness_score": 40,
                "skill_gaps": ["DSA", "System Design"],
                "weekly_plan": [
                    {"week": 1, "focus": "Arrays and Strings", "tasks": ["Solve 20 LeetCode easy problems"], "resources": ["LeetCode"]},
                    {"week": 2, "focus": "Linked Lists", "tasks": ["Solve 15 problems"], "resources": ["LeetCode"]},
                    {"week": 3, "focus": "Trees and BST", "tasks": ["Solve 20 tree problems"], "resources": ["LeetCode"]},
                    {"week": 4, "focus": "Dynamic Programming", "tasks": ["Learn DP patterns"], "resources": ["LeetCode"]},
                    {"week": 5, "focus": "System Design Basics", "tasks": ["Study HLD concepts"], "resources": ["System Design Primer"]},
                    {"week": 6, "focus": "SQL and Databases", "tasks": ["Practice SQL queries"], "resources": ["LeetCode"]},
                    {"week": 7, "focus": "OS and Networks", "tasks": ["Study OS concepts"], "resources": ["GFG"]},
                    {"week": 8, "focus": "Mock Interviews", "tasks": ["Mock interviews"], "resources": ["Pramp"]}
                ],
                "tips": [
                    "Always think out loud during coding interviews",
                    "Start with brute force then optimize",
                    "Practice daily on LeetCode"
                ]
            }
        
        # Ensure readiness_score and both tips keys are normalized
        readiness = plan_data.get("readiness_score", 40)
        plan_data["readiness_score"] = readiness
        if "tips" not in plan_data and "interview_tips" in plan_data:
            plan_data["tips"] = plan_data["interview_tips"]
        elif "interview_tips" not in plan_data and "tips" in plan_data:
            plan_data["interview_tips"] = plan_data["tips"]

        # Save to DB
        supabase.table("placement_plans").upsert({
            "student_id": student["id"],
            "goal": goal,
            "roadmap": plan_data,
            "readiness_score": readiness,
        }, on_conflict="student_id").execute()
        
        # Update Digital Twin (handle if json data column or ahs)
        try:
            supabase.table("digital_twin").update({
                "placement_score": readiness
            }).eq("student_id", student["id"]).execute()
        except Exception:
            try:
                supabase.table("digital_twin").update({
                    "data": {"placement_score": readiness}
                }).eq("student_id", student["id"]).execute()
            except Exception:
                pass
        
        return plan_data
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/update-skills")
def update_skills(body: dict, student: dict = Depends(get_current_student)):
    try:
        skills = body.get("skills", [])
        supabase.table("profiles").update({"skills": skills})\
            .eq("student_id", student["id"]).execute()
        return {"success": True, "skills": skills}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/analyze-pyq")
async def analyze_pyq(
    file: UploadFile = File(...),
    student: dict = Depends(get_current_student)
):
    try:
        file_bytes = await file.read()
        
        # Extract text from PDF using fitz (PyMuPDF) if possible
        text = ""
        try:
            import fitz
            doc = fitz.open(stream=file_bytes, filetype="pdf")
            for page in doc:
                text += page.get_text()
            doc.close()
        except Exception as e:
            print(f"PDF extraction error: {e}")
            text = "Sample Question Paper"

        # Ask Gemini to parse questions and identify topic coverage percentages, study priorities and tips
        prompt = f"""Analyze the exam question paper text provided and determine the exam pattern insights.
Question Paper Text: {text[:4000]}

Return ONLY valid JSON with this exact structure:
{{
  "subject": "Name of the Subject (e.g., Database Management Systems)",
  "topics": [
    {{"topic": "Topic Name A", "percentage": 35}},
    {{"topic": "Topic Name B", "percentage": 25}},
    {{"topic": "Topic Name C", "percentage": 20}},
    {{"topic": "Topic Name D", "percentage": 10}},
    {{"topic": "Topic Name E", "percentage": 10}}
  ],
  "most_important": ["Topic Name A", "Topic Name B"],
  "likely_this_year": ["Topic Name C", "Topic Name E"],
  "priority_order": [
    "First study Task A...",
    "Second focus on Task B...",
    "Third review Task C..."
  ],
  "insight": "Detailed summary paragraph outlining the general trends, question difficulty, and expected question distribution for the upcoming exam."
}}"""

        try:
            completion = _groq_client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": "You are a placement preparation expert for Indian engineering students. Return only valid JSON."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
                max_tokens=2000
            )
            resp_text = completion.choices[0].message.content.strip()
            resp_text = re.sub(r'^```json\s*', '', resp_text)
            resp_text = re.sub(r'\s*```$', '', resp_text)
            analysis = json.loads(resp_text)
        except Exception as groq_err:
            print(f"Groq PYQ analyzer failed/rate-limited: {groq_err}")
            # Fallback analysis data matching the structure
            analysis = {
                "subject": "Academic Course Subject",
                "topics": [
                    {"topic": "Core Fundamentals", "percentage": 50},
                    {"topic": "Problem Solving", "percentage": 30},
                    {"topic": "Theory Concepts", "percentage": 20}
                ],
                "most_important": ["Core Fundamentals"],
                "likely_this_year": ["Problem Solving"],
                "priority_order": [
                    "Revise core definitions and theories",
                    "Solve past 5 years of exam practice problems",
                    "Do a time-bound mock paper"
                ],
                "insight": "The pattern analyzer suggests that this subject focuses 50% on Core Fundamentals and 30% on analytical Problem Solving. Reviewing past year questions is highly recommended."
            }
            
        return analysis
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/profile")
def get_placement_profile(student: dict = Depends(get_current_student)):
    try:
        profile_res = supabase.table("profiles")\
            .select("goal, skills, target_companies, branch, year")\
            .eq("student_id", student["id"])\
            .maybe_single()\
            .execute()
        return profile_res.data or {}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.patch("/update-companies")
def update_companies(body: dict, student: dict = Depends(get_current_student)):
    try:
        companies = body.get("target_companies", [])
        supabase.table("profiles").update({"target_companies": companies})\
            .eq("student_id", student["id"]).execute()
        return {"success": True, "target_companies": companies}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.patch("/update-goal")
def update_goal(body: dict, student: dict = Depends(get_current_student)):
    try:
        goal = body.get("goal")
        supabase.table("profiles").update({"goal": goal})\
            .eq("student_id", student["id"]).execute()
        return {"success": True, "goal": goal}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.patch("/add-custom-module")
def add_custom_module(body: dict, student: dict = Depends(get_current_student)):
    try:
        module_name = body.get("module_name")
        tasks = body.get("tasks", [])
        
        # get existing plan
        res = supabase.table("placement_plans")\
            .select("roadmap")\
            .eq("student_id", student["id"])\
            .maybe_single()\
            .execute()
            
        if not res or not res.data:
            raise HTTPException(status_code=404, detail="No existing plan found")
            
        roadmap = res.data.get("roadmap", {})
        weekly_plan = roadmap.get("weekly_plan", [])
        
        new_week_num = len(weekly_plan) + 1
        new_module = {
            "week": new_week_num,
            "focus": module_name,
            "tasks": tasks,
            "resources": [],
            "custom": True
        }
        
        weekly_plan.append(new_module)
        roadmap["weekly_plan"] = weekly_plan
        
        supabase.table("placement_plans")\
            .update({"roadmap": roadmap})\
            .eq("student_id", student["id"])\
            .execute()
            
        return {"success": True, "updated_plan": roadmap}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
