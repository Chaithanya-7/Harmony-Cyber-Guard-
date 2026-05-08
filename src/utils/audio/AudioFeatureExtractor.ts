// AudioFeatureExtractor - 18+ low-level acoustic and prosodic features
// Optimized for 2.5s real-time processing windows

export interface AudioFeatures {
  // Pitch features
  pitchMean: number;
  pitchVariance: number;
  pitchRange: number;
  pitchSlope: number;

  // Energy features
  energyMean: number;
  energyVariance: number;
  energySpikes: number;
  energyDynamicRange: number;

  // Voice stress indicators
  voiceStress: number;
  jitter: number;
  shimmer: number;
  harmonicToNoiseRatio: number;

  // Spectral features
  spectralCentroid: number;
  spectralFlatness: number;
  spectralRolloff: number;
  spectralFlux: number;

  // Temporal features
  speechRate: number;
  articulationRate: number;
  pauseRatio: number;
  zeroCrossingRate: number;

  // Background analysis
  backgroundEntropy: number;
  backgroundNoiseType: 'clean' | 'office' | 'outdoor' | 'call_center' | 'unknown';

  // Composite scores
  overallStressScore: number;
  audioQualityScore: number;

  // Advanced Society Protection
  syntheticProbability: number;

  // Silence/Energy Gating
  isSilent: boolean;
  hasSpeech: boolean;
}

interface FrequencyBin {
  frequency: number;
  magnitude: number;
}

export class AudioFeatureExtractor {
  private sampleRate: number = 24000;
  private windowSize: number = 2048;
  private hopSize: number = 512;
  private previousSpectrum: Float32Array | null = null;

  constructor(sampleRate: number = 24000) {
    this.sampleRate = sampleRate;
  }

  // Extract all features from audio chunk
  extract(audioData: Float32Array | number[]): AudioFeatures {
    const data = audioData instanceof Float32Array
      ? audioData
      : new Float32Array(audioData);

    // RMS Energy calculation to detect pure silence
    let sumSquares = 0;
    for (let i = 0; i < data.length; i++) {
      sumSquares += data[i] * data[i];
    }
    const rmsEnergy = Math.sqrt(sumSquares / (data.length || 1));
    const isSilent = rmsEnergy < 0.005; // Strict energy threshold

    if (isSilent) {
      return this.getSilentFeatures();
    }

    // Extract individual feature categories
    const pitchFeatures = this.extractPitchFeatures(data);
    const energyFeatures = this.extractEnergyFeatures(data);
    const stressFeatures = this.extractStressFeatures(data);
    const spectralFeatures = this.extractSpectralFeatures(data);
    const temporalFeatures = this.extractTemporalFeatures(data);
    const backgroundFeatures = this.extractBackgroundFeatures(data);

    // Calculate composite scores
    const overallStressScore = this.calculateOverallStress(
      stressFeatures,
      energyFeatures,
      pitchFeatures
    );
    const audioQualityScore = this.calculateAudioQuality(
      spectralFeatures,
      backgroundFeatures
    );

    // NEW: Calculate Deepfake / Synthetic Voice Probability
    const syntheticProbability = this.calculateSyntheticProbability(
      pitchFeatures,
      stressFeatures,
      backgroundFeatures,
      spectralFeatures
    );

    return {
      ...pitchFeatures,
      ...energyFeatures,
      ...stressFeatures,
      ...spectralFeatures,
      ...temporalFeatures,
      ...backgroundFeatures,
      overallStressScore,
      audioQualityScore,
      syntheticProbability,
      isSilent: false,
      hasSpeech: temporalFeatures.speechRate > 0.1,
    };
  }

  private getSilentFeatures(): AudioFeatures {
    return {
      pitchMean: 0, pitchVariance: 0, pitchRange: 0, pitchSlope: 0,
      energyMean: 0, energyVariance: 0, energySpikes: 0, energyDynamicRange: 0,
      voiceStress: 0, jitter: 0, shimmer: 0, harmonicToNoiseRatio: 0,
      spectralCentroid: 0, spectralFlatness: 0, spectralRolloff: 0, spectralFlux: 0,
      speechRate: 0, articulationRate: 0, pauseRatio: 1, zeroCrossingRate: 0,
      backgroundEntropy: 0, backgroundNoiseType: 'clean',
      overallStressScore: 0, audioQualityScore: 1, syntheticProbability: 0,
      isSilent: true, hasSpeech: false,
    };
  }

