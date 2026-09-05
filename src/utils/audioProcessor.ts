/**
 * Audio Processor Utility for Gemini Vault Voice Reflection (Phase C)
 *
 * Handles:
 * - 16kHz mono 16-bit PCM microphone capture with software resampling
 * - Input RMS calculation for voice activity detection and audio reactivity
 * - 24kHz mono 16-bit PCM playback buffer queuing and smooth scheduling
 * - Instant (<20ms) playback cancellation for natural barge-in interruption
 */

/**
 * Distinguishes and formats browser DOMException errors for microphone access.
 * Accurately reports permission denial vs hardware or constraint failures.
 */
export function formatMicrophoneError(err: unknown): string {
  if (err && typeof err === 'object' && 'name' in err) {
    const name = (err as { name: string }).name;
    switch (name) {
      case 'NotAllowedError':
      case 'PermissionDeniedError':
        return 'Microphone access denied. Please allow microphone permissions in your browser to use Voice Reflection.';
      case 'NotFoundError':
      case 'DevicesNotFoundError':
        return 'No microphone detected. Please connect an audio input device to use Voice Reflection.';
      case 'NotReadableError':
      case 'TrackStartError':
        return 'Microphone is unavailable or in use by another application. Please check your audio input settings.';
      case 'OverconstrainedError':
      case 'ConstraintNotSatisfiedError':
        return 'Microphone does not satisfy requested audio constraints. Please check your audio device settings.';
      case 'AbortError':
        return 'Microphone access was interrupted. Please try again.';
      case 'SecurityError':
        return 'Microphone access is restricted by browser security policy. Please ensure the application is served securely.';
      case 'TypeError':
        return 'Invalid microphone configuration constraints.';
    }
  }
  if (err instanceof Error && err.message) {
    return err.message;
  }
  return 'Unable to access microphone. Please check your audio input settings.';
}

export class AudioCaptureService {
  private audioCtx: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private onAudioChunkCallback?: (base64Pcm: string, rms: number) => void;
  private isRecording = false;

  private async logMicDiagnostics(err: unknown, attemptedDevice?: string): Promise<void> {
    const domErr = err as { name?: string; message?: string };
    let deviceCount = 0;
    let selectedOrAvailableDevices: string[] = [];
    try {
      if (typeof navigator !== 'undefined' && navigator.mediaDevices?.enumerateDevices) {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter((d) => d.kind === 'audioinput');
        deviceCount = audioInputs.length;
        selectedOrAvailableDevices = audioInputs.map((d) => d.label).filter(Boolean);
      }
    } catch {
      // Diagnostic logging must not throw
    }

    console.error('[AudioCaptureService] Microphone diagnostic error:', {
      name: domErr?.name || 'UnknownError',
      message: domErr?.message || String(err),
      audioInputCount: deviceCount,
      selectedOrAvailableDevices:
        selectedOrAvailableDevices.length > 0 ? selectedOrAvailableDevices : attemptedDevice || 'None',
    });
  }

  async start(onChunk: (base64Pcm: string, rms: number) => void): Promise<void> {
    if (this.isRecording) return;
    this.onAudioChunkCallback = onChunk;

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      const err = new Error('MediaDevices API is not supported in this browser environment.');
      err.name = 'NotSupportedError';
      throw err;
    }

