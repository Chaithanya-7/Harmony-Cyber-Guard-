import base64
import logging
import os
import time
from typing import Any, Dict, List, Optional

import numpy as np
import uvicorn
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from models.audio_analyzer import get_audio_analyzer
from models.caller_analyzer import caller_analyzer
from models.fusion_layer import fusion_layer
from models.text_classifier import get_classifier

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
logger = logging.getLogger(__name__)

app = FastAPI(title="CyberGuard ML Inference Service", version="1.0.0")


@app.on_event("startup")
async def startup_event():
    if os.getenv("PRELOAD_MODELS", "false").lower() == "true":
        try:
            get_classifier()
            get_audio_analyzer()
            logger.info("Models preloaded successfully")
        except Exception as exc:
            logger.warning("Model preload failed; service will continue with lazy loading: %s", exc)


class MLSignal(BaseModel):
    id: str
    label: str
    probability: float


class MLResponse(BaseModel):
    riskScore: int
    riskLevel: str
    confidence: float
    signals: List[MLSignal]
    categories: List[str]
    explanation: str
    recommendedAction: str
    isHeuristicFallback: bool = False
    processingTimeMs: int


class CallAnalysisRequest(BaseModel):
    transcript: Optional[str] = None
    audioBase64: Optional[str] = None
    audioFeatures: Optional[Dict[str, Any]] = None


class TextAnalysisRequest(BaseModel):
    text: str = Field(min_length=1)


class CallerAnalysisRequest(BaseModel):
    phoneNumber: str = Field(min_length=3)
    metadata: Optional[Dict[str, Any]] = None
    callHistory: Optional[List[Any]] = None


@app.get("/healthz")
async def healthz():
    return {"status": "ok", "service": app.title, "version": app.version}


@app.get("/readyz")
async def readyz():
    classifier = get_classifier()
    audio = get_audio_analyzer()
    return {
        "status": "ready",
        "models": {
            "text": classifier.status(),
            "audio": audio.status(),
            "caller": caller_analyzer.status(),
        },
    }


def _decode_audio(audio_b64: str) -> np.ndarray:
    audio_bytes = base64.b64decode(audio_b64, validate=True)
    audio_data = np.frombuffer(audio_bytes, dtype=np.float32)
    if audio_data.size == 0:
        raise ValueError("Decoded audio payload is empty")
    return audio_data


@app.post("/analyze/call", response_model=MLResponse)
async def analyze_call(request: CallAnalysisRequest):
    start_time = time.time()
    text_result = None
    audio_result = None

    if request.transcript:
        text_result = get_classifier().analyze(request.transcript)

    if request.audioBase64:
        try:
            audio_data = _decode_audio(request.audioBase64)
            sample_rate = int((request.audioFeatures or {}).get("sampleRate", 16000))
            audio_result = get_audio_analyzer().analyze_chunk(audio_data, sample_rate=sample_rate)
        except Exception as exc:
            logger.warning("[analyze/call] Audio decoding failed: %s", exc)

    final_result = fusion_layer.fuse(text_result, audio_result, request.audioFeatures)

    return MLResponse(
        **final_result,
        processingTimeMs=int((time.time() - start_time) * 1000),
    )


@app.post("/analyze/text", response_model=MLResponse)
async def analyze_text(request: TextAnalysisRequest):
    start_time = time.time()
    text_result = get_classifier().analyze(request.text)
    if text_result is None:
        raise HTTPException(status_code=400, detail="Text payload is empty")

    return MLResponse(
        riskScore=text_result["riskScore"],
        riskLevel="critical" if text_result["riskScore"] > 85 else "danger" if text_result["riskScore"] > 70 else "warning" if text_result["riskScore"] > 30 else "safe",
        confidence=text_result["confidence"],
        signals=[MLSignal(**signal) for signal in text_result["signals"]],
        categories=text_result["categories"],
        explanation=f"Text analysis detected {', '.join(text_result['categories'])} patterns." if text_result["categories"] else "No strong high-risk text patterns detected.",
        recommendedAction="Exercise caution." if text_result["riskScore"] > 40 else "No action required.",
        isHeuristicFallback=not text_result.get("modelReady", False),
        processingTimeMs=int((time.time() - start_time) * 1000),
    )


@app.post("/analyze/caller", response_model=MLResponse)
async def analyze_caller(request: CallerAnalysisRequest):
    start_time = time.time()
    result = caller_analyzer.analyze(request.phoneNumber, request.metadata, request.callHistory)

    return MLResponse(
        riskScore=result["riskScore"],
        riskLevel=result["riskLevel"],
        confidence=result["confidence"],
        signals=[MLSignal(**signal) for signal in result["signals"]],
        categories=result["categories"],
        explanation=result["explanation"],
        recommendedAction=result["recommendedAction"],
        isHeuristicFallback=result["isHeuristicFallback"],
        processingTimeMs=int((time.time() - start_time) * 1000),
    )


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8005)
