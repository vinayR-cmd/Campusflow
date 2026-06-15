import os
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")

TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN")
TWILIO_WHATSAPP_NUMBER = os.getenv("TWILIO_WHATSAPP_NUMBER")

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:8000/api/gmail/callback")

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

CHROMA_DB_PATH = os.getenv("CHROMA_DB_PATH", "./chroma_db")

# Known college email domains -> college names
KNOWN_COLLEGES = {
    "kiet.edu": "KIET Group of Institutions",
}


def college_from_domain(email: str) -> str | None:
    """Return the known college name for an email domain, or None if unknown."""
    if not email or "@" not in email:
        return None
    domain = email.split("@")[-1].lower().strip()
    return KNOWN_COLLEGES.get(domain)


def sanitize_domain(email_or_college: str) -> str:
    """Turn an email domain or college name into a chromadb-safe collection name."""
    base = email_or_college.lower().strip()
    if "@" in base:
        base = base.split("@")[-1]
    safe = "".join(c if c.isalnum() else "_" for c in base)
    while "__" in safe:
        safe = safe.replace("__", "_")
    return safe.strip("_")
