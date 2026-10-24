// A short steam-whistle synthesized with Web Audio, so no audio asset ships.
// Two detuned tones with a pitch swoop plus breathy band-passed noise.

let ctx: AudioContext | null = null;
let lastPlayed = 0;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function playWhistle(duration = 1.1) {
  const now = Date.now();
  if (now - lastPlayed < 1500) return; // several boilers crossing at once = one whistle
  lastPlayed = now;

  const ac = audio();
  if (!ac) return;
  const t0 = ac.currentTime + 0.02;
  const end = t0 + duration;

  const master = ac.createGain();
  master.gain.setValueAtTime(0, t0);
  master.gain.linearRampToValueAtTime(0.13, t0 + 0.08);
  master.gain.setValueAtTime(0.13, end - 0.25);
  master.gain.exponentialRampToValueAtTime(0.0001, end);
  master.connect(ac.destination);

  for (const [freq, level] of [
    [740, 0.6],
    [1108, 0.35],
    [1480, 0.12],
  ] as const) {
    const osc = ac.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq * 0.86, t0);
    osc.frequency.exponentialRampToValueAtTime(freq, t0 + 0.12);
    const vib = ac.createOscillator();
    const vibGain = ac.createGain();
    vib.frequency.value = 6;
    vibGain.gain.value = freq * 0.006;
    vib.connect(vibGain).connect(osc.frequency);
    const g = ac.createGain();
    g.gain.value = level;
    osc.connect(g).connect(master);
    osc.start(t0);
    vib.start(t0);
    osc.stop(end);
    vib.stop(end);
  }

  const noise = ac.createBuffer(1, Math.ceil(ac.sampleRate * duration), ac.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource();
  src.buffer = noise;
  const band = ac.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = 2400;
  band.Q.value = 0.9;
  const ng = ac.createGain();
  ng.gain.value = 0.18;
  src.connect(band).connect(ng).connect(master);
  src.start(t0);
  src.stop(end);
}

/** Call from a click handler so later whistles are allowed to play. */
export function unlockAudio() {
  audio();
}
