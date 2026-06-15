from fastapi import APIRouter, Depends, HTTPException
from deps import get_current_student
from services.supabase_client import supabase
from datetime import datetime, timedelta

router = APIRouter()

# Point values for each action
POINT_VALUES = {
    "task_completed_on_time": 10,
    "attendance_above_80": 5,
    "wellness_checkin": 2,
    "pyq_uploaded": 3,
    "campus_kb_uploaded": 5,
    "task_completed_late": 3,
    "profile_complete": 5,
    "whatsapp_connected": 3,
    "gmail_connected": 3,
}

@router.get("/scores")
def get_leaderboard(college: str = None, student: dict = Depends(get_current_student)):
    try:
        # Get current student's college if not provided
        if not college:
            profile_res = supabase.table("profiles")\
                .select("college")\
                .eq("student_id", student["id"])\
                .maybe_single()\
                .execute()
            college = profile_res.data.get("college") if profile_res.data else None

        # Get all profiles for this college
        profiles_res = supabase.table("profiles")\
            .select("student_id, full_name, college, branch, year, linkedin_url, show_on_leaderboard")\
            .eq("college", college)\
            .execute()
        
        profiles = profiles_res.data or []
        
        # Get points for all students
        points_res = supabase.table("leaderboard_points")\
            .select("student_id, points, action, earned_at")\
            .execute()
        
        points_data = points_res.data or []
        
        # Calculate total points per student
        student_points = {}
        student_actions = {}
        for p in points_data:
            sid = p["student_id"]
            if sid not in student_points:
                student_points[sid] = 0
                student_actions[sid] = []
            student_points[sid] += p["points"]
            student_actions[sid].append(p["action"])
        
        # Build leaderboard
        leaderboard = []
        for profile in profiles:
            sid = profile["student_id"]
            total = student_points.get(sid, 0)
            actions = student_actions.get(sid, [])
            
            show_name = profile.get("show_on_leaderboard")
            if show_name is None:
                show_name = True
            
            name = profile.get("full_name") or "Anonymous"
            if not show_name and sid != student["id"]:
                name = "Anonymous"
            
            leaderboard.append({
                "student_id": sid,
                "name": name,
                "college": profile.get("college", ""),
                "branch": profile.get("branch", ""),
                "year": profile.get("year", 0),
                "linkedin_url": profile.get("linkedin_url") if show_name or sid == student["id"] else None,
                "total_points": total,
                "actions_count": len(actions),
                "is_current_user": sid == student["id"]
            })
        
        # Sort by points descending
        leaderboard.sort(key=lambda x: x["total_points"], reverse=True)
        
        # Add rank
        for i, entry in enumerate(leaderboard):
            entry["rank"] = i + 1
        
        # Get current user rank
        current_user_rank = next(
            (e for e in leaderboard if e["is_current_user"]), 
            None
        )
        
        return {
            "leaderboard": leaderboard,
            "college": college,
            "current_user_rank": current_user_rank,
            "total_students": len(leaderboard)
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/award-points")
def award_points(body: dict, student: dict = Depends(get_current_student)):
    try:
        action = body.get("action")
        if action not in POINT_VALUES:
            raise HTTPException(status_code=400, detail="Invalid action")
        
        points = POINT_VALUES[action]
        description = body.get("description", action)
        
        # Check if already awarded for one-time actions
        one_time_actions = ["profile_complete", "gmail_connected", "whatsapp_connected"]
        if action in one_time_actions:
            existing = supabase.table("leaderboard_points")\
                .select("id")\
                .eq("student_id", student["id"])\
                .eq("action", action)\
                .execute()
            if existing.data:
                return {"success": False, "message": "Points already awarded for this action"}
        
        # Check daily limit for wellness checkin
        if action == "wellness_checkin":
            today = datetime.now().date().isoformat()
            existing = supabase.table("leaderboard_points")\
                .select("id")\
                .eq("student_id", student["id"])\
                .eq("action", action)\
                .gte("earned_at", today)\
                .execute()
            if existing.data:
                return {"success": False, "message": "Already checked in today"}
        
        supabase.table("leaderboard_points").insert({
            "student_id": student["id"],
            "action": action,
            "points": points,
            "description": description,
            "earned_at": datetime.now().isoformat()
        }).execute()
        
        return {
            "success": True,
            "points_awarded": points,
            "action": action,
            "total_message": f"+{points} points for {action.replace('_', ' ')}"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/my-points")
def get_my_points(student: dict = Depends(get_current_student)):
    try:
        res = supabase.table("leaderboard_points")\
            .select("*")\
            .eq("student_id", student["id"])\
            .order("earned_at", desc=True)\
            .execute()
        
        history = res.data or []
        total = sum(h["points"] for h in history)
        
        # Group by action type
        breakdown = {}
        for h in history:
            action = h["action"]
            if action not in breakdown:
                breakdown[action] = {"count": 0, "total_points": 0}
            breakdown[action]["count"] += 1
            breakdown[action]["total_points"] += h["points"]
        
        return {
            "total_points": total,
            "history": history,
            "breakdown": breakdown
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/toggle-visibility")
def toggle_name_visibility(body: dict, student: dict = Depends(get_current_student)):
    try:
        show_name = body.get("show_name", True)
        supabase.table("profiles")\
            .update({"show_on_leaderboard": show_name})\
            .eq("student_id", student["id"])\
            .execute()
        return {"success": True, "show_name": show_name}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


profile_router = APIRouter()

@profile_router.put("/update-linkedin")
def update_linkedin(body: dict, student: dict = Depends(get_current_student)):
    try:
        linkedin_url = body.get("linkedin_url")
        supabase.table("profiles")\
            .update({"linkedin_url": linkedin_url})\
            .eq("student_id", student["id"])\
            .execute()
        return {"success": True, "linkedin_url": linkedin_url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

