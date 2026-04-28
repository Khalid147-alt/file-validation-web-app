import io
import re
import tempfile
import os

import numpy as np
import pdfplumber
import pytesseract
pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
from PIL import Image
from fastapi import FastAPI, File, Form, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sentence_transformers import SentenceTransformer, util as st_util

app = FastAPI(title="File Upload Validator")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174"],
    allow_methods=["*"],
    allow_headers=["*"],
)

sentence_model: SentenceTransformer | None = None
clip_model = None
clip_preprocess = None
clip_tokenizer = None


def get_sentence_model():
    global sentence_model
    if sentence_model is None:
        sentence_model = SentenceTransformer("all-MiniLM-L6-v2")
    return sentence_model


def get_clip():
    global clip_model, clip_preprocess, clip_tokenizer
    if clip_model is None:
        import open_clip

        clip_model, _, clip_preprocess = open_clip.create_model_and_transforms(
            "ViT-B-32", pretrained="openai"
        )
        clip_tokenizer = open_clip.get_tokenizer("ViT-B-32")
        clip_model.eval()
    return clip_model, clip_preprocess, clip_tokenizer


def clean_text(text: str) -> str:
    text = re.sub(r'\s+', ' ', text).strip()
    return text[:1000]


def text_score(text: str, description: str) -> tuple[float, float]:
    model = get_sentence_model()
    emb_a = model.encode(text, convert_to_tensor=True)
    emb_b = model.encode(description, convert_to_tensor=True)
    raw = float(st_util.cos_sim(emb_a, emb_b).item())
    final = max(0.0, min(1.0, (raw - 0.05) / 0.15))
    return raw, final


def pdf_keyword_bonus(extracted: str, description: str) -> float:
    lower_text = extracted.lower()
    words = [w for w in description.lower().split() if len(w) > 4]
    matches = sum(1 for w in words if w in lower_text)
    if matches >= 2:
        return 0.20
    if matches >= 1:
        return 0.10
    return 0.0


def clip_score(images: list[Image.Image], text: str) -> tuple[float, float]:
    import torch

    model, preprocess, tokenizer = get_clip()
    image_tensors = torch.stack([preprocess(img) for img in images])
    text_tokens = tokenizer([text])

    with torch.no_grad():
        image_features = model.encode_image(image_tensors)
        text_features = model.encode_text(text_tokens)

    image_features = image_features / image_features.norm(dim=-1, keepdim=True)
    text_features = text_features / text_features.norm(dim=-1, keepdim=True)

    avg_image = image_features.mean(dim=0, keepdim=True)
    avg_image = avg_image / avg_image.norm(dim=-1, keepdim=True)

    raw = float((avg_image @ text_features.T).item())
    final = max(0.0, min(1.0, (raw - 0.15) / 0.25))
    return raw, final


def extract_pdf_text(data: bytes) -> str:
    with pdfplumber.open(io.BytesIO(data)) as pdf:
        pages = [page.extract_text() or "" for page in pdf.pages]
    return "\n".join(pages).strip()


def extract_image_text(data: bytes) -> str:
    image = Image.open(io.BytesIO(data))
    return pytesseract.image_to_string(image).strip()


def extract_video_keyframes(data: bytes, n_frames: int = 5) -> list[Image.Image]:
    import cv2

    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".mp4")
    try:
        tmp.write(data)
        tmp.close()
        cap = cv2.VideoCapture(tmp.name)
        total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        if total <= 0:
            raise ValueError("Could not read video frames")

        indices = np.linspace(0, total - 1, n_frames, dtype=int)
        frames: list[Image.Image] = []
        for idx in indices:
            cap.set(cv2.CAP_PROP_POS_FRAMES, int(idx))
            ret, frame = cap.read()
            if ret:
                rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                frames.append(Image.fromarray(rgb))
        cap.release()
        return frames
    finally:
        os.unlink(tmp.name)


def classify(score: float) -> dict:
    if score >= 0.75:
        return {
            "status": "allowed",
            "message": "Your description matches the file. Upload allowed.",
        }
    if score >= 0.50:
        return {
            "status": "warning",
            "message": (
                "Improve your text area description, or if you are happy "
                "with your description, click the Submit button to submit the file."
            ),
        }
    return {
        "status": "blocked",
        "message": "Your description does not match the uploaded file. Upload not allowed.",
    }


def log(file_type: str, content: str, description: str, raw: float, final: float):
    print(f"File type: {file_type}")
    print(f"Extracted content (200 chars): {content[:200]}")
    print(f"Description: {description}")
    print(f"Raw score: {raw}")
    print(f"Final score: {final}")


@app.post("/validate")
async def validate(file: UploadFile = File(...), description: str = Form(...)):
    if not description.strip():
        raise HTTPException(status_code=400, detail="Description is required.")

    filename = (file.filename or "").lower()
    data = await file.read()

    if filename.endswith(".pdf"):
        extracted = extract_pdf_text(data)
        if not extracted:
            log("pdf", "", description, 0.0, 0.0)
            return {"score": 0.0, **classify(0.0), "extracted_text": ""}

        cleaned = clean_text(extracted)
        raw, final = text_score(cleaned, description)
        final = min(1.0, final + pdf_keyword_bonus(extracted, description))
        log("pdf", extracted, description, raw, final)
        return {"score": round(final, 4), **classify(final), "extracted_text": extracted}

    if filename.endswith((".jpg", ".jpeg", ".png")):
        extracted = ""
        try:
            extracted = extract_image_text(data)
        except Exception as e:
            print(f"OCR failed (skipping): {e}")

        image = Image.open(io.BytesIO(data)).convert("RGB")

        try:
            if len(extracted) >= 20:
                cleaned = clean_text(extracted)
                raw, final = text_score(cleaned, description)
                log("image-ocr", extracted, description, raw, final)
            else:
                raw, final = clip_score([image], description)
                log("image-clip", extracted, description, raw, final)

            return {"score": round(final, 4), **classify(final), "extracted_text": extracted}
        except Exception as e:
            print(f"Image scoring failed: {e}")
            return {
                "score": 0.5,
                "status": "warning",
                "message": (
                    "Improve your text area description, or if you are happy "
                    "with your description, click the Submit button to submit the file."
                ),
                "extracted_text": extracted,
            }

    if filename.endswith(".mp4"):
        frames = extract_video_keyframes(data)
        if not frames:
            log("video", "", description, 0.0, 0.0)
            return {"score": 0.0, **classify(0.0), "extracted_text": ""}

        raw, final = clip_score(frames, description)
        log("video", "", description, raw, final)
        return {"score": round(final, 4), **classify(final), "extracted_text": ""}

    raise HTTPException(
        status_code=400,
        detail="Unsupported file type. Please upload a PDF, JPG, PNG, or MP4.",
    )
