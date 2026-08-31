// Confetti + sound effects for successful bid/outbid.
//
// Lightweight, no deps. The confetti renders to its own <canvas> overlay
// positioned fixed at z-index above the bid modal. The sound is a short
// Web Audio chord (success) or single low note (outbid loss).
//
// Both effects are no-ops if the browser is missing AudioContext or the
// page is hidden — we never throw.

let _audio: AudioContext | null = null;
function ctx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (_audio) return _audio;
  const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!AC) return null;
  try {
    _audio = new AC();
  } catch {
    _audio = null;
  }
  return _audio;
}

/** Play a small success chord (root + fifth + octave) on a sine/triangle mix. */
export function playSuccess(): void {
  const ac = ctx();
  if (!ac) return;
  const now = ac.currentTime;
  const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
  notes.forEach((freq, i) => {
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = i === 0 ? 'triangle' : 'sine';
    o.frequency.value = freq;
    g.gain.value = 0;
    g.gain.linearRampToValueAtTime(0.18, now + 0.02 + i * 0.04);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.5 + i * 0.05);
    o.connect(g).connect(ac.destination);
    o.start(now + i * 0.04);
    o.stop(now + 0.7);
  });
}

/** Play a single low "you lost it" note on a sawtooth. */
export function playDefeat(): void {
  const ac = ctx();
  if (!ac) return;
  const now = ac.currentTime;
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(220, now);
  o.frequency.exponentialRampToValueAtTime(110, now + 0.4);
  g.gain.value = 0;
  g.gain.linearRampToValueAtTime(0.12, now + 0.02);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
  o.connect(g).connect(ac.destination);
  o.start(now);
  o.stop(now + 0.55);
}

// ---------------------------------------------------------------------------
// Confetti — particle system on a single full-screen <canvas>.
// ---------------------------------------------------------------------------

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  rot: number; vr: number;
  size: number;
  color: string;
  life: number; // 0..1
}

const COLORS = ['#3B82F6', '#FBBF24', '#10B981', '#EF4444', '#F97316', '#8B5CF6'];

let _canvas: HTMLCanvasElement | null = null;
let _particles: Particle[] = [];
let _raf = 0;

function ensureCanvas(): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  if (_canvas && _canvas.isConnected) return _canvas;
  const c = document.createElement('canvas');
  c.id = 'confetti-canvas';
  c.style.cssText =
    'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:300;';
  const dpr = window.devicePixelRatio || 1;
  c.width = Math.floor(window.innerWidth * dpr);
  c.height = Math.floor(window.innerHeight * dpr);
  document.body.appendChild(c);
  _canvas = c;
  return c;
}

function tick(): void {
  const c = _canvas;
  if (!c) return;
  const ctx2d = c.getContext('2d');
  if (!ctx2d) return;
  const dpr = window.devicePixelRatio || 1;
  ctx2d.clearRect(0, 0, c.width, c.height);
  ctx2d.save();
  ctx2d.scale(dpr, dpr);
  for (let i = _particles.length - 1; i >= 0; i--) {
    const p = _particles[i];
    p.vy += 0.18; // gravity
    p.x += p.vx;
    p.y += p.vy;
    p.rot += p.vr;
    p.life -= 0.012;
    if (p.life <= 0 || p.y > window.innerHeight + 40) {
      _particles.splice(i, 1);
      continue;
    }
    ctx2d.save();
    ctx2d.translate(p.x, p.y);
    ctx2d.rotate(p.rot);
    ctx2d.globalAlpha = Math.max(0, Math.min(1, p.life * 1.4));
    ctx2d.fillStyle = p.color;
    ctx2d.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.5);
    ctx2d.restore();
  }
  ctx2d.restore();
  if (_particles.length === 0) {
    cancelAnimationFrame(_raf);
    _raf = 0;
    if (_canvas && _canvas.parentNode) _canvas.parentNode.removeChild(_canvas);
    _canvas = null;
    return;
  }
  _raf = requestAnimationFrame(tick);
}

/** Burst confetti from the screen center (default) or a specific element. */
export function burstConfetti(origin?: { x: number; y: number }, count = 120): void {
  if (typeof document === 'undefined') return;
  const c = ensureCanvas();
  if (!c) return;
  const cx = origin?.x ?? window.innerWidth / 2;
  const cy = origin?.y ?? window.innerHeight / 2;
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 4 + Math.random() * 8;
    _particles.push({
      x: cx,
      y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 6,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.3,
      size: 6 + Math.random() * 8,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      life: 1,
    });
  }
  if (!_raf) _raf = requestAnimationFrame(tick);
}
