'use client';

// Audio format utilities for Gemini Live API
// Input audio to Gemini: 16kHz 16-bit PCM Mono
// Output audio from Gemini: 24kHz 16-bit PCM Mono (Puck voice)

function isContextClosed(ctx: AudioContext): boolean {
  return ctx.state === 'closed';
}

function closeContext(ctx: AudioContext): void {
  if (ctx.state !== 'closed') ctx.close().catch(() => {});
}

export class AudioStreamer {
  private outputCtx: AudioContext | null = null;
  private inputCtx: AudioContext | null = null;
  private inputSource: MediaStreamAudioSourceNode | null = null;
  private inputWorkletNode: AudioWorkletNode | null = null;
  private inputProcessor: ScriptProcessorNode | null = null;
  private inputAnalyser: AnalyserNode | null = null;
  private outputAnalyser: AnalyserNode | null = null;
  private mediaStream: MediaStream | null = null;

  private nextPlayTime: number = 0;
  private activeSources: AudioBufferSourceNode[] = [];
  private playbackWorkletNode: AudioWorkletNode | null = null;
  private useWorkletPlayback: boolean = false;
  private isRecording: boolean = false;
  private isStarting: boolean = false;
  private startAbort: boolean = false;

  private onAudioChunkCallback: ((base64Pcm: string) => void) | null = null;
  private onUserVolumeCallback: ((vol: number) => void) | null = null;
  private onAgentVolumeCallback: ((vol: number) => void) | null = null;

  constructor() {}

  // Initialize playback AudioContext (24000Hz for Gemini output)
  public async ensureOutputContext(): Promise<AudioContext> {
    if (!this.outputCtx || this.outputCtx.state === 'closed') {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtxClass({ sampleRate: 24000 });
      this.outputCtx = ctx;
      this.outputAnalyser = ctx.createAnalyser();
      this.outputAnalyser.fftSize = 256;
      this.outputAnalyser.smoothingTimeConstant = 0.8;
      this.outputAnalyser.connect(ctx.destination);

      // Try loading the ring-buffer playback worklet for gapless audio
      if (ctx.audioWorklet && 'addModule' in ctx.audioWorklet) {
        try {
          await ctx.audioWorklet.addModule('/audio-processors/playback.worklet.js');
          if (this.outputCtx !== ctx || ctx.state === 'closed') return ctx;
          this.playbackWorkletNode = new AudioWorkletNode(ctx, 'pcm-processor');
          this.playbackWorkletNode.connect(this.outputAnalyser);
          this.useWorkletPlayback = true;
        } catch {
          console.warn('[AudioStreamer] playback worklet load failed; using fallback');
          this.useWorkletPlayback = false;
        }
      }
    }
    const outputCtx = this.outputCtx;
    if (outputCtx.state === 'suspended') {
      await outputCtx.resume();
    }
    return outputCtx;
  }

