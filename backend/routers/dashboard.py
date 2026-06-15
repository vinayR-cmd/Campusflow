import time
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends
from deps import get_current_student
from services.supabase_client import supabase
from services.ahs_service import compute_ahs

router = APIRouter()

@router.get("/ahs")
def get_ahs(student: dict = Depends(get_current_student)):
    return compute_ahs(student["id"])


@router.get("/summary")
def get_dashboard_summary(student: dict = Depends(get_current_student)):
    student_id = student["id"]
    result = {
        "ahs": {"ahs_score": 0, "breakdown": "No data yet"},
        "today_classes": [],
        "upcoming_deadlines": [],
        "attendance_risks": [],
        "tasks_count": 0,
        "transport": []
    }
    
    # 1. AHS compute
    try:
        from services.ahs_service import compute_ahs
        result["ahs"] = compute_ahs(student_id)
    except Exception as e:
        print(f"AHS compute error: {e}")
    
    time.sleep(0.1)  # add between each supabase query
    
    # 2. Timetable slots
    try:
        from datetime import datetime
        today = datetime.now().strftime("%A")
        slots_res = supabase.table("timetable_slots").select("*").eq("student_id", student_id).eq("day", today).order("time_start").execute()
        result["today_classes"] = slots_res.data or []
    except Exception as e:
        print(f"Timetable error: {e}")
    
    time.sleep(0.1)  # add between each supabase query
    
    # 3. Deadlines query
    try:
        from datetime import datetime, timedelta, timezone
        now = datetime.now(timezone.utc)
        cutoff = (now + timedelta(hours=48)).isoformat()
        tasks_res = supabase.table("tasks")\
            .select("*")\
            .eq("student_id", student_id)\
            .eq("status", "pending")\
            .execute()
        all_tasks = tasks_res.data or []
        upcoming = [t for t in all_tasks if t.get("deadline") and t["deadline"] <= cutoff]
        result["upcoming_deadlines"] = upcoming[:10]
    except Exception as e:
        print(f"Deadlines error: {e}")
        result["upcoming_deadlines"] = []
    
    time.sleep(0.1)  # add between each supabase query
    
    # 4. Attendance risks
    try:
        attendance_res = supabase.table("attendance").select("*").eq("student_id", student_id).in_("risk_level", ["danger", "warning"]).execute()
        result["attendance_risks"] = attendance_res.data or []
    except Exception as e:
        print(f"Attendance error: {e}")
        
    time.sleep(0.1)  # add between each supabase query
    
    # 5. Tasks count
    try:
        all_tasks_res = supabase.table("tasks").select("id").eq("student_id", student_id).eq("status", "pending").execute()
        result["tasks_count"] = len(all_tasks_res.data or [])
    except Exception as e:
        print(f"Tasks count error: {e}")
        
    time.sleep(0.1)  # add between each supabase query
    
    # 6. Transport query
    try:
        profile_res = supabase.table("profiles")\
            .select("college")\
            .eq("student_id", student_id)\
            .maybe_single()\
            .execute()
        college = ""
        if profile_res and profile_res.data:
            college = profile_res.data.get("college", "")
        if college:
            transport_res = supabase.table("transport_schedules")\
                .select("*")\
                .eq("college", college)\
                .execute()
            result["transport"] = transport_res.data or []
        else:
            result["transport"] = []
    except Exception as e:
        print(f"Transport error: {e}")
        result["transport"] = []
        
    return result
