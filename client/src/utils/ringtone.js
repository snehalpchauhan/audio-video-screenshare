// ─── Ring tone using Web Audio API ──────────────────────────
// Single shared AudioContext (avoids the creation latency).
// Auto-primed on first user interaction so it's ready instantly.

let _ctx    = null;
let _timer  = null;

// Get or create the shared AudioContext
const getCtx = () => {
  if (!_ctx) {
    try {
      _ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch {}
  }
  return _ctx;
};

// Auto-prime on first user gesture (click / keydown / touch)
// so the AudioContext is already running when a call arrives.
if (typeof document !== "undefined") {
  const prime = () => {
    const ctx = getCtx();
    if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {});
    document.removeEventListener("click",      prime, true);
    document.removeEventListener("keydown",    prime, true);
    document.removeEventListener("touchstart", prime, true);
  };
  document.addEventListener("click",      prime, true);
  document.addEventListener("keydown",    prime, true);
  document.addEventListener("touchstart", prime, true);
}

async function playBell() {
  try {
    const ctx = getCtx();
    if (!ctx) return;
    if (ctx.state === "suspended") await ctx.resume();
    const now = ctx.currentTime;

    // Two-tone ring: 480 Hz then 620 Hz
    [[480, now], [620, now + 0.25]].forEach(([freq, start]) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.4, start + 0.02);
      gain.gain.setValueAtTime(0.4, start + 0.2);
      gain.gain.linearRampToValueAtTime(0, start + 0.24);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.25);
    });
  } catch {}
}

/** Start repeating ring tone. No-op if already ringing. */
export function startRingtone() {
  if (_timer) return;
  playBell();
  _timer = setInterval(playBell, 2200);
}

/** Stop the ring tone. */
export function stopRingtone() {
  if (_timer) {
    clearInterval(_timer);
    _timer = null;
  }
}
