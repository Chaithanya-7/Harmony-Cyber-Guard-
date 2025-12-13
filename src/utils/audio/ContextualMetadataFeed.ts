// Contextual Metadata Feed - Parallel metadata channels for the analysis pipeline

export interface MetadataChannel {
  name: string;
  type: 'confidence' | 'noise' | 'amplitude' | 'stress' | 'quality' | 'custom';
  value: number;
  timestamp: number;
  weight: number; // For fusion layer weighting
}

export interface AggregatedMetadata {
  confidenceScore: number;
  backgroundNoiseLevel: number;
  averageAmplitude: number;
  stressMarkers: StressMarker[];
  qualityIndicators: QualityIndicators;
  contextualWeight: number;
}

export interface StressMarker {
  type: 'vocal_tremor' | 'pitch_break' | 'breathing_irregular' | 'speech_hesitation' | 'volume_spike';
  intensity: number;
  timestamp: number;
  duration: number;
}

export interface QualityIndicators {
  signalToNoiseRatio: number;
  clippingDetected: boolean;
  silenceRatio: number;
  audioIntegrity: number;
}

export interface FusionLayerInput {
  textFeatures: Record<string, number>;
  audioFeatures: Record<string, number>;
  metadata: AggregatedMetadata;
  speakerContext: {
    speakerId: string | null;
    turnCount: number;
    speakingDuration: number;
  };
}

export class ContextualMetadataFeed {
  private channels: Map<string, MetadataChannel[]> = new Map();
  private stressMarkers: StressMarker[] = [];
  private qualityIndicators: QualityIndicators = {
    signalToNoiseRatio: 1.0,
    clippingDetected: false,
    silenceRatio: 0,
    audioIntegrity: 1.0,
  };
  private metadataUpdateCallbacks: ((metadata: AggregatedMetadata) => void)[] = [];

  constructor() {
    this.initializeChannels();
  }

  private initializeChannels(): void {
    const channelTypes: MetadataChannel['type'][] = [
      'confidence', 'noise', 'amplitude', 'stress', 'quality'
    ];
    
    channelTypes.forEach(type => {
      this.channels.set(type, []);
    });
  }

  // Feed new metadata into a channel
  feedChannel(
    channelType: MetadataChannel['type'],
    value: number,
    weight: number = 1.0
  ): void {
    const channel = this.channels.get(channelType);
    if (!channel) return;

    const entry: MetadataChannel = {
      name: channelType,
      type: channelType,
      value: Math.max(0, Math.min(1, value)),
      timestamp: Date.now(),
      weight,
    };

    channel.push(entry);

    // Keep only last 100 entries per channel
    if (channel.length > 100) {
      channel.shift();
    }

    this.notifyUpdate();
  }

  // Process raw audio data and extract metadata
  processAudioChunk(audioData: Float32Array | number[]): void {
    const data = Array.isArray(audioData) ? audioData : Array.from(audioData);
    
    // Calculate background noise level
    const noiseLevel = this.estimateNoiseLevel(data);
    this.feedChannel('noise', noiseLevel);

    // Calculate average amplitude
    const amplitude = this.calculateAmplitude(data);
    this.feedChannel('amplitude', amplitude);

    // Detect stress markers
    this.detectStressMarkers(data);

    // Update quality indicators
    this.updateQualityIndicators(data);
  }

  private estimateNoiseLevel(data: number[]): number {
    // Estimate noise from low-energy segments
    const sortedEnergy = data
      .map(v => Math.abs(v))
      .sort((a, b) => a - b);
    
    // Use bottom 20% as noise floor estimate
    const noiseFloorSamples = sortedEnergy.slice(0, Math.floor(data.length * 0.2));
    const noiseFloor = noiseFloorSamples.reduce((sum, v) => sum + v, 0) / noiseFloorSamples.length;
    
    return Math.min(1, noiseFloor * 5);
  }

  private calculateAmplitude(data: number[]): number {
    const rms = Math.sqrt(data.reduce((sum, v) => sum + v * v, 0) / data.length);
    return Math.min(1, rms * 3);
  }

  private detectStressMarkers(data: number[]): void {
    const timestamp = Date.now();
    
    // Detect volume spikes
    const maxAmplitude = Math.max(...data.map(Math.abs));
    const avgAmplitude = data.reduce((sum, v) => sum + Math.abs(v), 0) / data.length;
    
    if (maxAmplitude > avgAmplitude * 3 && maxAmplitude > 0.5) {
      this.addStressMarker({
        type: 'volume_spike',
        intensity: Math.min(1, maxAmplitude),
        timestamp,
        duration: 100,
      });
    }

    // Detect pitch breaks (simplified - using zero-crossing rate changes)
    const zcr = this.calculateZCR(data);
    if (zcr > 0.3) {
      this.addStressMarker({
        type: 'pitch_break',
        intensity: Math.min(1, zcr),
        timestamp,
        duration: 50,
      });
    }

    // Detect speech hesitation (silence patterns)
    const silenceRatio = data.filter(v => Math.abs(v) < 0.05).length / data.length;
    if (silenceRatio > 0.3 && silenceRatio < 0.7) {
      this.addStressMarker({
        type: 'speech_hesitation',
        intensity: silenceRatio,
        timestamp,
        duration: 200,
      });
    }

    // Update stress channel
    const stressLevel = this.calculateOverallStress();
    this.feedChannel('stress', stressLevel);
  }

