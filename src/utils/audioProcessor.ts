/**
 * Audio Processor Utility for Gemini Vault Voice Reflection (Phase C)
 *
 * Handles:
 * - 16kHz mono 16-bit PCM microphone capture with software resampling
 * - Input RMS calculation for voice activity detection and audio reactivity
 * - 24kHz mono 16-bit PCM playback buffer queuing and smooth scheduling
 * - Instant (<20ms) playback cancellation for natural barge-in interruption
 */

export class AudioCaptureService {
  private audioCtx: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private onAudioChunkCallback?: (base64Pcm: string, rms: number) => void;
  private isRecording = false;

  async start(onChunk: (base64Pcm: string, rms: number) => void): Promise<void> {
    if (this.isRecording) return;
    this.onAudioChunkCallback = onChunk;

    // Request microphone stream with voice-optimized constraints
    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.audioCtx = new AudioContextClass();
    if (this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
    }

    this.sourceNode = this.audioCtx.createMediaStreamSource(this.mediaStream);

    // Buffer size: 2048 or 4096 samples
    const bufferSize = 2048;
    this.processorNode = this.audioCtx.createScriptProcessor(bufferSize, 1, 1);

    const inputSampleRate = this.audioCtx.sampleRate;
    const targetSampleRate = 16000;

    this.processorNode.onaudioprocess = (e) => {
      if (!this.isRecording) return;

      const inputData = e.inputBuffer.getChannelData(0);

      // Compute RMS power (0.0 to 1.0)
      let sumSquares = 0;
      for (let i = 0; i < inputData.length; i++) {
        sumSquares += inputData[i] * inputData[i];
      }
      const rms = Math.sqrt(sumSquares / inputData.length);

      // Resample to 16kHz if necessary
      const resampled = inputSampleRate === targetSampleRate
        ? inputData
        : this.resample(inputData, inputSampleRate, targetSampleRate);

      // Convert Float32 to Int16 Little-Endian PCM
      const pcm16 = new Int16Array(resampled.length);
      for (let i = 0; i < resampled.length; i++) {
        const s = Math.max(-1, Math.min(1, resampled[i]));
        pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }

      // Convert to base64
      const bytes = new Uint8Array(pcm16.buffer);
      let binary = '';
      const len = bytes.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);

      if (this.onAudioChunkCallback) {
        this.onAudioChunkCallback(base64, Math.min(1, rms * 4)); // Scale for UI responsiveness
      }
    };

    this.sourceNode.connect(this.processorNode);
    // Connect to destination to keep processor active, but mute to prevent feedback loop
    const muteGain = this.audioCtx.createGain();
    muteGain.gain.value = 0;
    this.processorNode.connect(muteGain);
    muteGain.connect(this.audioCtx.destination);

    this.isRecording = true;
  }

  stop(): void {
    this.isRecording = false;

    if (this.processorNode) {
      this.processorNode.disconnect();
      this.processorNode = null;
    }
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      void this.audioCtx.close();
      this.audioCtx = null;
    }
  }

  private resample(source: Float32Array, srcRate: number, destRate: number): Float32Array {
    if (srcRate === destRate) return source;
    const ratio = srcRate / destRate;
    const newLen = Math.round(source.length / ratio);
    const result = new Float32Array(newLen);
    for (let i = 0; i < newLen; i++) {
      const srcIdx = i * ratio;
      const baseIdx = Math.floor(srcIdx);
      const frac = srcIdx - baseIdx;
      const nextIdx = Math.min(baseIdx + 1, source.length - 1);
      result[i] = source[baseIdx] * (1 - frac) + source[nextIdx] * frac;
    }
    return result;
  }
}

export class AudioPlaybackService {
  private audioCtx: AudioContext | null = null;
  private activeSources: AudioBufferSourceNode[] = [];
  private nextPlayTime = 0;
  private onOutputRmsCallback?: (rms: number) => void;
  private analyserNode: AnalyserNode | null = null;
  private animFrameId?: number;

  constructor() {
    // Lazy initialized on first user interaction or first playback chunk
  }

  private ensureContext(): AudioContext {
    if (!this.audioCtx || this.audioCtx.state === 'closed') {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioCtx = new AudioContextClass();

      // Analyser for output amplitude visualization
      this.analyserNode = this.audioCtx.createAnalyser();
      this.analyserNode.fftSize = 256;
      this.analyserNode.connect(this.audioCtx.destination);
      this.startRmsLoop();
    }
    if (this.audioCtx.state === 'suspended') {
      void this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  setRmsCallback(cb: (rms: number) => void): void {
    this.onOutputRmsCallback = cb;
  }

  playPcmChunk(base64Pcm: string): void {
    const ctx = this.ensureContext();

    // Decode base64 to Uint8Array
    const binary = atob(base64Pcm);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    // Convert 16-bit PCM little-endian to Float32 at 24,000 Hz
    const int16 = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 32768.0;
    }

    const audioBuffer = ctx.createBuffer(1, float32.length, 24000);
    audioBuffer.getChannelData(0).set(float32);

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;

    if (this.analyserNode) {
      source.connect(this.analyserNode);
    } else {
      source.connect(ctx.destination);
    }

    const currentTime = ctx.currentTime;
    const startTime = Math.max(currentTime, this.nextPlayTime);
    source.start(startTime);
    this.nextPlayTime = startTime + audioBuffer.duration;

    this.activeSources.push(source);
    source.onended = () => {
      const idx = this.activeSources.indexOf(source);
      if (idx !== -1) {
        this.activeSources.splice(idx, 1);
      }
    };
  }

  /**
   * Barge-in interruption: immediately cuts all active and queued audio playback in < 20ms
   */
  stopAll(): void {
    for (const source of this.activeSources) {
      try {
        source.stop();
        source.disconnect();
      } catch {
        // Source may already be stopped
      }
    }
    this.activeSources = [];
    if (this.audioCtx) {
      this.nextPlayTime = this.audioCtx.currentTime;
    }
    if (this.onOutputRmsCallback) {
      this.onOutputRmsCallback(0);
    }
  }

  close(): void {
    this.stopAll();
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = undefined;
    }
    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      void this.audioCtx.close();
      this.audioCtx = null;
    }
  }

  private startRmsLoop(): void {
    const dataArray = new Uint8Array(128);
    const checkRms = () => {
      if (this.analyserNode && this.activeSources.length > 0) {
        this.analyserNode.getByteTimeDomainData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const norm = (dataArray[i] - 128) / 128;
          sum += norm * norm;
        }
        const rms = Math.sqrt(sum / dataArray.length);
        if (this.onOutputRmsCallback) {
          this.onOutputRmsCallback(Math.min(1, rms * 3.5));
        }
      } else if (this.onOutputRmsCallback && this.activeSources.length === 0) {
        this.onOutputRmsCallback(0);
      }
      this.animFrameId = requestAnimationFrame(checkRms);
    };
    this.animFrameId = requestAnimationFrame(checkRms);
  }
}
