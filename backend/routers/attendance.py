import math
import time
import traceback
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, File, UploadFile, HTTPException
from pydantic import BaseModel
import google.generativeai as genai

from deps import get_current_student
from services.supabase_client import supabase
from services.gemini_service import VISION_MODEL, _extract_json

router = APIRouter()

class AttendanceManualEntry(BaseModel):
    subject: str
    attended: int
    total: int

class AttendanceManualPayload(BaseModel):
    entries: list[AttendanceManualEntry]


def compute_attendance_metrics(attended: int, total: int) -> tuple[float, str, int]:
    percentage = (attended / total * 100) if total > 0 else 0.0
    percentage = round(percentage, 2)
    
    if percentage >= 80:
        risk_level = "safe"
    elif percentage >= 75:
        risk_level = "warning"
    else:
        risk_level = "danger"
        
    classes_can_miss = math.floor((attended - 0.75 * total) / 0.25) if total > 0 else 0
    if classes_can_miss < 0:
        classes_can_miss = 0
        
    return percentage, risk_level, classes_can_miss


def upsert_attendance_record(student_id: str, subject: str, attended: int, total: int, course_code: str = None, source: str = "manual") -> dict:
    percentage, risk_level, classes_can_miss = compute_attendance_metrics(attended, total)
    
    payload = {
        "student_id": student_id,
        "subject": subject,
        "attended": attended,
        "total": total,
        "percentage": percentage,
        "risk_level": risk_level,
        "classes_can_miss": classes_can_miss,
        "source": source
    }
    if course_code:
        payload["course_code"] = course_code
    
    print("Saving attendance for subject:", subject, "percentage:", percentage)
    
    # Perform upsert
    supabase.table("attendance").upsert(payload, on_conflict="student_id,subject").execute()
    
    # Query back to verify the record was saved correctly
    verify_res = supabase.table("attendance").select("*").eq("student_id", student_id).eq("subject", subject).maybe_single().execute()
    record = verify_res.data if verify_res else None
    
    if record:
        return {
            "subject": record["subject"],
            "course_code": record.get("course_code"),
            "attended": record["attended"],
            "total": record["total"],
            "percentage": float(record["percentage"]),
            "risk_level": record["risk_level"],
            "classes_can_miss": record.get("classes_can_miss", classes_can_miss)
        }
    else:
        return {
            "subject": subject,
            "course_code": course_code,
            "attended": attended,
            "total": total,
            "percentage": percentage,
            "risk_level": risk_level,
            "classes_can_miss": classes_can_miss
        }


@router.post("/upload-screenshot")
async def upload_screenshot(
    file: UploadFile = File(...),
    student: dict = Depends(get_current_student)
):
    try:
        mime_type = file.content_type or "application/octet-stream"
        if not mime_type.startswith("image/"):
            raise HTTPException(status_code=400, detail="Only image files (JPG, PNG, WEBP) are accepted")
            
        file_bytes = await file.read()
        
        # Save file to Supabase Storage before calling Gemini Vision (BUG 3)
        timestamp = int(time.time())
        storage_path = f"{student['id']}/erp_{timestamp}.png"
        try:
            supabase.storage.from_("erp-screenshots").upload(storage_path, file_bytes, {"content-type": mime_type})
        except Exception as storage_err:
            print(f"WARNING: Failed to save file in erp-screenshots storage bucket: {storage_err}")
            
        # Proceed with Gemini Vision extraction
        model = genai.GenerativeModel(VISION_MODEL)
        prompt = (
            "This is a screenshot of a college ERP attendance/registration page.\n"
            "Extract the attendance data for each course/subject.\n"
            "The table may have columns like: S.No, Course Code, Course Name, Component, Credit, Faculty, Attendance %, Status.\n"
            "Attendance percentage may be shown as \"97 %\" or \"97%\" or \"97\".\n\n"
            "Return a JSON array. Each element:\n"
            "{\n"
            "  \"subject\": \"Course Name (use full name, not code)\",\n"
            "  \"course_code\": \"course code like CS206L\",\n"
            "  \"attended\": 0,\n"
            "  \"total\": 100,\n"
            "  \"percentage\": 97.0\n"
            "}\n\n"
            "IMPORTANT: If you cannot determine attended/total from the screenshot (only percentage shown),\n"
            "set attended = percentage (as integer) and total = 100.\n"
            "This allows percentage calculation to work correctly.\n\n"
            "Return ONLY valid JSON array, no explanation, no markdown.\n"
            "Example: [{\"subject\": \"Operating System\", \"course_code\": \"CS206L\", \"attended\": 97, \"total\": 100, \"percentage\": 97.0}]"
        )
        
        response = model.generate_content([
            prompt,
            {"mime_type": mime_type, "data": file_bytes}
        ])
        raw_entries = _extract_json(response.text)
        
        if not isinstance(raw_entries, list):
            raise HTTPException(status_code=422, detail="Invalid data extracted from screenshot")
            
        results = []
        for entry in raw_entries:
            subject = entry.get("subject", "").strip()
            course_code = entry.get("course_code", "").strip()
            attended = int(entry.get("attended") or 0)
            total = int(entry.get("total") or 0)
            
            if not subject or total <= 0:
                continue
                
            metrics = upsert_attendance_record(student["id"], subject, attended, total, course_code=course_code, source="screenshot")
            results.append(metrics)
            
        return {"subjects": results}
    except HTTPException:
        raise
    except Exception as e:
        print(f"ERROR in upload_screenshot: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/manual")