    // 1. Request microphone stream using broadly compatible audio constraints.
    // Prefer { audio: true } or compatible non-exact constraints.
    let stream: MediaStream | null = null;
    try {
      // Primary attempt: default audio input with browser-standard constraints
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (primaryErr: unknown) {
      const errName = (primaryErr as { name?: string })?.name;

      // Never attempt fallback for explicit user denials or security restrictions
      if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError' || errName === 'SecurityError') {
        await this.logMicDiagnostics(primaryErr);
        throw primaryErr;
      }

      // If default device fails due to device-level issues (e.g. NotReadableError on unplugged Line In or OverconstrainedError),
      // attempt fallback to other available audio input devices
      if (errName === 'NotReadableError' || errName === 'TrackStartError' || errName === 'OverconstrainedError') {
        console.warn(`[AudioCaptureService] Primary audio input failed with ${errName}. Checking other available inputs...`);
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const otherInputs = devices.filter(
            (d) => d.kind === 'audioinput' && d.deviceId && d.deviceId !== 'default' && d.deviceId !== 'communications'
          );

          for (const dev of otherInputs) {
            try {
              const fallbackStream = await navigator.mediaDevices.getUserMedia({
                audio: { deviceId: { exact: dev.deviceId } },
              });
              if (fallbackStream) {
                console.log(
                  `[AudioCaptureService] Successfully fell back to available audio device: "${dev.label || dev.deviceId}"`
                );
                stream = fallbackStream;
                break;
              }
            } catch {
              // Try next device
            }
          }
        } catch {
          // Device enumeration fallback failed
        }
      }