  private extractPitchFeatures(data: Float32Array): {
    pitchMean: number;
    pitchVariance: number;
    pitchRange: number;
    pitchSlope: number;
  } {
    // Simplified pitch extraction using autocorrelation
    const pitchValues = this.estimatePitchContour(data);

    if (pitchValues.length === 0) {
      return { pitchMean: 0, pitchVariance: 0, pitchRange: 0, pitchSlope: 0 };
    }

    const mean = pitchValues.reduce((a, b) => a + b, 0) / pitchValues.length;
    const variance = pitchValues.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / pitchValues.length;
    const range = Math.max(...pitchValues) - Math.min(...pitchValues);

    // Calculate pitch slope (trend over time)
    const slope = this.calculateSlope(pitchValues);

    return {
      pitchMean: this.normalize(mean, 50, 400),
      pitchVariance: this.normalize(Math.sqrt(variance), 0, 100),
      pitchRange: this.normalize(range, 0, 200),
      pitchSlope: this.normalize(slope, -50, 50),
    };
  }

  private estimatePitchContour(data: Float32Array): number[] {
    const pitchValues: number[] = [];
    const frameSize = Math.floor(this.sampleRate * 0.025); // 25ms frames
    const hopSize = Math.floor(this.sampleRate * 0.01); // 10ms hop

    for (let i = 0; i + frameSize < data.length; i += hopSize) {
      const frame = data.slice(i, i + frameSize);
      const pitch = this.autocorrelationPitch(frame);
      if (pitch > 50 && pitch < 500) {
        pitchValues.push(pitch);
      }
    }

    return pitchValues;
  }

  private autocorrelationPitch(frame: Float32Array): number {
    const minLag = Math.floor(this.sampleRate / 500); // 500 Hz max
    const maxLag = Math.floor(this.sampleRate / 50);  // 50 Hz min

    let maxCorr = 0;
    let bestLag = 0;

    for (let lag = minLag; lag < Math.min(maxLag, frame.length); lag++) {
      let correlation = 0;
      for (let i = 0; i < frame.length - lag; i++) {
        correlation += frame[i] * frame[i + lag];
      }
      if (correlation > maxCorr) {
        maxCorr = correlation;
        bestLag = lag;
      }
    }

    return bestLag > 0 ? this.sampleRate / bestLag : 0;
  }

  private extractEnergyFeatures(data: Float32Array): {
    energyMean: number;
    energyVariance: number;
    energySpikes: number;
    energyDynamicRange: number;
  } {
    const frameEnergies = this.calculateFrameEnergies(data);

    if (frameEnergies.length === 0) {
      return { energyMean: 0, energyVariance: 0, energySpikes: 0, energyDynamicRange: 0 };
    }

    const mean = frameEnergies.reduce((a, b) => a + b, 0) / frameEnergies.length;
    const variance = frameEnergies.reduce((sum, e) => sum + Math.pow(e - mean, 2), 0) / frameEnergies.length;

    // Count energy spikes (above 2 std dev)
    const stdDev = Math.sqrt(variance);
    const spikes = frameEnergies.filter(e => e > mean + 2 * stdDev).length;

    // Dynamic range (dB)
    const maxEnergy = Math.max(...frameEnergies);
    const minEnergy = Math.max(0.0001, Math.min(...frameEnergies));
    const dynamicRange = 20 * Math.log10(maxEnergy / minEnergy);

    return {
      energyMean: this.normalize(mean, 0, 0.5),
      energyVariance: this.normalize(Math.sqrt(variance), 0, 0.2),
      energySpikes: Math.min(1, spikes / 10),
      energyDynamicRange: this.normalize(dynamicRange, 0, 60),
    };
  }

  private calculateFrameEnergies(data: Float32Array): number[] {
    const frameSize = 512;
    const energies: number[] = [];

    for (let i = 0; i + frameSize < data.length; i += frameSize) {
      const frame = data.slice(i, i + frameSize);
      const energy = frame.reduce((sum, s) => sum + s * s, 0) / frameSize;
      energies.push(Math.sqrt(energy));
    }

    return energies;
  }

