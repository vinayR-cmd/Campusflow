import re
import os
import traceback
from fastapi.responses import Response
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, File, UploadFile, HTTPException, Form, Response, Request
from pydantic import BaseModel
import google.generativeai as genai
from groq import Groq
from services.openai_service import openai_chat

from deps import get_current_student
from services.supabase_client import supabase
from services.gemini_service import TEXT_MODEL, _extract_json

router = APIRouter()

_groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))

# Matches WhatsApp line format including AM/PM, bracket formats, and optional prefixes like ~ or -
WHATSAPP_LINE_REGEX = re.compile(
    r'^\[?(\d{1,2}/\d{1,2}/\d{2,4}),\s*(\d{1,2}:\d{2}(?:\s*[APap][Mm])?)\]?\s*(?:-\s*|~\s*)*([^:]+):\s*(.*)$'
)

WHATSAPP_EXTRACTION_PROMPT = """You are helping Indian college students track academic deadlines from WhatsApp group messages.

Analyze these WhatsApp messages and extract EVERY academic task, deadline, assignment, exam, viva, submission, placement drive, or important college event mentioned.

Messages are from Indian college student groups and may be in:
- English: "Assignment due Friday"
- Hindi: "kal tak jama karna hai assignment"  
- Hinglish: "bhai CN ka assignment kal 11:59 tak portal pe submit karna hai"

Current date: {current_date}
Current year: 2026

Extract items where you see ANY of these signals:
- Submission/jama/submit/upload
- Deadline/last date/due/kal tak/aaj tak
- Exam/viva/test/quiz/mid sem/end sem
- Assignment/project/lab report/practical
- Placement/internship/drive/register
- Notice/notice board/important/urgent

For each extracted item return:
{{
  "task": "clear description of what needs to be done",
  "subject": "subject name if mentioned, else null",
  "deadline": "YYYY-MM-DD format if date mentioned, else null",
  "priority": "high if due within 3 days or urgent, medium if within 7 days, low otherwise",
  "type": "deadline or exam or placement or event or notice"
}}

Return a JSON array of ALL found items.
If genuinely nothing academic found, return [].
Return ONLY the JSON array, no explanation.

Messages to analyze:
{messages}"""

class QuickAddPayload(BaseModel):
    text: str

class RegisterNumberPayload(BaseModel):
    whatsapp_number: str


