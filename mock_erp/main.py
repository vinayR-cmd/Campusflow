from fastapi import FastAPI, Request, Form
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

app = FastAPI(title="KIET ERP Portal")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mock student database
MOCK_STUDENTS = {
    "2024CSE001": {
        "password": "student123",
        "name": "Rohan Sharma",
        "roll": "2024CSE001",
        "branch": "CSE(AI)",
        "year": 3,
        "semester": 6,
        "attendance": [
            {"code": "CS206L", "name": "Operating System", "component": "THEORY", "attended": 28, "total": 32, "faculty": "Dr. Tanmoy Das"},
            {"code": "CS206P", "name": "Operating System Lab", "component": "PRACTICAL", "attended": 12, "total": 14, "faculty": "Dr. Tanmoy Das"},
            {"code": "CS401L", "name": "Design and Analysis of Algorithms", "component": "THEORY", "attended": 30, "total": 30, "faculty": "Prof. Gagan Kumar Singh"},
            {"code": "AI308B", "name": "AI Driven Full Stack Development", "component": "BLENDED", "attended": 22, "total": 26, "faculty": "Prof. Anuraag Raj Kamle"},
            {"code": "AI309E", "name": "Introduction to Cloud Computing", "component": "BLENDED", "attended": 18, "total": 28, "faculty": "Dr. Richa Singh"},
            {"code": "HS112L", "name": "Universal Human Values", "component": "THEORY", "attended": 14, "total": 16, "faculty": "Prof. Surbhi Verma"},
            {"code": "HS113L", "name": "Aptitude-2", "component": "THEORY", "attended": 10, "total": 10, "faculty": "Prof. Vinod Kumar Agarawal"},
            {"code": "AI311B", "name": "Deep Learning Essentials", "component": "BLENDED", "attended": 16, "total": 22, "faculty": "Prof. Deepinder Kaur"},
        ]
    }
}

# Session storage (simple dict for demo)
sessions = {}

LOGIN_PAGE = """
<!DOCTYPE html>
<html>
<head>
    <title>KIET ERP - Student Portal</title>
    <style>
        * {{ box-sizing: border-box; margin: 0; padding: 0; }}
        body {{ 
            font-family: Arial, sans-serif; 
            background: #f0f4f8;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
        }}
        .container {{
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 20px rgba(0,0,0,0.1);
            overflow: hidden;
            width: 420px;
        }}
        .header {{
            background: #1a237e;
            color: white;
            padding: 24px;
            text-align: center;
        }}
        .header h1 {{ font-size: 20px; margin-bottom: 4px; }}
        .header p {{ font-size: 13px; opacity: 0.8; }}
        .form-body {{ padding: 32px; }}
        .form-group {{ margin-bottom: 20px; }}
        label {{ display: block; font-size: 13px; color: #555; margin-bottom: 6px; font-weight: 500; }}
        input {{ 
            width: 100%; 
            padding: 10px 12px; 
            border: 1px solid #ddd; 
            border-radius: 4px;
            font-size: 14px;
        }}
        input:focus {{ outline: none; border-color: #1a237e; }}
        button {{
            width: 100%;
            padding: 12px;
            background: #1a237e;
            color: white;
            border: none;
            border-radius: 4px;
            font-size: 15px;
            cursor: pointer;
            font-weight: 500;
        }}
        button:hover {{ background: #283593; }}
        .error {{ 
            background: #ffebee; 
            color: #c62828; 
            padding: 10px 12px; 
            border-radius: 4px;
            margin-bottom: 16px;
            font-size: 13px;
        }}
        .footer {{
            text-align: center;
            padding: 16px;
            font-size: 12px;
            color: #999;
            border-top: 1px solid #eee;
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>KIET Group of Institutions</h1>
            <p>Student ERP Portal — Academic Management System</p>
        </div>
        <div class="form-body">
            {error}
            <div class="form-group">
                <label>Enrollment Number</label>
                <input type="text" name="username" form="loginForm" placeholder="e.g. 2024CSE001">
            </div>
            <div class="form-group">
                <label>Password</label>
                <input type="password" name="password" form="loginForm" placeholder="Enter password">
            </div>
            <form id="loginForm" method="post" action="/login">
                <input type="hidden" name="username" id="u">
                <input type="hidden" name="password" id="p">
                <button type="submit" 
                    onclick="document.getElementById('u').value=document.querySelector('[name=username]').value;document.getElementById('p').value=document.querySelector('[name=password]').value">
                    Login to Portal
                </button>
            </form>
        </div>
        <div class="footer">
            KIET Group of Institutions, Ghaziabad | Academic Year 2025-26
        </div>
    </div>
</body>
</html>
"""