  private extractStressFeatures(data: Float32Array): {
    voiceStress: number;
    jitter: number;
    shimmer: number;
    harmonicToNoiseRatio: number;
  } {
    const pitchValues = this.estimatePitchContour(data);
    const frameEnergies = this.calculateFrameEnergies(data);

    // Jitter (pitch perturbation)
    let jitter = 0;
    if (pitchValues.length > 1) {
      let sumDiff = 0;
      for (let i = 1; i < pitchValues.length; i++) {
        sumDiff += Math.abs(pitchValues[i] - pitchValues[i - 1]);
      }
      const meanPitch = pitchValues.reduce((a, b) => a + b, 0) / pitchValues.length;
      jitter = meanPitch > 0 ? sumDiff / (pitchValues.length - 1) / meanPitch : 0;
    }

    // Shimmer (amplitude perturbation)
    let shimmer = 0;
    if (frameEnergies.length > 1) {
      let sumDiff = 0;
      for (let i = 1; i < frameEnergies.length; i++) {
        sumDiff += Math.abs(frameEnergies[i] - frameEnergies[i - 1]);
      }
      const meanEnergy = frameEnergies.reduce((a, b) => a + b, 0) / frameEnergies.length;
      shimmer = meanEnergy > 0 ? sumDiff / (frameEnergies.length - 1) / meanEnergy : 0;
    }

    // Simplified HNR estimation
    const hnr = this.estimateHNR(data);

    // Composite voice stress score
    const voiceStress = Math.min(1, (
      this.normalize(jitter, 0, 0.05) * 0.3 +
      this.normalize(shimmer, 0, 0.1) * 0.3 +
      (1 - this.normalize(hnr, 0, 20)) * 0.4
    ));

    return {
      voiceStress,
      jitter: this.normalize(jitter, 0, 0.05),
      shimmer: this.normalize(shimmer, 0, 0.1),
      harmonicToNoiseRatio: this.normalize(hnr, 0, 20),
    };
  }

  private estimateHNR(data: Float32Array): number {
    // Simplified HNR using autocorrelation peak
    const autocorr = this.autocorrelation(data);
    const maxPeak = Math.max(...autocorr.slice(20)); // Skip first few samples
    const noise = 1 - maxPeak;
    return noise > 0 ? 10 * Math.log10(maxPeak / noise) : 20;
  }

  private autocorrelation(data: Float32Array): Float32Array {
    const result = new Float32Array(data.length);
    const energy = data.reduce((sum, s) => sum + s * s, 0);

    if (energy === 0) return result;

    for (let lag = 0; lag < data.length; lag++) {
      let sum = 0;
      for (let i = 0; i < data.length - lag; i++) {
        sum += data[i] * data[i + lag];
      }
      result[lag] = sum / energy;
    }

    return result;
  }

  private extractSpectralFeatures(data: Float32Array): {
    spectralCentroid: number;
    spectralFlatness: number;
    spectralRolloff: number;
    spectralFlux: number;
  } {
    const spectrum = this.computeSpectrum(data);
    const bins = this.getFrequencyBins(spectrum);

    // Spectral centroid (brightness)
    let centroidNumerator = 0;
    let centroidDenominator = 0;
    bins.forEach(bin => {
      centroidNumerator += bin.frequency * bin.magnitude;
      centroidDenominator += bin.magnitude;
    });
    const centroid = centroidDenominator > 0 ? centroidNumerator / centroidDenominator : 0;

    // Spectral flatness (tonality)
    const magnitudes = bins.map(b => b.magnitude).filter(m => m > 0);
    const geometricMean = Math.exp(
      magnitudes.reduce((sum, m) => sum + Math.log(m + 1e-10), 0) / magnitudes.length
    );
    const arithmeticMean = magnitudes.reduce((a, b) => a + b, 0) / magnitudes.length;
    const flatness = arithmeticMean > 0 ? geometricMean / arithmeticMean : 0;

    // Spectral rolloff (95% energy)
    const totalEnergy = bins.reduce((sum, b) => sum + b.magnitude, 0);
    let cumulativeEnergy = 0;
    let rolloff = 0;
    for (const bin of bins) {
      cumulativeEnergy += bin.magnitude;
      if (cumulativeEnergy >= 0.95 * totalEnergy) {
        rolloff = bin.frequency;
        break;
      }
    }

    // Spectral flux (rate of change)
    let flux = 0;
    if (this.previousSpectrum) {
      for (let i = 0; i < spectrum.length; i++) {
        const diff = spectrum[i] - this.previousSpectrum[i];
        flux += diff > 0 ? diff * diff : 0;
      }
      flux = Math.sqrt(flux);
    }
    this.previousSpectrum = new Float32Array(spectrum);

    return {
      spectralCentroid: this.normalize(centroid, 0, this.sampleRate / 4),
      spectralFlatness: Math.min(1, flatness),
      spectralRolloff: this.normalize(rolloff, 0, this.sampleRate / 2),
      spectralFlux: this.normalize(flux, 0, 10),
    };
  }

