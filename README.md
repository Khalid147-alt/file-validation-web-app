# File Upload Validator

An AI-powered web application that validates whether a user's text description matches their uploaded file (PDF, JPG/PNG, or MP4). All processing runs locally — no external API calls.

## Tech Stack

- **Backend:** Python FastAPI
- **Frontend:** React (Vite)
- **AI/ML:** Sentence-Transformers, OpenCLIP, Tesseract OCR — all local

## Requirements

- Python 3.9+
- Node.js 18+
- Tesseract OCR installed on your system

### Install Tesseract OCR

**Windows:**
```
Download the installer from https://github.com/UB-Mannheim/tesseract/wiki
Run the .exe and add the install path (e.g. C:\Program Files\Tesseract-OCR) to your system PATH.
```

**macOS:**
```bash
brew install tesseract
```

**Linux (Debian/Ubuntu):**
```bash
sudo apt update && sudo apt install tesseract-ocr
```

## Setup & Run

### 1. Clone / Download the repo

```bash
cd file-validation-web-app
```

### 2. Backend

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate

# macOS / Linux
source venv/bin/activate

pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The API will be running at `http://localhost:8000`.

### 3. Frontend

Open a second terminal:

```bash
cd frontend
npm install
npm run dev
```

The app will be running at `http://localhost:5173`.

### 4. Open in Browser

Navigate to [http://localhost:5173](http://localhost:5173).

## First Run Note

On the first request, the backend will automatically download the ML models:

- `all-MiniLM-L6-v2` (~80 MB) — sentence embeddings for text similarity
- `ViT-B-32` (OpenCLIP, ~350 MB) — image/video-to-text similarity

This is a one-time download. After that, the app works completely offline.

## How to Test

### Test 1 — Matching PDF (expect green / allowed)

Upload any PDF (e.g. a rental agreement, an invoice, or a research paper).  
In the description, write an accurate summary of the document's contents.  
**Expected result:** Green banner, score ≥ 75%, status "Upload Confirmed".

### Test 2 — Image with vague description (expect yellow / warning)

Upload any JPG or PNG image (e.g. a photo of a cat, a screenshot, a chart).  
In the description, write something vaguely related but not specific (e.g. "some kind of picture" for a photo of a dog).  
**Expected result:** Yellow banner, score between 50–74%, option to "Submit Anyway".

### Test 3 — Completely wrong description (expect red / blocked)

Upload any file (PDF, image, or video).  
In the description, write something completely unrelated (e.g. "A recipe for chocolate cake" for an image of a car).  
**Expected result:** Red banner, score < 50%, status "Upload Rejected".

## API Reference

### POST `/validate`

**Content-Type:** `multipart/form-data`

| Field         | Type   | Description                            |
|---------------|--------|----------------------------------------|
| `file`        | File   | PDF, JPG, PNG, or MP4                  |
| `description` | String | What the user claims the file contains |

**Response:**

```json
{
  "score": 0.82,
  "status": "allowed",
  "message": "Your description matches the file. Upload allowed.",
  "extracted_text": "..."
}
```

| Status      | Score Range | Meaning                     |
|-------------|-------------|-----------------------------|
| `allowed`   | ≥ 0.75      | Description matches file    |
| `warning`   | 0.50 – 0.74 | Partial match               |
| `blocked`   | < 0.50      | Description does not match  |
