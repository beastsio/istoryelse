(function () {
  const AT = window.AT;
  const hex = (c) => "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");

  const FONT = {
    A: [".#.", "#.#", "###", "#.#", "#.#"], B: ["##.", "#.#", "##.", "#.#", "##."], C: [".##", "#..", "#..", "#..", ".##"],
    D: ["##.", "#.#", "#.#", "#.#", "##."], E: ["###", "#..", "##.", "#..", "###"], F: ["###", "#..", "##.", "#..", "#.."],
    G: [".##", "#..", "#.#", "#.#", ".##"], H: ["#.#", "#.#", "###", "#.#", "#.#"], I: ["###", ".#.", ".#.", ".#.", "###"],
    J: ["..#", "..#", "..#", "#.#", ".#."], K: ["#.#", "#.#", "##.", "#.#", "#.#"], L: ["#..", "#..", "#..", "#..", "###"],
    M: ["#...#", "##.##", "#.#.#", "#...#", "#...#"], N: ["#..#", "##.#", "#.##", "#..#", "#..#"], O: [".#.", "#.#", "#.#", "#.#", ".#."],
    P: ["##.", "#.#", "##.", "#..", "#.."], Q: [".#.", "#.#", "#.#", "##.", ".##"], R: ["##.", "#.#", "##.", "#.#", "#.#"],
    S: [".##", "#..", ".#.", "..#", "##."], T: ["###", ".#.", ".#.", ".#.", ".#."], U: ["#.#", "#.#", "#.#", "#.#", "###"],
    V: ["#.#", "#.#", "#.#", "#.#", ".#."], W: ["#...#", "#...#", "#.#.#", "##.##", "#...#"], X: ["#.#", "#.#", ".#.", "#.#", "#.#"],
    Y: ["#.#", "#.#", ".#.", ".#.", ".#."], Z: ["###", "..#", ".#.", "#..", "###"], "&": [".#..", "#.#.", ".#..", "#.#.", ".#.#"],
    "0": ["###", "#.#", "#.#", "#.#", "###"], "1": [".#.", "##.", ".#.", ".#.", "###"], "2": ["##.", "..#", ".#.", "#..", "###"],
    "3": ["##.", "..#", ".#.", "..#", "##."], "4": ["#.#", "#.#", "###", "..#", "..#"], "5": ["###", "#..", "##.", "..#", "##."],
    "6": [".##", "#..", "###", "#.#", "###"], "7": ["###", "..#", ".#.", ".#.", ".#."], "8": ["###", "#.#", "###", "#.#", "###"],
    "9": ["###", "#.#", "###", "..#", "##."], "$": [".#.", "###", "##.", ".##", "###"], " ": ["..", "..", "..", "..", ".."], "!": ["#", "#", "#", ".", "#"]
  };
  function textWidth(s) {
    let w = 0;
    for (const ch of s) w += (FONT[ch] || FONT[" "])[0].length + 1;
    return Math.max(0, w - 1);
  }
  function text(g, x, y, s, col) {
    g.fillStyle = col;
    for (const ch of s) {
      const gl = FONT[ch] || FONT[" "];
      for (let j = 0; j < 5; j++) for (let i = 0; i < gl[j].length; i++) if (gl[j][i] === "#") g.fillRect(x + i, y + j, 1, 1);
      x += gl[0].length + 1;
    }
  }

  const X0 = 6, CW = 36, CH = 42;
  const LEGS = [
    [[18, 35, 3, 4], [27, 35, 3, 4], [17, 39, 4, 2], [27, 39, 4, 2]],
    [[18, 35, 3, 3], [27, 35, 3, 4], [17, 38, 4, 2], [27, 39, 4, 2]],
    [[18, 35, 3, 4], [27, 35, 3, 4], [17, 39, 4, 2], [27, 39, 4, 2]],
    [[18, 35, 3, 4], [27, 35, 3, 3], [17, 39, 4, 2], [27, 38, 4, 2]]
  ];
  const cache = new Map();
  function keyOf(a) { return [a.job, a.chassis, a.glow, a.uniform, a.eyes, a.head, a.hat, a.seat, a.mood || 0].join("."); }
  function sprite(a, pose, f, blink) {
    const k = (a.key || keyOf(a)) + "|" + pose + "|" + (f & 7) + "|" + (blink ? 1 : 0);
    let s = cache.get(k);
    if (s) return s;
    if (cache.size > 2600) cache.clear();
    s = build(a, pose, f & 7, blink);
    cache.set(k, s);
    return s;
  }
  function canvas(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; }
  function build(a, pose, f, blink) {
    const walk = pose === "walk", idle = pose === "idle";
    const L = AT.agentLayers(a, walk || idle ? 0 : f, blink);
    const m = AT.agentColorMap(a), P = AT.AGENT_PAL;
    const col = (v) => m[v] || P[v] || [255, 0, 255];
    const body = canvas(CW, CH), eyes = canvas(CW, CH), hands = canvas(CW, CH);
    const ib = new ImageData(CW, CH), ie = new ImageData(CW, CH), ih = new ImageData(CW, CH);
    const put = (img, x, y, c) => { x -= X0; if (x < 0 || x >= CW || y < 0 || y >= CH) return; const o = (y * CW + x) * 4; img.data[o] = c[0]; img.data[o + 1] = c[1]; img.data[o + 2] = c[2]; img.data[o + 3] = 255; };
    const h = L.head, hy = L.off.head;
    let bob = 0;
    if (walk) bob = f & 1;
    for (let y = 0; y < 48; y++) for (let x = 0; x < 48; x++) {
      const v = L.body.p[y * 48 + x];
      if (v == null) continue;
      const yy = y + bob;
      put(ib, x, yy, col(v));
      const inGlass = y - hy >= h.y0 + 3 && y - hy <= h.y1 - 2 && x >= h.x0 + 2 && x <= h.x1 - 2;
      if (v === "E" || v === "EG" || (inGlass && (v === "au" || v === "yl" || v === "w"))) put(ie, x, yy, col(v));
    }
    if (walk || pose === "stand") {
      const D = col("D"), S = col("S");
      const legs = LEGS[walk ? f & 3 : 0];
      legs.forEach(([x, y, w, hh], i) => { for (let j = 0; j < hh; j++) for (let k = 0; k < w; k++) put(ib, x + k, y + j, i < 2 && k === 1 ? S : D); });
    }
    if (walk || idle) {
      const lh = walk ? ((f & 2) ? -1 : 0) : 0, rh = walk ? ((f & 2) ? 0 : -1) : 0;
      [[14, lh], [30, rh]].forEach(([hx, dy]) => {
        const y = 30 + dy + bob;
        for (let yy = y; yy <= y + 2; yy++) for (let xx = hx; xx <= hx + 3; xx++) put(ih, xx, yy, yy === y ? col("L") : col("M"));
        put(ih, hx - 1, y + 1, col("D")); put(ih, hx + 4, y + 1, col("D"));
      });
    } else {
      for (let y = 0; y < 48; y++) for (let x = 0; x < 48; x++) { const v = L.hands.p[y * 48 + x]; if (v != null) put(ih, x, y, col(v)); }
    }
    body.getContext("2d").putImageData(ib, 0, 0);
    eyes.getContext("2d").putImageData(ie, 0, 0);
    hands.getContext("2d").putImageData(ih, 0, 0);
    return { body, eyes, hands, ox: X0, oy: 0 };
  }

  function drawAgent(ctx, fx, fy, a, pose, f, blink, later) {
    const s = sprite(a, pose, f, blink);
    ctx.drawImage(s.body, fx + s.ox, fy + s.oy);
    if (!later) { ctx.drawImage(s.eyes, fx + s.ox, fy + s.oy); ctx.drawImage(s.hands, fx + s.ox, fy + s.oy); }
    return s;
  }

  function rng(seed) {
    let s = seed >>> 0 || 1;
    return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  }

  function makeAgent(id, r) {
    const a = {
      id, job: (id * 23 + 7) % 35, chassis: Math.floor(r() * 12), glow: Math.floor(r() * 8), uniform: Math.floor(r() * 8),
      eyes: Math.floor(r() * 10), head: Math.floor(r() * 4), hat: Math.floor(r() * 5), seat: Math.floor(r() * 4), mood: Math.floor(r() * 3), plan: 0, since: 0, unlock: 0
    };
    a.key = keyOf(a);
    a.phase = (id * 7) & 7;
    a.blinkAt = Math.floor(r() * 40);
    return a;
  }

  function decode(v) {
    const n = (sh, bits) => Number((v >> BigInt(sh)) & ((1n << BigInt(bits)) - 1n));
    const a = {
      id: n(0, 16), job: n(16, 8), chassis: n(24, 8), glow: n(32, 8), uniform: n(40, 8), head: n(48, 8), hat: n(56, 8),
      eyes: n(64, 8), plan: n(72, 8), since: n(80, 40), unlock: n(120, 40), seat: n(160, 8), mood: n(168, 8), time: n(176, 8)
    };
    a.job %= 35; a.chassis %= 12; a.glow %= 8; a.uniform %= 8; a.head %= 4; a.hat %= 5; a.eyes %= 10; a.seat %= 4; a.mood %= 3;
    a.key = keyOf(a);
    a.phase = (a.id * 7) & 7;
    a.blinkAt = (a.id * 13) % 40;
    return a;
  }

  function demoTown(count, working) {
    const r = rng(6385), list = [];
    const now = Math.floor(Date.now() / 1000);
    for (let i = 1; i <= count; i++) {
      const a = makeAgent(i, r);
      if (r() < working / count) {
        a.plan = r() < 0.45 ? 2 : 1;
        a.since = now - Math.floor(r() * 24 * 86400);
        a.unlock = a.since + (a.plan === 2 ? 30 : 7) * 86400;
      }
      list.push(a);
    }
    return list;
  }

  const atlasImg = new Image();
  let atlasReady = false;
  const atlasWait = [];
  atlasImg.onload = () => { atlasReady = true; atlasWait.splice(0).forEach((f) => f()); };
  function loadAtlas(src) { if (!atlasImg.src) atlasImg.src = src || "atlas.png"; return new Promise((res) => atlasReady ? res() : atlasWait.push(res)); }

  const players = new Set();
  let tick = 0, loopOn = false;
  function playerLoop() {
    loopOn = true;
    tick++;
    for (const p of players) {
      if (!p.visible || !atlasReady) continue;
      const f = (tick + p.phase) & 7;
      const closed = ((tick + p.blink) % 36) < 2;
      p.ctx.clearRect(0, 0, 48, 48);
      p.ctx.drawImage(atlasImg, (f + (closed ? 8 : 0)) * 48, p.job * 48, 48, 48, 0, 0, 48, 48);
    }
    setTimeout(playerLoop, 140);
  }
  let io = null;
  function scene(canvas, job, phase) {
    canvas.width = 48; canvas.height = 48;
    const p = { ctx: canvas.getContext("2d"), job, phase: phase || 0, blink: Math.floor(Math.random() * 36), visible: true };
    players.add(p);
    if ("IntersectionObserver" in window) {
      io = io || new IntersectionObserver((es) => es.forEach((en) => { const q = en.target._player; if (q) q.visible = en.isIntersecting; }));
      canvas._player = p; io.observe(canvas);
    }
    loadAtlas();
    if (!loopOn) playerLoop();
    return p;
  }

  function drawScene(ctx, job, f, closed) {
    if (!atlasReady) { loadAtlas(); return false; }
    ctx.drawImage(atlasImg, ((f & 7) + (closed ? 8 : 0)) * 48, job * 48, 48, 48, 0, 0, 48, 48);
    return true;
  }

  function portrait(cv, a, scale) {
    const k = scale || 1;
    cv.width = 32 * k; cv.height = 36 * k;
    const g = cv.getContext("2d");
    g.imageSmoothingEnabled = false;
    const sp = sprite(a, "idle", 0, false);
    [sp.body, sp.eyes, sp.hands].forEach((c) => g.drawImage(c, 2, 0, 32, 36, 0, 0, 32 * k, 36 * k));
  }

  AT.hex = hex;
  AT.font = { text, textWidth };
  function hatName(a) {
    const j = AT.JOBS[a.job].name, k = a.hat;
    if (!k) return "None";
    if (j === "Chef" || j === "Baker" || (k === 1 && (j === "Street Food" || j === "Barista"))) return "Chef Hat";
    if (j === "Builder" || j === "Mechanic" || (j === "Farmer" && k === 2)) return "Hard Hat";
    if (j === "Farmer") return "Straw Hat";
    if (j === "Firefighter") return "Fire Helmet";
    if (j === "Police") return "Police Cap";
    if (j === "Pilot") return "Pilot Cap";
    if (j === "Security") return "Guard Cap";
    if (j === "Astronaut") return "Space Helmet";
    if (k === 1 && (j === "DJ" || j === "Trader" || j === "Coder")) return "Headphones";
    if (k === 1 && (j === "Musician" || j === "Streamer" || j === "Photographer")) return "Black Cap";
    if (k === 1 && j === "Doctor") return "Nurse Cap";
    return ["None", "None", "Cap", "Beret", "Beanie"][k];
  }
  AT.hatName = hatName;
  AT.sprite = sprite;
  AT.agentKey = keyOf;
  AT.drawAgent = drawAgent;
  AT.rng = rng;
  AT.makeAgent = makeAgent;
  AT.decodeAgent = decode;
  AT.demoTown = demoTown;
  AT.scene = scene;
  AT.loadAtlas = loadAtlas;
  AT.portrait = portrait;
  AT.drawScene = drawScene;
})();
