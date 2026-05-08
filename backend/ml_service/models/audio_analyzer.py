import logging
import os

import torch
import librosa
import numpy as np
from transformers import WavLMModel, AutoFeatureExtractor
from utils.preprocessing import extract_spectral_features, normalize_audio

logger = logging.getLogger(__name__)

class WavLMAudioAnalyzer:
    def __init__(self, model_id=None, device=None):
        self.model_id = model_id or os.getenv("AUDIO_MODEL_ID", "microsoft/wavlm-base-plus")
        self.device = device or ("cuda" if torch.cuda.is_available() else "cpu")
        self.feature_extractor = None
        self.model = None
        self.model_ready = False
        logger.info("[WavLM] Loading model '%s' on %s", self.model_id, self.device)

        try:
            self.feature_extractor = AutoFeatureExtractor.from_pretrained(self.model_id)
            self.model = WavLMModel.from_pretrained(self.model_id).to(self.device)
            self.model.eval()
            self.model_ready = True
        except Exception as exc:
            logger.warning("[WavLM] Model load failed, using DSP fallback: %s", exc)

    def _fallback_analyze(self, audio_data: np.ndarray) -> dict:
        spectral = extract_spectral_features(audio_data, sr=16000)
        rms = float(np.sqrt(np.mean(np.square(audio_data)))) if audio_data.size else 0.0
        zcr = spectral["zeroCrossingRate"]
        centroid = spectral["spectralCentroidMean"]
        rolloff = spectral["spectralRolloffMean"]

        voice_stress = min(1.0, (rms * 1.8) + min(0.45, zcr * 4.5))
        synthetic_probability = min(1.0, max(0.0, 0.45 - rms) + min(0.55, zcr * 1.8))

        return {
            "voiceStress": round(voice_stress, 3),
            "syntheticProbability": round(synthetic_probability, 3),
            "energyMean": round(float(np.mean(np.abs(audio_data))), 4) if audio_data.size else 0.0,
            "spectralCentroidMean": round(centroid, 2),
            "spectralRolloffMean": round(rolloff, 2),
            "zeroCrossingRate": round(zcr, 4),
            "modelReady": False,
        }

    def analyze_chunk(self, audio_data: np.ndarray, sample_rate=16000):
        """
        Analyzes an audio chunk for stress markers and synthetic voice patterns.
        audio_data: float32 numpy array
        """
        if audio_data is None or audio_data.size == 0:
            return self._fallback_analyze(np.zeros(1600, dtype=np.float32))

        audio_data = normalize_audio(np.asarray(audio_data, dtype=np.float32))

        if sample_rate != 16000:
            audio_data = librosa.resample(audio_data, orig_sr=sample_rate, target_sr=16000)

        if not self.model_ready or self.model is None or self.feature_extractor is None:
            return self._fallback_analyze(audio_data)

        inputs = self.feature_extractor(
            audio_data, 
            sampling_rate=16000, 
            return_tensors="pt"
        ).to(self.device)

        with torch.no_grad():
            outputs = self.model(**inputs)
            # Use last hidden state for feature extraction
            hidden_states = outputs.last_hidden_state
            
            hidden_variance = torch.var(hidden_states).item()
            hidden_std = torch.std(hidden_states).item()
            spectral = extract_spectral_features(audio_data, sr=16000)
            rms = float(np.sqrt(np.mean(np.square(audio_data)))) if audio_data.size else 0.0

            normalized_stress = min(1.0, (hidden_variance * 9.0) + (rms * 0.9))
            synthetic_prob = min(1.0, max(0.0, 0.55 - (hidden_std * 3.0)) + min(0.35, spectral["zeroCrossingRate"] * 1.5))

        return {
            "voiceStress": round(normalized_stress, 3),
            "syntheticProbability": round(synthetic_prob, 3),
            "energyMean": round(float(np.mean(np.abs(audio_data))), 4),
            "spectralCentroidMean": round(spectral["spectralCentroidMean"], 2),
            "spectralRolloffMean": round(spectral["spectralRolloffMean"], 2),
            "zeroCrossingRate": round(spectral["zeroCrossingRate"], 4),
            "modelReady": True,
        }

    def status(self) -> dict:
        return {
            "ready": self.model_ready,
            "modelId": self.model_id,
            "device": self.device,
        }

# Singleton instance
analyzer = None

def get_audio_analyzer():
    global analyzer
    if analyzer is None:
        analyzer = WavLMAudioAnalyzer()
    return analyzer