async def manual_attendance(
    payload: AttendanceManualPayload,
    student: dict = Depends(get_current_student)
):
    try:
        results = []
        for entry in payload.entries:
            subject = entry.subject.strip()
            attended = entry.attended
            total = entry.total
            
            if not subject or total <= 0:
                continue
                
            metrics = upsert_attendance_record(student["id"], subject, attended, total, source="manual")
            results.append(metrics)
            
        return {"subjects": results}
    except HTTPException:
        raise
    except Exception as e:
        print(f"ERROR in manual_attendance: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/my")
async def my_attendance(
    student: dict = Depends(get_current_student)
):
    try:
        res = supabase.table("attendance").select("*").eq("student_id", student["id"]).order("subject").execute()
        records = res.data if res else []
        
        subjects = [
            {
                "subject": r["subject"],
                "course_code": r.get("course_code"),
                "attended": r["attended"],
                "total": r["total"],
                "percentage": float(r["percentage"]),
                "risk_level": r["risk_level"],
                "classes_can_miss": r.get("classes_can_miss", 0)
            } for r in records
        ]
        return {"subjects": subjects}
    except HTTPException:
        raise
    except Exception as e:
        print(f"ERROR in my_attendance: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


class ERPCredentials(BaseModel):
    erp_url: str = "http://localhost:8001"
    username: str
    password: str


@router.post("/connect-erp")
async def connect_erp(
    credentials: ERPCredentials,
    student: dict = Depends(get_current_student)
):
    try:
        import httpx
        url = f"{credentials.erp_url}/api/attendance/{credentials.username}?password={credentials.password}"
        async with httpx.AsyncClient() as client:
            res = await client.get(url)
            
        if res.status_code != 200 or "error" in res.json():
            raise HTTPException(status_code=400, detail="Invalid ERP credentials")
            
        data = res.json()
        
        supabase.table("profiles").update({
            "erp_url": credentials.erp_url,
            "erp_username": credentials.username,
            "erp_password": credentials.password,
            "erp_last_synced": datetime.now(timezone.utc).isoformat()
        }).eq("student_id", student["id"]).execute()
        
        synced_count = sync_erp_attendance_sync(student["id"], data)
        
        # Award leaderboard points if leaderboard router / points table exists
        try:
            supabase.table("leaderboard_points").insert({
                "student_id": student["id"],
                "action": "profile_complete", # Or generic task point
                "points": 5,
                "description": "Connected College ERP Profile",
                "earned_at": datetime.now(timezone.utc).isoformat()
            }).execute()
        except Exception as award_err:
            print(f"Bypassed leaderboard award on erp connection: {award_err}")

        from services.ahs_service import compute_ahs
        compute_ahs(student["id"])
        
        updated_res = supabase.table("attendance").select("*").eq("student_id", student["id"]).execute()
        updated_records = updated_res.data if updated_res else []
        
        subjects = [
            {
                "subject": r["subject"],
                "course_code": r.get("course_code"),
                "attended": r["attended"],
                "total": r["total"],
                "percentage": float(r["percentage"]),
                "risk_level": r["risk_level"],
                "classes_can_miss": r.get("classes_can_miss", 0)
            } for r in updated_records
        ]
        
        return {
            "success": True,
            "subjects_synced": synced_count,
            "attendance": subjects
        }
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/sync-erp")
async def sync_erp(
    student: dict = Depends(get_current_student)
):
    try:
        synced_count = sync_erp_attendance(student["id"])
        
        from services.ahs_service import compute_ahs
        compute_ahs(student["id"])
        
        updated_res = supabase.table("attendance").select("*").eq("student_id", student["id"]).execute()
        updated_records = updated_res.data if updated_res else []
        
        subjects = [
            {
                "subject": r["subject"],
                "course_code": r.get("course_code"),
                "attended": r["attended"],
                "total": r["total"],
                "percentage": float(r["percentage"]),
                "risk_level": r["risk_level"],
                "classes_can_miss": r.get("classes_can_miss", 0)
            } for r in updated_records
        ]
        
        return {
            "synced": synced_count,
            "attendance": subjects
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/erp-status")
async def erp_status(
    student: dict = Depends(get_current_student)
):
    try:
        profile_res = supabase.table("profiles")\
            .select("erp_url, erp_username, erp_last_synced")\
            .eq("student_id", student["id"])\
            .maybe_single()\
            .execute()
            
        if not profile_res or not profile_res.data:
            return {"connected": False}
            
        profile = profile_res.data
        username = profile.get("erp_username")
        connected = bool(username)
        
        return {
            "connected": connected,
            "erp_url": profile.get("erp_url"),
            "username": username,
            "last_synced": profile.get("erp_last_synced")
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/disconnect-erp")
async def disconnect_erp(
    student: dict = Depends(get_current_student)
):
    try:
        supabase.table("profiles").update({
            "erp_url": None,
            "erp_username": None,
            "erp_password": None,
            "erp_last_synced": None
        }).eq("student_id", student["id"]).execute()
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def sync_erp_attendance(student_id: str) -> int:
    try:
        profile_res = supabase.table("profiles")\
            .select("erp_url, erp_username, erp_password")\
            .eq("student_id", student_id)\
            .maybe_single()\
            .execute()
        
        if not profile_res or not profile_res.data:
            return 0
            
        profile = profile_res.data
        erp_url = profile.get("erp_url")
        username = profile.get("erp_username")
        password = profile.get("erp_password")
        
        if not erp_url or not username or not password:
            return 0
            
        import httpx
        url = f"{erp_url}/api/attendance/{username}?password={password}"
        res = httpx.get(url)
        if res.status_code != 200 or "error" in res.json():
            return 0
            
        data = res.json()
        return sync_erp_attendance_sync(student_id, data)
    except Exception as e:
        print(f"Error in sync_erp_attendance for {student_id}: {e}")
        return 0


def sync_erp_attendance_sync(student_id: str, data: dict) -> int:
    attendance_list = data.get("attendance", [])
    synced_count = 0
    for item in attendance_list:
        subject = item.get("subject", "").strip()
        course_code = item.get("course_code", "").strip()
        attended = int(item.get("attended") or 0)
        total = int(item.get("total") or 0)
        
        if not subject or total <= 0:
            continue
            
        upsert_attendance_record(student_id, subject, attended, total, course_code=course_code, source="erp")
        synced_count += 1
        
    supabase.table("profiles").update({
        "erp_last_synced": datetime.now(timezone.utc).isoformat()
    }).eq("student_id", student_id).execute()
    
    return synced_count


def sync_erp_attendance_job():
    try:
        res = supabase.table("profiles").select("student_id").neq("erp_username", None).execute()
        for row in res.data or []:
            try:
                sync_erp_attendance(row["student_id"])
                from services.ahs_service import compute_ahs
                compute_ahs(row["student_id"])
            except Exception as e:
                print(f"Failed scheduled ERP sync for {row['student_id']}: {e}")
    except Exception as e:
        print(f"Failed ERP sync scheduler job: {e}")



