class BehavioralFusionLayer:
    def __init__(self):
        # Weights for different signal sources
        self.weights = {
            "text": 0.6,
            "audio": 0.3,
            "metadata": 0.1
        }

    def fuse(self, text_result, audio_result, metadata=None):
        """
        Combines text and audio signals into a final risk assessment.
        """
        if not text_result and not audio_result:
            return self.empty_response()

        text_score = text_result.get("riskScore", 0) if text_result else 0
        audio_score = (
            (audio_result.get("voiceStress", 0) * 45) +
            (audio_result.get("syntheticProbability", 0) * 40) +
            (min(1, audio_result.get("energyMean", 0) * 4) * 15)
        ) if audio_result else 0
        metadata_score = self.derive_metadata_score(metadata)
        
        # Weighted average
        final_score = (
            (text_score * self.weights["text"]) +
            (audio_score * self.weights["audio"]) +
            (metadata_score * self.weights["metadata"])
        )
        
        # Boost if both are high
        if text_score > 70 and audio_score > 70:
            final_score = min(100, final_score * 1.2)

        risk_level = "safe"
        if final_score > 85: risk_level = "critical"
        elif final_score > 70: risk_level = "danger"
        elif final_score > 40: risk_level = "warning"
        elif final_score > 15: risk_level = "low"

        # Combine signals
        signals = []
        if text_result:
            signals.extend(text_result.get("signals", []))
        if audio_result and audio_result.get("voiceStress", 0) > 0.72:
            signals.append({
                "id": "voice_stress",
                "label": "Elevated voice stress markers",
                "probability": min(0.97, audio_result["voiceStress"])
            })
        if audio_result and audio_result.get("syntheticProbability", 0) > 0.6:
            signals.append({
                "id": "synthetic_voice",
                "label": "Synthetic Voice Detected",
                "probability": audio_result["syntheticProbability"]
            })
        if metadata_score > 40:
            signals.append({
                "id": "metadata_escalation",
                "label": "Call metadata increases risk",
                "probability": min(0.9, metadata_score / 100)
            })

        return {
            "riskScore": int(final_score),
            "riskLevel": risk_level,
            "confidence": self.combine_confidence(text_result, audio_result, metadata),
            "signals": self.deduplicate_signals(signals),
            "categories": self.combine_categories(text_result, audio_result, metadata),
            "explanation": self.generate_explanation(text_result, audio_result, metadata_score),
            "recommendedAction": self.generate_action(final_score, risk_level)
        }

    def generate_explanation(self, text, audio, metadata_score=0):
        reasons = []
        if text and text["riskScore"] > 50:
            reasons.append(f"high-risk linguistic patterns ({text['categories'][0] if text['categories'] else 'general'})")
        if audio and audio["voiceStress"] > 0.7:
            reasons.append("extreme physiological stress markers")
        if audio and audio["syntheticProbability"] > 0.8:
            reasons.append("artificial voice characteristics")
        if metadata_score > 40:
            reasons.append("supporting contextual metadata")
            
        if not reasons: return "No major threat patterns detected."
        return f"Risk detected due to {', '.join(reasons)}."

    def generate_action(self, score, level):
        if level == "critical": return "Terminate interaction immediately and block source."
        if level == "danger": return "Do not provide personal information. Alert authorities if threat continues."
        if level == "warning": return "Exercise high caution. Verify caller identity independently."
        return "No immediate action required. Monitoring continued."

    def empty_response(self):
        return {
            "riskScore": 0,
            "riskLevel": "safe",
            "confidence": 1.0,
            "signals": [],
            "categories": [],
            "explanation": "No data available for analysis.",
            "recommendedAction": "Continue monitoring."
        }

    def derive_metadata_score(self, metadata):
        if not metadata:
            return 0
        score = 0
        if metadata.get("voiceStress", 0) > 0.75:
            score += 20
        if metadata.get("speakerCount", 1) and metadata.get("speakerCount", 1) > 2:
            score += 10
        if metadata.get("emotionalTrend") == "escalating":
            score += 18
        if metadata.get("speechRate") and metadata.get("speechRate") not in {"Normal", "normal"}:
            score += 12
        return min(100, score)

    def combine_confidence(self, text, audio, metadata):
        components = []
        if text:
            components.append(text.get("confidence", 0.5))
        if audio:
            components.append(0.83 if audio.get("modelReady") else 0.66)
        if metadata:
            components.append(0.7)
        if not components:
            return 0.5
        return round(sum(components) / len(components), 3)

    def combine_categories(self, text, audio, metadata):
        categories = set(text.get("categories", []) if text else [])
        if audio and audio.get("syntheticProbability", 0) > 0.6:
            categories.add("synthetic_voice")
        if audio and audio.get("voiceStress", 0) > 0.72:
            categories.add("aggressive_tone")
        if metadata and metadata.get("emotionalTrend") == "escalating":
            categories.add("behavioral_escalation")
        return list(categories)

    def deduplicate_signals(self, signals):
        deduped = {}
        for signal in signals:
            key = signal["id"]
            if key not in deduped or signal["probability"] > deduped[key]["probability"]:
                deduped[key] = signal
        return list(deduped.values())

# Singleton
fusion_layer = BehavioralFusionLayer()
