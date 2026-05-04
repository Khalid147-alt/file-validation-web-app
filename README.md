# AI-Powered File Description Validator

![Python](https://img.shields.io/badge/Python-3.9+-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-61DAFB?logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)
![Local AI](https://img.shields.io/badge/AI-100%25%20Local-success)

## Overview

A web app that decides whether a user's text description actually matches the file they're trying to upload — before letting the upload through. It scores the semantic similarity between the description and the file's contents on a 0–100% scale, then gates the upload: green (allowed) at ≥75%, yellow (warning, override available) at 50–74%, red (blocked) below 50%.

The whole pipeline runs **locally** — no external API calls, no cloud inference, no data leaving the machine. Useful as a portfolio piece, but also as a real moderation primitive: anywhere users upload files with required descriptions (job applications, marketplace listings, evidence submissions), this stops obvious mismatches at the boundary.

## Features

- **Drag-and-drop upload** with file-type auto-detection
- **Real-time match scoring (0–100%)** rendered as a labeled gauge after upload
- **Multi-modal support** — PDF, JPG/PNG, MP4 video
- **Three-tier gate** — allowed / warning / blocked, with explicit user-facing reasoning
- **100% local inference** — sentence-transformers for text, OpenCLIP for image/video, Tesseract for OCR. No keys, no usage caps, no privacy concerns
- **REST API** — the validator exposes a single `/validate` endpoint, usable independently of the frontend

## How it works

```
   ┌──────────────┐                  ┌─────────────────────────────────┐
   │  React UI    │ multipart POST   │  FastAPI /validate              │
   │  (drag/drop) │ ───────────────▶ │                                 │
   └──────────────┘                  │   ┌─────────────────────────┐   │
                                     │   │  Extract content        │   │
                                     │   │  • PDF  → text          │   │
                                     │   │  • IMG  → OCR + CLIP    │   │
                                     │   │  • MP4  → frames + CLIP │   │
                                     │   └────────────┬────────────┘   │
                                     │                ▼                │
                                     │   ┌─────────────────────────┐   │
                                     │   │  Embed description      │   │
                                     │   │  + extracted content    │   │
                                     │   │  (MiniLM / OpenCLIP)    │   │
                                     │   └────────────┬────────────┘   │
                                     │                ▼                │
                                     │   ┌─────────────────────────┐   │
                                     │   │ cosine similarity →     │   │
                                     │   │ score 0.0–1.0           │   │
                                     │   │ status: allowed / warn  │   │
                                     │   │         / blocked       │   │
                                     │   └─────────────────────────┘   │
                                     └────────────────┬────────────────┘
                                                      ▼
                                              { score, status,
                                                message, extracted_text }
```

1. User writes a description and drops a file into the React frontend.
2. The frontend POSTs both as `multipart/form-data` to FastAPI's `/validate`.
3. The backend extracts content based on file type — PDF text, OCR + CLIP embedding for images, sampled frames + CLIP for video.
4. Both the description and the extracted content are embedded and compared via cosine similarity.
5. The score is bucketed into a status (`allowed` / `warning` / `blocked`) and returned to the UI, which renders the gate and either accepts or refuses the upload.

## Tech stack

| Layer | Choice |
|-------|--------|
| Backend | Python 3.9+ · FastAPI · Uvicorn |
| Frontend | React · Vite |
| Text embeddings | sentence-transformers (`all-MiniLM-L6-v2`) |
| Image/video embeddings | OpenCLIP (`ViT-B-32`) |
| OCR | Tesseract |
| Transport | REST · `multipart/form-data` |

## Setup & installation

### Prerequisites

- Python 3.9+
- Node.js 18+
- Tesseract OCR installed on your system

### Install Tesseract

**Windows:** download from https://github.com/UB-Mannheim/tesseract/wiki and add the install path (e.g. `C:\Program Files\Tesseract-OCR`) to `PATH`.

**macOS:** `brew install tesseract`

**Linux (Debian/Ubuntu):** `sudo apt update && sudo apt install tesseract-ocr`

### Backend

```bash
cd backend
python -m venv venv
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The API listens on `http://localhost:8000`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The UI runs on `http://localhost:5173`.

### First-run note

On the first request the backend downloads the ML models:

- `all-MiniLM-L6-v2` (~80 MB)
- `ViT-B-32` (OpenCLIP, ~350 MB)

One-time download. After that the app works fully offline.

## API reference

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

| Status     | Score range  | Meaning                    |
|------------|--------------|----------------------------|
| `allowed`  | ≥ 0.75       | Description matches file   |
| `warning`  | 0.50 – 0.74  | Partial match              |
| `blocked`  | < 0.50       | Description does not match |

## Test cases

| Test | Setup | Expected |
|------|-------|----------|
| Matching PDF | Upload a PDF with an accurate summary as the description | Green banner, score ≥ 75% |
| Vague image description | Upload an image with a vaguely-related description | Yellow banner, 50–74%, "Submit Anyway" option |
| Wrong description | Upload any file with completely unrelated text | Red banner, < 50%, upload rejected |

## License

MIT
