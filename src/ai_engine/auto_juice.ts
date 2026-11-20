export type JuicePreset =
  | 'light_hit'
  | 'heavy_hit'
  | 'explosion'
  | 'reward'
  | 'level_up'
  | 'fail';

export interface FloatingText {
  text: string;
  x: number;
  y: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
}

/**
 * Zero-asset Web Audio procedural sound synthesizer.
 * Automatically operates as a safe no-op in headless Node/test environments.
 */
export class ProceduralAudio {
  private ctx: AudioContext | null = null;
  public enabled = true;
  public volume = 0.45;

  private ensureContext(): AudioContext | null {
    if (!this.enabled || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (AudioCtor) {
        this.ctx = new AudioCtor();
      }
    }
    return this.ctx;
  }

  public playPreset(preset: JuicePreset): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    switch (preset) {
      case 'light_hit':
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(340, now);
        osc.frequency.exponentialRampToValueAtTime(120, now + 0.08);
        gain.gain.setValueAtTime(this.volume * 0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        osc.start(now);
        osc.stop(now + 0.09);
        break;
      case 'heavy_hit':
      case 'explosion':
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.exponentialRampToValueAtTime(42, now + 0.22);
        gain.gain.setValueAtTime(this.volume * 0.8, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        osc.start(now);
        osc.stop(now + 0.23);
        break;
      case 'reward':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(660, now);
        osc.frequency.setValueAtTime(990, now + 0.07);
        gain.gain.setValueAtTime(this.volume * 0.55, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.21);
        break;
      case 'level_up':
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523, now);
        osc.frequency.setValueAtTime(659, now + 0.08);
        osc.frequency.setValueAtTime(1046, now + 0.16);
        gain.gain.setValueAtTime(this.volume * 0.65, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.34);
        osc.start(now);
        osc.stop(now + 0.35);
        break;
      case 'fail':
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(280, now);
        osc.frequency.linearRampToValueAtTime(95, now + 0.32);
        gain.gain.setValueAtTime(this.volume * 0.6, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
        osc.start(now);
        osc.stop(now + 0.33);
        break;
    }
  }
}

/**
 * Built-in Auto-Juice Controller: gives any AI-generated game instant
 * screen shake, hitstop freeze-frames, flash feedback, floating text, and audio.
 */
export class AutoJuiceController {
  public shakeIntensity = 0;
  public shakeOffsetX = 0;
  public shakeOffsetY = 0;
  public hitstopRemaining = 0;
  public flashAlpha = 0;
  public flashColor = '#00e5c4';
  public floatingTexts: FloatingText[] = [];
  public audio = new ProceduralAudio();

  public trigger(
    preset: JuicePreset,
    x?: number,
    y?: number,
    label?: string
  ): void {
    this.audio.playPreset(preset);

    switch (preset) {
      case 'light_hit':
        this.shakeIntensity = Math.max(this.shakeIntensity, 4);
        break;
      case 'heavy_hit':
        this.shakeIntensity = Math.max(this.shakeIntensity, 11);
        this.hitstopRemaining = Math.max(this.hitstopRemaining, 0.04);
        this.flashColor = '#f5c451';
        this.flashAlpha = 0.18;
        break;
      case 'explosion':
        this.shakeIntensity = Math.max(this.shakeIntensity, 18);
        this.hitstopRemaining = Math.max(this.hitstopRemaining, 0.06);
        this.flashColor = '#f43f5e';
        this.flashAlpha = 0.28;
        break;
      case 'reward':
        this.flashColor = '#22c55e';
        this.flashAlpha = 0.14;
        break;
      case 'level_up':
        this.shakeIntensity = Math.max(this.shakeIntensity, 6);
        this.flashColor = '#00e5c4';
        this.flashAlpha = 0.22;
        break;
      case 'fail':
        this.shakeIntensity = Math.max(this.shakeIntensity, 14);
        this.flashColor = '#f43f5e';
        this.flashAlpha = 0.3;
        break;
    }

    if (label && x !== undefined && y !== undefined) {
      this.floatingTexts.push({
        text: label,
        x,
        y,
        vy: -55,
        life: 0.9,
        maxLife: 0.9,
        color: this.flashColor,
      });
    }
  }

  /**
   * Advances juice timers. Returns true if physics should pause for hitstop.
   */
  public update(dt: number): boolean {
    if (this.hitstopRemaining > 0) {
      this.hitstopRemaining = Math.max(0, this.hitstopRemaining - dt);
      return true;
    }

    if (this.shakeIntensity > 0.1) {
      this.shakeOffsetX = (Math.random() * 2 - 1) * this.shakeIntensity;
      this.shakeOffsetY = (Math.random() * 2 - 1) * this.shakeIntensity;
      this.shakeIntensity *= Math.pow(0.001, dt);
    } else {
      this.shakeIntensity = 0;
      this.shakeOffsetX = 0;
      this.shakeOffsetY = 0;
    }

    if (this.flashAlpha > 0.005) {
      this.flashAlpha = Math.max(0, this.flashAlpha - dt * 1.4);
    } else {
      this.flashAlpha = 0;
    }

    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y += ft.vy * dt;
      ft.life -= dt;
      if (ft.life <= 0) {
        this.floatingTexts.splice(i, 1);
      }
    }

    return false;
  }
}
