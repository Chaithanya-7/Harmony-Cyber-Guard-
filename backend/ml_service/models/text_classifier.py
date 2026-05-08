import logging
import os
import re
from typing import Dict, List, Optional

import torch
from transformers import AutoModelForSequenceClassification, AutoTokenizer

logger = logging.getLogger(__name__)


class ModernBERTTextClassifier:
    def __init__(self, model_id: Optional[str] = None, device: Optional[str] = None):
        self.model_id = model_id or os.getenv("TEXT_MODEL_ID", "answerdotai/ModernBERT-base")
        self.device = device or ("cuda" if torch.cuda.is_available() else "cpu")
        self.model = None
        self.tokenizer = None
        self.model_ready = False
        self.labels = ["scam", "harassment", "threat", "pii_request", "financial"]

        self.patterns = {
            "scam": [
                re.compile(r"\b(irs|warrant|arrest|gift card|wire transfer|bitcoin|urgent|act now)\b", re.I),
                re.compile(r"\b(account suspended|verify your account|security alert)\b", re.I),
            ],
            "harassment": [
                re.compile(r"\b(idiot|worthless|ugly|loser|shut up|hate you)\b", re.I),
                re.compile(r"\b(kill yourself|nobody likes you|you are nothing)\b", re.I),
            ],
            "threat": [
                re.compile(r"\b(kill|hurt|beat|find you|watch your back|or else)\b", re.I),
                re.compile(r"\b(i know where you live|i will ruin you)\b", re.I),
            ],
            "pii_request": [
                re.compile(r"\b(ssn|social security|otp|password|verification code|bank account)\b", re.I),
                re.compile(r"\b(date of birth|credit card|cvv|routing number)\b", re.I),
            ],
            "financial": [
                re.compile(r"\b(pay|payment|send money|transfer funds|cashapp|paypal|zelle)\b", re.I),
                re.compile(r"\b(gift card|prize claim|refund fee|crypto)\b", re.I),
            ],
        }

        self._load_model()

    def _load_model(self) -> None:
        try:
            logger.info("[ModernBERT] Loading model '%s' on %s", self.model_id, self.device)
            self.tokenizer = AutoTokenizer.from_pretrained(self.model_id)
            self.model = AutoModelForSequenceClassification.from_pretrained(
                self.model_id,
                num_labels=len(self.labels),
            ).to(self.device)
            self.model.eval()
            self.model_ready = True
        except Exception as exc:
            logger.warning("[ModernBERT] Model load failed, using heuristic fallback: %s", exc)
            self.model = None
            self.tokenizer = None
            self.model_ready = False

    def _heuristic_analyze(self, text: str) -> Dict:
        scores: Dict[str, float] = {label: 0.0 for label in self.labels}
        signals: List[Dict] = []

        for label, patterns in self.patterns.items():
            matches = 0
            for pattern in patterns:
                found = pattern.findall(text)
                matches += len(found)
            if matches:
                probability = min(0.95, 0.25 + matches * 0.22)
                scores[label] = probability
                signals.append({
                    "id": label,
                    "label": label.replace("_", " ").title(),
                    "probability": round(probability, 3),
                })

        categories = [label for label, value in scores.items() if value >= 0.3]
        max_score = max(scores.values()) if scores else 0.0
        confidence = 0.72 if categories else 0.55

        return {
            "riskScore": int(max_score * 100),
            "signals": signals,
            "categories": categories,
            "confidence": confidence,
            "modelReady": False,
        }

    def analyze(self, text: str) -> Optional[Dict]:
        if not text:
            return None

        if not self.model_ready or self.model is None or self.tokenizer is None:
            return self._heuristic_analyze(text)

        inputs = self.tokenizer(
            text,
            return_tensors="pt",
            truncation=True,
            max_length=512,
        ).to(self.device)

        with torch.no_grad():
            outputs = self.model(**inputs)
            probabilities = torch.sigmoid(outputs.logits).squeeze().tolist()

        if isinstance(probabilities, float):
            probabilities = [probabilities]

        signals = []
        categories = []
        max_score = 0.0
        weighted_score = 0.0

        for i, prob in enumerate(probabilities[: len(self.labels)]):
            weighted_score += prob * (1.25 if self.labels[i] in {"threat", "pii_request", "financial"} else 1.0)
            if prob > 0.3:
                signals.append({
                    "id": self.labels[i],
                    "label": self.labels[i].replace("_", " ").title(),
                    "probability": round(prob, 3),
                })
                categories.append(self.labels[i])
                max_score = max(max_score, prob)

        blended_score = min(1.0, max(max_score, weighted_score / len(self.labels)))

        return {
            "riskScore": int(blended_score * 100),
            "signals": signals,
            "categories": categories,
            "confidence": round(sum(probabilities[: len(self.labels)]) / len(self.labels), 3),
            "modelReady": True,
        }

    def status(self) -> Dict[str, object]:
        return {
            "ready": self.model_ready,
            "modelId": self.model_id,
            "device": self.device,
            "labels": self.labels,
        }


classifier = None


def get_classifier():
    global classifier
    if classifier is None:
        classifier = ModernBERTTextClassifier()
    return classifier