  private calculateZCR(data: number[]): number {
    let crossings = 0;
    for (let i = 1; i < data.length; i++) {
      if ((data[i] >= 0 && data[i - 1] < 0) || (data[i] < 0 && data[i - 1] >= 0)) {
        crossings++;
      }
    }
    return crossings / data.length;
  }

  private addStressMarker(marker: StressMarker): void {
    this.stressMarkers.push(marker);
    
    // Keep only recent markers (last 5 seconds)
    const cutoff = Date.now() - 5000;
    this.stressMarkers = this.stressMarkers.filter(m => m.timestamp > cutoff);
  }

  private calculateOverallStress(): number {
    if (this.stressMarkers.length === 0) return 0;
    
    const recentMarkers = this.stressMarkers.filter(
      m => Date.now() - m.timestamp < 2000
    );
    
    if (recentMarkers.length === 0) return 0;
    
    const avgIntensity = recentMarkers.reduce((sum, m) => sum + m.intensity, 0) / recentMarkers.length;
    const frequency = Math.min(1, recentMarkers.length / 5);
    
    return (avgIntensity * 0.6 + frequency * 0.4);
  }

  private updateQualityIndicators(data: number[]): void {
    // Signal-to-noise ratio
    const signal = Math.max(...data.map(Math.abs));
    const noise = this.estimateNoiseLevel(data);
    this.qualityIndicators.signalToNoiseRatio = noise > 0 ? Math.min(10, signal / noise) / 10 : 1;

    // Clipping detection
    this.qualityIndicators.clippingDetected = data.some(v => Math.abs(v) > 0.99);

    // Silence ratio
    this.qualityIndicators.silenceRatio = data.filter(v => Math.abs(v) < 0.01).length / data.length;

    // Audio integrity
    this.qualityIndicators.audioIntegrity = 
      (this.qualityIndicators.signalToNoiseRatio * 0.4) +
      (this.qualityIndicators.clippingDetected ? 0 : 0.3) +
      ((1 - this.qualityIndicators.silenceRatio) * 0.3);

    this.feedChannel('quality', this.qualityIndicators.audioIntegrity);
  }

  // Update confidence based on model predictions
  updateConfidence(confidence: number): void {
    this.feedChannel('confidence', confidence, 1.2); // Higher weight for ML confidence
  }

  // Get aggregated metadata for fusion layer
  getAggregatedMetadata(): AggregatedMetadata {
    return {
      confidenceScore: this.getChannelAverage('confidence'),
      backgroundNoiseLevel: this.getChannelAverage('noise'),
      averageAmplitude: this.getChannelAverage('amplitude'),
      stressMarkers: [...this.stressMarkers],
      qualityIndicators: { ...this.qualityIndicators },
      contextualWeight: this.calculateContextualWeight(),
    };
  }

  private getChannelAverage(channelType: MetadataChannel['type']): number {
    const channel = this.channels.get(channelType);
    if (!channel || channel.length === 0) return 0;

    // Weighted average of recent values
    const recentEntries = channel.slice(-20);
    const weightedSum = recentEntries.reduce((sum, entry) => sum + entry.value * entry.weight, 0);
    const totalWeight = recentEntries.reduce((sum, entry) => sum + entry.weight, 0);

    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  private calculateContextualWeight(): number {
    // Weight for ambiguous predictions based on metadata quality
    const quality = this.qualityIndicators.audioIntegrity;
    const confidence = this.getChannelAverage('confidence');
    const noiseLevel = this.getChannelAverage('noise');

    // Higher weight when we have good quality audio and low noise
    return (quality * 0.4 + confidence * 0.4 + (1 - noiseLevel) * 0.2);
  }

  // Prepare input for fusion layer
  prepareFusionInput(
    textFeatures: Record<string, number>,
    audioFeatures: Record<string, number>,
    speakerContext: FusionLayerInput['speakerContext']
  ): FusionLayerInput {
    return {
      textFeatures,
      audioFeatures,
      metadata: this.getAggregatedMetadata(),
      speakerContext,
    };
  }

  // Apply contextual weighting to predictions
  applyContextualWeighting(
    basePrediction: number,
    fusionInput: FusionLayerInput
  ): number {
    const { metadata } = fusionInput;
    
    // Adjust prediction based on contextual factors
    let adjustment = 0;

    // Stress markers increase fraud likelihood
    if (metadata.stressMarkers.length > 3) {
      adjustment += 0.1;
    }

    // Poor audio quality reduces confidence
    if (metadata.qualityIndicators.audioIntegrity < 0.5) {
      adjustment -= 0.05;
    }

    // High noise might indicate call center (more suspicious)
    if (metadata.backgroundNoiseLevel > 0.6) {
      adjustment += 0.05;
    }

    const weighted = basePrediction + adjustment * metadata.contextualWeight;
    return Math.max(0, Math.min(1, weighted));
  }

  private notifyUpdate(): void {
    const metadata = this.getAggregatedMetadata();
    this.metadataUpdateCallbacks.forEach(cb => cb(metadata));
  }

  // Event listener
  onMetadataUpdate(callback: (metadata: AggregatedMetadata) => void): void {
    this.metadataUpdateCallbacks.push(callback);
  }

  reset(): void {
    this.channels.forEach(channel => channel.length = 0);
    this.stressMarkers = [];
    this.qualityIndicators = {
      signalToNoiseRatio: 1.0,
      clippingDetected: false,
      silenceRatio: 0,
      audioIntegrity: 1.0,
    };
  }
}

export const contextualMetadataFeed = new ContextualMetadataFeed();