def get_attendance_page(student_data: dict) -> str:
    rows = ""
    for i, sub in enumerate(student_data["attendance"], 1):
        pct = round((sub["attended"] / sub["total"]) * 100, 1)
        color = "#2e7d32" if pct >= 80 else ("#f57f17" if pct >= 75 else "#c62828")
        status_bg = "#e8f5e9" if pct >= 80 else ("#fff8e1" if pct >= 75 else "#ffebee")
        rows += f"""
        <tr>
            <td>{i}</td>
            <td>{sub['code']}</td>
            <td>{sub['name']}</td>
            <td>{sub['component']}</td>
            <td>{sub['faculty']}</td>
            <td style="text-align:center; font-weight:600; color:{color}; background:{status_bg}">
                {pct}%
            </td>
            <td style="text-align:center">{sub['attended']}</td>
            <td style="text-align:center">{sub['total']}</td>
        </tr>"""
    
    return f"""
<!DOCTYPE html>
<html>
<head>
    <title>KIET ERP - Attendance</title>
    <style>
        * {{ box-sizing: border-box; margin: 0; padding: 0; }}
        body {{ font-family: Arial, sans-serif; background: #f0f4f8; }}
        .topbar {{
            background: #1a237e;
            color: white;
            padding: 12px 24px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }}
        .topbar h1 {{ font-size: 16px; }}
        .topbar span {{ font-size: 13px; opacity: 0.8; }}
        .navbar {{
            background: #283593;
            padding: 0 24px;
            display: flex;
            gap: 0;
        }}
        .nav-item {{
            color: rgba(255,255,255,0.7);
            padding: 12px 20px;
            font-size: 13px;
            cursor: pointer;
            border-bottom: 3px solid transparent;
        }}
        .nav-item.active {{
            color: white;
            border-bottom-color: #ffeb3b;
        }}
        .content {{ padding: 24px; }}
        .page-header {{
            background: white;
            border-radius: 8px;
            padding: 16px 20px;
            margin-bottom: 20px;
            box-shadow: 0 1px 4px rgba(0,0,0,0.1);
        }}
        .page-header h2 {{ font-size: 16px; color: #1a237e; margin-bottom: 4px; }}
        .page-header p {{ font-size: 13px; color: #666; }}
        .student-info {{
            background: white;
            border-radius: 8px;
            padding: 16px 20px;
            margin-bottom: 20px;
            box-shadow: 0 1px 4px rgba(0,0,0,0.1);
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 16px;
        }}
        .info-item label {{ font-size: 11px; color: #999; text-transform: uppercase; display: block; margin-bottom: 2px; }}
        .info-item span {{ font-size: 14px; font-weight: 600; color: #333; }}
        table {{
            width: 100%;
            background: white;
            border-radius: 8px;
            box-shadow: 0 1px 4px rgba(0,0,0,0.1);
            border-collapse: collapse;
            overflow: hidden;
        }}
        th {{
            background: #1a237e;
            color: white;
            padding: 12px 14px;
            text-align: left;
            font-size: 12px;
            font-weight: 500;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }}
        td {{
            padding: 11px 14px;
            font-size: 13px;
            border-bottom: 1px solid #f0f0f0;
            color: #333;
        }}
        tr:last-child td {{ border-bottom: none; }}
        tr:hover td {{ background: #f8f9ff; }}
        .logout {{
            background: rgba(255,255,255,0.15);
            color: white;
            border: 1px solid rgba(255,255,255,0.3);
            padding: 6px 14px;
            border-radius: 4px;
            font-size: 12px;
            cursor: pointer;
            text-decoration: none;
        }}
    </style>
</head>
<body>
    <div class="topbar">
        <h1>KIET Group of Institutions — Student ERP Portal</h1>
        <div style="display:flex;align-items:center;gap:16px">
            <span>Welcome, {student_data['name']}</span>
            <a href="/logout" class="logout">Logout</a>
        </div>
    </div>
    <div class="navbar">
        <div class="nav-item">Dashboard</div>
        <div class="nav-item">Academic</div>
        <div class="nav-item active">Attendance</div>
        <div class="nav-item">Results</div>
        <div class="nav-item">Fee</div>
        <div class="nav-item">Timetable</div>
    </div>
    <div class="content">
        <div class="page-header">
            <h2>Attendance Report — Even Semester 2025-26</h2>
            <p>Current Registered Courses — Attendance as of today</p>
        </div>
        <div class="student-info">
            <div class="info-item">
                <label>Student Name</label>
                <span>{student_data['name']}</span>
            </div>
            <div class="info-item">
                <label>Enrollment No.</label>
                <span>{student_data['roll']}</span>
            </div>
            <div class="info-item">
                <label>Branch</label>
                <span>{student_data['branch']}</span>
            </div>
            <div class="info-item">
                <label>Semester</label>
                <span>{student_data['semester']}</span>
            </div>
        </div>
        <table id="attendanceTable">
            <thead>
                <tr>
                    <th>S.No</th>
                    <th>Course Code</th>
                    <th>Course Name</th>
                    <th>Component</th>
                    <th>Faculty</th>
                    <th>Attendance %</th>
                    <th>Attended</th>
                    <th>Total</th>
                </tr>
            </thead>
            <tbody>
                {rows}
            </tbody>
        </table>
    </div>
</body>
</html>"""


