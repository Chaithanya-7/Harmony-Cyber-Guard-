// Context Tracker - Maintains conversational state across audio chunks

export interface ConversationState {
  topicHistory: string[];
  currentTopic: string | null;
  emotionalProgression: EmotionalState[];
  linguisticContinuity: number; // 0-1 score
  turnCount: number;
  totalDuration: number;
  lastUpdateTime: number;
}

export interface EmotionalState {
  timestamp: number;
  valence: number; // -1 to 1 (negative to positive)
  arousal: number; // 0 to 1 (calm to excited)
  dominance: number; // 0 to 1 (submissive to dominant)
  label: 'neutral' | 'anxious' | 'angry' | 'fearful' | 'confident' | 'stressed';
}

export interface TopicShift {
  fromTopic: string | null;
  toTopic: string;
  timestamp: number;
  confidence: number;
}

export class ContextTracker {
  private state: ConversationState;
  private topicShiftCallbacks: ((shift: TopicShift) => void)[] = [];
  private emotionChangeCallbacks: ((emotion: EmotionalState) => void)[] = [];

  constructor() {
    this.state = {
      topicHistory: [],
      currentTopic: null,
      emotionalProgression: [],
      linguisticContinuity: 1.0,
      turnCount: 0,
      totalDuration: 0,
      lastUpdateTime: Date.now(),
    };
  }

  // Process incoming audio chunk context
  processChunk(chunkData: {
    transcript?: string;
    duration: number;
    speakerId?: string;
    audioFeatures?: Record<string, number>;
  }): void {
    const now = Date.now();
    this.state.totalDuration += chunkData.duration;
    this.state.lastUpdateTime = now;

    if (chunkData.transcript) {
      this.analyzeTranscript(chunkData.transcript, now);
    }

    if (chunkData.audioFeatures) {
      this.updateEmotionalState(chunkData.audioFeatures, now);
    }
  }

  private analyzeTranscript(transcript: string, timestamp: number): void {
    const detectedTopic = this.detectTopic(transcript);
    
    if (detectedTopic && detectedTopic !== this.state.currentTopic) {
      const shift: TopicShift = {
        fromTopic: this.state.currentTopic,
        toTopic: detectedTopic,
        timestamp,
        confidence: this.calculateTopicConfidence(transcript, detectedTopic),
      };
      
      this.state.topicHistory.push(detectedTopic);
      this.state.currentTopic = detectedTopic;
      this.topicShiftCallbacks.forEach(cb => cb(shift));
    }

    // Update linguistic continuity based on coherence
    this.state.linguisticContinuity = this.calculateLinguisticContinuity(transcript);
  }

  private detectTopic(transcript: string): string | null {
    const topicPatterns: Record<string, RegExp[]> = {
      'financial': [/bank|account|money|transfer|payment|credit|debit/i],
      'identity': [/ssn|social security|id|identity|passport|license/i],
      'urgency': [/urgent|immediately|now|hurry|limited time|expire/i],
      'authority': [/irs|fbi|police|government|official|department/i],
      'technical': [/computer|virus|software|hack|password|login/i],
      'prize_scam': [/winner|prize|lottery|congratulations|claim/i],
      'romance': [/love|relationship|meet|dating|lonely/i],
      'investment': [/invest|returns|crypto|bitcoin|opportunity/i],
    };

    for (const [topic, patterns] of Object.entries(topicPatterns)) {
      if (patterns.some(pattern => pattern.test(transcript))) {
        return topic;
      }
    }

    return null;
  }

  private calculateTopicConfidence(transcript: string, topic: string): number {
    // Simple confidence based on keyword density
    const words = transcript.toLowerCase().split(/\s+/);
    const topicKeywords: Record<string, string[]> = {
      'financial': ['bank', 'account', 'money', 'transfer', 'payment'],
      'identity': ['ssn', 'social', 'security', 'identity', 'passport'],
      'urgency': ['urgent', 'immediately', 'now', 'hurry', 'expire'],
      'authority': ['irs', 'fbi', 'police', 'government', 'official'],
      'technical': ['computer', 'virus', 'software', 'hack', 'password'],
      'prize_scam': ['winner', 'prize', 'lottery', 'congratulations'],
      'romance': ['love', 'relationship', 'meet', 'dating'],
      'investment': ['invest', 'returns', 'crypto', 'bitcoin'],
    };

    const keywords = topicKeywords[topic] || [];
    const matchCount = words.filter(word => keywords.includes(word)).length;
    return Math.min(1, matchCount / 3);
  }

