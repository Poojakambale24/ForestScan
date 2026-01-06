# ForestScan

ForestScan — Tree-level change detection dashboard built with Flask, Leaflet, Chart.js and Tailwind.

This repository contains code to visualize NDVI and GLCM-based change detection at taluka (sub-district) level. Data files (CSV) are included in the project root.

How to run locally

1. Create a Python virtual environment and install dependencies (Flask, pandas, numpy):

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install flask pandas numpy
```

2. Start the app:

```powershell
python app.py
```

Open http://127.0.0.1:5000 in your browser.

Publish to GitHub (local steps)

Run these commands from the project root on your machine (PowerShell):

```powershell
git init
git add .
git commit -m "first commit"
git branch -M main
git remote add origin https://github.com/Poojakambale24/ForestScan.git
git push -u origin main
```

Notes on authentication

- The `git push` step requires authentication. On Windows, the easiest ways are:
	- Install and use Git Credential Manager Core (recommended). It will pop up an OAuth/GUI login.
	- Use SSH keys (add your public key to GitHub and push via SSH URL).
	- Use a personal access token (PAT) in place of your password if Git prompts for credentials.

If you want, I can prepare a `.gitignore` and a small `requirements.txt` for you before pushing.

https://github.com/Jadhav-Prathamesh-01
<img width="1870" height="890" alt="Screenshot 2025-11-19 172720" src="https://github.com/user-attachments/assets/841ae32d-55fc-4a48-b841-5199ad906c0a" />