def parse_iso_datetime(dt_str: str) -> datetime | None:
    if not dt_str:
        return None
    dt_str = dt_str.strip()
    if dt_str.endswith("Z"):
        dt_str = dt_str[:-1] + "+00:00"
    for fmt in ("%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%dT%H:%M:%S.%f%z", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.strptime(dt_str, fmt)
        except ValueError:
            continue
    try:
        return datetime.fromisoformat(dt_str)
    except ValueError:
        return None


def clean_iso_deadline(dt_str: str | None) -> str | None:
    dt = parse_iso_datetime(dt_str)
    return dt.isoformat() if dt else None


def get_task_key(task_name: str, deadline_str: str | None):
    norm_name = task_name.lower().strip()
    clean_dl = clean_iso_deadline(deadline_str)
    return (norm_name, clean_dl)


def extract_tasks_from_messages(messages: list[str]) -> list[dict]:
    if not messages:
        return []

    messages_text = "\n".join(messages)
    current_date_str = datetime.now().strftime("%d %B %Y")
    prompt = WHATSAPP_EXTRACTION_PROMPT.format(
        current_date=current_date_str,
        messages=messages_text
    )

    system_prompt = "You are an AI that extracts academic tasks from Indian college student WhatsApp messages. Messages may be in Hindi, English or Hinglish. Return only valid JSON array."

    try:
        result_text = openai_chat(
            prompt=prompt,
            system=system_prompt,
            max_tokens=1500,
            temperature=0.1
        )

        # Detailed logging
        print(f"OpenAI raw response: {result_text[:500]}")

        extracted = _extract_json(result_text)
        if isinstance(extracted, list):
            # Fallback if OpenAI returns [] for a batch of messages that clearly contains text
            if not extracted and len(messages) > 0:
                print("OpenAI returned empty array, attempting fallback simple prompt...")
                simple_prompt = f"List all deadlines and assignments from these messages as JSON array [{{task, subject, deadline, priority, type}}]: {messages_text}"
                try:
                    result_text2 = openai_chat(
                        prompt=simple_prompt,
                        system=system_prompt,
                        max_tokens=1500,
                        temperature=0.1
                    )
                    extracted2 = _extract_json(result_text2)
                    if isinstance(extracted2, list) and extracted2:
                        print(f"Fallback Tasks extracted: {len(extracted2)}")
                        return extracted2
                except Exception as fallback_err:
                    print(f"Fallback extraction failed: {fallback_err}")

            print(f"Tasks extracted: {len(extracted)}")
            return extracted
    except Exception as e:
        print(f"Error in OpenAI task extraction: {e}")
    return []


def save_extracted_tasks(student_id: str, items: list[dict]) -> tuple[int, int, int]:
    if not items:
        return 0, 0, 0

    # Fetch existing tasks to deduplicate
    existing_res = supabase.table("tasks").select("task, deadline").eq("student_id", student_id).execute()
    existing_tasks = existing_res.data if existing_res else []
    
    existing_keys = set()
    for t in existing_tasks:
        existing_keys.add(get_task_key(t["task"], t["deadline"]))

    tasks_found = len(items)
    tasks_created = 0
    duplicates_skipped = 0
    
    insert_payloads = []
    for item in items:
        task_name = item.get("task")
        if not task_name:
            continue
            
        deadline = item.get("deadline")
        key = get_task_key(task_name, deadline)
        
        if key in existing_keys:
            duplicates_skipped += 1
            continue
            
        insert_payloads.append({
            "student_id": student_id,
            "task": task_name,
            "subject": item.get("subject"),
            "deadline": clean_iso_deadline(deadline),
            "priority": item.get("priority", "medium"),
            "type": item.get("type", "notice"),
            "source": "whatsapp",
            "status": "pending"
        })
        tasks_created += 1

    if insert_payloads:
        supabase.table("tasks").insert(insert_payloads).execute()

    return tasks_found, tasks_created, duplicates_skipped


@router.post("/upload-export")
async def upload_export(
    file: UploadFile = File(...),
    student: dict = Depends(get_current_student)
):
    try:
        if not file.filename.endswith(".txt"):
            raise HTTPException(status_code=400, detail="Only .txt files are accepted")
            
        contents = await file.read()
        try:
            text = contents.decode("utf-8")
        except UnicodeDecodeError:
            try:
                text = contents.decode("latin-1")
            except Exception:
                raise HTTPException(status_code=400, detail="Unable to decode file text")

        lines = text.splitlines()
        valid_message_texts = []
        
        for line in lines:
            line_str = line.strip()
            if not line_str:
                continue
                
            # Filter lines containing specific text immediately
            if any(term in line_str for term in [
                "Messages and calls are end-to-end encrypted",
                "<Media omitted>",
                "image omitted",
                "video omitted",
                "audio omitted",
                "This message was deleted"
            ]):
                continue
            
            # Match lines with sender
            match = WHATSAPP_LINE_REGEX.match(line_str)
            if match:
                msg_text = match.group(4).strip()
                
                # Double-check filters on msg_text
                if not msg_text:
                    continue
                if any(term in msg_text for term in [
                    "Messages and calls are end-to-end encrypted",
                    "<Media omitted>",
                    "image omitted",
                    "video omitted",
                    "audio omitted",
                    "This message was deleted"
                ]):
                    continue
                    
                valid_message_texts.append(msg_text)
            else:
                # If a line doesn't match the regex but it has no sender,
                # check if it is a continuation of the previous message.
                is_date_separator = False
                if re.match(r'^[\d/\s,-]+$', line_str):
                    is_date_separator = True
                elif line_str in ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]:
                    is_date_separator = True
                
                if not is_date_separator and valid_message_texts:
                    valid_message_texts[-1] = f"{valid_message_texts[-1]} {line_str}"

        # Detailed logging
        total_lines = len(lines)
        messages = valid_message_texts
        print(f"Parsed {len(messages)} messages from WhatsApp export")
        print(f"Total lines in file: {total_lines}")
        print(f"Valid messages extracted: {len(messages)}")
        print(f"First 3 messages: {messages[:3]}")

        # Send ALL messages as one single prompt to Gemini.
        # If total messages > 100, send in batches of 50 (not 20).
        all_extracted_items = []
        if len(messages) > 0:
            batch_size = 50 if len(messages) > 100 else len(messages)
            for i in range(0, len(messages), batch_size):
                batch = messages[i : i + batch_size]
                extracted = extract_tasks_from_messages(batch)
                all_extracted_items.extend(extracted)

        found, created, skipped = save_extracted_tasks(student["id"], all_extracted_items)
        
        # Message text format
        if created > 0:
            message_text = f"{created} tasks extracted from your WhatsApp messages"
        else:
            message_text = "No academic tasks found in this chat. Try a group with assignment/deadline messages."
            
        return {
            "tasks_found": found,
            "tasks_created": created,
            "duplicates_skipped": skipped,
            "message": message_text
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"ERROR in upload_export: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/quick-add")
async def quick_add(
    payload: QuickAddPayload,
    student: dict = Depends(get_current_student)
):
    try:
        extracted = extract_tasks_from_messages([payload.text])
        found, created, skipped = save_extracted_tasks(student["id"], extracted)
        
        # Fetch newly created tasks to return in response
        new_tasks = []
        if created > 0:
            res = supabase.table("tasks").select("*").eq("student_id", student["id"]).eq("source", "whatsapp").order("created_at", desc=True).limit(created).execute()
            new_tasks = res.data if res else []
            
        return {
            "tasks_created": created,
            "tasks": new_tasks
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"ERROR in quick_add: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/register-number")
async def register_number(
    payload: RegisterNumberPayload,
    student: dict = Depends(get_current_student)
):
    try:
        whatsapp_num = payload.whatsapp_number.strip()
        if not whatsapp_num.startswith("+"):
             raise HTTPException(status_code=400, detail="Number must start with '+' and contain country code, e.g. +91XXXXXXXXXX")
             
        supabase.table("profiles").update({"whatsapp_number": whatsapp_num}).eq("student_id", student["id"]).execute()
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        print(f"ERROR in register_number: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/inbound")
async def inbound_whatsapp(request: Request):
    try:
        print(f"=== WHATSAPP INBOUND ===")
        form_data = dict(await request.form())
        print(f"All form data: {form_data}")
        
        Body = form_data.get("Body", "")
        From = form_data.get("From", "")
        
        # Normalize the incoming number - strip whatsapp: prefix
        from_number = From
        print(f"Inbound WhatsApp from: {from_number}")

        # Try both formats
        normalized = from_number.replace("whatsapp:", "").strip()
        print(f"Normalized number: {normalized}")

        try:
            profile_res = supabase.table("profiles")\
                .select("student_id, whatsapp_number")\
                .eq("whatsapp_number", normalized)\
                .execute()

            profile = profile_res.data[0] if profile_res.data else None

            if not profile:
                profile_res2 = supabase.table("profiles")\
                    .select("student_id, whatsapp_number")\
                    .eq("whatsapp_number", from_number)\
                    .execute()
                profile = profile_res2.data[0] if profile_res2.data else None

        except Exception as e:
            print(f"Profile lookup error: {e}")
            profile = None

        print(f"Profile found: {profile}")

        if not profile:
            twiml = '<?xml version="1.0" encoding="UTF-8"?><Response><Message>Please register your WhatsApp number in CampusFlow first. Go to dashboard, Data Sources, WhatsApp section and save your number.</Message></Response>'
            return Response(content=twiml, media_type="application/xml")

        student_id = profile["student_id"]
        extracted = extract_tasks_from_messages([Body])
        _, created, _ = save_extracted_tasks(student_id, extracted)
        
        twiml_response = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response><Message>Got it! Created {created} task(s) from your message.</Message></Response>"""
        return Response(content=twiml_response, media_type="application/xml")
    except Exception as e:
        print(f"ERROR in inbound_whatsapp: {e}")
        traceback.print_exc()
        twiml_error = """<?xml version="1.0" encoding="UTF-8"?>
<Response><Message>Error processing your request.</Message></Response>"""
        return Response(content=twiml_error, media_type="application/xml")