  private calculateLinguisticContinuity(transcript: string): number {
    // Analyze for coherent sentence structure
    const sentences = transcript.split(/[.!?]+/).filter(s => s.trim());
    if (sentences.length === 0) return 0.5;

    let coherenceScore = 0;
    sentences.forEach(sentence => {
      const words = sentence.trim().split(/\s+/);
      // Longer, complete sentences indicate higher continuity
      if (words.length >= 3 && words.length <= 20) {
        coherenceScore += 1;
      } else if (words.length > 0) {
        coherenceScore += 0.5;
      }
    });

    return Math.min(1, coherenceScore / sentences.length);
  }

  private updateEmotionalState(audioFeatures: Record<string, number>, timestamp: number): void {
    // Map audio features to emotional dimensions
    const pitchVariance = audioFeatures.pitchVariance || 0;
    const energyLevel = audioFeatures.energyLevel || 0;
    const speechRate = audioFeatures.speechRate || 0;
    const voiceStress = audioFeatures.voiceStress || 0;

    const valence = Math.max(-1, Math.min(1, (0.5 - voiceStress) * 2));
    const arousal = Math.min(1, (energyLevel + pitchVariance + speechRate) / 3);
    const dominance = Math.min(1, energyLevel * 0.6 + (1 - voiceStress) * 0.4);

    const label = this.classifyEmotion(valence, arousal, voiceStress);

    const emotionalState: EmotionalState = {
      timestamp,
      valence,
      arousal,
      dominance,
      label,
    };

    this.state.emotionalProgression.push(emotionalState);
    
    // Keep only last 50 states
    if (this.state.emotionalProgression.length > 50) {
      this.state.emotionalProgression.shift();
    }

    this.emotionChangeCallbacks.forEach(cb => cb(emotionalState));
  }

  private classifyEmotion(
    valence: number, 
    arousal: number, 
    stress: number
  ): EmotionalState['label'] {
    if (stress > 0.7) return 'stressed';
    if (valence < -0.3 && arousal > 0.6) return 'angry';
    if (valence < -0.3 && arousal < 0.4) return 'fearful';
    if (arousal > 0.6 && stress > 0.4) return 'anxious';
    if (valence > 0.3 && arousal > 0.5) return 'confident';
    return 'neutral';
  }

  // Event listeners
  onTopicShift(callback: (shift: TopicShift) => void): void {
    this.topicShiftCallbacks.push(callback);
  }

  onEmotionChange(callback: (emotion: EmotionalState) => void): void {
    this.emotionChangeCallbacks.push(callback);
  }

  // Getters
  getState(): ConversationState {
    return { ...this.state };
  }

  getEmotionalTrend(): 'escalating' | 'de-escalating' | 'stable' {
    const recent = this.state.emotionalProgression.slice(-10);
    if (recent.length < 2) return 'stable';

    const avgEarlyArousal = recent.slice(0, 5).reduce((sum, e) => sum + e.arousal, 0) / 5;
    const avgLateArousal = recent.slice(-5).reduce((sum, e) => sum + e.arousal, 0) / 5;

    if (avgLateArousal - avgEarlyArousal > 0.15) return 'escalating';
    if (avgEarlyArousal - avgLateArousal > 0.15) return 'de-escalating';
    return 'stable';
  }

  incrementTurnCount(): void {
    this.state.turnCount++;
  }

  reset(): void {
    this.state = {
      topicHistory: [],
      currentTopic: null,
      emotionalProgression: [],
      linguisticContinuity: 1.0,
      turnCount: 0,
      totalDuration: 0,
      lastUpdateTime: Date.now(),
    };
  }
}

export const contextTracker = new ContextTracker();
