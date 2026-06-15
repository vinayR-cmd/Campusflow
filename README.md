# 🎓 CampusFlow
> **CampusFlow** is a smarter AI-powered campus life copilot designed for students to track classes, automate task extractions, monitor attendance safety margins, prepare for placements, and query institutional knowledge. 

Built for *HackOn with Amazon Season 6.0*.

---

## 🏛️ System Architecture

CampusFlow is split into three main modules:
1. **Backend (FastAPI)**: Serves AI pipelines, scheduler integrations, PDF document generations, and data processing.
2. **Frontend (Next.js)**: Modern, responsive user interface styled with a custom brand palette (`#6C47FF` brand purple), Google Inter typography, sticky tab systems, and clean cards.
3. **Mock ERP (FastAPI)**: Simulates a college portal database to enable credentialed attendance scraping/sync.

### 🧠 The Hybrid AI Engine
*   **OpenAI API (`gpt-4o-mini`)**: Primary engine for natural language parsing (extracting tasks from WhatsApp dumps, scanning Gmail alerts, generating weekly study roadmaps, composing condonation forms, and structuring daily briefings).
*   **Google Gemini AI (Vision & Embeddings)**:
    *   **Vision OCR**: Scans uploaded class timetables and college ERP attendance screenshots.
    *   **Text Embeddings**: Generates vectorized semantic representations of academic/policy documents.
*   **ChromaDB (Vector Store)**: Locally indexes embedded college documents for real-time question answering via the campus Q&A chat.

---

## 🚀 Key Features

*   **📈 Academic Health Score (AHS)**: Dynamic dashboard metric (weighted: 30% Attendance, 25% Deadlines, 25% Placement Readiness, 20% Cognitive Load) showing overall academic health.
*   **📅 AI Morning Briefing**: Summarizes daily schedules, next departures for selected bus routes, and high-priority homework deadlines.
*   **🤖 WhatsApp Parser & Forwarder**: Register a phone number to parse forwarded texts automatically, or drop chat logs directly into the inline search-like input box.
*   **📧 Gmail Scanner**: Periodically pulls emails (via background cron) to isolate exam notifications, project deadlines, and syllabus files.
*   **🛡️ Attendance Safety Margin**: Subject-by-subject attendance safety calculation. Warns how many lectures can be missed before falling below 75% and provides an **automatic condonation application PDF generator**.
*   **🎯 Placement Copilot**: Generates weekly custom learning tracks, logs readiness scores, and manages skill chips.
*   **🏆 Campus Leaderboard**: Awards score points (e.g. `+10` on-time submission, `+5` ERP connection, `+3` WhatsApp pairing) to gamify campus metrics.

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
