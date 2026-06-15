import io

import fitz  # PyMuPDF
import google.generativeai as genai
from services.openai_service import openai_chat
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from deps import get_current_student
from services.chroma_service import add_document_chunks, new_doc_id, query_documents, collection_doc_count
from services.gemini_service import extract_text_from_image
from services.groq_service import answer_campus_question
from services.supabase_client import supabase

router = APIRouter()

DOC_TYPES = {
    "Syllabus",
    "Academic Calendar",
    "Hostel Rules",
    "Exam Schedule",
    "Placement Notice",
    "General Notice",
    "Other",
}


def _extract_text(file_bytes: bytes, mime_type: str) -> str:
    if mime_type == "application/pdf":
        text_parts = []
        with fitz.open(stream=file_bytes, filetype="pdf") as doc:
            for page in doc:
                text_parts.append(page.get_text())
        return "\n".join(text_parts)
    if mime_type.startswith("image/"):
        return extract_text_from_image(file_bytes, mime_type)
    raise HTTPException(status_code=415, detail=f"Unsupported file type: {mime_type}")


def _get_college_identifier(student_id: str) -> str:
    res = (
        supabase.table("profiles")
        .select("college_domain, college")
        .eq("student_id", student_id)
        .maybe_single()
        .execute()
    )
    profile = res.data if res else None
    if not profile:
        raise HTTPException(status_code=400, detail="Complete onboarding before uploading documents")
    return profile.get("college_domain") or profile.get("college")


@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    doc_type: str = Form(...),
    branch: str = Form("All"),
    year: str = Form("All"),
    section: str = Form("All"),
    hostel_wing: str = Form("All"),
    student: dict = Depends(get_current_student),
):
    if doc_type not in DOC_TYPES:
        raise HTTPException(status_code=422, detail=f"Invalid doc_type: {doc_type}")

    file_bytes = await file.read()
    mime_type = file.content_type or "application/octet-stream"

    text = _extract_text(file_bytes, mime_type)
    if not text.strip():
        raise HTTPException(status_code=422, detail="No text could be extracted from this document")

    college_identifier = _get_college_identifier(student["id"])
    doc_id = new_doc_id()

    metadata = {
        "doc_id": doc_id,
        "doc_type": doc_type,
        "branch": branch,
        "year": year,
        "section": section,
        "hostel_wing": hostel_wing,
        "college": college_identifier,
    }

    chunks_count = add_document_chunks(college_identifier, doc_id, text, metadata)

    file_path = f"{student['id']}/{doc_id}_{file.filename}"
    db_res = (
        supabase.table("campus_docs")
        .insert(
            {
                "id": doc_id,
                "student_id": student["id"],
                "college": college_identifier,
                "doc_type": doc_type,
                "branch": branch,
                "year": year,
                "section": section,
                "hostel_wing": hostel_wing,
                "file_path": file_path,
                "chunks_count": chunks_count,
            }
        )
        .execute()
    )

    return {"doc": db_res.data[0], "chunks_count": chunks_count}


class StudentContext(BaseModel):
    college: str | None = None
    branch: str | None = None
    year: str | None = None
    section: str | None = None
    hostel: str | None = None


class QueryPayload(BaseModel):
    question: str
    student_context: StudentContext | None = None


@router.post("/query")
def query_kb(payload: QueryPayload, student: dict = Depends(get_current_student)):
    college_identifier = _get_college_identifier(student["id"])

    if collection_doc_count(college_identifier) == 0:
        return {
            "answer": "No documents uploaded yet",
            "sources": [],
        }

    ctx = payload.student_context.dict() if payload.student_context else {}
    chunks = query_documents(college_identifier, payload.question, student_context=ctx, top_k=3)

    if chunks:
        chunks_text = "\n\n".join(
            f"[Document type: {c['metadata'].get('doc_type', 'Unknown')}]\n{c['text']}"
            for c in chunks
        )
    else:
        chunks_text = "(no documents available)"

    answer = openai_chat(
        prompt=f"Answer this question using only the provided campus documents.\n\nQuestion: {payload.question}\n\nDocuments:\n{chunks_text}",
        system="You are a campus assistant for Indian college students. Answer using ONLY the provided documents. If answer not found say 'I don't have that information in the campus documents yet.' Mention which document type your answer came from.",
        max_tokens=500,
        temperature=0.3
    )
    sources = sorted({c["metadata"].get("doc_type", "Unknown") for c in chunks})

    return {"answer": answer, "sources": sources}


