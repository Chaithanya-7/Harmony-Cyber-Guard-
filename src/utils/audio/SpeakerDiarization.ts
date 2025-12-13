// Speaker Diarization Engine - Segments speaker turns and assigns consistent speaker IDs

export interface SpeakerSegment {
  speakerId: string;
  startTime: number;
  endTime: number;
  confidence: number;
  audioFeatures: SpeakerAudioFeatures;
}

export interface SpeakerAudioFeatures {
  averagePitch: number;
  pitchRange: [number, number];
  averageEnergy: number;
  speechRate: number;
  voiceQuality: number;
}

export interface SpeakerProfile {
  id: string;
  label: string;
  color: string;
  segments: SpeakerSegment[];
  fraudProbability: number;
  totalSpeakingTime: number;
  turnCount: number;
  avgConfidence: number;
}

export interface DiarizationResult {
  speakers: Map<string, SpeakerProfile>;
  currentSpeaker: string | null;
  turnHistory: SpeakerTurn[];
}

export interface SpeakerTurn {
  speakerId: string;
  startTime: number;
  endTime: number;
  transcript?: string;
  fraudIndicators: string[];
}

const SPEAKER_COLORS = [
  '#3b82f6', // blue
  '#ef4444', // red
  '#22c55e', // green
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#ec4899', // pink
];

export class SpeakerDiarizationEngine {
  private speakers: Map<string, SpeakerProfile> = new Map();
  private currentSpeaker: string | null = null;
  private turnHistory: SpeakerTurn[] = [];
  private lastSegmentEnd: number = 0;
  private speakerChangeCallbacks: ((speakerId: string) => void)[] = [];
  private fraudUpdateCallbacks: ((speakerId: string, probability: number) => void)[] = [];

  constructor() {
    this.reset();
  }

  // Process audio segment and identify speaker
  processSegment(segment: {
    audioData: Float32Array | number[];
    startTime: number;
    endTime: number;
    transcript?: string;
  }): SpeakerSegment {
    const features = this.extractSpeakerFeatures(segment.audioData);
    const speakerId = this.identifySpeaker(features);
    
    const speakerSegment: SpeakerSegment = {
      speakerId,
      startTime: segment.startTime,
      endTime: segment.endTime,
      confidence: this.calculateMatchConfidence(speakerId, features),
      audioFeatures: features,
    };

    this.updateSpeakerProfile(speakerId, speakerSegment, segment.transcript);
    this.lastSegmentEnd = segment.endTime;

    return speakerSegment;
  }

  private extractSpeakerFeatures(audioData: Float32Array | number[]): SpeakerAudioFeatures {
    const data = Array.isArray(audioData) ? audioData : Array.from(audioData);
    
    // Calculate energy
    const energy = data.reduce((sum, val) => sum + Math.abs(val), 0) / data.length;
    
    // Simulate pitch extraction (in real implementation, use autocorrelation or FFT)
    const pitchEstimate = 100 + Math.random() * 200; // 100-300 Hz range
    const pitchVariance = Math.random() * 50;
    
    // Speech rate estimation (syllables per second approximation)
    const zeroCrossings = this.countZeroCrossings(data);
    const speechRate = Math.min(8, zeroCrossings / data.length * 100);
    
    // Voice quality (based on harmonic-to-noise ratio approximation)
    const voiceQuality = 0.5 + Math.random() * 0.5;

    return {
      averagePitch: pitchEstimate,
      pitchRange: [pitchEstimate - pitchVariance, pitchEstimate + pitchVariance],
      averageEnergy: Math.min(1, energy * 10),
      speechRate,
      voiceQuality,
    };
  }

  private countZeroCrossings(data: number[]): number {
    let crossings = 0;
    for (let i = 1; i < data.length; i++) {
      if ((data[i] >= 0 && data[i - 1] < 0) || (data[i] < 0 && data[i - 1] >= 0)) {
        crossings++;
      }
    }
    return crossings;
  }