  private computeSpectrum(data: Float32Array): Float32Array {
    // Simplified DFT for spectrum estimation
    const n = Math.min(this.windowSize, data.length);
    const spectrum = new Float32Array(n / 2);

    for (let k = 0; k < n / 2; k++) {
      let real = 0;
      let imag = 0;
      for (let t = 0; t < n; t++) {
        const angle = (2 * Math.PI * k * t) / n;
        real += data[t] * Math.cos(angle);
        imag -= data[t] * Math.sin(angle);
      }
      spectrum[k] = Math.sqrt(real * real + imag * imag) / n;
    }

    return spectrum;
  }

  private getFrequencyBins(spectrum: Float32Array): FrequencyBin[] {
    return Array.from(spectrum).map((magnitude, index) => ({
      frequency: (index * this.sampleRate) / (2 * spectrum.length),
      magnitude,
    }));
  }

  private extractTemporalFeatures(data: Float32Array): {
    speechRate: number;
    articulationRate: number;
    pauseRatio: number;
    zeroCrossingRate: number;
  } {
    // Zero crossing rate
    let zeroCrossings = 0;
    for (let i = 1; i < data.length; i++) {
      if ((data[i] >= 0 && data[i - 1] < 0) || (data[i] < 0 && data[i - 1] >= 0)) {
        zeroCrossings++;
      }
    }
    const zcr = zeroCrossings / data.length;

    // Estimate speech/pause segments
    const threshold = 0.02;
    let speechFrames = 0;
    let pauseFrames = 0;
    const frameSize = 256;

    for (let i = 0; i + frameSize < data.length; i += frameSize) {
      const frame = data.slice(i, i + frameSize);
      const energy = Math.sqrt(frame.reduce((sum, s) => sum + s * s, 0) / frameSize);
      if (energy > threshold) {
        speechFrames++;
      } else {
        pauseFrames++;
      }
    }

    const totalFrames = speechFrames + pauseFrames;
    const pauseRatio = totalFrames > 0 ? pauseFrames / totalFrames : 0;

    // Estimate syllable rate (using energy envelope peaks)
    const syllableRate = this.estimateSyllableRate(data);
    const durationSeconds = data.length / this.sampleRate;
    const speechRate = durationSeconds > 0 ? syllableRate / durationSeconds : 0;
    const articulationRate = pauseRatio < 1 ? speechRate / (1 - pauseRatio) : 0;

    return {
      speechRate: this.normalize(speechRate, 0, 8),
      articulationRate: this.normalize(articulationRate, 0, 10),
      pauseRatio: Math.min(1, pauseRatio),
      zeroCrossingRate: this.normalize(zcr, 0, 0.3),
    };
  }

  private estimateSyllableRate(data: Float32Array): number {
    // Count peaks in smoothed energy envelope
    const envelope = this.computeEnergyEnvelope(data);
    let peaks = 0;

    for (let i = 1; i < envelope.length - 1; i++) {
      if (envelope[i] > envelope[i - 1] &&
        envelope[i] > envelope[i + 1] &&
        envelope[i] > 0.1) {
        peaks++;
      }
    }

    return peaks;
  }

  private computeEnergyEnvelope(data: Float32Array): Float32Array {
    const windowSize = Math.floor(this.sampleRate * 0.02); // 20ms
    const hopSize = Math.floor(this.sampleRate * 0.01);    // 10ms
    const envelope: number[] = [];

    for (let i = 0; i + windowSize < data.length; i += hopSize) {
      const frame = data.slice(i, i + windowSize);
      const energy = Math.sqrt(frame.reduce((sum, s) => sum + s * s, 0) / windowSize);
      envelope.push(energy);
    }

    return new Float32Array(envelope);
  }

  private extractBackgroundFeatures(data: Float32Array): {
    backgroundEntropy: number;
    backgroundNoiseType: 'clean' | 'office' | 'outdoor' | 'call_center' | 'unknown';
  } {
    const spectrum = this.computeSpectrum(data);

    // Calculate spectral entropy
    const totalEnergy = spectrum.reduce((sum, s) => sum + s, 0);
    let entropy = 0;
    if (totalEnergy > 0) {
      spectrum.forEach(s => {
        const p = s / totalEnergy;
        if (p > 0) {
          entropy -= p * Math.log2(p);
        }
      });
    }
    const normalizedEntropy = entropy / Math.log2(spectrum.length);

    // Classify noise type based on spectral characteristics
    const noiseType = this.classifyNoiseType(spectrum, normalizedEntropy);

    return {
      backgroundEntropy: normalizedEntropy,
      backgroundNoiseType: noiseType,
    };
  }

