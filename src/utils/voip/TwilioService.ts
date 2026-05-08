import { supabase } from "@/integrations/supabase/client";

export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  phoneNumber: string;
}

class TwilioService {
  private config: TwilioConfig | null = {
    accountSid: import.meta.env.VITE_TWILIO_ACCOUNT_SID || '',
    authToken: import.meta.env.VITE_TWILIO_AUTH_TOKEN || '',
    phoneNumber: import.meta.env.VITE_TWILIO_PHONE_NUMBER || ''
  };

  // Load config from local storage or environment
  init(config?: TwilioConfig) {
    if (config) {
      this.config = config;
      localStorage.setItem('cyberguard_twilio_config', JSON.stringify(config));
    } else {
      const saved = localStorage.getItem('cyberguard_twilio_config');
      if (saved) {
        this.config = JSON.parse(saved);
      } else {
        // Use hardcoded defaults if nothing saved
        this.config = {
          accountSid: import.meta.env.VITE_TWILIO_ACCOUNT_SID || '',
          authToken: import.meta.env.VITE_TWILIO_AUTH_TOKEN || '',
          phoneNumber: import.meta.env.VITE_TWILIO_PHONE_NUMBER || ''
        };
      }
    }
  }

  get isConfigured(): boolean {
    return !!(this.config?.accountSid && this.config?.authToken);
  }

  async makeRealCall(to: string) {
    if (!this.isConfigured) {
      throw new Error("Twilio is not configured. Please add your credentials in Settings.");
    }

    console.log(`[Twilio Service] Requesting real PSTN call to ${to}...`);

    // Request Microphone Access for Two-Way Audio
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log("[Twilio Service] Microphone access granted for two-way audio.");
      // We don't need to do anything with the stream yet as Twilio will handle it,
      // but this ensures the browser allows audio capture.
    } catch (err) {
      console.warn("[Twilio Service] Microphone access denied. recipient will not hear you.");
    }

    try {
      console.log(`[Twilio Service] Invoking Secure Bridge for PSTN call to ${to}...`);
      
      const { data, error: fnError } = await supabase.functions.invoke('twilio-voice', {
        body: {
          action: 'make-call',
          to: to,
          sid: this.config?.accountSid,
          token: this.config?.authToken,
          from: this.config?.phoneNumber,
          userNumber: '+917019186014' // HARDCODED FOR RELIABILITY
        }
      });

      if (fnError) {
        console.error("[Twilio Service] Function Invocation Error:", fnError);
        throw new Error(fnError.message || "Twilio Bridge unreachable. Ensure the function is deployed.");
      }

      if (data && data.success === false) {
        console.error("[Twilio Service] Twilio API Reject:", data.error);
        throw new Error(`${data.error || "Unknown Twilio Error"}. ${data.details || ""}`);
      }

      return data;
    } catch (err: any) {
      console.error("[Twilio Service] Fatal Connection Error:", err);
      throw new Error(err.message || "Failed to establish secure call bridge.");
    }
  }

  clearConfig() {
    this.config = null;
    localStorage.removeItem('cyberguard_twilio_config');
  }
}

export const twilioService = new TwilioService();