transport_router = APIRouter()

class SelectRoutePayload(BaseModel):
    route: str


@transport_router.post("/upload")
async def upload_transport_schedule(
    file: UploadFile = File(...),
    student: dict = Depends(get_current_student)
):
    try:
        file_bytes = await file.read()
        mime_type = file.content_type or "application/pdf"
        
        # Extract text from PDF using PyMuPDF first (faster than Vision)
        text = ""
        if mime_type == "application/pdf":
            try:
                import fitz
                doc = fitz.open(stream=file_bytes, filetype="pdf")
                for page in doc:
                    text += page.get_text()
                doc.close()
            except Exception as e:
                print(f"PyMuPDF failed: {e}")
                text = ""
        
        # If no text extracted, use Gemini Vision
        if not text.strip():
            try:
                model = genai.GenerativeModel("gemini-2.5-flash")
                response = model.generate_content([
                    "Extract all text from this document.",
                    {"mime_type": mime_type, "data": file_bytes}
                ])
                text = response.text
            except Exception as e:
                print(f"Vision extraction failed: {e}")
                raise HTTPException(status_code=500, detail="Could not extract text from file")
        
        print(f"Extracted text length: {len(text)}")
        print(f"First 200 chars: {text[:200]}")
        
        # Parse transport schedule from text using OpenAI
        parse_prompt = f"""Extract bus/transport schedule from this text.
Return JSON array only:
[{{"route": "Route name/number", "stops": ["stop1", "stop2"], "departure_times": ["07:30", "08:00"], "destination": "final stop"}}]
If no schedule found return [].
Text: {text[:3000]}"""
        
        response_text = openai_chat(
            prompt=parse_prompt,
            system="You are a helpful assistant. Return only valid JSON when asked.",
            max_tokens=1000,
            temperature=0.1
        )
        print(f"OpenAI parse response: {response_text[:300]}")
        
        # Parse JSON
        import json, re
        response_text = response_text.strip()
        response_text = re.sub(r'^```json\s*', '', response_text)
        response_text = re.sub(r'\s*```$', '', response_text)
        
        try:
            schedules = json.loads(response_text)
        except:
            schedules = []
        
        print(f"Parsed {len(schedules)} routes")
        
        # Get student college
        profile_res = supabase.table("profiles")\
            .select("college")\
            .eq("student_id", student["id"])\
            .maybe_single()\
            .execute()
        college = profile_res.data.get("college", "Unknown") if profile_res.data else "Unknown"
        
        # Save to transport_schedules table
        saved = []
        for schedule in schedules:
            try:
                route_name = schedule.get("route", "")
                if route_name:
                    supabase.table("transport_schedules").delete().eq("college", college).eq("route", route_name).execute()

                res = supabase.table("transport_schedules").insert({
                    "college": college,
                    "route": route_name,
                    "stops": schedule.get("stops", []),
                    "departure_times": schedule.get("departure_times", []),
                    "uploaded_by": student["id"]
                }).execute()
                saved.append(schedule)
            except Exception as e:
                print(f"Error saving route: {e}")
        
        return {"schedules": saved, "routes_found": len(saved)}
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@transport_router.get("/schedules")
def get_schedules(student: dict = Depends(get_current_student)):
    try:
        profile_res = supabase.table("profiles").select("college").eq("student_id", student["id"]).maybe_single().execute()
        college = profile_res.data.get("college", "") if profile_res.data else ""
        res = supabase.table("transport_schedules").select("*").eq("college", college).execute()
        return {"schedules": res.data or []}
    except Exception as e:
        print(f"Transport schedules error: {e}")
        return {"schedules": []}


@transport_router.post("/select-route")
def select_route(
    payload: SelectRoutePayload,
    student: dict = Depends(get_current_student)
):
    supabase.table("profiles").update({"bus_route": payload.route}).eq("student_id", student["id"]).execute()
    return {"success": True}
