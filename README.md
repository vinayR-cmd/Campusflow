# 🎓 CampusFlow
> **CampusFlow** is a smarter AI-powered campus life copilot designed for students to track classes, automate task extractions, monitor attendance safety margins, prepare for placements, and query institutional knowledge. 

Built for *HackOn with Amazon Season 6.0*.

---

## 🏛️ System Architecture

CampusFlow is split into three main modules:
1. **Backend (FastAPI)**: Serves AI pipelines, scheduler integrations, PDF document generations, and data processing.
2. **Frontend (Next.js)**: Modern, responsive user interface styled with a custom brand palette (`#6C47FF` brand purple), Google Inter typography, sticky tab systems, and clean cards.
3. **Mock ERP (FastAPI)**: Simulates a college portal database to enable credentialed attendance scraping/sync.

```
                   ┌───────────────────────────────────────┐
                   │               FRONTEND                │
                   │               (Next.js)               │
                   └──────────────────┬────────────────────┘
                                      │
                                      ▼ API Requests
                   ┌───────────────────────────────────────┐
                   │               BACKEND                 │
                   │              (FastAPI)                │
                   └──────┬───────────┬────────────┬───────┘
                          │           │            │
      Chroma Vector DB ◄──┘           │            └──► Supabase DB & Auth
   (Gemini Text Embeddings)           ▼ AI APIs
                          ┌────────────────────────┐
                          │ OpenAI API (gpt-4o-mini│
                          │ Gemini Vision (OCR)    │
                          └────────────────────────┘
```

---

## 📁 Repository Folder Structure

```
d:\campusflow
├── Dockerfile.backend        # Docker build specs for FastAPI service
├── Dockerfile.frontend       # Docker build specs for Next.js service
├── docker-compose.yml        # Multi-container local orchestration script
├── backend/                  # Fast API Backend Source
│   ├── main.py               # Main API launch & lifecycle hooks
│   ├── config.py             # Key configurations & environment bindings
│   ├── deps.py               # Authentication dependencies
│   ├── Procfile              # AWS Elastic Beanstalk process configuration
│   ├── runtime.txt           # Python environment specification
│   ├── requirements.txt      # Python dependencies
│   ├── schema.sql            # Core Supabase SQL database schema
│   ├── routers/              # Endpoint modules
│   │   ├── attendance.py     # OCR scan & mock ERP synchronization
│   │   ├── briefing.py       # OpenAI-driven daily updates
│   │   ├── campus_kb.py      # Chroma Vector search and Q&A chat
│   │   ├── condonation.py    # Automatic PDF application generator
│   │   ├── gmail.py          # Google API scanning & parsing
│   │   ├── leaderboard.py    # Student ranks & dynamic score logging
│   │   ├── placement.py      # Personal prep roadmaps & target companies
│   │   ├── timetable.py      # Timetable image parser
│   │   └── ...
│   └── services/             # Helper business logic layers
│       ├── ahs_service.py    # Dynamic Academic Health Score calculations
│       ├── gemini_service.py # OCR parsing & semantic vector creation
│       ├── openai_service.py # Core NLP agent completions (OpenAI)
│       └── supabase_client.py# Supabase query handlers
│
├── frontend/                 # Next.js Frontend App
│   ├── package.json          # Dependency packages
│   ├── next.config.mjs       # Next.js stand-alone output options
│   ├── tailwind.config.ts    # Brand color setups (#6C47FF)
│   ├── app/                  # App Router Layouts & Routing
│   │   ├── layout.tsx        # Inter Typography loading & main frame
│   │   ├── page.tsx          # Landing redirect page
│   │   ├── (auth)/           # OAuth registration
│   │   ├── (dashboard)/      # Student dashboard & profile editor
│   │   └── (onboarding)/     # Step-by-step student data setup
│   └── components/           # UI Components
│       ├── dashboard/        # Widget cards (Briefing, Checklist, Tasks)
│       ├── onboarding/       # Setup pages (College selector, Career goals)
│       └── ui/               # Core atomic blocks (Buttons, Card wraps)
│
└── mock_erp/                 # Simulated College Portal
    ├── main.py               # ERP credential checker & syllabus data
    ├── requirements.txt      # ERP packages
    └── start.bat             # Auto-launch script
```

---

## 🌟 Unique Selling Points (USPs)

