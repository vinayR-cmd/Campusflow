from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from config import GEMINI_API_KEY, GROQ_API_KEY
from services.supabase_client import supabase
from services.chroma_service import _client as chroma_client
from routers import auth, timetable, campus_kb, gmail, whatsapp, attendance, condonation, dashboard, tasks, clubs, planner, wellness
from routers.campus_kb import transport_router
from routers.gmail import start_scheduler, shutdown_scheduler
from routers.placement import router as placement_router
from routers.wrapped import router as wrapped_router  
from routers.briefing import router as briefing_router
from routers.leaderboard import router as leaderboard_router, profile_router as profile_leaderboard_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    start_scheduler()
    try:
        from routers.gmail import _scheduler
        from routers.attendance import sync_erp_attendance_job
        if _scheduler.running:
            if not _scheduler.get_job("erp_sync"):
                _scheduler.add_job(sync_erp_attendance_job, "cron", day_of_week="mon", hour=6, minute=0, id="erp_sync")
    except Exception as e:
        print(f"Failed to register ERP sync background job: {e}")
    yield
    shutdown_scheduler()


app = FastAPI(title="CampusFlow API", lifespan=lifespan)

import os
allowed_origins_str = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000")
allowed_origins = [origin.strip() for origin in allowed_origins_str.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
print(f"CORS allowed origins: {allowed_origins}")

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(timetable.router, prefix="/api/timetable", tags=["timetable"])
app.include_router(campus_kb.router, prefix="/api/kb", tags=["campus_kb"])
app.include_router(gmail.router, prefix="/api/gmail", tags=["gmail"])
app.include_router(whatsapp.router, prefix="/api/whatsapp", tags=["whatsapp"])
app.include_router(attendance.router, prefix="/api/attendance", tags=["attendance"])
app.include_router(condonation.router, prefix="/api/condonation", tags=["condonation"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["dashboard"])
app.include_router(transport_router, prefix="/api/transport", tags=["transport"])
app.include_router(tasks.router, prefix="/api/tasks", tags=["tasks"])
app.include_router(clubs.router, prefix="/api/clubs", tags=["clubs"])
app.include_router(planner.router, prefix="/api/planner", tags=["planner"])
app.include_router(wellness.router, prefix="/api/wellness", tags=["wellness"])
app.include_router(placement_router, prefix="/api/placement")
app.include_router(wrapped_router, prefix="/api/wrapped")
app.include_router(briefing_router, prefix="/api/briefing")
app.include_router(leaderboard_router, prefix="/api/leaderboard")
app.include_router(profile_leaderboard_router, prefix="/api/profile")



@app.get("/health")
def health():
    supabase_status = "connected"
    try:
        supabase.table("profiles").select("student_id").limit(1).execute()
    except Exception:
        supabase_status = "error"

    chromadb_status = "ready"
    try:
        chroma_client.heartbeat()
    except Exception:
        chromadb_status = "error"

    return {
        "status": "ok",
        "supabase": supabase_status,
        "chromadb": chromadb_status,
        "gemini": "configured" if GEMINI_API_KEY and "your-" not in GEMINI_API_KEY else "missing",
        "groq": "configured" if GROQ_API_KEY and "your-" not in GROQ_API_KEY else "missing",
    }
