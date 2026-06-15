import logging
from urllib.parse import urlencode

import httpx
from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse

from config import (
    FRONTEND_URL,
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI,
)
from deps import get_current_student
from services.gemini_service import extract_email_info
from services.supabase_client import supabase

router = APIRouter()
logger = logging.getLogger("campusflow.gmail")

GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"
GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me"
GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly"

ACTIONABLE_KEYWORDS = [
    "assignment",
    "deadline",
    "submission",
    "exam",
    "notice",
    "placement",
    "attendance",
]


@router.get("/auth-url")
def get_auth_url(student: dict = Depends(get_current_student)):
    """Return the Google OAuth consent URL for connecting Gmail (readonly scope)."""
    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": GMAIL_SCOPE,
        "access_type": "offline",
        "prompt": "consent",
        "state": student["id"],
    }
    return {"url": f"{GOOGLE_AUTH_ENDPOINT}?{urlencode(params)}"}


@router.get("/callback")
def gmail_callback(code: str, state: str):
    """OAuth callback: exchange the code for tokens, store them, and trigger an initial sync."""
    student_id = state

    with httpx.Client() as client:
        token_res = client.post(
            GOOGLE_TOKEN_ENDPOINT,
            data={
                "code": code,
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "redirect_uri": GOOGLE_REDIRECT_URI,
                "grant_type": "authorization_code",
            },
        )

    if token_res.status_code != 200:
        return RedirectResponse(f"{FRONTEND_URL}/dashboard?gmail=error")

    token_data = token_res.json()
    access_token = token_data.get("access_token")
    refresh_token = token_data.get("refresh_token")

    update = {"gmail_access_token": access_token, "gmail_connected": True}
    if refresh_token:
        update["gmail_refresh_token"] = refresh_token

    supabase.table("profiles").update(update).eq("student_id", student_id).execute()

    try:
        created = sync_gmail_for_student(student_id)
    except Exception:
        logger.exception("Initial gmail sync failed for %s", student_id)
        created = 0

    return RedirectResponse(f"{FRONTEND_URL}/dashboard?gmail=connected&tasks={created}")


@router.post("/sync")
def sync_now(student: dict = Depends(get_current_student)):
    """Manually trigger a Gmail sync for the current student."""
    created = sync_gmail_for_student(student["id"])
    return {"status": "ok", "tasks_created": created}


def _refresh_access_token(refresh_token: str) -> str | None:
    with httpx.Client() as client:
        res = client.post(
            GOOGLE_TOKEN_ENDPOINT,
            data={
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "refresh_token": refresh_token,
                "grant_type": "refresh_token",
            },
        )
    if res.status_code != 200:
        return None
    return res.json().get("access_token")


def _fetch_messages(access_token: str, college_domain: str | None) -> list[dict]:
    keyword_query = " OR ".join(f"subject:{kw}" for kw in ACTIONABLE_KEYWORDS)
    query_parts = [f"({keyword_query})"]
    if college_domain:
        query_parts.append(f"from:(*@{college_domain})")
    q = " OR ".join(query_parts)

    headers = {"Authorization": f"Bearer {access_token}"}

    with httpx.Client() as client:
        list_res = client.get(
            f"{GMAIL_API_BASE}/messages",
            headers=headers,
            params={"q": q, "maxResults": 50},
        )
        if list_res.status_code != 200:
            return []

        message_ids = [m["id"] for m in list_res.json().get("messages", [])]

        messages = []
        for msg_id in message_ids:
            msg_res = client.get(
                f"{GMAIL_API_BASE}/messages/{msg_id}",
                headers=headers,
                params={"format": "metadata", "metadataHeaders": "Subject"},
            )
            if msg_res.status_code != 200:
                continue
            msg_data = msg_res.json()
            headers_list = msg_data.get("payload", {}).get("headers", [])
            subject = next((h["value"] for h in headers_list if h["name"] == "Subject"), "")
            snippet = msg_data.get("snippet", "")
            messages.append({"subject": subject, "snippet": snippet})

    return messages


def sync_gmail_for_student(student_id: str) -> int:
    """Fetch recent relevant emails for `student_id`, extract tasks with Gemini, and store them.

    Returns the number of tasks created.
    """
    profile_res = (
        supabase.table("profiles")
        .select("gmail_access_token, gmail_refresh_token, gmail_connected, college_domain")
        .eq("student_id", student_id)
        .maybe_single()
        .execute()
    )
    profile = profile_res.data if profile_res else None
    if not profile or not profile.get("gmail_connected"):
        return 0

    access_token = profile.get("gmail_access_token")
    refresh_token = profile.get("gmail_refresh_token")
    college_domain = profile.get("college_domain")

    messages = _fetch_messages(access_token, college_domain)

    if not messages and refresh_token:
        new_access_token = _refresh_access_token(refresh_token)
        if new_access_token:
            supabase.table("profiles").update({"gmail_access_token": new_access_token}).eq(
                "student_id", student_id
            ).execute()
            access_token = new_access_token
            messages = _fetch_messages(access_token, college_domain)

    created = 0
    for message in messages:
        try:
            info = extract_email_info(message["subject"], message["snippet"])
        except Exception:
            logger.exception("Gemini extraction failed for an email")
            continue

        if not info.get("found"):
            continue

        supabase.table("tasks").insert(
            {
                "student_id": student_id,
                "task": info.get("task", ""),
                "subject": info.get("subject", message["subject"]),
                "deadline": info.get("deadline"),
                "priority": info.get("priority", "medium"),
                "type": info.get("type", "notice"),
                "status": "pending",
                "source": "gmail",
            }
        ).execute()
        created += 1

    return created


# ---------------------------------------------------------------------------
# Background sync every 6 hours for all students with Gmail connected
# ---------------------------------------------------------------------------

_scheduler = BackgroundScheduler()


def _sync_all_connected_students():
    res = supabase.table("profiles").select("student_id").eq("gmail_connected", True).execute()
    for row in res.data or []:
        try:
            sync_gmail_for_student(row["student_id"])
        except Exception:
            logger.exception("Scheduled gmail sync failed for %s", row["student_id"])


def start_scheduler():
    if not _scheduler.running:
        _scheduler.add_job(_sync_all_connected_students, "interval", hours=6, id="gmail_sync")
        _scheduler.start()


def shutdown_scheduler():
    if _scheduler.running:
        _scheduler.shutdown(wait=False)
