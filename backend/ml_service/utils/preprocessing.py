import numpy as np
import librosa

def normalize_audio(audio_data: np.ndarray, target_sr=16000) -> np.ndarray:
    """
    Standardizes audio for ML models.
    """
    # Remove silence from start/end
    audio_data, _ = librosa.effects.trim(audio_data)
    
    # Normalize volume
    max_val = np.max(np.abs(audio_data))
    if max_val > 0:
        audio_data = audio_data / max_val
        
    return audio_data

def extract_spectral_features(audio_data: np.ndarray, sr=16000):
    """
    Extracts manual features that help in synthetic voice detection.
    """
    # Spectral Centroid
    centroid = librosa.feature.spectral_centroid(y=audio_data, sr=sr)
    # Spectral Rolloff
    rolloff = librosa.feature.spectral_rolloff(y=audio_data, sr=sr)
    # Zero Crossing Rate
    zcr = librosa.feature.zero_crossing_rate(audio_data)
    
    return {
        "spectralCentroidMean": float(np.mean(centroid)),
        "spectralRolloffMean": float(np.mean(rolloff)),
        "zeroCrossingRate": float(np.mean(zcr))
    }