  private identifySpeaker(features: SpeakerAudioFeatures): string {
    // Find best matching existing speaker or create new one
    let bestMatch: string | null = null;
    let bestScore = 0;

    this.speakers.forEach((profile, speakerId) => {
      const score = this.calculateSimilarity(features, profile);
      if (score > bestScore && score > 0.6) {
        bestScore = score;
        bestMatch = speakerId;
      }
    });

    if (bestMatch) {
      if (this.currentSpeaker !== bestMatch) {
        this.handleSpeakerChange(bestMatch);
      }
      return bestMatch;
    }

    // Create new speaker profile
    const newSpeakerId = `speaker_${this.speakers.size + 1}`;
    this.createSpeakerProfile(newSpeakerId, features);
    this.handleSpeakerChange(newSpeakerId);
    return newSpeakerId;
  }

  private calculateSimilarity(features: SpeakerAudioFeatures, profile: SpeakerProfile): number {
    if (profile.segments.length === 0) return 0;

    // Get average features from profile
    const avgFeatures = this.getAverageFeatures(profile.segments);
    
    // Compare features
    const pitchSimilarity = 1 - Math.abs(features.averagePitch - avgFeatures.averagePitch) / 200;
    const energySimilarity = 1 - Math.abs(features.averageEnergy - avgFeatures.averageEnergy);
    const rateSimilarity = 1 - Math.abs(features.speechRate - avgFeatures.speechRate) / 8;

    return (pitchSimilarity * 0.4 + energySimilarity * 0.3 + rateSimilarity * 0.3);
  }

  private getAverageFeatures(segments: SpeakerSegment[]): SpeakerAudioFeatures {
    const avg = segments.reduce((acc, seg) => ({
      averagePitch: acc.averagePitch + seg.audioFeatures.averagePitch,
      averageEnergy: acc.averageEnergy + seg.audioFeatures.averageEnergy,
      speechRate: acc.speechRate + seg.audioFeatures.speechRate,
      voiceQuality: acc.voiceQuality + seg.audioFeatures.voiceQuality,
      pitchRange: acc.pitchRange,
    }), {
      averagePitch: 0,
      averageEnergy: 0,
      speechRate: 0,
      voiceQuality: 0,
      pitchRange: [0, 0] as [number, number],
    });

    const count = segments.length;
    return {
      averagePitch: avg.averagePitch / count,
      pitchRange: segments[0]?.audioFeatures.pitchRange || [100, 300],
      averageEnergy: avg.averageEnergy / count,
      speechRate: avg.speechRate / count,
      voiceQuality: avg.voiceQuality / count,
    };
  }

  private calculateMatchConfidence(speakerId: string, features: SpeakerAudioFeatures): number {
    const profile = this.speakers.get(speakerId);
    if (!profile || profile.segments.length === 0) return 0.7;
    
    return Math.min(0.95, 0.6 + this.calculateSimilarity(features, profile) * 0.35);
  }

  private createSpeakerProfile(speakerId: string, features: SpeakerAudioFeatures): void {
    const colorIndex = this.speakers.size % SPEAKER_COLORS.length;
    
    this.speakers.set(speakerId, {
      id: speakerId,
      label: `Speaker ${this.speakers.size + 1}`,
      color: SPEAKER_COLORS[colorIndex],
      segments: [],
      fraudProbability: 0,
      totalSpeakingTime: 0,
      turnCount: 0,
      avgConfidence: 0.7,
    });
  }

