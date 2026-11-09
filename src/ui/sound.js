/**
 * A short alert sound made with the Web Audio API (no audio files). Browsers only allow sound
 * after the page has been clicked or tapped once, so `unlockAudio` runs on the first interaction.
 */
let ctx = null;

function context() {
  if (!ctx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    ctx = new AudioCtx();
  }
  return ctx;
}

export function unlockAudio() {
  const c = context();
  if (c && c.state === 'suspended') c.resume().catch(() => {});
}

/** Two quick high tones, repeated twice: noticeable over a busy dining room. */
export function playAlarm() {
  const c = context();
  if (!c || c.state !== 'running') return false;
  const start = c.currentTime + 0.02;
  [0, 0.18, 0.5, 0.68].forEach((offset, i) => {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'square';
    osc.frequency.value = i % 2 ? 660 : 880;
    gain.gain.setValueAtTime(0.0001, start + offset);
    gain.gain.exponentialRampToValueAtTime(0.25, start + offset + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.15);
    osc.connect(gain).connect(c.destination);
    osc.start(start + offset);
    osc.stop(start + offset + 0.16);
  });
  return true;
}