  // Start microphone capture at 16kHz linear PCM
  public async startRecording(
    onChunk: (base64Pcm: string) => void,
    onUserVolume?: (vol: number) => void,
    onAgentVolume?: (vol: number) => void
  ): Promise<void> {
    if (this.isRecording || this.isStarting) return;

    this.isStarting = true;
    this.startAbort = false;

    try {
      this.onAudioChunkCallback = onChunk;
      if (onUserVolume) this.onUserVolumeCallback = onUserVolume;
      if (onAgentVolume) this.onAgentVolumeCallback = onAgentVolume;

      await this.ensureOutputContext();
      if (this.startAbort) return;

      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtxClass({ sampleRate: 16000 });
      this.inputCtx = ctx;
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      if (this.startAbort || isContextClosed(ctx)) {
        closeContext(ctx);
        if (this.inputCtx === ctx) this.inputCtx = null;
        return;
      }

      const inputAnalyser = ctx.createAnalyser();
      inputAnalyser.fftSize = 256;
      inputAnalyser.smoothingTimeConstant = 0.5;
      this.inputAnalyser = inputAnalyser;

      let mediaStream: MediaStream;
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: { ideal: 1 },
            sampleRate: { ideal: 16000 },
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      } catch {
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch (err) {
          closeContext(ctx);
          if (this.inputCtx === ctx) this.inputCtx = null;
          throw err;
        }
      }

      if (this.startAbort || isContextClosed(ctx)) {
        mediaStream.getTracks().forEach((track) => track.stop());
        closeContext(ctx);
        if (this.inputCtx === ctx) this.inputCtx = null;
        return;
      }
      this.mediaStream = mediaStream;

      const inputSource = ctx.createMediaStreamSource(mediaStream);
      inputSource.connect(inputAnalyser);
      this.inputSource = inputSource;

      // Try AudioWorklet (512 samples ~32ms at 16kHz) for low latency,
      // fall back to ScriptProcessorNode if worklet unavailable
      let workletLoaded = false;
      if (ctx.audioWorklet && 'addModule' in ctx.audioWorklet) {
        try {
          await ctx.audioWorklet.addModule('/audio-processors/capture.worklet.js');
          workletLoaded = true;
        } catch {
          console.warn('[AudioStreamer] worklet load failed; using ScriptProcessor fallback');
        }
      }

      if (this.startAbort || isContextClosed(ctx)) {
        inputSource.disconnect();
        if (this.inputSource === inputSource) this.inputSource = null;
        mediaStream.getTracks().forEach((track) => track.stop());
        if (this.mediaStream === mediaStream) this.mediaStream = null;
        closeContext(ctx);
        if (this.inputCtx === ctx) this.inputCtx = null;
        return;
      }

      if (workletLoaded) {
        try {
          this.inputWorkletNode = new AudioWorkletNode(ctx, 'audio-capture-processor');
          this.inputWorkletNode.port.onmessage = (e: MessageEvent) => {
            if (!this.isRecording) return;
            const float32 = e.data?.data as Float32Array | undefined;
            if (float32) this.processAudioChunk(float32);
          };
          inputSource.connect(this.inputWorkletNode);
          this.isRecording = true;
          this.startVolumeMonitoringLoop();
          return;
        } catch {
          this.inputWorkletNode = null;
        }
      }

      // Fallback: ScriptProcessorNode (widely supported, 4096 samples ~256ms)
      this.inputProcessor = ctx.createScriptProcessor(4096, 1, 1);
      inputSource.connect(this.inputProcessor);
      this.inputProcessor.connect(ctx.destination);

      this.inputProcessor.onaudioprocess = (e) => {
        if (!this.isRecording) return;
        this.processAudioChunk(e.inputBuffer.getChannelData(0));
      };

      this.isRecording = true;
      this.startVolumeMonitoringLoop();
    } finally {
      this.isStarting = false;
    }
  }

  private processAudioChunk(inputData: Float32Array): void {
    // Calculate instantaneous volume for visualization
    let sum = 0;
    for (let i = 0; i < inputData.length; i++) {
      sum += inputData[i] * inputData[i];
    }
    const rms = Math.sqrt(sum / inputData.length);
    const volume = Math.min(1, rms * 5);
    if (this.onUserVolumeCallback) {
      this.onUserVolumeCallback(volume);
    }

    // Convert Float32 [-1.0, 1.0] to Int16 PCM little-endian
    const pcm16 = new Int16Array(inputData.length);
    for (let i = 0; i < inputData.length; i++) {
      const s = Math.max(-1, Math.min(1, inputData[i]));
      pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }

    // Base64 encode
    const uint8 = new Uint8Array(pcm16.buffer);
    let binary = '';
    const len = uint8.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(uint8[i]);
    }
    const base64 = btoa(binary);

    if (this.onAudioChunkCallback) {
      this.onAudioChunkCallback(base64);
    }
  }

  // Stop microphone recording
  public stopRecording(): void {
    this.startAbort = true;
    this.isRecording = false;

    if (this.inputWorkletNode) {
      this.inputWorkletNode.disconnect();
      this.inputWorkletNode = null;
    }
    if (this.inputProcessor) {
      this.inputProcessor.disconnect();
      this.inputProcessor = null;
    }
    if (this.inputSource) {
      this.inputSource.disconnect();
      this.inputSource = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
    if (this.inputCtx && this.inputCtx.state !== 'closed') {
      this.inputCtx.close().catch(() => {});
      this.inputCtx = null;
    }
  }

  // Play incoming 24kHz PCM chunk from Gemini Live (Puck voice)
  public async playPcmChunk(base64Pcm: string): Promise<void> {
    const ctx = await this.ensureOutputContext();
    if (ctx.state === 'closed' || !this.outputAnalyser) return;

    // Decode base64 to binary
    const binary = atob(base64Pcm);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    // Convert Int16 PCM to Float32 [-1, 1]
    const pcm16 = new Int16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2);
    const float32 = new Float32Array(pcm16.length);
    for (let i = 0; i < pcm16.length; i++) {
      float32[i] = pcm16[i] / (pcm16[i] < 0 ? 0x8000 : 0x7fff);
    }

    // Primary path: ring buffer worklet (gapless playback)
    if (this.useWorkletPlayback && this.playbackWorkletNode) {
      this.playbackWorkletNode.port.postMessage(float32);
      return;
    }

    // Fallback: per-chunk AudioBufferSourceNode scheduling
    const audioBuffer = ctx.createBuffer(1, float32.length, 24000);
    audioBuffer.copyToChannel(float32, 0);

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.outputAnalyser);

    const currentTime = ctx.currentTime;
    if (this.nextPlayTime < currentTime) {
      this.nextPlayTime = currentTime + 0.02; // 20ms buffer (reduced from 50ms)
    }

    source.start(this.nextPlayTime);
    this.activeSources.push(source);

    const duration = audioBuffer.duration;
    this.nextPlayTime += duration;

    source.onended = () => {
      const idx = this.activeSources.indexOf(source);
      if (idx !== -1) {
        this.activeSources.splice(idx, 1);
      }
    };
  }

  // Stop all playing audio instantly (e.g. on interruption)
  public stopPlayback(): void {
    // Interrupt ring buffer worklet
    if (this.useWorkletPlayback && this.playbackWorkletNode) {
      this.playbackWorkletNode.port.postMessage('interrupt');
    }

    // Stop any legacy fallback sources
    for (const src of this.activeSources) {
      try {
        src.stop();
        src.disconnect();
      } catch {
        // Source already ended
      }
    }
    this.activeSources = [];
    if (this.outputCtx) {
      this.nextPlayTime = this.outputCtx.currentTime;
    }
  }

  // Monitoring loop for agent volume and spectrum
  private startVolumeMonitoringLoop(): void {
    const checkVolume = () => {
      if (!this.isRecording && this.activeSources.length === 0) return;

      if (this.outputAnalyser && this.onAgentVolumeCallback) {
        const data = new Uint8Array(this.outputAnalyser.frequencyBinCount);
        this.outputAnalyser.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          sum += data[i];
        }
        const avg = sum / (data.length * 255);
        this.onAgentVolumeCallback(avg);
      }

      requestAnimationFrame(checkVolume);
    };

    requestAnimationFrame(checkVolume);
  }

  // Get raw analyser data for 3D visualizer
  public getOutputFrequencyData(array: Uint8Array<ArrayBuffer>): void {
    if (this.outputAnalyser) {
      this.outputAnalyser.getByteFrequencyData(array);
    }
  }

  public getInputFrequencyData(array: Uint8Array<ArrayBuffer>): void {
    if (this.inputAnalyser) {
      this.inputAnalyser.getByteFrequencyData(array);
    }
  }

  public getIsPlaying(): boolean {
    if (this.useWorkletPlayback && this.playbackWorkletNode) {
      // Worklet is always "playing" — silence when queue empty
      return true;
    }
    return this.activeSources.length > 0;
  }

  public dispose(): void {
    this.stopRecording();
    this.stopPlayback();
    if (this.playbackWorkletNode) {
      this.playbackWorkletNode.disconnect();
      this.playbackWorkletNode = null;
    }
    if (this.outputCtx && this.outputCtx.state !== 'closed') {
      this.outputCtx.close().catch(() => {});
      this.outputCtx = null;
    }
  }
}
