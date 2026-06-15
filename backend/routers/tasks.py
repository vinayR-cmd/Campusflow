import traceback
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from deps import get_current_student
from services.supabase_client import supabase

router = APIRouter()

class UpdateStatusPayload(BaseModel):
    status: str


@router.patch("/{task_id}/status")
async def update_task_status(
    task_id: str,
    payload: UpdateStatusPayload,
    student: dict = Depends(get_current_student)
):
    try:
        new_status = payload.status.strip().lower()
        if new_status not in ["done", "pending", "missed"]:
            raise HTTPException(status_code=400, detail="Invalid status value")
            
        supabase.table("tasks")\
            .update({"status": new_status})\
            .eq("id", task_id)\
            .eq("student_id", student["id"])\
            .execute()
            
        return {
            "success": True,
            "task_id": task_id,
            "status": new_status
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"ERROR in update_task_status: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{task_id}")
async def delete_task(
    task_id: str,
    student: dict = Depends(get_current_student)
):
    try:
        supabase.table("tasks")\
            .delete()\
            .eq("id", task_id)\
            .eq("student_id", student["id"])\
            .execute()
            
        return {"success": True}
    except Exception as e:
        print(f"ERROR in delete_task: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
