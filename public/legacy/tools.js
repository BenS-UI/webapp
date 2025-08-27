/* tools.js — per-tool behavior, attached to global BucketTools */

(() => {
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  function IX(f, x, y) { return f.IX(x, y); }
  function PX2G(f) { return (f.N / Math.max(f.W, f.H)); }

  // ------- Tools -------
  function addBlender(B, dt) {
    const { fluid: f, params: p, state: s } = B;
    if (!s.holding || s.tool !== 'blender') return;
    const radiusPx = p.size * B.DPR;
    const [cx, cy] = f.gridFromPx(s.x, s.y);
    const rG = clamp(radiusPx * PX2G(f), 2, f.N), r2 = rG * rG;
    for (let j = 1; j <= f.N; j++) for (let i = 1; i <= f.N; i++) {
      const dx = i - cx, dy = j - cy, d2 = dx * dx + dy * dy; if (d2 > r2) continue;
      const dist = Math.sqrt(d2) + 1e-6, tx = (-dy / dist) * s.spinSign, ty = (dx / dist) * s.spinSign, w = 1 - d2 / r2;
      const force = dt * p.speed * p.strength * w;
      f.u0[IX(f, i, j)] += tx * force; f.v0[IX(f, i, j)] += ty * force;
    }
  }

  function addBucket(B, dt) {
    const { fluid: f, params: p, state: s, colors } = B;
    if (!s.holding || s.tool !== 'bucket') return;
    const radiusPx = p.size * B.DPR; const [cx, cy] = f.gridFromPx(s.x, s.y);
    const rG = clamp(radiusPx * PX2G(f), 2, f.N), r2 = rG * rG;
    const [rC, gC, bC] = colors.pour; const rate = clamp(60 * dt, 0.1, 2);
    for (let j = 1; j <= f.N; j++) for (let i = 1; i <= f.N; i++) {
      const dx = i - cx, dy = j - cy, d2 = dx * dx + dy * dy; if (d2 > r2) continue;
      const w = Math.max(0, 1 - d2 / r2), a = w * rate, id = IX(f, i, j);
      f.dR[id] += (rC - f.dR[id]) * a; f.dG[id] += (gC - f.dG[id]) * a; f.dB[id] += (bC - f.dB[id]) * a;
    }
  }

  function addSmudge(B, dt) {
    const { fluid: f, params: p, state: s } = B;
    if (!s.holding || s.tool !== 'smudge' || Number.isNaN(s.px)) return;
    const [cx, cy] = f.gridFromPx(s.x, s.y); const [pxg, pyg] = f.gridFromPx(s.px, s.py);
    const mvx = cx - pxg, mvy = cy - pyg, len = Math.hypot(mvx, mvy) + 1e-6, sx = mvx / len, sy = mvy / len;
    const radiusPx = p.size * B.DPR, rG = clamp(radiusPx * PX2G(f), 2, f.N), r2 = rG * rG;
    const pull = p.strength * 0.6 * (1 + p.speed * 0.2);
    for (let j = 1; j <= f.N; j++) for (let i = 1; i <= f.N; i++) {
      const dx = i - cx, dy = j - cy, d2 = dx * dx + dy * dy; if (d2 > r2) continue;
      const w = 1 - d2 / r2, srcX = clamp((i - sx * 3) | 0, 1, f.N), srcY = clamp((j - sy * 3) | 0, 1, f.N);
      const id = IX(f, i, j), sid = IX(f, srcX, srcY), a = w * pull * dt;
      f.dR[id] += (f.dR[sid] - f.dR[id]) * a;
      f.dG[id] += (f.dG[sid] - f.dG[id]) * a;
      f.dB[id] += (f.dB[sid] - f.dB[id]) * a;
    }
  }

  let splatterCarry = 0;
  function addSplatter(B, dt) {
    const { fluid: f, params: p, state: s, colors } = B;
    if (!s.holding || s.tool !== 'splatter') return;
    const [cx, cy] = f.gridFromPx(s.x, s.y);
    const [rC, gC, bC] = colors.pour;
    let rate = 25 * (0.5 + p.speed * 0.5) * dt + splatterCarry;
    let drops = Math.floor(rate); splatterCarry = rate - drops;
    while (drops-- > 0) {
      const ang = Math.random() * Math.PI * 2, rad = Math.random() * (p.size * B.DPR);
      const gx = clamp((cx + (rad * Math.cos(ang)) * PX2G(f)) | 0, 2, f.N - 1);
      const gy = clamp((cy + (rad * Math.sin(ang)) * PX2G(f)) | 0, 2, f.N - 1);
      const dropR = (0.2 + Math.random() * 0.8) * (p.size * B.DPR * PX2G(f));
      const rG = clamp(dropR, 1.2, f.N / 6), r2 = rG * rG;
      for (let j = (gy - rG) | 0; j <= (gy + rG) | 0; j++) { if (j < 1 || j > f.N) continue;
        for (let i = (gx - rG) | 0; i <= (gx + rG) | 0; i++) { if (i < 1 || i > f.N) continue;
          const dx = i - gx, dy = j - gy, d2 = dx * dx + dy * dy; if (d2 > r2) continue;
          const w = 1 - d2 / r2, id = IX(f, i, j);
          f.dR[id] += (rC - f.dR[id]) * w; f.dG[id] += (gC - f.dG[id]) * w; f.dB[id] += (bC - f.dB[id]) * w;
        }
      }
      const spin = p.speed * .35 * p.strength * s.spinSign;
      if (Math.abs(spin) > 0.01) {
        for (let j = (gy - rG) | 0; j <= (gy + rG) | 0; j++) { if (j < 1 || j > f.N) continue;
          for (let i = (gx - rG) | 0; i <= (gx + rG) | 0; i++) { if (i < 1 || i > f.N) continue;
            const dx = i - gx, dy = j - gy, d2 = dx * dx + dy * dy; if (d2 > r2 || d2 === 0) continue;
            const dist = Math.sqrt(d2), tx = -dy / dist, ty = dx / dist, w = 1 - d2 / r2, force = dt * spin * w;
            f.u0[IX(f, i, j)] += tx * force; f.v0[IX(f, i, j)] += ty * force;
          }
        }
      }
    }
  }

  let sprayCarry = 0;
  function addSpray(B, dt) {
    const { fluid: f, params: p, state: s, colors } = B;
    if (!s.holding || s.tool !== 'spray') return;
    const rate = 220 * dt * (0.5 + p.strength / 60); let count = Math.floor(rate + sprayCarry);
    sprayCarry = rate + sprayCarry - count; const radPx = (p.size * 0.6) * B.DPR; const [rC, gC, bC] = colors.pour;
    while (count-- > 0) {
      const ang = Math.random() * Math.PI * 2, rad = (Math.random() ** 0.5) * radPx;
      const [gx, gy] = f.gridFromPx(s.x + Math.cos(ang) * rad, s.y + Math.sin(ang) * rad);
      const id = IX(f, gx | 0, gy | 0);
      f.dR[id] += (rC - f.dR[id]) * 0.9; f.dG[id] += (gC - f.dG[id]) * 0.9; f.dB[id] += (bC - f.dB[id]) * 0.9;
    }
  }

  let glitterCarry = 0;
  function addGlitter(B, dt) {
    const { fluid: f, params: p, state: s, colors } = B;
    if (!s.holding || s.tool !== 'glitter') return;
    const baseRate = 160 * dt; let count = Math.floor(baseRate + glitterCarry);
    glitterCarry = baseRate + glitterCarry - count; const radPx = (p.size * 0.5) * B.DPR; const [rC, gC, bC] = colors.pour;
    while (count-- > 0) {
      const ang = Math.random() * Math.PI * 2, rad = (Math.random() ** 0.3) * radPx;
      const [gx, gy] = f.gridFromPx(s.x + Math.cos(ang) * rad, s.y + Math.sin(ang) * rad);
      const id = IX(f, gx | 0, gy | 0); const sparkle = Math.random() < 0.25; const br = sparkle ? 1.0 : 0.6 + Math.random() * 0.4;
      const R = Math.min(255, rC * br + (sparkle ? 60 : 0));
      const G = Math.min(255, gC * br + (sparkle ? 60 : 0));
      const Bv = Math.min(255, bC * br + (sparkle ? 60 : 0));
      f.dR[id] += (R - f.dR[id]) * 0.9; f.dG[id] += (G - f.dG[id]) * 0.9; f.dB[id] += (Bv - f.dB[id]) * 0.9;
    }
  }

  function addPush(B, dt) {
    const { fluid: f, params: p, state: s } = B;
    if (!s.holding || s.tool !== 'push' || Number.isNaN(s.px)) return;
    const [cx, cy] = f.gridFromPx(s.x, s.y); const [pxg, pyg] = f.gridFromPx(s.px, s.py);
    const vx = cx - pxg, vy = cy - pyg, len = Math.hypot(vx, vy) + 1e-6, dx = vx / len, dy = vy / len;
    const rG = clamp(p.size * B.DPR * PX2G(f), 2, f.N), r2 = rG * rG;
    const force = p.strength * dt * (0.6 + p.speed * 0.4);
    for (let j = 1; j <= f.N; j++) for (let i = 1; i <= f.N; i++) {
      const rx = i - cx, ry = j - cy, d2 = rx * rx + ry * ry; if (d2 > r2) continue;
      const w = 1 - d2 / r2, f0 = force * w;
      f.u0[IX(f, i, j)] += dx * f0; f.v0[IX(f, i, j)] += dy * f0;
    }
  }

  function addPinch(B, dt) {
    const { fluid: f, params: p, state: s } = B;
    if (!s.holding || s.tool !== 'pinch') return;
    const [cx, cy] = f.gridFromPx(s.x, s.y);
    const rG = clamp(p.size * B.DPR * PX2G(f), 2, f.N), r2 = rG * rG, sign = (s.button === 0 ? -1 : 1);
    const force = p.strength * dt * (0.8 + p.speed * 0.2);
    for (let j = 1; j <= f.N; j++) for (let i = 1; i <= f.N; i++) {
      const rx = i - cx, ry = j - cy, d2 = rx * rx + ry * ry; if (d2 > r2 || d2 === 0) continue;
      const dist = Math.sqrt(d2), nx = rx / dist, ny = ry / dist, w = 1 - d2 / r2, f0 = force * w * sign;
      f.u0[IX(f, i, j)] += nx * f0; f.v0[IX(f, i, j)] += ny * f0;
    }
  }

  function addRipple(B, dt) {
    const { fluid: f, params: p, state: s } = B;
    if (!s.holding || s.tool !== 'ripple') return;
    const [cx, cy] = f.gridFromPx(s.x, s.y);
    const rG = clamp(p.size * B.DPR * PX2G(f), 3, f.N / 2);
    const k = (Math.PI * 2) / (rG / 3), w = 6 * p.speed, amp = p.strength * 0.08;
    for (let j = 1; j <= f.N; j++) for (let i = 1; i <= f.N; i++) {
      const rx = i - cx, ry = j - cy, d = Math.hypot(rx, ry); if (d > rG || d === 0) continue;
      const sgn = Math.sin(k * d - w * B.state.timeSec), a = amp * (1 - (d * d) / (rG * rG)), nx = rx / d, ny = ry / d;
      const f0 = sgn * a * dt * 60;
      f.u0[IX(f, i, j)] += nx * f0; f.v0[IX(f, i, j)] += ny * f0;
    }
  }

  // ------- Apply current tool(s) each frame -------
  function apply(B, dt) {
    // Spin direction via right-click is already handled in app.js by state.spinSign
    addBlender(B, dt);
    addBucket(B, dt);
    addSmudge(B, dt);
    addSplatter(B, dt);
    addSpray(B, dt);
    addGlitter(B, dt);
    addPush(B, dt);
    addPinch(B, dt);
    addRipple(B, dt);
  }

  // expose
  window.BucketTools = { apply };
})();
