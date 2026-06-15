from datetime import datetime, timedelta, timezone
from services.supabase_client import supabase

def compute_ahs(student_id: str) -> dict:
    # 1. Fetch attendance records
    att_res = supabase.table("attendance").select("percentage").eq("student_id", student_id).execute()
    att_data = att_res.data if att_res else []
    if att_data:
        percentages = [float(r["percentage"]) for r in att_data]
        attendance_score = sum(percentages) / len(percentages)
    else:
        attendance_score = 50.0

    # 2. Fetch tasks from last 30 days
    thirty_days_ago = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    tasks_res = supabase.table("tasks").select("status").eq("student_id", student_id).gte("created_at", thirty_days_ago).execute()
    tasks_data = tasks_res.data if tasks_res else []
    if tasks_data:
        done_tasks = sum(1 for t in tasks_data if t["status"] == "done")
        deadline_score = (done_tasks / len(tasks_data)) * 100
    else:
        deadline_score = 50.0

    # 3. Fetch placement plan readiness score
    placement_score = 0.0
    try:
        placement_res = supabase.table("placement_plans").select("readiness_score").eq("student_id", student_id).maybe_single().execute()
        if placement_res and placement_res.data:
            placement_score = float(placement_res.data.get("readiness_score") or 0.0)
    except Exception:
        # Table might not exist yet or request failed
        placement_score = 0.0

    # 4. Cognitive load: pending tasks in the next 7 days
    now = datetime.now(timezone.utc)
    seven_days_later = (now + timedelta(days=7)).isoformat()
    
    # We query all tasks with a deadline in next 7 days, excluding 'done' status
    load_tasks_res = supabase.table("tasks").select("id").eq("student_id", student_id).neq("status", "done").gte("deadline", now.isoformat()).lte("deadline", seven_days_later).execute()
    load_tasks = load_tasks_res.data if load_tasks_res else []
    num_tasks = len(load_tasks)

    if num_tasks <= 2:
        cognitive_load = 20
    elif num_tasks <= 4:
        cognitive_load = 50
    elif num_tasks <= 6:
        cognitive_load = 70
    else:
        cognitive_load = 100

    # 5. Calculate AHS
    ahs_raw = (attendance_score * 0.30) + (deadline_score * 0.25) + (placement_score * 0.25) + ((100 - cognitive_load) * 0.20)
    ahs_score = round(ahs_raw)

    # 6. Build breakdown label
    load_label = "Low"
    if cognitive_load == 50:
        load_label = "Medium"
    elif cognitive_load == 70:
        load_label = "High"
    elif cognitive_load == 100:
        load_label = "Very High"

    breakdown = f"Attendance {round(attendance_score)}% · Deadlines {round(deadline_score)}% · Placement {round(placement_score)}% · Load: {load_label}"

    # 7. Upsert into digital_twin table
    try:
        supabase.table("digital_twin").upsert({
            "student_id": student_id,
            "ahs_score": ahs_score,
            "data": {
                "attendance_score": attendance_score,
                "deadline_score": deadline_score,
                "placement_score": placement_score,
                "cognitive_load": cognitive_load,
                "breakdown": breakdown
            }
        }).execute()
    except Exception:
        # If digital_twin doesn't have student_id insert policy enabled or fails, log it or bypass
        pass

    return {
        "ahs_score": ahs_score,
        "attendance_score": round(attendance_score),
        "deadline_score": round(deadline_score),
        "placement_score": round(placement_score),
        "cognitive_load": cognitive_load,
        "breakdown": breakdown
    }
