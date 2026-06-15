@echo off
echo Starting KIET Mock ERP Portal on port 8001...
cd /d D:\campusflow\mock_erp
pip install -r requirements.txt -q
python -m uvicorn main:app --host 127.0.0.1 --port 8001 --reload
pause