      if (!stream) {
        await this.logMicDiagnostics(primaryErr);
        throw primaryErr;
      }
    }

    // 2. Verify audio track state
    if (!stream) {
      const err = new Error('No media stream returned by microphone.');
      err.name = 'NotFoundError';
      await this.logMicDiagnostics(err);
      throw err;
    }

    const audioTracks = stream.getAudioTracks();
    if (!audioTracks || audioTracks.length === 0) {
      const err = new Error('No audio tracks found on the microphone stream.');
      err.name = 'NotFoundError';
      await this.logMicDiagnostics(err);
      throw err;
    }

    const track = audioTracks[0];
    if (track.readyState !== 'live') {
      const err = new Error(`Audio track is not live (readyState: ${track.readyState}).`);
      err.name = 'NotReadableError';
      await this.logMicDiagnostics(err);
      throw err;
    }

    if (!track.enabled) {
      const err = new Error('Audio track is disabled.');
      err.name = 'NotReadableError';
      await this.logMicDiagnostics(err);
      throw err;
    }

    this.mediaStream = stream;

    // Diagnostic log of active track and device count
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter((d) => d.kind === 'audioinput');
      console.log('[AudioCaptureService] Audio stream active:', {
        selectedDevice: track.label || 'Default',
        audioInputCount: audioInputs.length,
        readyState: track.readyState,
      });
    } catch {
      // Diagnostic logging must not throw
    }

    // 3. Setup Web Audio pipeline
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) {
      const err = new Error('Web Audio API is not supported in this browser.');
      err.name = 'NotSupportedError';
      await this.logMicDiagnostics(err);
      throw err;
    }

    this.audioCtx = new AudioContextClass();
    if (this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
    }

    this.sourceNode = this.audioCtx.createMediaStreamSource(this.mediaStream);

    // Buffer size: 2048 samples
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
      const resampled =
        inputSampleRate === targetSampleRate
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
      try {
        this.processorNode.disconnect();
      } catch {}
      this.processorNode = null;
    }
    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect();
      } catch {}
      this.sourceNode = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {}
      });
      this.mediaStream = null;
    }
    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      try {
        void this.audioCtx.close();
      } catch {}
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
  private masterGainNode: GainNode | null = null;
  private activeSources: AudioBufferSourceNode[] = [];
  private nextPlayTime = 0;
  private onOutputRmsCallback?: (rms: number) => void;
  private analyserNode: AnalyserNode | null = null;
  private animFrameId?: number;
  private remainderByte: number | null = null;

  constructor() {
    // Lazy initialized on first user interaction or first playback chunk
  }

  private ensureContext(): AudioContext {
    if (!this.audioCtx || this.audioCtx.state === 'closed') {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioCtx = new AudioContextClass();

      // Master output gain node for clickless volume ramping and DAC pop prevention
      this.masterGainNode = this.audioCtx.createGain();
      this.masterGainNode.gain.setValueAtTime(1.0, this.audioCtx.currentTime);

      // Analyser for output amplitude visualization
      this.analyserNode = this.audioCtx.createAnalyser();
      this.analyserNode.fftSize = 256;

      this.masterGainNode.connect(this.analyserNode);
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

    // Strict 16-bit PCM alignment: carry over odd remainder bytes across chunk boundaries
    // to prevent high/low byte swapping which causes loud high-amplitude mechanical beeps.
    let allBytes: Uint8Array;
    if (this.remainderByte !== null) {
      allBytes = new Uint8Array(bytes.length + 1);
      allBytes[0] = this.remainderByte;
      allBytes.set(bytes, 1);
      this.remainderByte = null;
    } else {
      allBytes = bytes;
    }

    if (allBytes.length % 2 !== 0) {
      this.remainderByte = allBytes[allBytes.length - 1];
      allBytes = allBytes.subarray(0, allBytes.length - 1);
    }

    if (allBytes.length === 0) return;

    // Convert 16-bit PCM little-endian directly to Float32 at 24,000 Hz
    const sampleCount = allBytes.length / 2;
    const float32 = new Float32Array(sampleCount);
    for (let i = 0; i < sampleCount; i++) {
      const low = allBytes[i * 2];
      const high = allBytes[i * 2 + 1];
      let val = (high << 8) | low;
      if (val >= 32768) val -= 65536;
      float32[i] = val / 32768.0;
    }

    const currentTime = ctx.currentTime;
    const jitterDelta = currentTime - this.nextPlayTime;
    const isInitialBurst = this.nextPlayTime === 0 || jitterDelta > 0.25;
    const isMinorJitter = !isInitialBurst && jitterDelta > 0;

    // 1. Playback scheduling:
    // Initial burst from silence: cushion by 40ms to give Web Audio quantum thread headroom.
    // Minor network jitter (<250ms): resume immediately (2ms context switch) without inserting 40ms silence gaps.
    // Continuous stream: seamlessly append to nextPlayTime.
    let startTime: number;
    if (isInitialBurst) {
      startTime = currentTime + 0.04;
    } else if (isMinorJitter) {
      startTime = currentTime + 0.002;
    } else {
      startTime = this.nextPlayTime;
    }

    // 2. Micro fade-in on burst/underrun to eliminate DC step discontinuity pop:
    // 3ms (72 samples at 24kHz) on initial burst, 1ms (24 samples) on minor jitter recovery.
    if (isInitialBurst || isMinorJitter) {
      const fadeSamples = isInitialBurst ? Math.min(72, float32.length) : Math.min(24, float32.length);
      for (let i = 0; i < fadeSamples; i++) {
        float32[i] *= (i / fadeSamples);
      }
    }

    const audioBuffer = ctx.createBuffer(1, float32.length, 24000);
    audioBuffer.getChannelData(0).set(float32);

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;

    if (this.masterGainNode) {
      source.connect(this.masterGainNode);
    } else if (this.analyserNode) {
      source.connect(this.analyserNode);
    } else {
      source.connect(ctx.destination);
    }

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
   * Barge-in interruption: smoothly cuts all active and queued audio playback in < 10ms with 5ms DAC pop ramp
   */
  stopAll(): void {
    this.remainderByte = null;
    const sourcesToStop = [...this.activeSources];
    this.activeSources = [];

    if (this.audioCtx && this.masterGainNode) {
      try {
        const curTime = this.audioCtx.currentTime;
        // 5ms output gain ramp down to eliminate DAC pop
        this.masterGainNode.gain.setValueAtTime(this.masterGainNode.gain.value, curTime);
        this.masterGainNode.gain.linearRampToValueAtTime(0.0001, curTime + 0.005);
        setTimeout(() => {
          for (const source of sourcesToStop) {
            try {
              source.stop();
              source.disconnect();
            } catch {}
          }
          if (this.masterGainNode && this.audioCtx) {
            this.masterGainNode.gain.setValueAtTime(1.0, this.audioCtx.currentTime);
          }
        }, 6);
      } catch {
        for (const source of sourcesToStop) {
          try {
            source.stop();
            source.disconnect();
          } catch {}
        }
      }
    } else {
      for (const source of sourcesToStop) {
        try {
          source.stop();
          source.disconnect();
        } catch {}
      }
    }

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
