import { pipeline, env } from '@xenova/transformers';
import type { PipelineType } from '@xenova/transformers';

// Disable local cache to prevent Vite development issues
env.allowLocalModels = false;

class WhisperPipeline {
    static task: PipelineType = 'automatic-speech-recognition';
    static model = 'Xenova/whisper-tiny.en';
    static instance: any = null;

    static async getInstance(progress_callback?: (progress: any) => void) {
        if (this.instance === null) {
            this.instance = await pipeline(this.task, this.model, {
                progress_callback,
            });
        }
        return this.instance;
    }
}

// Listen for messages from the main thread
self.addEventListener('message', async (event) => {
    const { type, audioData } = event.data;

    if (type === 'load') {
        // Preload the model
        await WhisperPipeline.getInstance((progress) => {
            self.postMessage({ type: 'progress', progress });
        });
        self.postMessage({ type: 'ready' });
    }

    if (type === 'transcribe') {
        try {
            // Get pipeline
            const transcriber = await WhisperPipeline.getInstance();
            
            // audioData is expected to be a Float32Array sampled at 16kHz
            const result = await transcriber(audioData, {
                chunk_length_s: 30,
                stride_length_s: 5,
                language: 'en',
                task: 'transcribe',
                return_timestamps: true,
            });

            self.postMessage({ 
                type: 'result', 
                text: result.text,
                chunks: result.chunks 
            });
        } catch (error: any) {
            self.postMessage({ type: 'error', error: error.message });
        }
    }
});