1. **Academic Health Score (AHS)**: A proprietary composite metric that models student wellbeing. It dynamically factors in class attendance margins, homework submission timeliness, placement milestone achievements, and cognitive task loads to score the student's current status out of 100.
2. **Multi-Source AI Orchestration**: Coordinates two top-tier foundation models. OpenAI (`gpt-4o-mini`) handles text reasoning (roadmaps, WhatsApp task logs, condonation formatting) while Google Gemini AI drives timetable OCR parsing and generates text embeddings.
3. **Gmail & WhatsApp Deadline Harvester**: Passively tracks school notifications. A student simply forwards complex group texts to a WhatsApp bot or links their Gmail inbox, and the background agent filters academic tasks, sets subject context, and logs deadlines instantly.
4. **Condonation Application Automator**: If attendance in any course drops below the mandatory 75%, a button appears allowing the student to specify absent dates and select HOD-ready reasons. The engine compiles this into a clean, downloadable application letter PDF.
5. **Real-time Vectorized Campus Q&A**: Lets students upload syllabus, college handbooks, or course sheets. The pipeline indexes them into ChromaDB, allowing students to query complex policies directly from the dashboard chat.

---

## 🔑 Core API Endpoints

### 🗓️ Timetable
*   `POST /api/timetable/upload` - Scans uploaded timetable files using Gemini Vision and writes class sessions to the database.

### 📈 Attendance
*   `GET /api/attendance/my` - Fetches the user's current attendance records.
*   `POST /api/attendance/upload-screenshot` - Parses student portal attendance table screenshots.
*   `POST /api/attendance/manual` - Saves manual attendance adjustments.
*   `POST /api/attendance/connect-erp` - Registers student credentials with the college portal mock database.
*   `POST /api/attendance/sync-erp` - Scrapes live attendance statistics on-demand.

### ✉️ Integrations
*   `POST /api/whatsapp/quick-add` - Extracts study deadlines and course targets from raw text dumps.
*   `GET /api/gmail/auth-url` - Returns Google API access request link.
*   `POST /api/gmail/scan` - Initiates background email parsing.

### 🎓 Career & Placement
*   `GET /api/placement/my-plan` - Retrieves the student's preparation roadmap and readiness index.
*   `POST /api/placement/generate-plan` - Re-evaluates target companies and triggers roadmap generation via OpenAI.

### 🏆 Gamification
*   `GET /api/leaderboard/scores` - Displays peer leaderboard rankings.
*   `POST /api/leaderboard/award-points` - Appends positive points to profile for task completions or device connections.

---

## 🛠️ Local Development Setup

### 1. Prerequisites
Ensure you have the following installed:
*   Python 3.11+
*   Node.js 18+
*   Git
*   Supabase Account & Project

---

### 2. Backend Setup
1. Open a terminal in `./backend`.
2. Create and activate a python virtual environment:
   ```bash
   python -m venv venv
   # On Windows (PowerShell)
   .\venv\Scripts\Activate.ps1
   # On macOS/Linux
   source venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Create a `.env` file inside the `./backend` directory:
   ```env
   # Supabase Configuration
   SUPABASE_URL=your_supabase_url
   SUPABASE_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE=your_supabase_service_role_key

   # LLM Credentials
   GEMINI_API_KEY=your_google_gemini_api_key
   OPENAI_API_KEY=your_openai_api_key

   # Gmail OAuth Configuration
   GMAIL_CLIENT_ID=your_gmail_client_id
   GMAIL_CLIENT_SECRET=your_gmail_client_secret
   GOOGLE_REDIRECT_URI=http://localhost:8000/api/gmail/oauth2callback
   ```
5. Launch the backend development server:
   ```bash
   uvicorn main:app --host 127.0.0.1 --port 8000 --reload
   ```

---

### 3. Frontend Setup
1. Open a terminal in `./frontend`.
2. Install npm dependencies:
   ```bash
   npm install
   ```
3. Create a `.env.local` file inside the `./frontend` directory:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   NEXT_PUBLIC_API_URL=http://localhost:8000
   ```
4. Start the Next.js development server:
   ```bash
   npm run dev
   ```

---

### 4. Mock ERP Setup
1. Open a terminal in `./mock_erp`.
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Start the Mock ERP portal server:
   ```bash
   python -m uvicorn main:app --host 127.0.0.1 --port 8001 --reload
   ```
   *Accredited test account credentials*:
   *   **Roll Number / Enrollment**: `2024CSE001`
   *   **Password**: `student123`

---

## 🐳 Docker Container Orchestration

Run both backend and frontend environments in containerized mode with Docker Compose.

1. Ensure Docker is running.
2. Build and launch services from the repository root:
   ```bash
   docker-compose up --build
   ```
3. The frontend will be accessible at `http://localhost:3000` and backend at `http://localhost:8000`.

---

## 🌐 Production Deployment Notes

*   **AWS Elastic Beanstalk (Backend)**:
    *   Deploy package utilizes the root `./backend/Procfile` setting up `gunicorn` with `uvicorn.workers.UvicornWorker`.
    *   Set python version constraints to `python-3.11` in `./backend/runtime.txt`.
*   **AWS Amplify / Vercel (Frontend)**:
    *   Container setup compiles with Next.js `standalone` target configured in [next.config.mjs](file:///d:/campusflow/frontend/next.config.mjs) for minimized deployment builds.
