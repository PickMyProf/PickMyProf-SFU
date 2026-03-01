# PickMyProf SFU

PickMyProf is an SFU-focused course decision platform that combines scheduling with professor and section insights to help students make better course choices.

---

## Tech Stack

### Frontend
- React
- Vite
- JavaScript

### Backend
- FastAPI
- Python
- Uvicorn

---

## Prerequisites

Make sure you have these installed on your machine:

- [Node.js](https://nodejs.org/)
- [Python 3](https://www.python.org/downloads/)
- [Git](https://git-scm.com/)
- [VS Code](https://code.visualstudio.com/)

---

## Project Structure

    PickMyProf-SFU/
    ├── frontend/
    ├── backend/
    ├── README.md
    └── .gitignore

---

## Frontend Setup

### 1. Navigate to the frontend folder

    cd frontend

### 2. Install dependencies

    npm install

### 3. Start the frontend development server

    npm run dev

### 4. Open in browser

After running the command above, Vite will show a local URL, usually:

    http://localhost:5173

---

## Backend Setup

### 1. Navigate to the backend folder

    cd backend

### 2. Create a virtual environment

#### Windows

    python -m venv .venv

#### Mac/Linux

    python3 -m venv .venv

### 3. Activate the virtual environment

#### Windows PowerShell

    .\.venv\Scripts\Activate.ps1

#### Windows CMD

    .venv\Scripts\activate

#### Mac/Linux

    source .venv/bin/activate

### 4. Install dependencies

    pip install -r requirements.txt

If `requirements.txt` has not been created yet, install these manually:

    pip install fastapi uvicorn mysql-connector-python python-dotenv

Then save them with:

    pip freeze > requirements.txt

### 5. Start the backend server

    uvicorn app.main:app --reload

### 6. Open in browser

Backend root:

    http://127.0.0.1:8000/
    http://localhost:8000/

Swagger docs:

    http://127.0.0.1:8000/docs
    http://localhost:8000/docs

---

## Running the Full Project

You need **two terminals** open.

### Terminal 1 - Frontend

    cd frontend
    npm install
    npm run dev

### Terminal 2 - Backend

    cd backend
    .\venv\Scripts\Activate.ps1
    uvicorn app.main:app --reload

---

## Notes

- Make sure your backend virtual environment is activated before running the FastAPI server.
- Do not commit `venv/`, `.env`, or `node_modules/` to GitHub.
- If `npm` does not work in PowerShell, you may need to restart VS Code or update your execution policy.

---

## Current Status

This project is currently in early development.  
The frontend and backend have been initialized and are being built out incrementally.

---

## Team

- Alexander Potiagalov
- Khalid Karim
- Yusuf Shalaby
- Mohamed Refaai