@app.get("/", response_class=HTMLResponse)
def home():
    return LOGIN_PAGE.format(error="")

@app.post("/login", response_class=HTMLResponse)
def login(request: Request, username: str = Form(...), password: str = Form(...)):
    student = MOCK_STUDENTS.get(username)
    if not student or student["password"] != password:
        error = '<div class="error">Invalid enrollment number or password. Try: 2024CSE001 / student123</div>'
        return LOGIN_PAGE.format(error=error)
    sessions[username] = student
    response = RedirectResponse(url=f"/attendance?user={username}", status_code=302)
    return response

@app.get("/attendance", response_class=HTMLResponse)
def attendance(user: str = "2024CSE001"):
    student = MOCK_STUDENTS.get(user, MOCK_STUDENTS["2024CSE001"])
    return get_attendance_page(student)

@app.get("/logout")
def logout():
    return RedirectResponse(url="/")

@app.get("/api/attendance/{username}")
def get_attendance_api(username: str, password: str = "student123"):
    student = MOCK_STUDENTS.get(username)
    if not student or student["password"] != password:
        return {"error": "Invalid credentials"}
    
    attendance_data = []
    for sub in student["attendance"]:
        pct = round((sub["attended"] / sub["total"]) * 100, 1)
        risk = "safe" if pct >= 80 else ("warning" if pct >= 75 else "danger")
        can_miss = max(0, int((sub["attended"] - 0.75 * sub["total"]) / 0.25))
        attendance_data.append({
            "subject": sub["name"],
            "course_code": sub["code"],
            "attended": sub["attended"],
            "total": sub["total"],
            "percentage": pct,
            "risk_level": risk,
            "classes_can_miss": can_miss,
            "faculty": sub["faculty"],
            "component": sub["component"]
        })
    
    return {
        "student": {
            "name": student["name"],
            "roll": student["roll"],
            "branch": student["branch"]
        },
        "attendance": attendance_data
    }

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8001, reload=True)
