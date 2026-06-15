import json
import os
import re
import google.generativeai as genai
from groq import Groq
from services.openai_service import openai_chat
from config import GEMINI_API_KEY

genai.configure(api_key=GEMINI_API_KEY)

_groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))

VISION_MODEL = "gemini-2.5-flash"
TEXT_MODEL = "gemini-2.5-flash"
EMBEDDING_MODEL = "models/gemini-embedding-001"

TIMETABLE_PROMPT = (
    "Extract this college timetable into a JSON array. Each element: "
    "{day: string (Monday/Tuesday etc), time_start: string (HH:MM), "
    "time_end: string (HH:MM), subject: string, room: string, faculty: string}. "
    "Handle merged cells. If a cell spans multiple days or times, repeat the entry. "
    "Return ONLY valid JSON array, no explanation."
)

OCR_PROMPT = (
    "Extract all readable text from this document image, preserving structure "
    "as plain text. Return ONLY the extracted text, no commentary."
)

EMAIL_EXTRACTION_PROMPT = (
    "Extract any academic deadlines, exam dates, events, or important notices "
    "from this email. Return JSON: {found: bool, task: string, subject: string, "
    "deadline: string or null, priority: high/medium/low, type: deadline/event/notice}. "
    "If nothing actionable, return {found: false}"
)


def _extract_json(text: str):
    """Strip markdown code fences and parse the first JSON value found."""
    cleaned = text.strip()
    cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
    cleaned = re.sub(r"\s*```$", "", cleaned)
    cleaned = cleaned.strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        # Fallback: try to locate the outermost [] or {}
        for open_ch, close_ch in (("[", "]"), ("{", "}")):
            start = cleaned.find(open_ch)
            end = cleaned.rfind(close_ch)
            if start != -1 and end != -1 and end > start:
                try:
                    return json.loads(cleaned[start : end + 1])
                except json.JSONDecodeError:
                    continue
        raise


def extract_timetable_from_file(file_bytes: bytes, mime_type: str) -> list[dict]:
    """Send a timetable file (image or pdf) to Gemini Vision and return parsed slots."""
    model = genai.GenerativeModel(VISION_MODEL)
    response = model.generate_content(
        [
            TIMETABLE_PROMPT,
            {"mime_type": mime_type, "data": file_bytes},
        ]
    )
    data = _extract_json(response.text)
    if not isinstance(data, list):
        raise ValueError("Gemini did not return a JSON array for the timetable")
    return data


def extract_text_from_image(file_bytes: bytes, mime_type: str) -> str:
    """Use Gemini Vision to OCR text out of an image document."""
    model = genai.GenerativeModel(VISION_MODEL)
    response = model.generate_content(
        [
            OCR_PROMPT,
            {"mime_type": mime_type, "data": file_bytes},
        ]
    )
    return response.text.strip()


def extract_email_info(subject: str, body_snippet: str) -> dict:
    try:
        prompt = f"Extract academic deadline or event from this email. Return JSON only: {{\"found\": bool, \"task\": string, \"subject\": string, \"deadline\": string or null, \"priority\": \"high/medium/low\", \"type\": \"deadline/event/notice\"}}. If nothing actionable return {{\"found\": false}}.\n\nSubject: {subject}\nBody: {body_snippet}"
        text = openai_chat(
            prompt=prompt,
            system="Extract academic information from emails. Return only valid JSON.",
            max_tokens=300,
            temperature=0.1
        )
        import json, re
        text = re.sub(r'^```json\s*', '', text)
        text = re.sub(r'\s*```$', '', text)
        return json.loads(text)
    except Exception as e:
        print(f"Email extraction error: {e}")
        return {"found": False}


def embed_text(text: str, task_type: str = "retrieval_document") -> list[float]:
    import google.generativeai as genai
    result = genai.embed_content(
        model="models/gemini-embedding-001",
        content=text,
        task_type=task_type,
    )
    return result["embedding"]


def embed_texts(texts: list[str], task_type: str = "retrieval_document") -> list[list[float]]:
    """Generate embeddings for a batch of texts."""
    return [embed_text(t, task_type=task_type) for t in texts]
