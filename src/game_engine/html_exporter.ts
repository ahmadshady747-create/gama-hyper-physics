import { GamaGameSpec } from '../ai_engine';

/**
 * Exports any GamaGameSpec into a single, self-contained, playable HTML5 game file
 * with built-in 2D physics, drag-to-launch controls, neon Canvas visuals,
 * screen shake, particles, procedural Web Audio SFX, and Victory/Restart HUD.
 */
export function exportPlayableHtml(spec: GamaGameSpec): string {
  const safeSpecJson = JSON.stringify(spec).replace(/</g, '\\u003c');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${spec.title} — Powered by GAMA v4.0</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #060911; color: #f8fafc; font-family: system-ui, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; gap: 12px; padding: 12px; }
    .hud { width: 100%; max-width: ${spec.width}px; display: flex; justify-content: space-between; align-items: center; background: #0f1624; border: 1px solid #21304a; border-radius: 14px; padding: 10px 16px; }
    .title { font-weight: 800; color: #00e5c4; font-size: 16px; }
    .stats { display: flex; gap: 16px; font-weight: 700; font-size: 14px; }
    button { background: #00e5c4; color: #04221d; border: none; border-radius: 10px; padding: 7px 14px; font-weight: 800; cursor: pointer; }
    canvas { width: 100%; max-width: ${spec.width}px; height: auto; background: #090e1a; border: 1.5px solid #21304a; border-radius: 16px; touch-action: none; cursor: crosshair; }
    .hint { color: #94a3b8; font-size: 13px; }
  </style>
</head>
<body>
  <div class="hud">
    <div class="title">${spec.title}</div>
    <div class="stats">
      <span id="score">Score: 0</span>
      <span id="status">PLAYING</span>
    </div>
    <button onclick="resetGame()">Restart</button>
  </div>
  <canvas id="c" width="${spec.width}" height="${spec.height}"></canvas>
  <div class="hint">Drag from the cyan hero/projectile and release to launch! Powered by GAMA AI Game Engine v4.0</div>
  <script>
    const SPEC = ${safeSpecJson};
    const canvas = document.getElementById('c');
    const ctx = canvas.getContext('2d');
    let bodies = [], particles = [], shake = 0, score = 0, dragStart = null, dragCurr = null;
    const audioCtx = typeof AudioContext !== 'undefined' ? new AudioContext() : null;

    function beep(freq, dur) {
      if (!audioCtx) return;
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.connect(g); g.connect(audioCtx.destination);
      o.frequency.setValueAtTime(freq, audioCtx.currentTime);
      o.frequency.exponentialRampToValueAtTime(freq * 0.4, audioCtx.currentTime + dur);
      g.gain.setValueAtTime(0.18, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
      o.start(); o.stop(audioCtx.currentTime + dur);
    }

    function resetGame() {
      score = 0; shake = 0; particles = [];
      bodies = SPEC.entities.map(e => ({
        ...e, vx: e.vx || 0, vy: e.vy || 0, radius: e.radius || 20, width: e.width || 40, height: e.height || 40,
        mass: e.mass || 1, restitution: e.restitution ?? 0.45, ix: e.x, iy: e.y, alive: true
      }));
      document.getElementById('score').textContent = 'Score: 0';
      document.getElementById('status').textContent = 'PLAYING';
    }

    function spawnSparks(x, y, color) {
      for (let i = 0; i < 12; i++) {
        const a = Math.random() * Math.PI * 2, sp = 60 + Math.random() * 180;
        particles.push({ x, y, vx: Math.cos(a)*sp, vy: Math.sin(a)*sp, life: 0.5, color });
      }
    }

    function step(dt) {
      const gY = SPEC.gravityY ?? 980;
      for (const b of bodies) {
        if (b.isStatic) continue;
        b.vy += gY * dt;
        b.x += b.vx * dt; b.y += b.vy * dt;
        b.vx *= 0.996; b.vy *= 0.996;
        const r = b.shape === 'circle' ? b.radius : Math.max(b.width, b.height) * 0.5;
        if (b.x - r < 0) { b.x = r; b.vx = Math.abs(b.vx) * b.restitution; }
        if (b.x + r > SPEC.width) { b.x = SPEC.width - r; b.vx = -Math.abs(b.vx) * b.restitution; }
        if (b.y + r > SPEC.height - 20) { b.y = SPEC.height - 20 - r; b.vy = -Math.abs(b.vy) * b.restitution; b.vx *= 0.92; }
        if (b.y - r < 0) { b.y = r; b.vy = Math.abs(b.vy) * b.restitution; }
      }
      for (let i = 0; i < bodies.length; i++) {
        for (let j = i + 1; j < bodies.length; j++) {
          const a = bodies[i], b = bodies[j];
          if (a.isStatic && b.isStatic) continue;
          const ra = a.shape === 'circle' ? a.radius : (a.width + a.height) * 0.25;
          const rb = b.shape === 'circle' ? b.radius : (b.width + b.height) * 0.25;
          const dx = b.x - a.x, dy = b.y - a.y, dist = Math.hypot(dx, dy) || 0.001;
          if (dist < ra + rb) {
            const nx = dx / dist, ny = dy / dist, pen = (ra + rb - dist);
            if (!a.isStatic) { a.x -= nx * pen * 0.5; a.y -= ny * pen * 0.5; }
            if (!b.isStatic) { b.x += nx * pen * 0.5; b.y += ny * pen * 0.5; }
            const rvx = b.vx - a.vx, rvy = b.vy - a.vy, vn = rvx * nx + rvy * ny;
            if (vn < 0) {
              const imp = -(1 + Math.min(a.restitution, b.restitution)) * vn / ((a.isStatic ? 0 : 1/a.mass) + (b.isStatic ? 0 : 1/b.mass));
              if (!a.isStatic) { a.vx -= (imp / a.mass) * nx; a.vy -= (imp / a.mass) * ny; }
              if (!b.isStatic) { b.vx += (imp / b.mass) * nx; b.vy += (imp / b.mass) * ny; }
              if (Math.abs(vn) > 120) { shake = Math.min(14, shake + 6); spawnSparks((a.x+b.x)/2, (a.y+b.y)/2, b.color || '#00e5c4'); beep(280, 0.12); }
            }
          }
        }
      }
      let remaining = 0;
      for (const b of bodies) {
        if (b.role !== 'target') continue;
        if (b.alive && Math.hypot(b.x - b.ix, b.y - b.iy) > 70) {
          b.alive = false; score += 100;
          document.getElementById('score').textContent = 'Score: ' + score;
          spawnSparks(b.x, b.y, '#22c55e'); beep(740, 0.18);
        }
        if (b.alive) remaining++;
      }
      if (remaining === 0 && bodies.some(b => b.role === 'target')) {
        document.getElementById('status').textContent = 'VICTORY!';
      }
      shake *= 0.88;
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
        if (p.life <= 0) particles.splice(i, 1);
      }
    }

    function draw() {
      ctx.save();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (shake > 0.3) ctx.translate((Math.random()-0.5)*shake, (Math.random()-0.5)*shake);
      for (const b of bodies) {
        ctx.fillStyle = b.alive ? (b.color || '#00e5c4') : '#475569';
        ctx.globalAlpha = b.alive ? 0.95 : 0.35;
        if (b.shape === 'circle') { ctx.beginPath(); ctx.arc(b.x, b.y, b.radius, 0, Math.PI*2); ctx.fill(); }
        else { ctx.fillRect(b.x - b.width/2, b.y - b.height/2, b.width, b.height); }
      }
      ctx.globalAlpha = 1;
      for (const p of particles) { ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, 4, 4); }
      if (dragStart && dragCurr) {
        ctx.strokeStyle = '#f5c451'; ctx.lineWidth = 3; ctx.beginPath();
        ctx.moveTo(dragStart.x, dragStart.y); ctx.lineTo(dragCurr.x, dragCurr.y); ctx.stroke();
      }
      ctx.restore();
    }

    function getPt(e) {
      const rect = canvas.getBoundingClientRect();
      return { x: (e.clientX - rect.left) * (canvas.width / rect.width), y: (e.clientY - rect.top) * (canvas.height / rect.height) };
    }
    canvas.addEventListener('pointerdown', e => { dragStart = getPt(e); dragCurr = dragStart; });
    canvas.addEventListener('pointermove', e => { if (dragStart) dragCurr = getPt(e); });
    canvas.addEventListener('pointerup', () => {
      if (dragStart && dragCurr) {
        const hero = bodies.find(b => b.role === 'projectile' || b.role === 'player');
        if (hero) { hero.vx = (dragStart.x - dragCurr.x) * 4.5; hero.vy = (dragStart.y - dragCurr.y) * 4.5; beep(420, 0.14); }
      }
      dragStart = null; dragCurr = null;
    });

    resetGame();
    let last = performance.now();
    (function loop(now) {
      const dt = Math.min(0.033, (now - last) / 1000); last = now;
      step(dt); draw(); requestAnimationFrame(loop);
    })(last);
  </script>
</body>
</html>`;
}
