// Audio notification generator using Web Audio API for distinct, clear chime
let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  try {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  } catch (e) {
    console.warn('Web Audio API not supported:', e);
    return null;
  }
}

/**
 * Plays a clear, distinctive chime for new claim notifications:
 * Sequence of two harmonized bell tones: High crisp Ding-Dong (880 Hz -> 1174.66 Hz -> 1760 Hz)
 */
export function playNewClaimChime(volume: number = 0.8): boolean {
  try {
    const ctx = getAudioContext();
    if (!ctx) return false;

    const now = ctx.currentTime;

    // First tone (Alert strike - E6 / 1318.5 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(1046.5, now); // C6
    osc1.frequency.exponentialRampToValueAtTime(1318.5, now + 0.08); // E6

    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(volume * 0.9, now + 0.02);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);

    osc1.start(now);
    osc1.stop(now + 0.5);

    // Second tone (Resonant confirming chime - G6 / 1567.98 Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(1567.98, now + 0.12);

    gain2.gain.setValueAtTime(0, now + 0.12);
    gain2.gain.linearRampToValueAtTime(volume, now + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);

    osc2.start(now + 0.12);
    osc2.stop(now + 0.95);

    // Subtle third harmonic for rich alert presence
    const osc3 = ctx.createOscillator();
    const gain3 = ctx.createGain();
    osc3.type = 'sine';
    osc3.frequency.setValueAtTime(2093.0, now + 0.2); // C7

    gain3.gain.setValueAtTime(0, now + 0.2);
    gain3.gain.linearRampToValueAtTime(volume * 0.4, now + 0.24);
    gain3.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);

    osc3.connect(gain3);
    gain3.connect(ctx.destination);

    osc3.start(now + 0.2);
    osc3.stop(now + 0.85);

    return true;
  } catch (err) {
    console.error('Failed to play audio chime:', err);
    return false;
  }
}
