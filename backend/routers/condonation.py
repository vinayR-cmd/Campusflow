from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
import google.generativeai as genai
from fpdf import FPDF
from services.openai_service import openai_chat

from deps import get_current_student
from services.supabase_client import supabase
from services.gemini_service import TEXT_MODEL

router = APIRouter()

class CondonationPayload(BaseModel):
    subject: str
    absent_dates: list[str]
    reason: str


@router.post("/generate")
async def generate_condonation(
    payload: CondonationPayload,
    student: dict = Depends(get_current_student)
):
    # Fetch student profile
    res = supabase.table("profiles").select("full_name, college, branch, year, section").eq("student_id", student["id"]).maybe_single().execute()
    profile = res.data if res else None
    
    if not profile:
        raise HTTPException(status_code=400, detail="Student profile not found. Please complete onboarding first.")

    name = profile.get("full_name") or "Student"
    college = profile.get("college") or "College"
    branch = profile.get("branch") or "Branch"
    year = str(profile.get("year") or "")
    section = profile.get("section") or ""
    
    roll_no = student["id"][-8:] # last 8 characters of UUID
    dates_str = ", ".join(payload.absent_dates)
    
    prompt = (
        f"Generate a formal college condonation application letter for a student with these details:\n"
        f"Name: {name}\n"
        f"Roll No: {roll_no}\n"
        f"College: {college}\n"
        f"Branch: {branch}\n"
        f"Year: {year}\n"
        f"Subject: {payload.subject}\n"
        f"Absent Dates: {dates_str}\n"
        f"Reason: {payload.reason}\n\n"
        f"The letter should be addressed to the Head of Department. Professional formal tone. "
        f"Include: date, subject line, body with reason and dates, request for condonation, "
        f"closing with student signature line. Do NOT include markdown styling or markdown code blocks (e.g. ```), just raw plain text."
    )
    
    try:
        letter_text = openai_chat(
            prompt=prompt,
            system="You are a helpful assistant that generates professional college letter applications.",
            max_tokens=1500,
            temperature=0.3
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to generate letter text: {exc}")

    # Remove potential markdown wrappers if Gemini still returns them
    if letter_text.startswith("```"):
        # split first and last lines
        lines = letter_text.splitlines()
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].startswith("```"):
            lines = lines[:-1]
        letter_text = "\n".join(lines).strip()

    # Generate PDF using fpdf2
    try:
        pdf = FPDF()
        pdf.add_page()
        pdf.set_font("Helvetica", size=11)
        
        # We need to encode the text correctly for standard fonts (latin-1) or clean it
        clean_text = letter_text.encode('latin-1', 'replace').decode('latin-1')
        
        pdf.multi_cell(0, 6, clean_text)
        pdf_bytes = pdf.output()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to generate PDF: {exc}")

    safe_subject = "".join(c if c.isalnum() else "_" for c in payload.subject)
    safe_name = "".join(c if c.isalnum() else "_" for c in name)
    filename = f"condonation_{safe_subject}_{safe_name}.pdf"
    
    headers = {
        'Content-Disposition': f'attachment; filename="{filename}"',
        'Access-Control-Expose-Headers': 'Content-Disposition'
    }
    
    return Response(
        content=bytes(pdf_bytes),
        media_type="application/pdf",
        headers=headers
    )