  private classifyNoiseType(
    spectrum: Float32Array,
    entropy: number
  ): 'clean' | 'office' | 'outdoor' | 'call_center' | 'unknown' {
    const lowFreqEnergy = spectrum.slice(0, 20).reduce((a, b) => a + b, 0);
    const midFreqEnergy = spectrum.slice(20, 100).reduce((a, b) => a + b, 0);
    const highFreqEnergy = spectrum.slice(100).reduce((a, b) => a + b, 0);
    const totalEnergy = lowFreqEnergy + midFreqEnergy + highFreqEnergy;

    if (totalEnergy < 0.01) return 'clean';

    const lowRatio = lowFreqEnergy / totalEnergy;
    const highRatio = highFreqEnergy / totalEnergy;

    if (entropy > 0.8 && highRatio > 0.3) return 'call_center';
    if (lowRatio > 0.6 && entropy < 0.5) return 'outdoor';
    if (entropy > 0.6 && lowRatio < 0.4) return 'office';
    if (entropy < 0.3) return 'clean';

    return 'unknown';
  }

  private calculateOverallStress(
    stressFeatures: { voiceStress: number; jitter: number; shimmer: number },
    energyFeatures: { energyVariance: number; energySpikes: number },
    pitchFeatures: { pitchVariance: number }
  ): number {
    return Math.min(1, (
      stressFeatures.voiceStress * 0.4 +
      energyFeatures.energyVariance * 0.2 +
      energyFeatures.energySpikes * 0.15 +
      pitchFeatures.pitchVariance * 0.25
    ));
  }

  private calculateAudioQuality(
    spectralFeatures: { spectralFlatness: number },
    backgroundFeatures: { backgroundEntropy: number; backgroundNoiseType: string }
  ): number {
    const noiseQuality = backgroundFeatures.backgroundNoiseType === 'clean' ? 1 : 0.7;
    const entropyQuality = 1 - backgroundFeatures.backgroundEntropy * 0.5;

    return (noiseQuality * 0.5 + entropyQuality * 0.5);
  }

  private calculateSyntheticProbability(
    pitch: { pitchVariance: number },
    stress: { jitter: number; shimmer: number },
    background: { backgroundEntropy: number },
    spectral: { spectralFlux: number }
  ): number {
    // UPDATED: Conservative Co-occurrence Model for Deepfake Detection
    // We only flag as synthetic if MULTIPLE signals align simultaneously.
    
    let indicators = 0;
    let confidence = 0;

    // 1. Unnatural Stability (AI lacks micro-tremors)
    // Human voice naturally has some jitter/shimmer even in professionals.
    if (stress.jitter < 0.05 && stress.shimmer < 0.05) {
      indicators++;
      confidence += 0.3;
    }

    // 2. Spectral Sterility (Low Flux/Change)
    if (spectral.spectralFlux < 0.15) {
      indicators++;
      confidence += 0.3;
    }

    // 3. Environment Sterility (Zero background entropy)
    // This is often 0 in generated audio but rarely 0 in real calls.
    if (background.backgroundEntropy < 0.1) {
      indicators++;
      confidence += 0.2;
    }

    // SCORING: Only provide high probability if at least 2 indicators align.
    if (indicators < 2) return 0;
    
    // If all three align, we are highly suspicious.
    if (indicators === 3) return Math.min(0.85, confidence + 0.15);

    return Math.min(0.7, confidence);
  }

  private calculateSlope(values: number[]): number {
    if (values.length < 2) return 0;

    const n = values.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = values.reduce((sum, y, x) => sum + x * y, 0);
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;

    const denominator = n * sumX2 - sumX * sumX;
    if (denominator === 0) return 0;

    return (n * sumXY - sumX * sumY) / denominator;
  }

  private normalize(value: number, min: number, max: number): number {
    return Math.max(0, Math.min(1, (value - min) / (max - min)));
  }

  // Get feature vector for ML model input
  getFeatureVector(features: AudioFeatures): number[] {
    return [
      features.pitchMean,
      features.pitchVariance,
      features.pitchRange,
      features.pitchSlope,
      features.energyMean,
      features.energyVariance,
      features.energySpikes,
      features.energyDynamicRange,
      features.voiceStress,
      features.jitter,
      features.shimmer,
      features.harmonicToNoiseRatio,
      features.spectralCentroid,
      features.spectralFlatness,
      features.spectralRolloff,
      features.spectralFlux,
      features.speechRate,
      features.zeroCrossingRate,
    ];
  }
}

export const audioFeatureExtractor = new AudioFeatureExtractor();
