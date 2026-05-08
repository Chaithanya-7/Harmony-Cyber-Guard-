import os
import pickle
import re
from typing import Any, Dict, List, Optional

try:
    import xgboost as xgb  # type: ignore
except Exception:
    xgb = None


class CallerRiskAnalyzer:
    def __init__(self) -> None:
        self.model = None
        self.model_ready = False
        self.model_path = os.getenv("CALLER_MODEL_PATH")
        self.voip_markers = {
            "voip",
            "twilio",
            "bandwidth",
            "sendgrid",
            "virtual",
            "sip",
        }
        self._load_model()

    def _load_model(self) -> None:
        if not self.model_path or not os.path.exists(self.model_path) or xgb is None:
            self.model = None
            self.model_ready = False
            return

        with open(self.model_path, "rb") as model_file:
            self.model = pickle.load(model_file)
        self.model_ready = True

    def analyze(self, phone_number: str, metadata: Optional[Dict[str, Any]] = None, call_history: Optional[List[Any]] = None) -> Dict[str, Any]:
        metadata = metadata or {}
        call_history = call_history or []

        digits = re.sub(r"\D", "", phone_number or "")
        risk_score = 12.0
        signals = []
        categories = ["caller_risk"]

        carrier = str(metadata.get("carrier", "")).lower()
        caller_type = str(metadata.get("type", "")).lower()
        location = str(metadata.get("location", "")).lower()
        total_calls = len(call_history)
        prior_risks = [self._extract_prior_risk(entry) for entry in call_history]
        prior_risks = [risk for risk in prior_risks if risk is not None]
        blocked_ratio = self._blocked_ratio(call_history)

        if self.model_ready and self.model is not None:
            model_risk = self._predict_model_risk(digits, metadata, call_history)
            risk_score = max(risk_score, model_risk)
            signals.append(self._signal("caller_model", "Learned caller-risk model elevated this source", min(0.96, 0.55 + (model_risk / 200))))

        if any(marker in carrier for marker in self.voip_markers) or caller_type == "voip":
            risk_score += 24
            signals.append(self._signal("voip_origin", "VoIP or virtual carrier detected", 0.91))

        if re.search(r"(\d)\1{4,}", digits):
            risk_score += 22
            signals.append(self._signal("digit_repetition", "Repeated digit spoof pattern", 0.88))

        if digits.startswith("000") or digits.endswith("0000"):
            risk_score += 14
            signals.append(self._signal("placeholder_number", "Placeholder-like numbering pattern", 0.71))

        if total_calls >= 5:
            risk_score += min(18, total_calls * 1.8)
            signals.append(self._signal("repeat_volume", f"{total_calls} recent calls from the same source", min(0.95, 0.55 + total_calls * 0.03)))

        if prior_risks:
            avg_prior_risk = sum(prior_risks) / len(prior_risks)
            risk_score += avg_prior_risk * 0.22
            if avg_prior_risk >= 60:
                signals.append(self._signal("historical_risk", "Prior call history shows elevated risk", min(0.93, avg_prior_risk / 100)))

        if blocked_ratio >= 0.3:
            risk_score += blocked_ratio * 24
            signals.append(self._signal("community_blocks", "High block/report rate in call history", min(0.94, 0.55 + blocked_ratio)))

        suspicious_hour = metadata.get("hourOfDay")
        if suspicious_hour is not None and (int(suspicious_hour) < 6 or int(suspicious_hour) > 22):
            risk_score += 8
            signals.append(self._signal("off_hours", "Off-hours contact attempt", 0.63))

        if location in {"unknown", "masked", "hidden"}:
            risk_score += 7
            signals.append(self._signal("masked_location", "Caller location is masked or unavailable", 0.58))

        risk_score = max(0, min(100, round(risk_score)))
        confidence = self._confidence(total_calls, metadata, len(signals))
        risk_level = self._risk_level(risk_score)

        return {
            "riskScore": risk_score,
            "riskLevel": risk_level,
            "confidence": confidence,
            "signals": signals,
            "categories": categories,
            "explanation": self._explanation(risk_score, signals),
            "recommendedAction": self._recommended_action(risk_level),
            "isHeuristicFallback": not self.model_ready,
        }

    def status(self) -> Dict[str, Any]:
        return {
            "ready": True,
            "modelReady": self.model_ready,
            "modelId": "caller-xgboost-v1" if self.model_ready else "structured-caller-risk-v1",
            "device": "cpu",
        }

    def _signal(self, signal_id: str, label: str, probability: float) -> Dict[str, Any]:
        return {"id": signal_id, "label": label, "probability": round(probability, 3)}

    def _extract_prior_risk(self, entry: Any) -> Optional[float]:
        if not isinstance(entry, dict):
            return None
        for key in ("risk_score", "riskScore", "overallRiskScore"):
            value = entry.get(key)
            if isinstance(value, (int, float)):
                return float(value)
        return None

    def _blocked_ratio(self, call_history: List[Any]) -> float:
        if not call_history:
            return 0.0
        blocked = 0
        for entry in call_history:
            if not isinstance(entry, dict):
                continue
            if entry.get("blocked") or entry.get("status") in {"blocked", "reported"}:
                blocked += 1
        return blocked / max(1, len(call_history))

    def _build_feature_vector(self, digits: str, metadata: Dict[str, Any], call_history: List[Any]) -> List[float]:
        carrier = str(metadata.get("carrier", "")).lower()
        caller_type = str(metadata.get("type", "")).lower()
        location = str(metadata.get("location", "")).lower()
        total_calls = len(call_history)
        prior_risks = [self._extract_prior_risk(entry) for entry in call_history]
        prior_risks = [risk for risk in prior_risks if risk is not None]
        blocked_ratio = self._blocked_ratio(call_history)

        return [
            1.0 if any(marker in carrier for marker in self.voip_markers) or caller_type == "voip" else 0.0,
            1.0 if re.search(r"(\d)\1{4,}", digits) else 0.0,
            float(total_calls),
            float(sum(prior_risks) / len(prior_risks)) if prior_risks else 0.0,
            float(blocked_ratio),
            1.0 if location in {"unknown", "masked", "hidden"} else 0.0,
            float(len(digits)),
        ]

    def _predict_model_risk(self, digits: str, metadata: Dict[str, Any], call_history: List[Any]) -> int:
        feature_vector = self._build_feature_vector(digits, metadata, call_history)
        if self.model is None:
            return 0

        if hasattr(self.model, "predict_proba"):
            probability = float(self.model.predict_proba([feature_vector])[0][1])
        else:
            probability = float(self.model.predict([feature_vector])[0])

        return int(max(0, min(100, round(probability * 100))))

    def _confidence(self, total_calls: int, metadata: Dict[str, Any], signal_count: int) -> float:
        score = 0.56 + min(0.18, total_calls * 0.02) + min(0.12, signal_count * 0.03)
        if metadata.get("carrier") or metadata.get("type"):
            score += 0.08
        return round(min(0.95, score), 3)

    def _risk_level(self, score: int) -> str:
        if score > 85:
            return "critical"
        if score > 70:
            return "danger"
        if score > 40:
            return "warning"
        if score > 15:
            return "low"
        return "safe"

    def _explanation(self, score: int, signals: List[Dict[str, Any]]) -> str:
        if not signals:
            return "Caller metadata appears stable and does not show major abuse indicators."
        lead = ", ".join(signal["label"].lower() for signal in signals[:3])
        return f"Caller risk scored at {score}/100 based on {lead}."

    def _recommended_action(self, level: str) -> str:
        if level == "critical":
            return "Block the caller and avoid further engagement."
        if level == "danger":
            return "Do not share personal information and verify identity through another channel."
        if level == "warning":
            return "Use live analysis before continuing the conversation."
        if level == "low":
            return "Proceed carefully and continue monitoring."
        return "No immediate action required."


caller_analyzer = CallerRiskAnalyzer()
