// Count and Bounce physics. Shared by the page (site/bounce/index.html) and the
// level generator (tools/generate-bounce.js), so targets are calibrated on the
// exact same simulation the player sees.
(function (root) {
  const W = 400, H = 720, R = 6;
  const GRAVITY = 1100, DT = 1 / 120, DROP_EVERY = 0.07, MAX_BALLS = 700;
  const DISPENSER_Y = 70;

  function rng(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function createWorld(level) {
    return {
      level,
      t: 0,
      balls: [],
      nextId: 1,
      left: level.balls,
      dropTimer: 0,
      collected: 0,
      lost: 0,
      rand: rng(level.seed || 1),
      gates: level.gates.map((g, i) => ({ ...g, id: i, x0: g.x })),
      cup: { ...level.cup, x0: level.cup.x },
      pops: [],
    };
  }

  // Moving parts follow a sine wave so the simulation is deterministic.
  function movingX(base, range, speed, t) {
    return range ? base + Math.sin(t * speed) * range : base;
  }

  function spawn(world, x, y, vx, vy, used) {
    if (world.balls.length >= MAX_BALLS) return;
    world.balls.push({ id: world.nextId++, x, y, vx, vy, used: used ? used.slice() : [] });
  }

  function collideCircle(b, cx, cy, cr, bounce) {
    const dx = b.x - cx, dy = b.y - cy;
    const d2 = dx * dx + dy * dy, min = cr + R;
    if (d2 >= min * min || d2 === 0) return;
    const d = Math.sqrt(d2), nx = dx / d, ny = dy / d;
    b.x = cx + nx * min;
    b.y = cy + ny * min;
    const vn = b.vx * nx + b.vy * ny;
    if (vn < 0) {
      b.vx -= (1 + bounce) * vn * nx;
      b.vy -= (1 + bounce) * vn * ny;
    }
  }

  // Axis-aligned box collision; returns true if the ball touched it.
  function collideBox(b, x, y, w, h, bounce) {
    const px = Math.max(x, Math.min(b.x, x + w)), py = Math.max(y, Math.min(b.y, y + h));
    const dx = b.x - px, dy = b.y - py;
    const d2 = dx * dx + dy * dy;
    if (d2 >= R * R) return false;
    let nx, ny, d = Math.sqrt(d2);
    if (d > 0) { nx = dx / d; ny = dy / d; }
    else {
      // Center inside the box: push out along the shallowest side.
      const opts = [[b.x - x, -1, 0], [x + w - b.x, 1, 0], [b.y - y, 0, -1], [y + h - b.y, 0, 1]].sort((a, c) => a[0] - c[0]);
      nx = opts[0][1]; ny = opts[0][2]; d = -opts[0][0];
    }
    b.x += nx * (R - d);
    b.y += ny * (R - d);
    const vn = b.vx * nx + b.vy * ny;
    if (vn < 0) {
      b.vx -= (1 + bounce) * vn * nx;
      b.vy -= (1 + bounce) * vn * ny;
    }
    return true;
  }

  function step(world, input) {
    const L = world.level;
    world.t += DT;
    const t = world.t;
    for (const g of world.gates) g.x = movingX(g.x0, g.range, g.speed, t);
    const cup = world.cup;
    cup.x = movingX(cup.x0, cup.range, cup.speed, t);

    // Pour from the dispenser while the player holds.
    world.dropTimer -= DT;
    if (input.pouring && world.left > 0 && world.dropTimer <= 0) {
      world.dropTimer = DROP_EVERY;
      world.left--;
      spawn(world, Math.max(R, Math.min(W - R, input.x)), DISPENSER_Y + 14, (world.rand() - 0.5) * 30, 60);
    }

    const keep = [];
    for (const b of world.balls) {
      b.vy += GRAVITY * DT;
      b.vx *= 0.999;
      b.x += b.vx * DT;
      b.y += b.vy * DT;

      if (b.x < R) { b.x = R; b.vx = Math.abs(b.vx) * 0.6; }
      if (b.x > W - R) { b.x = W - R; b.vx = -Math.abs(b.vx) * 0.6; }

      for (const p of L.pegs) collideCircle(b, p.x, p.y, p.r, 0.55);
      for (const s of L.walls) collideBox(b, s.x, s.y, s.w, s.h, 0.4);

      let dead = false;
      for (const k of L.spikes) {
        if (b.x > k.x - R && b.x < k.x + k.w + R && b.y > k.y - R && b.y < k.y + k.h + R) { dead = true; break; }
      }
      if (dead) { world.lost++; world.pops.push({ x: b.x, y: b.y, t, bad: true }); continue; }

      // Gates: each ball can trigger each gate once; its copies inherit that.
      for (const g of world.gates) {
        if (b.used.includes(g.id)) continue;
        if (b.x > g.x && b.x < g.x + g.w && b.y > g.y && b.y < g.y + g.h) {
          b.used.push(g.id);
          const extra = g.op === 'x' ? g.n - 1 : g.n;
          for (let i = 0; i < extra; i++) {
            spawn(world, b.x + (world.rand() - 0.5) * 8, b.y + 2, b.vx + (world.rand() - 0.5) * 160, b.vy * 0.9, b.used);
          }
          world.pops.push({ x: b.x, y: b.y, t, gate: g.id });
        }
      }

      // Cup: open top with two side walls and a floor.
      const cx = cup.x, cy = cup.y, cw = cup.w, ch = cup.h, wall = 6;
      if (b.x > cx + wall && b.x < cx + cw - wall && b.y > cy + 10 && b.y < cy + ch) {
        world.collected++;
        continue;
      }
      collideBox(b, cx, cy, wall, ch, 0.3);
      collideBox(b, cx + cw - wall, cy, wall, ch, 0.3);

      if (b.y > H + 20) { world.lost++; continue; }
      keep.push(b);
    }
    world.balls = keep;
    if (world.pops.length > 60) world.pops.splice(0, world.pops.length - 60);
  }

  const finished = world => world.left === 0 && world.balls.length === 0;

  const api = { W, H, R, DT, DISPENSER_Y, createWorld, step, finished, movingX, rng };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Bounce = api;
})(this);