  private updateSpeakerProfile(
    speakerId: string, 
    segment: SpeakerSegment,
    transcript?: string
  ): void {
    const profile = this.speakers.get(speakerId);
    if (!profile) return;

    profile.segments.push(segment);
    profile.totalSpeakingTime += segment.endTime - segment.startTime;
    
    // Update average confidence
    const totalConfidence = profile.segments.reduce((sum, s) => sum + s.confidence, 0);
    profile.avgConfidence = totalConfidence / profile.segments.length;

    // Analyze for fraud indicators
    if (transcript) {
      const fraudScore = this.analyzeFraudIndicators(transcript, segment.audioFeatures);
      this.updateFraudProbability(speakerId, fraudScore);
    }
  }

  private handleSpeakerChange(newSpeakerId: string): void {
    if (this.currentSpeaker && this.currentSpeaker !== newSpeakerId) {
      const profile = this.speakers.get(newSpeakerId);
      if (profile) {
        profile.turnCount++;
      }
    }

    this.currentSpeaker = newSpeakerId;
    this.speakerChangeCallbacks.forEach(cb => cb(newSpeakerId));
  }

  private analyzeFraudIndicators(transcript: string, features: SpeakerAudioFeatures): number {
    let score = 0;
    const indicators: string[] = [];

    // Text-based indicators
    if (/urgent|immediately|now|hurry/i.test(transcript)) {
      score += 0.2;
      indicators.push('urgency_language');
    }
    if (/bank|account|transfer|money/i.test(transcript)) {
      score += 0.15;
      indicators.push('financial_topic');
    }
    if (/irs|fbi|police|government/i.test(transcript)) {
      score += 0.25;
      indicators.push('authority_impersonation');
    }
    if (/ssn|social security|password/i.test(transcript)) {
      score += 0.3;
      indicators.push('pii_request');
    }

    // Audio-based indicators
    if (features.speechRate > 6) {
      score += 0.1;
      indicators.push('rapid_speech');
    }
    if (features.averageEnergy > 0.8) {
      score += 0.1;
      indicators.push('aggressive_tone');
    }

    return Math.min(1, score);
  }

  private updateFraudProbability(speakerId: string, newScore: number): void {
    const profile = this.speakers.get(speakerId);
    if (!profile) return;

    // Exponential moving average
    profile.fraudProbability = profile.fraudProbability * 0.7 + newScore * 0.3;
    
    this.fraudUpdateCallbacks.forEach(cb => cb(speakerId, profile.fraudProbability));
  }

  // Record a complete speaker turn
  recordTurn(turn: Omit<SpeakerTurn, 'fraudIndicators'>): void {
    const profile = this.speakers.get(turn.speakerId);
    const fraudIndicators: string[] = [];

    if (profile && profile.fraudProbability > 0.5) {
      if (profile.fraudProbability > 0.8) fraudIndicators.push('high_fraud_probability');
      else if (profile.fraudProbability > 0.6) fraudIndicators.push('moderate_fraud_probability');
    }

    this.turnHistory.push({
      ...turn,
      fraudIndicators,
    });
  }

  // Event listeners
  onSpeakerChange(callback: (speakerId: string) => void): void {
    this.speakerChangeCallbacks.push(callback);
  }

  onFraudUpdate(callback: (speakerId: string, probability: number) => void): void {
    this.fraudUpdateCallbacks.push(callback);
  }

  // Getters
  getResult(): DiarizationResult {
    return {
      speakers: new Map(this.speakers),
      currentSpeaker: this.currentSpeaker,
      turnHistory: [...this.turnHistory],
    };
  }

  getSpeaker(speakerId: string): SpeakerProfile | undefined {
    return this.speakers.get(speakerId);
  }

  getCurrentSpeaker(): SpeakerProfile | null {
    return this.currentSpeaker ? this.speakers.get(this.currentSpeaker) || null : null;
  }

  getAllSpeakers(): SpeakerProfile[] {
    return Array.from(this.speakers.values());
  }

  reset(): void {
    this.speakers = new Map();
    this.currentSpeaker = null;
    this.turnHistory = [];
    this.lastSegmentEnd = 0;
  }
}

export const speakerDiarization = new SpeakerDiarizationEngine();
