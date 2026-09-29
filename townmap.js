(function () {
  const AT = window.AT;
  const BW = 180, BH = 140, RW = 18, COLS = 4, ROWS = 3, SW = 6;
  const WW = RW + COLS * (BW + RW), WH = RW + ROWS * (BH + RW);
  const GRID = [["office", "market", "hospital", "studio"], ["workshop", "school", "safety", "airport"], ["farm", "cafe", "harbor", "space"]];
  const K = {
    ink: "#1a1530", grass: "#6cc24a", grass2: "#5db43f", grass3: "#8ad960", grassD: "#4a9935",
    road: "#4a4e62", road2: "#43475a", lane: "#f2eedf", walk: "#dcd3c0", walk2: "#c9bfa9", walkL: "#ebe4d4", curb: "#a39a88",
    plaza: "#ecdfc6", plaza2: "#e0d1b4", water: "#3b9fe6", water2: "#2f86cf", water3: "#9adbff", sand: "#f1dca6", sand2: "#e2c888",
    wood: "#a0693c", wood2: "#7a4e2c", wood3: "#c48c58", shadow: "rgba(24,18,56,0.22)", glass: "#8fd3ff", glass2: "#5fb0e8", frame: "#2a2440",
    steel: "#b9c0cf", steel2: "#8d95a8", steel3: "#e3e8f2", dark: "#22202e", red: "#e84a4a", red2: "#b42f3a", yellow: "#ffd23f", orange: "#ff8c2a",
    green: "#46be5a", green2: "#2f8f47", blue: "#3f7fe8", blue2: "#2a55b0", violet: "#8b5cf6", violet2: "#6236c9", pink: "#ff7eb0", white: "#f7f5ef", teal: "#26c6b0", cream: "#fff3d6"
  };

  function pen(g) {
    const R = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
    const P = (x, y, c) => { g.fillStyle = c; g.fillRect(x, y, 1, 1); };
    const rows = (x, y, arr, m) => { arr.forEach((r, j) => { for (let i = 0; i < r.length; i++) { const c = m[r[i]]; if (c) P(x + i, y + j, c); } }); };
    const txt = (x, y, s, c) => AT.font.text(g, x, y, s, c);
    const disc = (cx, cy, r, c) => { g.fillStyle = c; for (let y = -r; y <= r; y++) { const w = Math.floor(Math.sqrt(r * r - y * y + r * 0.8)); g.fillRect(cx - w, cy + y, w * 2 + 1, 1); } };
    return { g, R, P, rows, txt, disc };
  }

  function blockAt(c, r) { return { x: RW + c * (BW + RW), y: RW + r * (BH + RW), w: BW, h: BH, c, r }; }

  function createTown(canvas, opts) {
    opts = opts || {};
    const hero = !!opts.hero;
    const view = canvas.getContext("2d");
    const base = document.createElement("canvas"); base.width = WW * 2; base.height = WH * 2;
    const frame = document.createElement("canvas"); frame.width = WW * 2; frame.height = WH * 2;
    const lightsC = document.createElement("canvas"); lightsC.width = WW * 2; lightsC.height = WH * 2;
    base.getContext("2d").setTransform(2, 0, 0, 2, 0, 0);
    lightsC.getContext("2d").setTransform(2, 0, 0, 2, 0, 0);
    const fg = frame.getContext("2d");
    const lights = [], lamps = [], stations = [], blocks = {}, decor = [], water = [], signs = [];
    let agents = [], mine = new Set(), byJob = {}, working = [], districtCount = {};
    let night = opts.night === undefined ? null : opts.night;
    let tick = 0, lastTick = 0, t0 = performance.now();
    let hoverSt = null, selDistrict = null, focusId = null, commuters = [], walkers = [], cars = [];
    const cam = { x: 0, y: 0, z: 2, tx: null, ty: null };

    GRID.forEach((row, r) => row.forEach((id, c) => {
      const d = AT.DISTRICTS.find((q) => q.id === id);
      blocks[id] = Object.assign(blockAt(c, r), { id, d });
    }));

    const p = pen(base.getContext("2d"));
    const { R, P, rows, txt, disc } = p;

    function tree(x, y, v) {
      const leaf = ["#3f9e3a", "#4fb046", "#2f7f30"], leaf2 = ["#5fbf4f", "#7fd35f", "#3f9a3c"];
      const k = v || 0;
      R(x + 3, y + 9, 2, 3, K.wood2);
      g2(x + 1, y + 11, 7, 2, K.shadow);
      disc(x + 4, y + 5, 4, leaf[k % 3]);
      disc(x + 3, y + 4, 2, leaf2[k % 3]);
      P(x + 2, y + 3, "#b4f08c");
    }
    function g2(x, y, w, h, c) { R(x, y, w, h, c); }
    function bush(x, y, flower) {
      disc(x + 3, y + 2, 2, "#3f9e3a"); disc(x + 6, y + 2, 2, "#4aa842"); P(x + 2, y + 1, "#7fd35f");
      if (flower) { P(x + 3, y + 1, flower); P(x + 6, y + 2, flower); P(x + 5, y + 0, flower); }
    }
    function lamp(x, y) {
      R(x, y, 1, 8, "#3a3550"); R(x - 1, y - 1, 3, 2, "#3a3550"); P(x, y, "#ffe9a0"); R(x - 1, y + 8, 3, 1, "#2a2540");
      lamps.push([x, y]);
    }
    function bench(x, y) { R(x, y, 9, 1, K.wood3); R(x, y + 1, 9, 2, K.wood); R(x, y + 3, 1, 1, K.wood2); R(x + 8, y + 3, 1, 1, K.wood2); }
    function flowers(x, y, w) {
      R(x, y, w, 4, "#7a4e2c"); R(x, y, w, 1, "#916039");
      const cs = [K.red, K.yellow, K.pink, K.white, K.violet];
      for (let i = 1; i < w - 1; i += 2) { P(x + i, y + 1 + (i % 3 === 0 ? 1 : 0), cs[(i + x) % 5]); P(x + i, y + 2, "#3f9e3a"); }
    }
    function win(x, y, w, h, lit) {
      R(x - 1, y - 1, w + 2, h + 2, K.frame);
      R(x, y, w, h, K.glass2); R(x, y, w, Math.max(1, h >> 1), K.glass);
      P(x, y, "#dff4ff");
      if (lit !== false) lights.push([x, y, w, h]);
    }
    function building(x, y, w, h, o) {
      const roofH = o.roofH || 9;
      R(x + 3, y + 3, w, h, K.shadow);
      R(x, y + roofH, w, h - roofH, o.wall);
      R(x + w - 3, y + roofH, 3, h - roofH, o.wall2);
      R(x, y + roofH, w, 1, o.wall2);
      if (o.bricks) for (let yy = y + roofH + 1; yy < y + h; yy += 3) for (let xx = x + ((yy / 3) & 1) * 3; xx < x + w - 3; xx += 6) P(xx, yy, o.bricks);
      R(x - 2, y, w + 4, roofH, o.roof);
      for (let yy = y + 2; yy < y + roofH - 1; yy += 2) for (let xx = x - 2 + ((yy >> 1) & 1) * 2; xx < x + w + 2; xx += 4) P(xx, yy, o.roof2);
      R(x - 2, y, w + 4, 1, o.roofL || o.roof);
      R(x - 2, y + roofH - 1, w + 4, 1, o.roof2);
      R(x - 2, y + roofH, w + 4, 1, "rgba(0,0,0,0.25)");
      if (o.windows) {
        const [cols, rws, ww, wh] = o.windows;
        const gx = Math.floor((w - 4) / cols), top = y + roofH + 4;
        for (let j = 0; j < rws; j++) for (let i = 0; i < cols; i++) {
          const wx = x + 2 + i * gx + Math.floor((gx - ww) / 2), wy = top + j * (wh + 4);
          if (o.skipDoor && j === rws - 1 && Math.abs(wx + ww / 2 - (x + w / 2)) < 8) continue;
          win(wx, wy, ww, wh);
        }
      }
      if (o.door) {
        const dx = x + Math.floor(w / 2) - 4, dy = y + h - 10;
        R(dx - 1, dy - 1, 10, 11, K.frame); R(dx, dy, 8, 10, o.door); R(dx + 1, dy + 1, 6, 4, K.glass); R(dx + 4, dy, 1, 10, K.frame); P(dx + 6, dy + 6, K.yellow);
        R(dx - 2, y + h, 12, 2, K.walk2);
        lights.push([dx + 1, dy + 1, 6, 4]);
      }
      if (o.sign) sign(x + Math.floor(w / 2), y + roofH + (o.signY || 1), o.sign, o.signBg || K.ink, o.signFg || K.yellow);
    }
    function sign(cx, y, s, bg, fg) {
      const w = AT.font.textWidth(s) + 6;
      const x = cx - Math.floor(w / 2);
      R(x, y, w, 9, K.frame); R(x + 1, y + 1, w - 2, 7, bg); txt(x + 3, y + 2, s, fg);
      signs.push([x, y, w, 9, fg]);
    }
    function awning(x, y, w, c1, c2) {
      for (let i = 0; i < w; i++) { const c = ((i >> 1) & 1) ? c1 : c2; R(x + i, y, 1, 4, c); }
      for (let i = 0; i < w; i += 2) P(x + i, y + 4, ((i >> 1) & 1) ? c1 : c2);
      R(x, y, w, 1, "rgba(255,255,255,0.35)");
    }

    function ground() {
      R(0, 0, WW, WH, K.road);
      for (let y = 0; y < WH; y += 3) for (let x = (y * 7) % 5; x < WW; x += 5) P(x, y, K.road2);
      for (let r = 0; r <= ROWS; r++) {
        const cy = r * (BH + RW) + RW / 2;
        for (let x = 0; x < WW; x += 10) R(x, cy, 5, 1, K.lane);
      }
      for (let c = 0; c <= COLS; c++) {
        const cx = c * (BW + RW) + RW / 2;
        for (let y = 0; y < WH; y += 10) R(cx, y, 1, 5, K.lane);
      }
      for (let r = 0; r <= ROWS; r++) for (let c = 0; c <= COLS; c++) {
        const x = c * (BW + RW), y = r * (BH + RW);
        R(x, y, RW, RW, K.road);
        for (let i = 2; i < RW - 1; i += 3) { R(x + i, y - 7, 2, 6, K.lane); R(x + i, y + RW + 1, 2, 6, K.lane); R(x - 7, y + i, 6, 2, K.lane); R(x + RW + 1, y + i, 6, 2, K.lane); }
      }
      Object.values(blocks).forEach((b) => {
        R(b.x, b.y, b.w, b.h, K.walk);
        for (let x = b.x; x < b.x + b.w; x += 6) R(x, b.y, 1, SW, K.walk2), R(x, b.y + b.h - SW, 1, SW, K.walk2);
        for (let y = b.y; y < b.y + b.h; y += 6) R(b.x, y, SW, 1, K.walk2), R(b.x + b.w - SW, y, SW, 1, K.walk2);
        R(b.x, b.y, b.w, 1, K.walkL); R(b.x, b.y, 1, b.h, K.walkL);
        R(b.x, b.y + b.h - 1, b.w, 1, K.curb); R(b.x + b.w - 1, b.y, 1, b.h, K.curb);
        R(b.x + SW, b.y + SW, b.w - SW * 2, b.h - SW * 2, K.grass);
        const rr = AT.rng(b.x * 31 + b.y);
        for (let i = 0; i < 220; i++) { const x = b.x + SW + Math.floor(rr() * (b.w - SW * 2)), y = b.y + SW + Math.floor(rr() * (b.h - SW * 2)); P(x, y, rr() < 0.5 ? K.grass2 : K.grass3); }
      });
      Object.values(blocks).forEach((b) => {
        lamp(b.x + 3, b.y + 3 - 7 + 7); lamp(b.x + b.w - 4, b.y + b.h - 12);
      });
    }

    function plaza(x, y, w, h) {
      R(x, y, w, h, K.plaza);
      for (let yy = y; yy < y + h; yy += 5) R(x, yy, w, 1, K.plaza2);
      for (let yy = y; yy < y + h; yy += 5) for (let xx = x + ((yy - y) / 5 % 2) * 4; xx < x + w; xx += 8) R(xx, yy, 1, 5, K.plaza2);
    }

    function layoutStations(b, rowsY, perRow, jobs) {
      const list = [];
      jobs.forEach((j) => { for (let s = 0; s < 3; s++) list.push(j); });
      const order = [];
      for (let s = 0; s < 3; s++) jobs.forEach((j) => order.push(j));
      let k = 0;
      rowsY.forEach((ry, ri) => {
        const n = Math.min(perRow, order.length - k);
        if (n <= 0) return;
        const gap = n >= 7 ? 24 : 26, total = n * 20 + (n - 1) * (gap - 20);
        const x0 = b.x + Math.floor((b.w - total) / 2);
        for (let i = 0; i < n; i++) {
          const job = order[k++];
          addStation(b, x0 + i * gap, b.y + ry, job);
        }
      });
    }
    function addStation(b, x, y, job) {
      const slot = stations.filter((s) => s.job === job).length;
      stations.push({ x, y, job, slot, district: b.id, agent: null });
    }

    const D = {};
    D.office = (b) => {
      const x = b.x + 14, y = b.y + 8;
      R(x + 3, y + 3, 96, 56, K.shadow);
      R(x, y, 96, 56, "#5d8fd8");
      for (let yy = y + 10; yy < y + 56; yy++) for (let xx = x; xx < x + 96; xx++) if (((xx - x) % 8 === 0) || ((yy - y - 10) % 7 === 0)) P(xx, yy, "#35568f");
      for (let yy = y + 11; yy < y + 55; yy += 7) for (let xx = x + 1; xx < x + 95; xx += 8) { R(xx, yy, 7, 6, K.glass2); R(xx, yy, 7, 2, K.glass); lights.push([xx, yy, 7, 6]); }
      for (let i = 0; i < 40; i++) { const xx = x + 8 + i, yy = y + 12 + i; if (yy < y + 55) { P(xx, yy, "#e6f6ff"); P(xx + 1, yy, "#c3e9ff"); } }
      R(x - 2, y, 100, 10, "#2c3552"); R(x - 2, y, 100, 1, "#4f5c85"); R(x - 2, y + 9, 100, 1, "#1b2138");
      R(x + 8, y - 6, 1, 6, K.steel2); P(x + 8, y - 7, K.red); lights.push([x + 8, y - 7, 1, 1]);
      R(x + 70, y + 2, 16, 6, "#3a4466"); txt(x + 72, y + 2, "HQ", K.yellow);
      sign(x + 48, y + 1, "OFFICE", K.ink, K.yellow);
      R(x + 40, y + 46, 16, 10, K.frame); R(x + 41, y + 47, 14, 9, K.glass); R(x + 48, y + 47, 1, 9, K.frame);
      const x2 = b.x + 118;
      building(x2, b.y + 20, 50, 44, { wall: "#e9e3d6", wall2: "#c9c0ae", roof: "#6b5a8e", roof2: "#54467a", roofL: "#8a79ad", windows: [4, 2, 6, 7], door: "#6b5a8e", sign: "BANK", signBg: "#2d6a3e", signFg: K.yellow, skipDoor: true });
      R(x2 + 4, b.y + 24, 42, 1, "#c9c0ae");
      plaza(b.x + SW, b.y + 70, b.w - SW * 2, 60);
      tree(b.x + 7, b.y + 56, 0); tree(b.x + 164, b.y + 118, 1); bush(b.x + 110, b.y + 60, K.pink);
      layoutStations(b, [74, 101], 6, b.d.jobs);
    };
    D.market = (b) => {
      const cols = ["#e84a4a", "#3f7fe8", "#46be5a", "#ff8c2a", "#8b5cf6", "#ff7eb0"];
      for (let i = 0; i < 6; i++) {
        const x = b.x + 8 + i * 28;
        building(x, b.y + 8, 26, 34, { wall: ["#f4d9a8", "#e9c6a0", "#f1e3c2", "#dcc7a8", "#f4d0b8", "#e8dab6"][i], wall2: "#c9a980", roof: ["#a0453a", "#3a5a8a", "#4a7a3a", "#8a5a2a", "#5a3a8a", "#8a3a5a"][i], roof2: "rgba(0,0,0,0.25)", roofH: 8, windows: [2, 1, 5, 5] });
        awning(x, b.y + 30, 26, cols[i], K.white);
        R(x + 2, b.y + 35, 22, 7, K.frame); R(x + 3, b.y + 36, 20, 6, K.glass2); lights.push([x + 3, b.y + 36, 20, 6]);
      }
      sign(b.x + 90, b.y + 1, "MARKET STREET", K.red, K.cream);
      plaza(b.x + SW, b.y + 44, b.w - SW * 2, 90);
      for (let x = b.x + 8; x < b.x + b.w - 8; x += 1) { const yy = b.y + 47 + Math.round(Math.sin((x - b.x) / 9) * 1.5); P(x, yy, "#6a5a4a"); if ((x - b.x) % 7 === 0) { P(x, yy + 1, cols[((x - b.x) / 7) % 6]); P(x, yy + 2, cols[((x - b.x) / 7) % 6]); } }
      layoutStations(b, [55, 82, 109], 6, b.d.jobs);
    };
    D.hospital = (b) => {
      const x = b.x + 20, y = b.y + 8;
      building(x, y, 140, 58, { wall: "#f5f6fa", wall2: "#d5d9e4", roof: "#e05555", roof2: "#b83c46", roofL: "#f08080", windows: [9, 2, 7, 7], door: "#3f7fe8", skipDoor: true });
      R(x + 64, y + 12, 12, 12, K.white); R(x + 68, y + 13, 4, 10, K.red); R(x + 65, y + 16, 10, 4, K.red);
      sign(x + 70, y + 27, "HOSPITAL", "#1f5fbf", K.white);
      const ax = b.x + 150, ay = b.y + 56;
      R(ax, ay, 22, 11, K.white); R(ax, ay + 7, 22, 4, "#d5d9e4"); R(ax + 14, ay + 2, 6, 4, K.glass2); R(ax + 4, ay + 3, 6, 1, K.red); R(ax + 6, ay + 1, 2, 5, K.red);
      R(ax + 3, ay + 11, 3, 2, K.dark); R(ax + 16, ay + 11, 3, 2, K.dark); R(ax + 8, ay - 1, 4, 1, K.blue);
      plaza(b.x + SW, b.y + 70, b.w - SW * 2, 60);
      tree(b.x + 8, b.y + 108, 2); tree(b.x + 163, b.y + 108, 0); flowers(b.x + 30, b.y + 124, 30); flowers(b.x + 120, b.y + 124, 30);
      layoutStations(b, [76, 102], 3, b.d.jobs);
    };
    D.studio = (b) => {
      const x = b.x + 12, y = b.y + 8;
      building(x, y, 156, 40, { wall: "#3b2a6b", wall2: "#2a1d52", roof: "#1f1640", roof2: "#140e2e", roofL: "#4a3a8a", roofH: 8 });
      for (let i = 0; i < 20; i++) { P(x + 4 + i * 8, y + 10, ["#ff4fd8", "#26c6b0", "#ffd23f", "#8b5cf6"][i % 4]); lights.push([x + 4 + i * 8, y + 10, 1, 1]); }
      sign(x + 40, y + 16, "CLUB", "#140e2e", "#ff4fd8");
      sign(x + 116, y + 16, "STUDIO", "#140e2e", "#26c6b0");
      R(x + 72, y + 28, 12, 12, K.frame); R(x + 73, y + 29, 10, 11, "#ff4fd8"); lights.push([x + 73, y + 29, 10, 11]);
      for (let i = 0; i < 4; i++) { win(x + 10 + i * 14, y + 28, 8, 6); win(x + 96 + i * 14, y + 28, 8, 6); }
      plaza(b.x + SW, b.y + 50, b.w - SW * 2, 84);
      for (let yy = b.y + 50; yy < b.y + 134; yy += 4) for (let xx = b.x + SW + ((yy >> 2) & 1) * 4; xx < b.x + b.w - SW; xx += 8) R(xx, yy, 4, 4, "#e0d4ee");
      layoutStations(b, [55, 82, 109], 5, b.d.jobs);
    };
    D.workshop = (b) => {
      const x = b.x + 10, y = b.y + 10;
      building(x, y, 100, 54, { wall: "#b8b3a8", wall2: "#948f84", roof: "#6a6f7c", roof2: "#555a66", roofL: "#8a90a0" });
      for (let i = 0; i < 3; i++) {
        const dx = x + 8 + i * 30;
        R(dx - 1, y + 25, 24, 30, K.frame); R(dx, y + 26, 22, 28, "#dfe2e8");
        for (let yy = y + 27; yy < y + 54; yy += 2) R(dx, yy, 22, 1, "#c4c8d2");
        if (i === 1) { R(dx, y + 40, 22, 14, "#2a2733"); lights.push([dx, y + 40, 22, 14]); }
      }
      sign(x + 50, y + 12, "GARAGE", K.orange, K.ink);
      const mx = b.x + 118, my = b.y + 10;
      disc(mx + 26, my + 30, 24, "#8a7a68"); disc(mx + 22, my + 26, 16, "#a0907a"); disc(mx + 30, my + 20, 8, "#b4a48e");
      R(mx + 4, my + 50, 48, 6, "#8a7a68");
      R(mx + 17, my + 30, 18, 22, "#2a2030"); R(mx + 15, my + 28, 22, 3, K.wood); R(mx + 15, my + 28, 3, 24, K.wood); R(mx + 34, my + 28, 3, 24, K.wood);
      sign(mx + 26, my + 18, "MINE", K.wood2, K.yellow);
      for (let i = 0; i < 6; i++) P(mx + 20 + i * 2, my + 36 + (i % 2) * 5, K.yellow);
      R(mx + 10, my + 58, 1, 8, "#6a5a48"); R(mx + 40, my + 58, 1, 8, "#6a5a48");
      plaza(b.x + SW, b.y + 70, b.w - SW * 2, 60);
      for (let xx = b.x + SW; xx < b.x + b.w - SW; xx += 1) if ((xx >> 2) & 1) P(xx, b.y + 70, K.yellow);
      layoutStations(b, [76, 102], 5, b.d.jobs);
    };
    D.school = (b) => {
      const x = b.x + 12, y = b.y + 12;
      building(x, y, 100, 52, { wall: "#c9674a", wall2: "#a44f38", roof: "#5b4a8a", roof2: "#46376e", roofL: "#7a68aa", windows: [5, 2, 8, 7], door: "#5b4a8a", sign: "SCHOOL", signBg: K.cream, signFg: "#a44f38", skipDoor: true, signY: 18, bricks: "#b85a40" });
      R(x + 44, y - 12, 12, 13, "#c9674a"); R(x + 42, y - 14, 16, 3, "#5b4a8a"); disc(x + 50, y - 5, 3, K.white); P(x + 50, y - 6, K.ink); P(x + 51, y - 5, K.ink);
      const lx = b.x + 120;
      building(lx, b.y + 16, 50, 48, { wall: "#e8f1f5", wall2: "#c3d4de", roof: "#26a69a", roof2: "#1c7f76", roofL: "#4fd0c2", windows: [3, 2, 8, 7], sign: "LAB", signBg: "#1c7f76", signFg: K.white, signY: 19, skipDoor: true });
      disc(lx + 25, b.y + 12, 6, "#c3d4de"); R(lx + 19, b.y + 12, 13, 5, "#e8f1f5"); P(lx + 25, b.y + 8, K.teal);
      plaza(b.x + SW, b.y + 70, b.w - SW * 2, 60);
      tree(b.x + 8, b.y + 58, 1);
      layoutStations(b, [76, 102], 5, b.d.jobs);
    };
    D.safety = (b) => {
      const x = b.x + 8, y = b.y + 10;
      building(x, y, 80, 54, { wall: "#d64545", wall2: "#a83238", roof: "#5a2a2e", roof2: "#431e22", roofL: "#7a3a40", sign: "FIRE", signBg: K.cream, signFg: K.red });
      for (let i = 0; i < 2; i++) {
        const dx = x + 8 + i * 34;
        R(dx - 1, y + 26, 30, 29, K.frame); R(dx, y + 27, 28, 28, "#2a2733");
        if (i === 0) { R(dx + 2, y + 38, 24, 14, K.red); R(dx + 2, y + 38, 24, 2, "#ff8080"); R(dx + 4, y + 41, 8, 4, K.glass); R(dx + 4, y + 51, 5, 3, K.dark); R(dx + 19, y + 51, 5, 3, K.dark); R(dx + 13, y + 36, 12, 2, K.steel); }
        else { for (let yy = y + 27; yy < y + 55; yy += 2) R(dx, yy, 28, 1, "#c4c8d2"); R(dx, y + 27, 28, 28, "#dfe2e8"); for (let yy = y + 28; yy < y + 55; yy += 2) R(dx, yy, 28, 1, "#c4c8d2"); }
      }
      const px = b.x + 96;
      building(px, y + 6, 76, 48, { wall: "#e7ecf5", wall2: "#c2cadb", roof: "#1f3f8f", roof2: "#16306e", roofL: "#3f5faf", windows: [4, 2, 7, 6], door: "#1f3f8f", sign: "POLICE", signBg: "#1f3f8f", signFg: K.white, skipDoor: true, signY: 17 });
      P(px + 6, y + 2, K.red); P(px + 8, y + 2, K.blue); lights.push([px + 6, y + 2, 1, 1]);
      plaza(b.x + SW, b.y + 70, b.w - SW * 2, 60);
      R(b.x + 12, b.y + 124, 3, 6, K.red); R(b.x + 11, b.y + 125, 5, 1, K.red);
      layoutStations(b, [76, 102], 5, b.d.jobs);
    };
    D.airport = (b) => {
      const x = b.x + 8, y = b.y + 8;
      R(x + 3, y + 3, 16, 58, K.shadow);
      R(x + 4, y + 14, 8, 48, "#e7ecf5"); R(x + 10, y + 14, 2, 48, "#c2cadb");
      R(x, y + 4, 16, 10, "#26324f"); R(x + 1, y + 6, 14, 5, K.glass); lights.push([x + 1, y + 6, 14, 5]); R(x - 1, y + 2, 18, 2, "#e7ecf5"); R(x + 7, y - 2, 2, 4, K.steel2); P(x + 7, y - 3, K.red); lights.push([x + 7, y - 3, 1, 1]);
      R(b.x + 30, b.y + 10, 140, 28, "#55596b");
      for (let xx = b.x + 34; xx < b.x + 166; xx += 12) R(xx, b.y + 23, 6, 2, K.white);
      for (let xx = b.x + 32; xx < b.x + 168; xx += 6) { P(xx, b.y + 11, K.yellow); P(xx, b.y + 36, K.yellow); lights.push([xx, b.y + 11, 1, 1]); }
      const pl = b.x + 110, py = b.y + 16;
      rows(pl, py, [
        "......WW..........",
        "......WWW.........",
        "WWWWWWWWWWWWWWW...",
        "WBBWWWWWWWWWWWWWW.",
        "WWWWWWWWWWWWWWWWWW",
        "......WWW.........",
        "......WW.........."], { W: K.white, B: K.glass2 });
      R(pl + 1, py + 4, 16, 1, "#c2cadb");
      building(b.x + 36, b.y + 42, 70, 24, { wall: "#f1e3c2", wall2: "#d4c29c", roof: "#e84a4a", roof2: "#b42f3a", roofL: "#ff7a7a", roofH: 7, windows: [4, 1, 7, 5], sign: "POST", signBg: "#e84a4a", signFg: K.white, signY: 1 });
      sign(b.x + 140, b.y + 44, "AIRPORT", "#26324f", K.yellow);
      plaza(b.x + SW, b.y + 70, b.w - SW * 2, 60);
      layoutStations(b, [76, 102], 3, b.d.jobs);
    };
    D.farm = (b) => {
      const x = b.x + 12, y = b.y + 10;
      building(x, y, 50, 46, { wall: "#c83c3c", wall2: "#a02e32", roof: "#6a3a2a", roof2: "#522c20", roofL: "#8a4a3a", sign: "FARM", signBg: K.cream, signFg: K.red, signY: 12 });
      R(x + 17, y + 28, 16, 18, "#f7f0e0"); R(x + 18, y + 29, 14, 17, "#8a3030"); R(x + 18, y + 29, 14, 1, "#f7f0e0"); for (let i = 0; i < 14; i++) { P(x + 18 + i, y + 29 + i, "#f7f0e0"); P(x + 31 - i, y + 29 + i, "#f7f0e0"); }
      R(x + 56, y + 6, 14, 40, "#c7ced9"); disc(x + 63, y + 6, 7, "#9aa3b4"); R(x + 56, y + 6, 14, 1, "#e3e8f2"); R(x + 67, y + 8, 3, 38, "#aab2c2");
      const fx = b.x + 92, fy = b.y + 10;
      for (let j = 0; j < 7; j++) { R(fx, fy + j * 7, 80, 5, "#8a5a32"); R(fx, fy + j * 7, 80, 1, "#a06a3c"); for (let i = 2; i < 80; i += 4) { P(fx + i, fy + j * 7 + 1, ["#46be5a", "#e8c040", "#e84a4a"][j % 3]); P(fx + i, fy + j * 7 + 2, "#2f8f47"); } }
      R(fx - 2, fy - 2, 1, 52, K.wood2); R(fx + 81, fy - 2, 1, 52, K.wood2);
      R(b.x + SW, b.y + 70, b.w - SW * 2, 60, "#7a5230");
      for (let yy = b.y + 72; yy < b.y + 130; yy += 3) R(b.x + SW, yy, b.w - SW * 2, 1, "#8a6038");
      tree(b.x + 4, b.y + 56, 2); tree(b.x + 78, b.y + 56, 0);
      layoutStations(b, [76, 102], 3, b.d.jobs);
    };
    D.cafe = (b) => {
      const x = b.x + 10, y = b.y + 10;
      building(x, y, 78, 54, { wall: "#f4e1c1", wall2: "#d8c19c", roof: "#2f8f6b", roof2: "#246e52", roofL: "#4fb08b", windows: [3, 1, 12, 9], door: "#2f8f6b", sign: "CAFE", signBg: "#2f8f6b", signFg: K.cream, skipDoor: true });
      awning(x, y + 38, 78, "#2f8f6b", K.cream);
      const bx2 = b.x + 94;
      building(bx2, y + 4, 76, 50, { wall: "#f6d6c8", wall2: "#dbb3a2", roof: "#b0563a", roof2: "#8a4028", roofL: "#d07a5a", windows: [3, 1, 12, 9], door: "#b0563a", sign: "BAKERY", signBg: "#b0563a", signFg: K.cream, skipDoor: true });
      awning(bx2, y + 38, 76, "#e84a4a", K.cream);
      R(bx2 + 60, y - 4, 6, 10, "#8a4028"); decor.push({ type: "smoke", x: bx2 + 63, y: y - 6 });
      plaza(b.x + SW, b.y + 70, b.w - SW * 2, 60);
      for (const tx of [b.x + 14, b.x + 160]) { disc(tx, b.y + 124, 3, K.white); R(tx - 4, b.y + 119, 9, 1, "#e84a4a"); R(tx, b.y + 117, 1, 7, K.steel2); }
      layoutStations(b, [76, 102], 5, b.d.jobs);
    };
    D.harbor = (b) => {
      R(b.x + SW, b.y + SW, b.w - SW * 2, 40, K.sand);
      for (let i = 0; i < 60; i++) P(b.x + SW + ((i * 37) % (b.w - 12)), b.y + SW + ((i * 13) % 38), K.sand2);
      building(b.x + 14, b.y + 10, 60, 32, { wall: "#e7ecf5", wall2: "#c2cadb", roof: "#1f5f9f", roof2: "#174a7c", roofL: "#3f7fbf", roofH: 8, windows: [4, 1, 7, 6], sign: "HARBOR", signBg: "#1f5f9f", signFg: K.white, signY: 1 });
      const lx = b.x + 152, ly = b.y + 6;
      for (let j = 0; j < 30; j++) R(lx + 4 - (j >> 3), ly + 6 + j, 8 + (j >> 2), 1, ((j >> 2) & 1) ? K.red : K.white);
      R(lx + 2, ly, 12, 6, K.ink); R(lx + 4, ly + 1, 8, 4, K.yellow); lights.push([lx + 4, ly + 1, 8, 4]); R(lx + 1, ly - 2, 14, 2, K.red);
      R(b.x + SW, b.y + 46, b.w - SW * 2, b.h - 46 - SW, K.water);
      water.push([b.x + SW, b.y + 46, b.w - SW * 2, b.h - 46 - SW]);
      R(b.x + SW, b.y + 46, b.w - SW * 2, 1, K.water3);
      R(b.x + 30, b.y + 46, 120, 10, K.wood); for (let xx = b.x + 30; xx < b.x + 150; xx += 4) R(xx, b.y + 46, 1, 10, K.wood2); R(b.x + 30, b.y + 56, 120, 2, K.wood2);
      for (let xx = b.x + 32; xx < b.x + 150; xx += 16) R(xx, b.y + 58, 2, 4, K.wood2);
      R(b.x + 80, b.y + 56, 20, 60, K.wood); for (let yy = b.y + 56; yy < b.y + 116; yy += 4) R(b.x + 80, yy, 20, 1, K.wood2);
      stations.push({ x: b.x + 36, y: b.y + 38, job: 22, slot: 0, district: "harbor", agent: null, dock: true });
      stations.push({ x: b.x + 120, y: b.y + 38, job: 22, slot: 1, district: "harbor", agent: null, dock: true });
      stations.push({ x: b.x + 80, y: b.y + 100, job: 22, slot: 2, district: "harbor", agent: null, dock: true });
      decor.push({ type: "boat", x: b.x + 20, y: b.y + 90, c: K.red }, { type: "boat", x: b.x + 120, y: b.y + 80, c: K.blue }, { type: "boat", x: b.x + 138, y: b.y + 112, c: K.yellow });
    };
    D.space = (b) => {
      R(b.x + SW, b.y + SW, b.w - SW * 2, b.h - SW * 2, "#9aa0ad");
      for (let yy = b.y + SW; yy < b.y + b.h - SW; yy += 8) R(b.x + SW, yy, b.w - SW * 2, 1, "#8a909d");
      for (let xx = b.x + SW; xx < b.x + b.w - SW; xx += 8) R(xx, b.y + SW, 1, b.h - SW * 2, "#8a909d");
      const cx = b.x + 60, cy = b.y + 96;
      disc(cx, cy, 26, "#6f7584"); disc(cx, cy, 22, "#7d8392"); for (let a = 0; a < 16; a++) P(cx + Math.round(Math.cos(a / 16 * 6.283) * 24), cy + Math.round(Math.sin(a / 16 * 6.283) * 24), K.yellow);
      const rx = cx - 14, ry = b.y + 44;
      const rocket = [
        "......RR......", ".....RRRR.....", "....RRRRRR....", "....WWWWWW....", "...WWWWWWWW...", "...WWWBBWWW...", "...WWBGGBWW...", "...WWBGGBWW...", "...WWWBBWWW...",
        "...WWWWWWWW...", "...WWWWWWWW...", "...WWSSSSWW...", "...WWWWWWWW...", "...WWWWWWWW...", "...WWWWWWWW...", "...WWWWWWWW...", "...WWSSSSWW...", "...WWWWWWWW...",
        "...WWWWWWWW...", "...WWWWWWWW...", "...WWWWWWWW...", "..RWWWWWWWWR..", ".RRWWWWWWWWRR.", "RRRWWWWWWWWRRR", "RRR.WWWWWW.RRR", "RR...SSSS...RR", "......SS......"];
      const rm = { R: "#e84a4a", W: "#f4f6fb", B: "#8d95a8", G: K.glass, S: "#b9c0cf" };
      R(rx + 4, ry + 50, 22, 4, "rgba(0,0,0,0.25)");
      rocket.forEach((r, j) => { for (let i = 0; i < r.length; i++) { const c = rm[r[i]]; if (c) R(rx + i * 2, ry + j * 2 - 6, 2, 2, c); } });
      R(rx + 8, ry - 2, 2, 40, "#ffffff"); R(rx + 20, ry, 2, 38, "#d5d9e4");
      txt(rx + 9, ry + 26, "TOWN", "#e84a4a");
      R(cx + 18, b.y + 20, 4, 78, "#c8452e"); for (let yy = b.y + 22; yy < b.y + 96; yy += 6) { R(cx + 12, yy, 10, 1, "#c8452e"); P(cx + 13, yy + 1, "#8a2e1e"); }
      R(cx + 12, b.y + 50, 6, 2, "#c8452e");
      const dx = b.x + 128, dy = b.y + 18;
      R(dx + 8, dy + 14, 4, 16, K.steel2); decor.push({ type: "radar", x: dx + 10, y: dy + 10 });
      building(b.x + 112, b.y + 60, 58, 28, { wall: "#e7ecf5", wall2: "#c2cadb", roof: "#3a3f5a", roof2: "#2c3046", roofL: "#5a607f", roofH: 8, windows: [4, 1, 7, 5], sign: "SPACE PORT", signBg: "#3a3f5a", signFg: K.yellow, signY: 1 });
      stations.push({ x: b.x + 96, y: b.y + 100, job: 26, slot: 0, district: "space", agent: null });
      stations.push({ x: b.x + 122, y: b.y + 100, job: 26, slot: 1, district: "space", agent: null });
      stations.push({ x: b.x + 148, y: b.y + 100, job: 26, slot: 2, district: "space", agent: null });
    };

    function drawStatic() {
      ground();
      Object.values(blocks).forEach((b) => D[b.id](b));
      const lg = lightsC.getContext("2d");
      lg.clearRect(0, 0, WW, WH);
      const rr = AT.rng(99);
      lights.forEach(([x, y, w, h]) => {
        if (rr() < 0.18) return;
        lg.fillStyle = rr() < 0.5 ? "#ffd86b" : "#ffe9a8"; lg.fillRect(x, y, w, h);
        lg.fillStyle = "rgba(255,210,110,0.18)"; lg.fillRect(x - 1, y - 1, w + 2, h + 2);
      });
      signs.forEach(([x, y, w, h]) => { lg.drawImage(base, x * 2, y * 2, w * 2, h * 2, x, y, w, h); lg.fillStyle = "rgba(255,240,200,0.12)"; lg.fillRect(x - 1, y - 1, w + 2, h + 2); });
      lamps.forEach(([x, y]) => {
        const gr = lg.createRadialGradient(x + 0.5, y + 1, 0, x + 0.5, y + 1, 16);
        gr.addColorStop(0, "rgba(255,220,130,0.55)"); gr.addColorStop(1, "rgba(255,220,130,0)");
        lg.fillStyle = gr; lg.fillRect(x - 16, y - 15, 33, 33);
        lg.fillStyle = "#fff4c2"; lg.fillRect(x, y, 1, 1);
      });
    }

    function isNight() {
      if (night !== null) return night;
      const h = new Date().getHours();
      return h >= 19 || h < 6;
    }

    function stationFront(st, f) {
      const x = st.x, y = st.y, job = AT.JOBS[st.job].name, g = fg;
      const R2 = (a, b, c, d, col) => { g.fillStyle = col; g.fillRect(a, b, c, d); };
      const P2 = (a, b, col) => { g.fillStyle = col; g.fillRect(a, b, 1, 1); };
      const desk = (top, front, dark) => { R2(x + 1, y + 10, 18, 1, top); R2(x + 1, y + 11, 18, 4, front); R2(x + 1, y + 15, 1, 2, dark); R2(x + 18, y + 15, 1, 2, dark); R2(x + 2, y + 17, 17, 1, "rgba(0,0,0,0.18)"); };
      const counter = (c1, c2) => { R2(x, y + 10, 20, 1, "#f7f5ef"); R2(x, y + 11, 20, 5, c1); for (let i = 0; i < 20; i += 4) R2(x + i, y + 11, 2, 5, c2); R2(x, y + 16, 20, 1, "rgba(0,0,0,0.22)"); };
      const posts = () => { R2(x - 1, y - 10, 1, 21, "#6b5a4a"); R2(x + 20, y - 10, 1, 21, "#6b5a4a"); };
      const aw = (c) => { for (let i = -1; i < 21; i++) R2(x + i, y - 12, 1, 4, ((i >> 1) & 1) ? c : "#f7f5ef"); for (let i = -1; i < 21; i += 2) P2(x + i, y - 8, ((i >> 1) & 1) ? c : "#f7f5ef"); R2(x - 1, y - 12, 22, 1, "rgba(255,255,255,0.35)"); };
      const monitor = (mx, draw) => { mx = mx < x + 8 ? mx - 2 : mx + 2; R2(mx, y + 3, 6, 6, "#1a1b24"); R2(mx + 2, y + 9, 2, 1, "#1a1b24"); R2(mx + 1, y + 4, 4, 4, "#0d1422"); draw(mx + 1, y + 4); };
      switch (job) {
        case "Coder": desk(K.wood3, K.wood, K.wood2); monitor(x, (a, b) => { for (let i = 0; i < 4; i++) R2(a, b + i, 1 + ((f + i * 3) % 4), 1, "#46e07a"); }); R2(x + 7, y + 10, 6, 1, "#c9cfdc"); R2(x + 16, y + 8, 2, 2, K.yellow); break;
        case "Trader": desk("#5a5f73", "#3a3e50", "#23262f"); monitor(x, (a, b) => { for (let i = 0; i < 4; i++) { const up = (i + f) % 3 !== 0; R2(a + i, b + 1 + ((i * 2 + f) % 3 === 0 ? 0 : 1), 1, 2, up ? "#46e07a" : "#ff4d5e"); } }); monitor(x + 14, (a, b) => { for (let i = 0; i < 4; i++) P2(a + i, b + ((i + f) % 4 < 2 ? 1 : 2), "#46e07a"); }); break;
        case "Banker": desk("#7a5a3a", "#5a3f28", "#3a2818"); for (let i = 0; i < 3; i++) { const h = 2 + ((i + (f >> 1)) % 3); R2(x + 14 + i * 2, y + 10 - h, 2, h, K.yellow); P2(x + 14 + i * 2, y + 10 - h, "#fff0a0"); } R2(x + 1, y + 7, 5, 3, K.white); R2(x + 3, y + 7, 1, 3, "#c9cfdc"); break;
        case "Journalist": desk(K.wood3, K.wood, K.wood2); R2(x, y + 7, 6, 3, "#2a2733"); R2(x + 1, y + 3 + (f & 3 ? 0 : 1), 4, 4, K.white); R2(x + 2, y + 5, 2, 1, "#9aa3b4"); R2(x + 14, y + 8, 5, 2, "#e8e4d8"); R2(x + 14, y + 7, 5, 1, "#c9cfdc"); break;
        case "Street Food": posts(); counter("#e84a4a", "#f7f5ef"); R2(x, y + 7, 6, 3, "#2a2733"); for (let i = 0; i < 3; i++) R2(x + 1 + i * 2, y + 6, 1, 1, "#c86a3a"); for (let k = 0; k < 3; k++) { const yy = y + 4 - k * 2 - ((f >> 1) & 1); P2(x + 2 + ((k + f) & 1), yy, "rgba(240,240,250,0.8)"); } aw("#e84a4a"); break;
        case "Tea Stall": posts(); counter("#46be5a", "#2f8f47"); R2(x + 1, y + 7, 4, 3, "#b9c0cf"); R2(x + 5, y + 8, 1, 1, "#b9c0cf"); for (let k = 0; k < 2; k++) P2(x + 2 + ((k + f) & 1), y + 5 - k * 2 - ((f >> 1) & 1), "rgba(240,240,250,0.8)"); for (let i = 0; i < 3; i++) R2(x + 14 + i * 2, y + 9, 1, 1, K.white); aw("#46be5a"); break;
        case "Shopkeeper": posts(); counter("#3f7fe8", "#2a55b0"); R2(x + 1, y + 7, 3, 3, K.orange); R2(x + 15, y + 6, 4, 4, "#c48c58"); R2(x + 15, y + 7, 4, 1, "#a0693c"); aw("#3f7fe8"); break;
        case "Florist": posts(); counter("#ff7eb0", "#e85a94"); for (let i = 0; i < 3; i++) { R2(x + 1 + i * 2, y + 8, 1, 2, "#2f8f47"); P2(x + 1 + i * 2, y + 7, [K.red, K.yellow, K.violet][i]); R2(x + 14 + i * 2, y + 8, 1, 2, "#2f8f47"); P2(x + 14 + i * 2, y + 7 - ((f + i) % 4 === 0 ? 1 : 0), [K.white, K.pink, K.orange][i]); } aw("#ff7eb0"); break;
        case "Tailor": posts(); counter("#8b5cf6", "#6236c9"); R2(x + 1, y + 7, 5, 3, "#e84a4a"); R2(x + 1, y + 8, 5, 1, "#ff8080"); R2(x + 15, y + 7, 4, 3, K.teal); aw("#8b5cf6"); break;
        case "Barber": posts(); counter("#f7f5ef", "#d5d9e4"); for (let j = 0; j < 7; j++) P2(x + 1, y + 2 + j, ((j + f) % 3 === 0) ? K.red : ((j + f) % 3 === 1 ? K.white : K.blue)); R2(x + 1, y + 1, 1, 1, "#9aa3b4"); R2(x + 14, y + 7, 4, 3, "#2a2733"); aw("#e84a4a"); break;
        case "Chef": desk("#e3e8f2", "#b9c0cf", "#8d95a8"); R2(x + 3, y + 11, 5, 3, "#2a2733"); R2(x + 12, y + 11, 5, 3, "#2a2733"); P2(x + 4 + (f & 1), y + 12, (f & 1) ? "#ff8c2a" : "#ffd23f"); P2(x + 14 + ((f + 1) & 1), y + 12, (f & 1) ? "#ffd23f" : "#ff8c2a"); R2(x + 1, y + 8, 5, 2, "#555a66"); R2(x + 6, y + 9, 3, 1, "#2a2733"); P2(x + 3, y + 7 - ((f & 3) === 1 || (f & 3) === 2 ? 2 : 0), "#ffd23f"); break;
        case "Barista": desk("#c48c58", "#8a5a32", "#6a4428"); R2(x + 13, y + 3, 7, 7, "#b9c0cf"); R2(x + 14, y + 4, 5, 3, "#e3e8f2"); R2(x + 15, y + 7, 3, 1, "#2a2733"); R2(x + 16, y + 8, 2, 2, K.white); P2(x + 16 + (f & 1), y + 1 - ((f >> 1) & 1), "rgba(240,240,250,0.8)"); R2(x + 1, y + 8, 2, 2, K.white); R2(x + 3, y + 8, 2, 2, K.white); break;
        case "Baker": desk("#e8d2b0", "#c9a47a", "#8a6a48"); R2(x + 1, y + 8, 5, 2, "#d99a4a"); R2(x + 2, y + 8, 3, 1, "#f0c070"); R2(x + 14, y + 8, 5, 2, "#c07a3a"); P2(x + 15, y + 8, "#e8a860"); P2(x + 17, y + 8, "#e8a860"); break;
        case "Doctor": desk(K.white, "#d5d9e4", "#9aa3b4"); R2(x + 8, y + 12, 4, 1, K.red); R2(x + 9, y + 11, 2, 3, K.red); monitor(x, (a, b) => { for (let i = 0; i < 4; i++) P2(a + i, b + ((i + f) % 4 === 0 ? 0 : 2), "#46e07a"); }); break;
        case "Pharmacist": desk(K.white, "#d5d9e4", "#9aa3b4"); R2(x + 8, y + 12, 4, 1, K.green); R2(x + 9, y + 11, 2, 3, K.green); for (let i = 0; i < 3; i++) { R2(x + 1 + i * 2, y + 8, 1, 2, [K.red, K.blue, K.yellow][i]); R2(x + 14 + i * 2, y + 8, 1, 2, [K.green, K.pink, K.orange][i]); } break;
        case "Teacher": R2(x + 7, y + 10, 8, 1, K.wood3); R2(x + 8, y + 11, 6, 5, K.wood); R2(x + 8, y + 16, 7, 1, "rgba(0,0,0,0.2)"); break;
        case "Scientist": desk("#e3e8f2", "#9aa3b4", "#6f7584"); R2(x + 1, y + 6, 2, 1, K.steel3); R2(x + 1, y + 7, 3, 3, "#46e07a"); P2(x + 2, y + 6 - (f & 3), "rgba(200,255,210,0.9)"); R2(x + 15, y + 6, 2, 1, K.steel3); R2(x + 14, y + 7, 4, 3, "#ff7eb0"); P2(x + 15 + (f & 1), y + 5 - ((f >> 1) & 1), "rgba(255,210,230,0.9)"); break;
        case "Librarian": desk(K.wood3, K.wood, K.wood2); for (let i = 0; i < 3; i++) R2(x + 1, y + 7 + i, 5, 1, [K.red, K.blue, K.green][i]); R2(x + 14, y + 8, 5, 2, K.white); R2(x + 14, y + 8, 5, 1, "#c9cfdc"); break;
        case "DJ": R2(x, y + 10, 20, 6, "#1a1b24"); R2(x, y + 10, 20, 1, "#3a3e50"); for (const ox of [2, 12]) { R2(x + ox, y + 11, 6, 3, "#2a2733"); P2(x + ox + 1 + (f % 4), y + 12, K.white); } for (let i = 0; i < 20; i += 2) P2(x + i, y + 15, ["#ff4fd8", "#26c6b0", "#ffd23f", "#8b5cf6"][((i >> 1) + f) & 3]); R2(x + 1, y + 16, 18, 1, "rgba(0,0,0,0.25)"); break;
        case "Musician": R2(x, y + 10, 20, 3, K.white); for (let i = 1; i < 20; i += 3) R2(x + i, y + 10, 1, 2, "#1a1b24"); R2(x + 2, y + 13, 1, 3, "#1a1b24"); R2(x + 17, y + 13, 1, 3, "#1a1b24"); { const ny = y + 2 - ((f >> 1) & 3); P2(x + 17, ny, "#ffd23f"); P2(x + 17, ny + 1, "#ffd23f"); P2(x + 16, ny + 2, "#ffd23f"); } break;
        case "Streamer": desk("#3a3e50", "#2a2733", "#1a1b24"); monitor(x, (a, b) => { R2(a, b, 4, 4, "#26324f"); P2(a, b, (f & 2) ? "#ff4d5e" : "#26324f"); }); R2(x + 15, y + 6, 1, 4, "#9aa3b4"); R2(x + 14, y + 4, 3, 2, "#2a2733"); break;
        case "Photographer": R2(x + 1, y + 6, 6, 4, "#2a2733"); R2(x + 2, y + 7, 2, 2, K.glass2); R2(x + 5, y + 5, 2, 1, "#2a2733"); if ((f & 7) === 3) { R2(x + 5, y + 4, 2, 1, "#fff9c0"); } R2(x + 3, y + 10, 1, 6, "#555a66"); P2(x + 1, y + 16, "#555a66"); P2(x + 5, y + 16, "#555a66"); break;
        case "Artist": R2(x + 14, y + 2, 6, 7, K.white); P2(x + 15, y + 3, K.red); P2(x + 17, y + 4, K.blue); P2(x + 16, y + 6, K.yellow); P2(x + 15 + (f % 3), y + 7, K.green); R2(x + 15, y + 9, 1, 7, K.wood2); R2(x + 18, y + 9, 1, 7, K.wood2); break;
        case "Mechanic": R2(x, y + 10, 20, 6, "#e84a4a"); R2(x, y + 10, 20, 1, "#ff8080"); R2(x + 1, y + 12, 3, 2, "#fff0a0"); R2(x + 16, y + 12, 3, 2, "#fff0a0"); R2(x + 6, y + 12, 8, 2, "#2a2733"); R2(x + 2, y + 16, 3, 1, "#1a1b24"); R2(x + 15, y + 16, 3, 1, "#1a1b24"); if ((f & 7) === 3) { P2(x + 14, y + 6, K.yellow); P2(x + 16, y + 7, K.yellow); P2(x + 15, y + 5, K.white); } break;
        case "Builder": for (let j = 0; j < 3; j++) for (let i = 0; i < 5; i++) { R2(x + ((j & 1) ? 2 : 0) + i * 4, y + 10 + j * 2, 3, 1, "#c8452e"); } R2(x, y + 11, 20, 1, "#d8cfc0"); R2(x, y + 13, 20, 1, "#d8cfc0"); R2(x + 1, y + 6, 3, 4, K.orange); R2(x + 1, y + 7, 3, 1, K.white); break;
        case "Miner": R2(x, y + 11, 8, 5, "#7a6a58"); R2(x + 1, y + 10, 5, 2, "#8a7a68"); P2(x + 2, y + 12, (f & 2) ? K.yellow : "#7a6a58"); R2(x + 13, y + 9, 7, 5, "#6f7584"); R2(x + 14, y + 8, 5, 2, "#8a7a68"); P2(x + 15, y + 8, K.yellow); R2(x + 14, y + 14, 2, 2, "#2a2733"); R2(x + 18, y + 14, 2, 2, "#2a2733"); break;
        case "Farmer": R2(x, y + 11, 20, 5, "#8a5a32"); for (let i = 1; i < 20; i += 3) { P2(x + i, y + 11, "#46be5a"); P2(x + i, y + 10, (i + (f >> 2)) % 2 ? "#46be5a" : "#e8c040"); } break;
        case "Gardener": R2(x, y + 11, 20, 5, "#7a4e2c"); for (let i = 1; i < 20; i += 2) { P2(x + i, y + 11, "#3f9e3a"); P2(x + i, y + 10, [K.red, K.yellow, K.pink, K.white][i % 4]); } R2(x + 15, y + 7, 4, 3, "#3f7fe8"); P2(x + 14, y + 7, "#3f7fe8"); if (f & 1) { P2(x + 13, y + 9, K.water3); } break;
        case "Firefighter": R2(x + 1, y + 9, 3, 7, K.red); R2(x, y + 11, 5, 1, K.red); P2(x + 2, y + 8, K.yellow); for (let i = 0; i < 4; i++) P2(x + 15 + i, y + 6 + i + ((f + i) & 1), K.water3); break;
        case "Police": R2(x + 1, y + 11, 3, 5, K.orange); R2(x + 1, y + 12, 3, 1, K.white); R2(x + 15, y + 11, 3, 5, K.orange); R2(x + 15, y + 12, 3, 1, K.white); R2(x + 7, y + 11, 6, 1, "#1f3f8f"); break;
        case "Security": R2(x, y + 10, 20, 6, "#555a66"); R2(x, y + 10, 20, 1, "#7a8090"); R2(x + 2, y + 12, 3, 2, (f & 4) ? K.green : "#2a2733"); { const up = (f >> 2) & 1; for (let i = 0; i < 6; i++) P2(x + 14 + i, y + 9 - (up ? i : 0), (i & 1) ? K.red : K.white); } break;
        case "Pilot": R2(x - 2, y + 9, 24, 7, K.white); R2(x - 2, y + 9, 24, 1, "#ffffff"); R2(x - 2, y + 13, 24, 1, K.red); R2(x - 3, y + 10, 1, 4, "#9aa3b4"); { const pr = f & 1; R2(x - 4, y + 8 + pr * 2, 1, 4, "#555a66"); } R2(x + 21, y + 7, 2, 5, K.white); break;
        case "Delivery": R2(x, y + 8, 5, 3, "#c48c58"); R2(x + 1, y + 10, 5, 3, "#a0693c"); R2(x, y + 13, 6, 3, "#c48c58"); R2(x + 13, y + 10, 6, 3, K.red); R2(x + 13, y + 13, 2, 3, "#2a2733"); R2(x + 17, y + 13, 2, 3, "#2a2733"); R2(x + 18, y + 7, 1, 3, "#9aa3b4"); break;
        case "Astronaut": R2(x, y + 10, 20, 6, "#3a3f5a"); R2(x, y + 10, 20, 1, "#5a607f"); for (let i = 0; i < 5; i++) P2(x + 2 + i * 4, y + 12, ((i + f) % 3 === 0) ? K.red : ((i + f) % 3 === 1 ? K.green : K.yellow)); R2(x + 1, y + 16, 18, 1, "rgba(0,0,0,0.25)"); break;
        case "Fisher": { const bob = (f >> 1) & 1; R2(x + 14, y + 2, 1, 1, "#6b4a2a"); for (let i = 0; i < 7; i++) P2(x + 13 + i, y + 5 - (i >> 1), "#6b4a2a"); R2(x + 20, y + 3, 1, 12, "rgba(255,255,255,0.6)"); P2(x + 20, y + 15 + bob, K.red); P2(x + 20, y + 14 + bob, K.white); } break;
      }
    }
    function stationBack(st, f) {
      const x = st.x, y = st.y, job = AT.JOBS[st.job].name, g = fg;
      const R2 = (a, b, c, d, col) => { g.fillStyle = col; g.fillRect(a, b, c, d); };
      if (["Coder", "Trader", "Banker", "Journalist", "Doctor", "Streamer"].includes(job)) { R2(x + 3, y + 1, 14, 10, "#2a2733"); R2(x + 4, y + 2, 12, 8, "#3a3550"); }
      if (job === "Shopkeeper") { R2(x + 1, y - 1, 18, 10, "#8a5a32"); for (let i = 0; i < 3; i++) { R2(x + 2, y + i * 3, 16, 1, "#6a4428"); for (let k = 0; k < 4; k++) R2(x + 2 + k * 4, y - 2 + i * 3 + 1, 3, 2, [K.red, K.yellow, K.blue, K.green][(k + i) % 4]); } }
      if (job === "Pharmacist") { R2(x + 1, y - 1, 18, 10, "#e3e8f2"); for (let i = 0; i < 3; i++) for (let k = 0; k < 6; k++) R2(x + 2 + k * 3, y + i * 3, 2, 2, [K.red, K.teal, K.yellow, K.blue][(k + i) % 4]); }
      if (job === "Teacher") { R2(x - 2, y - 8, 24, 13, K.wood2); R2(x - 1, y - 7, 22, 11, "#2f5a3f"); for (let i = 0; i < 4; i++) { R2(x, y - 6 + i * 2, 3 + ((i * 3 + (f >> 2)) % 3), 1, "#e8f0e8"); R2(x + 16, y - 6 + i * 2, 2 + ((i + (f >> 2)) % 3), 1, "#e8f0e8"); } }
      if (job === "Librarian") { R2(x, y - 3, 20, 13, K.wood2); for (let i = 0; i < 3; i++) for (let k = 0; k < 9; k++) R2(x + 1 + k * 2, y - 2 + i * 4, 1, 3, [K.red, K.blue, K.green, K.yellow, K.violet][(k + i * 2) % 5]); }
      if (job === "DJ") { for (const ox of [0, 16]) { R2(x + ox, y + 1, 4, 9, "#1a1b24"); R2(x + ox + 1, y + 3, 2, 2, "#3a3e50"); R2(x + ox + 1, y + 6, 2, 2, (f & 1) ? "#8b5cf6" : "#3a3e50"); } }
      if (job === "Photographer") { R2(x + 8, y - 2, 12, 12, ["#ffd23f", "#26c6b0", "#ff7eb0"][st.slot % 3]); }
      if (job === "Baker") { R2(x + 14, y + 1, 6, 9, "#b0563a"); R2(x + 15, y + 5, 4, 3, (f & 2) ? "#ff8c2a" : "#ffb04a"); }
      if (job === "Chef") { R2(x + 1, y - 1, 18, 3, "#b9c0cf"); R2(x + 3, y + 2, 14, 1, "#8d95a8"); }
      if (job === "Mechanic") { R2(x + 1, y + 2, 18, 3, "#b83238"); R2(x + 2, y + 5, 16, 5, "#3a3e50"); }
      if (job === "Security") { R2(x + 2, y - 3, 16, 13, "#c2cadb"); R2(x + 3, y - 2, 14, 7, K.glass2); R2(x + 1, y - 4, 18, 2, "#555a66"); }
      if (job === "Police") { R2(x + 2, y - 2, 16, 12, "#1f3f8f"); R2(x + 3, y - 1, 14, 6, K.glass2); R2(x + 1, y - 3, 18, 1, K.white); }
      if (job === "Astronaut") { R2(x + 3, y + 1, 14, 9, "#2a2e44"); R2(x + 4, y + 2, 12, 5, "#10182a"); for (let i = 0; i < 4; i++) g.fillRect(x + 5 + i * 3, y + 3 + ((i + f) & 1), 1, 1); }
    }

    function drawStation(st, f, blink) {
      stationBack(st, f);
      const a = st.agent;
      let s = null;
      const fx = st.x * 2 - 4, fy = st.y * 2 - 9;
      if (a && !a.walking) {
        const pose = STAND.includes(AT.JOBS[st.job].name) ? "stand" : "work";
        s = AT.sprite(a, pose, (f + a.phase) & 7, blink(a));
        fine(s.body, fx + s.ox, fy + s.oy);
        eyeQueue.push([s.eyes, fx + s.ox, fy + s.oy]);
      }
      stationFront(st, f);
      if (s) {
        fine(s.hands, fx + s.ox, fy + s.oy);
        if (mine.has(a.id) || a.id === focusId) {
          const by = st.y - 12 - ((tick >> 2) & 1);
          fg.fillStyle = a.id === focusId ? "#ff4d5e" : "#ffd23f";
          fg.fillRect(st.x + 8, by, 5, 1); fg.fillRect(st.x + 9, by + 1, 3, 1); fg.fillRect(st.x + 10, by + 2, 1, 1);
        }
      }
    }

    let eyeQueue = [];
    function fine(c, x, y) { fg.save(); fg.setTransform(1, 0, 0, 1, 0, 0); fg.drawImage(c, x, y); fg.restore(); }
    const STAND = ["Teacher", "Photographer", "Artist", "Firefighter", "Police", "Miner", "Delivery", "Fisher", "Musician"];

    function assign() {
      stations.forEach((s) => { s.agent = null; });
      byJob = {}; districtCount = {};
      working = agents.filter((a) => a.plan > 0);
      working.forEach((a) => { (byJob[a.job] = byJob[a.job] || []).push(a); const d = AT.JOBS[a.job].district; districtCount[d] = (districtCount[d] || 0) + 1; });
      Object.values(byJob).forEach((list) => list.sort((p, q) => (mine.has(q.id) - mine.has(p.id)) || ((q.id === focusId) - (p.id === focusId)) || (p.since - q.since)));
      stations.forEach((s) => { const list = byJob[s.job]; if (list && list[s.slot]) s.agent = list[s.slot]; });
      const idle = agents.filter((a) => a.plan === 0);
      walkers = [];
      const r = AT.rng(77);
      const n = Math.min(hero ? 46 : 60, idle.length);
      const ids = Object.keys(blocks);
      for (let i = 0; i < n; i++) {
        const a = idle[Math.floor(r() * idle.length)];
        const b = blocks[ids[i % ids.length]];
        walkers.push({ a, b, t: r(), dir: r() < 0.5 ? 1 : -1, speed: 0.00018 + r() * 0.00012 });
      }
    }

    function walkerDraw(a, x, y, f, blink) {
      const s = AT.sprite(a, "walk", f, blink);
      const fx = Math.round(x * 2) - 24, fy = Math.round(y * 2) - 41;
      fg.fillStyle = "rgba(20,16,40,0.22)"; fg.fillRect(Math.round(x) - 5, Math.round(y) - 1, 10, 2);
      fine(s.body, fx + s.ox, fy + s.oy); fine(s.hands, fx + s.ox, fy + s.oy);
      eyeQueue.push([s.eyes, fx + s.ox, fy + s.oy]);
    }
    function ringPos(b, t) {
      const x0 = b.x + 3, y0 = b.y + 3, w = b.w - 6, h = b.h - 6, L = 2 * (w + h);
      let d = ((t % 1) + 1) % 1 * L;
      if (d < w) return [x0 + d, y0];
      d -= w; if (d < h) return [x0 + w, y0 + d];
      d -= h; if (d < w) return [x0 + w - d, y0 + h];
      d -= w; return [x0, y0 + h - d];
    }

    function initCars() {
      cars = [];
      const cols = ["#e84a4a", "#3f7fe8", "#ffd23f", "#f7f5ef", "#46be5a", "#ff8c2a", "#8b5cf6", "#26c6b0"];
      const r = AT.rng(5);
      for (let i = 0; i < 18; i++) {
        const horiz = i % 2 === 0;
        const lane = Math.floor(r() * (horiz ? ROWS + 1 : COLS + 1));
        const dir = r() < 0.5 ? 1 : -1;
        const c0 = lane * (horiz ? BH + RW : BW + RW) + RW / 2;
        cars.push({ horiz, dir, pos: r() * (horiz ? WW : WH), fixed: c0 + (dir > 0 ? 2 : -7), speed: 14 + r() * 12, col: cols[i % cols.length], bus: i % 7 === 3 });
      }
    }
    function drawCar(c) {
      const g = fg;
      const R2 = (a, b, w, h, col) => { g.fillStyle = col; g.fillRect(Math.round(a), Math.round(b), w, h); };
      if (c.horiz) {
        const x = c.pos, y = c.fixed, L = c.bus ? 18 : 11;
        R2(x + 1, y + 5, L, 1, "rgba(0,0,0,0.25)");
        R2(x, y, L, 5, c.bus ? "#ffd23f" : c.col); R2(x, y, L, 1, "rgba(255,255,255,0.35)");
        if (c.bus) for (let i = 2; i < L - 2; i += 3) R2(x + i, y + 1, 2, 2, K.glass2);
        else { R2(x + 3, y + 1, 5, 2, K.glass2); }
        R2(x + 1, y + 4, 2, 2, "#1a1b24"); R2(x + L - 3, y + 4, 2, 2, "#1a1b24");
        headQueue.push([c.dir > 0 ? x + L : x - 1, y + 2, c.dir]);
      } else {
        const x = c.fixed, y = c.pos;
        R2(x + 1, y + 1, 6, 10, "rgba(0,0,0,0.25)");
        R2(x, y, 5, 10, c.col); R2(x, y, 1, 10, "rgba(255,255,255,0.35)");
        R2(x + 1, c.dir > 0 ? y + 6 : y + 2, 3, 2, K.glass2);
        R2(x - 1, y + 2, 1, 2, "#1a1b24"); R2(x + 5, y + 2, 1, 2, "#1a1b24"); R2(x - 1, y + 7, 1, 2, "#1a1b24"); R2(x + 5, y + 7, 1, 2, "#1a1b24");
        headQueue.push([x + 2, c.dir > 0 ? y + 10 : y - 1, 0]);
      }
    }
    let headQueue = [];


    function blinkFn() { return (a) => ((tick + a.blinkAt) % 40) < 2; }

    function render(now) {
      const dt = Math.min(0.1, (now - (render.last || now)) / 1000);
      render.last = now;
      const ft = Math.floor((now - t0) / 140);
      if (ft !== lastTick) { tick = ft; lastTick = ft; }
      const f = tick & 7;
      const nightOn = isNight();
      fg.setTransform(2, 0, 0, 2, 0, 0);
      fg.clearRect(0, 0, WW, WH);
      fg.drawImage(base, 0, 0, WW, WH);
      water.forEach(([x, y, w, h]) => {
        fg.fillStyle = K.water3;
        for (let i = 0; i < 26; i++) { const xx = x + ((i * 53 + tick * (i % 3 + 1)) % w), yy = y + 3 + ((i * 29) % (h - 4)); fg.fillRect(xx, yy, 3, 1); }
        fg.fillStyle = K.water2;
        for (let i = 0; i < 16; i++) { const xx = x + ((i * 71 + tick * 2) % w), yy = y + 5 + ((i * 41) % (h - 6)); fg.fillRect(xx, yy, 4, 1); }
      });
      decor.forEach((d) => {
        if (d.type === "boat") {
          const by = d.y + ((tick >> 2) + d.x) % 2;
          fg.fillStyle = "rgba(0,0,0,0.2)"; fg.fillRect(d.x + 1, by + 6, 16, 1);
          fg.fillStyle = d.c; fg.fillRect(d.x, by + 3, 16, 3); fg.fillStyle = K.white; fg.fillRect(d.x + 2, by + 3, 12, 1);
          fg.fillStyle = K.wood2; fg.fillRect(d.x + 7, by - 6, 1, 9); fg.fillStyle = K.white; fg.fillRect(d.x + 8, by - 5, 5, 6); fg.fillRect(d.x + 8, by - 5, 1, 7);
        } else if (d.type === "smoke") {
          for (let k = 0; k < 4; k++) { const yy = d.y - k * 3 - (tick % 3); fg.fillStyle = "rgba(240,240,250," + (0.7 - k * 0.15) + ")"; fg.fillRect(d.x + ((k + (tick >> 1)) & 1) - 1, yy, 2 + (k >> 1), 2); }
        } else if (d.type === "radar") {
          const a = tick * 0.25, dx = Math.round(Math.cos(a) * 8);
          fg.fillStyle = "#c2cadb"; fg.fillRect(d.x - Math.abs(dx), d.y - 3, Math.abs(dx) * 2 + 1, 6);
          fg.fillStyle = "#8d95a8"; fg.fillRect(d.x - Math.abs(dx), d.y + 2, Math.abs(dx) * 2 + 1, 1);
          fg.fillStyle = K.red; fg.fillRect(d.x, d.y - 1, 1, 1);
        }
      });
      eyeQueue = []; headQueue = [];
      const bl = blinkFn();
      stations.forEach((st) => drawStation(st, f, bl));
      walkers.forEach((w) => {
        w.t += w.speed * w.dir * dt * 60;
        const [x, y] = ringPos(w.b, w.t);
        walkerDraw(w.a, x, y, (tick + w.a.phase) & 7, bl(w.a));
      });
      commuters.forEach((c) => {
        if (c.done) return;
        const seg = c.path[c.i], nxt = c.path[c.i + 1];
        if (!nxt) { c.done = true; c.a.walking = false; if (opts.onArrive) opts.onArrive(c.a); return; }
        const dx = nxt[0] - c.x, dy = nxt[1] - c.y, dist = Math.hypot(dx, dy), step = 34 * dt;
        if (dist <= step) { c.x = nxt[0]; c.y = nxt[1]; c.i++; } else { c.x += dx / dist * step; c.y += dy / dist * step; }
        walkerDraw(c.a, c.x, c.y, tick & 7, false);
        fg.fillStyle = "#ff4d5e"; const by = Math.round(c.y) - 25 - ((tick >> 2) & 1); fg.fillRect(Math.round(c.x) - 2, by, 5, 1); fg.fillRect(Math.round(c.x) - 1, by + 1, 3, 1); fg.fillRect(Math.round(c.x), by + 2, 1, 1);
        if (opts.follow !== false) { cam.tx = c.x; cam.ty = c.y; }
      });
      cars.forEach((c) => {
        c.pos += c.dir * c.speed * dt;
        const lim = c.horiz ? WW : WH;
        if (c.pos > lim + 20) c.pos = -20; if (c.pos < -20) c.pos = lim + 20;
        drawCar(c);
      });
      if (!nightOn) {
        eyeQueue.forEach(([c, x, y]) => fine(c, x, y));
      } else {
        fg.save();
        fg.globalCompositeOperation = "multiply";
        fg.fillStyle = "#555aa3";
        fg.fillRect(0, 0, WW, WH);
        fg.restore();
        fg.drawImage(lightsC, 0, 0, WW, WH);
        headQueue.forEach(([x, y, d]) => {
          fg.fillStyle = "rgba(255,240,170,0.9)"; fg.fillRect(x, y, 1, 1);
          fg.fillStyle = "rgba(255,240,170,0.18)";
          if (d > 0) fg.fillRect(x + 1, y - 2, 8, 5); else if (d < 0) fg.fillRect(x - 8, y - 2, 8, 5);
        });
        fg.save(); fg.setTransform(1, 0, 0, 1, 0, 0);
        eyeQueue.forEach(([c, x, y]) => { fg.drawImage(c, x, y); fg.globalAlpha = 0.3; fg.drawImage(c, x - 1, y); fg.drawImage(c, x + 1, y); fg.drawImage(c, x, y - 1); fg.globalAlpha = 1; });
        fg.restore();
      }
      if (selDistrict) {
        const b = blocks[selDistrict];
        fg.fillStyle = "#ffd23f";
        const per = 2 * (b.w + b.h);
        for (let i = 0; i < per; i += 6) {
          const k = (i + tick) % per;
          let x, y;
          if (k < b.w) { x = b.x + k; y = b.y; } else if (k < b.w + b.h) { x = b.x + b.w - 1; y = b.y + k - b.w; } else if (k < 2 * b.w + b.h) { x = b.x + b.w - (k - b.w - b.h) - 1; y = b.y + b.h - 1; } else { x = b.x; y = b.y + b.h - (k - 2 * b.w - b.h) - 1; }
          fg.fillRect(x, y, 3, 1); fg.fillRect(x, y, 1, 3);
        }
      }
      if (hoverSt && hoverSt.agent) {
        fg.strokeStyle = "#ffd23f"; fg.lineWidth = 1; fg.strokeRect(hoverSt.x - 2.5, hoverSt.y - 12.5, 25, 31);
      }
    }

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      const w = Math.max(1, Math.round(canvas.clientWidth * dpr)), h = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      const fit = Math.max(w / WW, h / WH);
      cam.zMin = Math.max(2, Math.ceil(fit / 2) * 2);
      cam.zMax = Math.max(cam.zMin + 2, Math.round(dpr * 4) * 2);
      if (hero) cam.z = Math.max(cam.zMin, Math.round(dpr * (w / dpr < 700 ? 1 : 2)) * 2);
      cam.z = Math.round(cam.z / 2) * 2;
      cam.z = Math.min(cam.zMax, Math.max(cam.zMin, cam.z || cam.zMin));
      clamp();
    }
    function clamp() {
      const vw = canvas.width / cam.z, vh = canvas.height / cam.z;
      cam.x = Math.min(Math.max(0, cam.x), Math.max(0, WW - vw));
      cam.y = Math.min(Math.max(0, cam.y), Math.max(0, WH - vh));
    }
    function blit() {
      const vw = canvas.width / cam.z, vh = canvas.height / cam.z;
      const x = Math.round(cam.x * cam.z) / cam.z, y = Math.round(cam.y * cam.z) / cam.z;
      view.imageSmoothingEnabled = false;
      view.fillStyle = K.grassD; view.fillRect(0, 0, canvas.width, canvas.height);
      view.drawImage(frame, x * 2, y * 2, vw * 2, vh * 2, 0, 0, canvas.width, canvas.height);
      if (opts.onFrame) opts.onFrame(api);
    }

    let raf = 0, alive = true, visible = true;
    function loop(now) {
      if (!alive) return;
      raf = requestAnimationFrame(loop);
      if (!visible || document.hidden) return;
      if (opts.view) {
        cam.z = opts.view.z; cam.x = opts.view.x; cam.y = opts.view.y;
      } else if (hero) {
        const vw = canvas.width / cam.z;
        const span = Math.max(0, WW - vw);
        const tt = (now - t0) / 1000;
        cam.x = span * (0.5 - 0.5 * Math.cos(tt * 0.035));
        cam.y = (WH - canvas.height / cam.z) * (0.35 + 0.25 * Math.sin(tt * 0.021));
        clamp();
      } else if (cam.tx !== null) {
        const vw = canvas.width / cam.z, vh = canvas.height / cam.z;
        cam.x += (cam.tx - vw / 2 - cam.x) * 0.08; cam.y += (cam.ty - vh / 2 - cam.y) * 0.08;
        clamp();
        if (!commuters.some((c) => !c.done) && Math.abs(cam.tx - vw / 2 - cam.x) < 0.5 && Math.abs(cam.ty - vh / 2 - cam.y) < 0.5) { cam.tx = null; }
      } else if (inertia.vx || inertia.vy) {
        cam.x -= inertia.vx / cam.z; cam.y -= inertia.vy / cam.z; inertia.vx *= 0.9; inertia.vy *= 0.9;
        if (Math.abs(inertia.vx) < 0.2) inertia.vx = 0; if (Math.abs(inertia.vy) < 0.2) inertia.vy = 0;
        clamp();
      }
      render(now);
      blit();
    }
    const inertia = { vx: 0, vy: 0 };

    function toWorld(ev) {
      const r = canvas.getBoundingClientRect(), dpr = canvas.width / r.width;
      return [cam.x + (ev.clientX - r.left) * dpr / cam.z, cam.y + (ev.clientY - r.top) * dpr / cam.z];
    }
    function pickStation(wx, wy) { return stations.find((s) => wx >= s.x - 1 && wx < s.x + 21 && wy >= s.y - 10 && wy < s.y + 18) || null; }
    function pickDistrict(wx, wy) { return Object.values(blocks).find((b) => wx >= b.x && wx < b.x + b.w && wy >= b.y && wy < b.y + b.h) || null; }
    function zoomAt(z, sx, sy) {
      z = Math.round(z / 2) * 2;
      z = Math.min(cam.zMax, Math.max(cam.zMin, z));
      if (z === cam.z) return;
      const wx = cam.x + sx / cam.z, wy = cam.y + sy / cam.z;
      cam.z = z; cam.x = wx - sx / z; cam.y = wy - sy / z; cam.tx = null; clamp();
    }

    if (!hero) {
      const ptrs = new Map();
      let drag = null, pinch = null, moved = 0;
      canvas.addEventListener("pointerdown", (e) => {
        canvas.setPointerCapture(e.pointerId);
        ptrs.set(e.pointerId, [e.clientX, e.clientY]);
        inertia.vx = inertia.vy = 0; cam.tx = null;
        if (ptrs.size === 1) { drag = { x: e.clientX, y: e.clientY, t: performance.now() }; moved = 0; }
        if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), z: cam.z }; drag = null; moved = 99; }
      });
      canvas.addEventListener("pointermove", (e) => {
        const r = canvas.getBoundingClientRect(), dpr = canvas.width / r.width;
        if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, [e.clientX, e.clientY]);
        if (pinch && ptrs.size === 2) {
          const [a, b] = [...ptrs.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
          zoomAt(Math.round(pinch.z * d / pinch.d), ((a[0] + b[0]) / 2 - r.left) * dpr, ((a[1] + b[1]) / 2 - r.top) * dpr);
          return;
        }
        if (drag) {
          const dx = (e.clientX - drag.x) * dpr, dy = (e.clientY - drag.y) * dpr;
          moved += Math.abs(dx) + Math.abs(dy);
          cam.x -= dx / cam.z; cam.y -= dy / cam.z; clamp();
          inertia.vx = dx; inertia.vy = dy;
          drag.x = e.clientX; drag.y = e.clientY;
          canvas.style.cursor = "grabbing";
          return;
        }
        const [wx, wy] = toWorld(e);
        const st = pickStation(wx, wy);
        hoverSt = st && st.agent ? st : null;
        canvas.style.cursor = hoverSt || pickDistrict(wx, wy) ? "pointer" : "grab";
      });
      const end = (e) => {
        ptrs.delete(e.pointerId);
        if (ptrs.size < 2) pinch = null;
        if (drag && moved < 8 * (window.devicePixelRatio || 1)) {
          inertia.vx = inertia.vy = 0;
          const [wx, wy] = toWorld(e);
          const st = pickStation(wx, wy);
          if (st && st.agent && opts.onAgent) { opts.onAgent(st.agent, st); }
          else { const b = pickDistrict(wx, wy); if (b && opts.onDistrict) opts.onDistrict(b.d, districtList(b.id)); }
        }
        drag = null; canvas.style.cursor = "grab";
      };
      canvas.addEventListener("pointerup", end);
      canvas.addEventListener("pointercancel", end);
      canvas.addEventListener("wheel", (e) => {
        e.preventDefault();
        const r = canvas.getBoundingClientRect(), dpr = canvas.width / r.width;
        zoomAt(cam.z + (e.deltaY < 0 ? 2 : -2), (e.clientX - r.left) * dpr, (e.clientY - r.top) * dpr);
      }, { passive: false });
      canvas.style.cursor = "grab";
      canvas.style.touchAction = "none";
    }

    function districtList(id) { return working.filter((a) => AT.JOBS[a.job].district === id); }

    new ResizeObserver(resize).observe(canvas);
    if ("IntersectionObserver" in window) new IntersectionObserver((es) => { visible = es[0].isIntersecting; }).observe(canvas);
    drawStatic();
    initCars();
    resize();
    cam.x = (WW - canvas.width / cam.z) / 2; cam.y = (WH - canvas.height / cam.z) / 2; clamp();
    raf = requestAnimationFrame(loop);

    const api = {
      WW, WH,
      blocks,
      stations,
      setAgents(list) { agents = list; assign(); },
      setMine(ids) { mine = new Set(ids); assign(); },
      setNight(v) { night = v; },
      isNight,
      zoom(d) { zoomAt(cam.z + d * 2, canvas.width / 2, canvas.height / 2); },
      select(id) { selDistrict = id; if (id) { const b = blocks[id]; cam.tx = b.x + b.w / 2; cam.ty = b.y + b.h / 2; } },
      districtList,
      counts() { return districtCount; },
      working() { return working; },
      agents() { return agents; },
      focus(id, walk) {
        focusId = id; assign();
        const st = stations.find((s) => s.agent && s.agent.id === id);
        const a = agents.find((q) => q.id === id);
        if (!a) return null;
        const b = blocks[AT.JOBS[a.job].district];
        if (walk && st) {
          a.walking = true;
          const ry = b.y + b.h + RW / 2, sx = st.x + 10;
          const path = [[-10, ry], [sx, ry], [sx, st.y + 16]];
          commuters = [{ a, path, i: 0, x: path[0][0], y: path[0][1], done: false }];
          cam.z = Math.min(cam.zMax, Math.max(cam.zMin, cam.z));
          cam.tx = path[0][0]; cam.ty = path[0][1];
        } else if (st) { cam.tx = st.x + 10; cam.ty = st.y + 6; }
        else { cam.tx = b.x + b.w / 2; cam.ty = b.y + b.h / 2; }
        return { station: st, block: b };
      },
      screenOf(wx, wy) { const r = canvas.getBoundingClientRect(), dpr = canvas.width / r.width; return [(wx - cam.x) * cam.z / dpr, (wy - cam.y) * cam.z / dpr]; },
      destroy() { alive = false; cancelAnimationFrame(raf); }
    };
    return api;
  }

  AT.createTown = createTown;
  AT.TOWN_SIZE = [WW, WH];
})();
