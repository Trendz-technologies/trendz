"use client";

/**
 * Audible scan feedback: one short high tone on success, two low tones on an
 * error. Cashiers usually look at the product, not the screen, while scanning.
 */
let ctx: AudioContext | null = null;

function tone(freq: number, startAt: number, duration: number) {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "square";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.06, ctx.currentTime + startAt);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + startAt + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(ctx.currentTime + startAt);
  osc.stop(ctx.currentTime + startAt + duration);
}

export function beep(kind: "ok" | "error") {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    if (kind === "ok") tone(1800, 0, 0.08);
    else {
      tone(320, 0, 0.12);
      tone(260, 0.16, 0.16);
    }
  } catch {
    // Audio is a nicety; never break billing over it.
  }
}
