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

  /**
   * Iconic 2.0-Second Web Startup Chime (Procedural Audio Synthesis)
   * High-end cinematic audio signature:
   * 1. Warm Sub-Bass Cinematic Swell (55Hz -> 42Hz)
   * 2. D-Major 9th Resonant Chord with Low-pass Filter Sweep
   * 3. Triple Crystalline Bell Chimes (F#6, C#7, F#7)
   * 4. Ethereal Reverb-Tail Dissolve
   */
  playIconicStartup() {
    this.setEnabled(true);
    try {
      this.ensureContext();
      if (!this.ctx) return;
      const ctx = this.ctx;

      if (ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }

      const now = ctx.currentTime + 0.04;
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.85, now);
      master.connect(ctx.destination);

      // 1. Deep Sub-Bass Cinematic Impact (55Hz -> 42Hz)
      const subOsc = ctx.createOscillator();
      const subGain = ctx.createGain();
      subOsc.type = "sine";
      subOsc.frequency.setValueAtTime(55, now);
      subOsc.frequency.exponentialRampToValueAtTime(42, now + 1.8);

      subGain.gain.setValueAtTime(0.0001, now);
      subGain.gain.linearRampToValueAtTime(0.24, now + 0.18);
      subGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.95);

      subOsc.connect(subGain);
      subGain.connect(master);
      subOsc.start(now);
      subOsc.stop(now + 2.0);

      // 2. Resonant Filtered Major-9th Swell (D3, A3, F#4, C#5, E5, A5)
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.Q.value = 2.4;
      filter.frequency.setValueAtTime(240, now);
      filter.frequency.exponentialRampToValueAtTime(5800, now + 0.45);
      filter.frequency.exponentialRampToValueAtTime(1200, now + 1.9);
      filter.connect(master);

      const chord = [
        { f: 146.83, type: "triangle", gain: 0.13 }, // D3
        { f: 220.00, type: "sine",     gain: 0.11 }, // A3
        { f: 369.99, type: "triangle", gain: 0.10 }, // F#4
        { f: 554.37, type: "sine",     gain: 0.09 }, // C#5
        { f: 659.25, type: "sine",     gain: 0.08 }, // E5
        { f: 880.00, type: "sine",     gain: 0.06 }, // A5
      ];

      chord.forEach(({ f, type, gain }) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(f, now);
        g.gain.setValueAtTime(0.0001, now);
        g.gain.linearRampToValueAtTime(gain, now + 0.18);
        g.gain.exponentialRampToValueAtTime(0.00001, now + 1.95);
        osc.connect(g);
        g.connect(filter);
        osc.start(now);
        osc.stop(now + 2.0);
      });

      // 3. Iconic Triple Crystal Bell Chimes
      const bells = [
        { time: now + 0.22, freq: 1479.98, dur: 1.4, vol: 0.09 }, // F#6
        { time: now + 0.42, freq: 2217.46, dur: 1.5, vol: 0.08 }, // C#7
        { time: now + 0.58, freq: 2959.96, dur: 1.4, vol: 0.07 }, // F#7
      ];

      bells.forEach(({ time, freq, dur, vol }) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, time);
        g.gain.setValueAtTime(0.0001, time);
        g.gain.linearRampToValueAtTime(vol, time + 0.012);
        g.gain.exponentialRampToValueAtTime(0.00001, time + dur);
        osc.connect(g);
        g.connect(master);
        osc.start(time);
        osc.stop(time + dur);
      });
    } catch (err) {
      console.debug("Iconic startup audio synthesis skipped:", err);
    }
  }
}

export const sound = new SoundSystem();
