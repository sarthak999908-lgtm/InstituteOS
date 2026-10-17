import { appStorageKey } from "./localDemo.js";

/**
 * Cosmic Aurora Procedural Sound FX (Web Audio API)
 * Off by default; toggleable in settings or topbar. Zero audio assets required.
 */

class SoundSystem {
  constructor() {
    this.ctx = null;
    this.enabled = false;
    try {
      this.enabled = localStorage.getItem(appStorageKey("instituteos_sound_enabled")) === "true";
    } catch {
      this.enabled = false;
    }
  }

  ensureContext() {
    if (!this.ctx && typeof window !== "undefined") {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
  }

  setEnabled(val) {
    this.enabled = Boolean(val);
    try {
      localStorage.setItem(appStorageKey("instituteos_sound_enabled"), String(this.enabled));
    } catch {}
  }

  isEnabled() {
    return this.enabled;
  }

  // Very subtle tactile click (5ms tick)
  tick(freq = 1200, duration = 0.025) {
    if (!this.enabled) return;
    try {
      this.ensureContext();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const now = this.ctx.currentTime;

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(300, now + duration);

      gain.gain.setValueAtTime(0.03, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + duration);
    } catch {}
  }

  // Soft high-frequency shimmer when focusing or opening
  shimmer() {
    if (!this.enabled) return;
    try {
      this.ensureContext();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      [800, 1200, 1600].forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, now + idx * 0.03);
        gain.gain.setValueAtTime(0.015, now + idx * 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.03 + 0.12);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + idx * 0.03);
        osc.stop(now + idx * 0.03 + 0.12);
      });
    } catch {}
  }

  // Celestial approval chime (layered major triad with slight delay)
  chime() {
    if (!this.enabled) return;
    try {
      this.ensureContext();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const start = now + idx * 0.06;
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.04, start);
        gain.gain.exponentialRampToValueAtTime(0.00001, start + 0.45);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(start);
        osc.stop(start + 0.45);
      });
    } catch {}
  }

  // Rejection / lock error tone
  error() {
    if (!this.enabled) return;
    try {
      this.ensureContext();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.setValueAtTime(180, now + 0.08);
      gain.gain.setValueAtTime(0.03, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.2);
    } catch {}
  }
}

export const sound = new SoundSystem();
