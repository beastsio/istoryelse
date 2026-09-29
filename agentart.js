(function (G) {
  const AT = G.AT = G.AT || {};
  const W = 48;
  const P = {"k":[14,14,22],"w":[250,250,255],"wh":[236,238,245],"g0":[60,62,76],"g1":[110,114,130],"g2":[165,170,184],"g3":[205,210,222],"au":[250,200,60],"au2":[200,140,30],"au3":[255,238,160],"rd":[230,50,60],"rd2":[160,24,36],"or":[255,140,30],"or2":[205,90,15],"yl":[255,222,70],"gr":[70,190,90],"gr2":[35,125,60],"gr3":[150,225,120],"bl":[50,110,230],"bl2":[28,60,150],"cy":[0,229,255],"lm":[204,255,0],"vi":[157,77,255],"vi2":[100,40,180],"pk":[255,120,150],"br":[130,85,50],"br2":[90,55,30],"br3":[170,115,70],"wd":[160,105,60],"wd2":[115,72,40],"wd3":[195,140,90],"sk":[40,44,62],"sk2":[26,28,42],"gl":[16,20,28],"gl2":[28,34,46],"gl3":[21,26,36],"sm":[220,225,235]};
  const EYES = ["Dots", "Happy", "Round", "Dollar", "Hearts", "Visor", "Focused", "Wink", "Sleepy", "Star"];
  const HEADS = { 0: [16, 31, 6, 19, 2], 1: [16, 31, 5, 19, 5], 2: [14, 33, 7, 19, 2], 3: [17, 30, 5, 19, 6] };
  const NEW = ["Teacher", "Baker", "Tea Stall", "Scientist", "Builder", "Miner", "Streamer", "Musician", "Photographer", "Barber", "Shopkeeper", "Florist", "Fisher", "Firefighter", "Police", "Pilot", "Astronaut", "Tailor", "Librarian", "Delivery", "Gardener", "Pharmacist", "Banker", "Journalist", "Security"];
  const TIE = ["Coder", "Trader", "Doctor", "Artist", "Banker", "Journalist", "Teacher", "Librarian", "Pharmacist"];
  const MOTION = {};
  ["Coder", "Trader", "Streamer", "Journalist", "Security", "Banker", "Pilot", "Tailor", "Photographer"].forEach((j) => { MOTION[j] = "type"; });
  ["Street Food", "Chef", "Barista", "Tea Stall", "Baker", "Scientist", "Pharmacist"].forEach((j) => { MOTION[j] = "stir"; });
  ["Mechanic", "Builder", "Miner", "Librarian"].forEach((j) => { MOTION[j] = "hammer"; });
  ["DJ", "Musician", "Teacher", "Police", "Firefighter"].forEach((j) => { MOTION[j] = "wave"; });
  ["Farmer", "Gardener", "Florist", "Shopkeeper", "Fisher", "Delivery", "Barber", "Astronaut"].forEach((j) => { MOTION[j] = "reach"; });
  ["Doctor", "Artist"].forEach((j) => { MOTION[j] = "write"; });
  const BODY_DY = [0, 0, 0, 1, 1, 1, 0, 0];
  const Z8 = [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0]];
  const HANDS = {
    type: [[[0, 0], [0, -1], [0, 0], [0, -1], [0, 0], [0, -1], [0, 0], [0, -1]], [[0, -1], [0, 0], [0, -1], [0, 0], [0, -1], [0, 0], [0, -1], [0, 0]]],
    stir: [Z8, [[0, 0], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1]]],
    hammer: [Z8, [[0, 0], [0, -2], [0, -4], [0, -5], [0, -3], [0, 0], [0, 0], [0, 0]]],
    wave: [[[0, 0], [0, -1], [0, -2], [0, -1], [0, 0], [0, 0], [0, 0], [0, 0]], [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [1, -1], [1, -2], [0, -1]]],
    reach: [[[0, 0], [-1, 0], [-2, 0], [-1, 0], [0, 0], [0, 0], [0, 0], [0, 0]], [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [1, 0], [2, 0], [1, 0]]],
    write: [Z8, [[0, 0], [1, 0], [2, 1], [1, 0], [0, 0], [1, 1], [2, 0], [1, 0]]]
  };
  const rep = (s, n) => (n > 0 ? s.repeat(n) : "");
  const fdiv = (a, b) => Math.floor(a / b);

  function Cv() {
    const p = new Array(W * W).fill(null);
    const c = {
      p,
      set(x, y, v) { if (x >= 0 && x < W && y >= 0 && y < W && v != null) p[y * W + x] = v; },
      get(x, y) { return x >= 0 && x < W && y >= 0 && y < W ? p[y * W + x] : null; },
      rect(x0, y0, x1, y1, v) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) c.set(x, y, v); },
      rows(x0, y0, rs, m) { rs.forEach((r, j) => { for (let i = 0; i < r.length; i++) if (r[i] in m) c.set(x0 + i, y0 + j, m[r[i]]); }); },
      outline(cols, oc) {
        const pts = [];
        for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
          if (!cols.has(c.get(x, y)) && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => cols.has(c.get(x + a, y + b)))) pts.push([x, y]);
        }
        pts.forEach(([x, y]) => c.set(x, y, oc));
      }
    };
    return c;
  }
  function rr(c, x0, y0, x1, y1, r, col) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const dx = Math.max(x0 + r - x, 0, x - (x1 - r)), dy = Math.max(y0 + r - y, 0, y - (y1 - r));
      if (dx * dx + dy * dy <= r * r + (r >= 2 ? 1 : 0)) c.set(x, y, col);
    }
  }

  function agent(c, t, job, closed) {
    const torso = [[22, 16, 31], [23, 14, 33]];
    for (let y = 24; y < 34; y++) torso.push([y, 13, 34]);
    torso.forEach(([y, a, b]) => c.rect(a, y, b, y, "U"));
    c.rect(13, 24, 13, 33, "U2"); c.rect(34, 24, 34, 33, "U2"); c.rect(33, 25, 33, 33, "U2");
    c.outline(new Set(["U", "U2"]), "D");
    c.rect(21, 22, 26, 24, "L"); c.rect(22, 25, 25, 26, "M"); c.set(21, 24, "U"); c.set(26, 24, "U");
    if (TIE.includes(job)) c.rect(23, 25, 24, 30, "T");
    c.rect(22, 19, 25, 21, "S"); c.rect(21, 19, 21, 21, "D"); c.rect(26, 19, 26, 21, "D");
    const [x0, x1, y0, y1, r] = HEADS[t.head];
    rr(c, x0, y0, x1, y1, r, "M");
    for (let y = y0; y <= y1; y++) {
      const xs = [];
      for (let x = x0; x <= x1; x++) if (c.get(x, y) === "M") xs.push(x);
      if (xs.length) { c.set(xs[0], y, "L"); xs.slice(-2).forEach((x) => c.set(x, y, "S")); }
    }
    for (let x = x0 + 2; x < x1 - 2; x++) if (c.get(x, y0) === "M") c.set(x, y0, "L");
    for (let x = x0 + 1; x < x1; x++) if (c.get(x, y1) === "M") c.set(x, y1, "S");
    c.outline(new Set(["M", "L", "S"]), "D");
    for (const x of [x0 - 2, x1 + 1]) {
      c.rect(x, 11, x + 1, 14, "S");
      const ex = x < x0 ? x : x + 1;
      c.set(ex, 12, "E"); c.set(ex, 13, "E");
    }
    const sx0 = x0 + 2, sx1 = x1 - 2, sy0 = y0 + (r >= 5 ? 4 : 3), sy1 = y1 - 2;
    rr(c, sx0, sy0, sx1, sy1, 1, "G");
    for (let y = sy0; y <= sy1; y += 2) for (let x = sx0; x <= sx1; x++) if (c.get(x, y) === "G") c.set(x, y, "G3");
    c.outline(new Set(["G", "G3"]), "D");
    const ex = fdiv(sx0 + sx1, 2), ey = fdiv(sy0 + sy1, 2) - 1;
    const lx = ex - 3, rx = ex + 2;
    const kind = EYES[t.eyes];
    if (closed || kind === "Sleepy") { c.rect(lx - 1, ey + 1, lx + 1, ey + 1, "E"); c.rect(rx, ey + 1, rx + 2, ey + 1, "E"); }
    else if (kind === "Dots") { c.rect(lx - 1, ey, lx, ey + 1, "E"); c.rect(rx + 1, ey, rx + 2, ey + 1, "E"); }
    else if (kind === "Happy") { for (const x of [lx - 1, rx]) c.rows(x, ey, [".E.", "E.E"], { E: "E" }); }
    else if (kind === "Round") { for (const x of [lx - 1, rx]) c.rows(x, ey - 1, [".E.", "EwE", ".E."], { E: "E", w: "w" }); }
    else if (kind === "Dollar") { for (const x of [lx - 1, rx]) c.rows(x, ey - 2, [".Y.", "YYY", "Y..", "YYY", "..Y", "YYY", ".Y."], { Y: "au" }); }
    else if (kind === "Hearts") { for (const x of [lx - 1, rx]) c.rows(x, ey - 1, ["E.E", "EEE", ".E."], { E: "E" }); }
    else if (kind === "Visor") { c.rect(sx0 + 1, ey, sx1 - 1, ey + 1, "E"); c.set(sx0 + 2, ey, "w"); }
    else if (kind === "Focused") { for (const x of [lx - 1, rx]) c.rows(x, ey - 1, ["EEE", ".E.", ".E."], { E: "E" }); }
    else if (kind === "Wink") { c.rect(lx - 1, ey, lx, ey + 1, "E"); c.rect(rx, ey + 1, rx + 2, ey + 1, "E"); }
    else if (kind === "Star") { for (const x of [lx - 1, rx]) c.rows(x, ey - 1, [".Y.", "YYY", ".Y."], { Y: "yl" }); }
    if (kind !== "Dollar" && kind !== "Visor") {
      const my = Math.min(ey + 4, sy1 - 1);
      const mood = t.mood || 0;
      c.rows(ex - 2, my - 1, mood === 0 ? ["E...E", ".EEE."] : (mood === 1 ? [".EEE."] : ["..E..", ".E.E."]), { E: "E" });
    }
    const hits = [];
    for (let y = sy0; y <= sy1; y++) for (let x = sx0; x <= sx1; x++) {
      const v = c.get(x, y);
      if ((v === "G" || v === "G3") && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => ["E", "au", "yl"].includes(c.get(x + a, y + b)))) hits.push([x, y]);
    }
    hits.forEach(([x, y]) => c.set(x, y, "EG"));
    c.set(sx1 - 1, sy0 + 1, "GL"); c.set(sx1 - 1, sy0 + 2, "GL");
    return { x0, x1, y0, y1, ex };
  }

  const CHEF = ["...WWW.WWW...", "..WWWWWWWWW..", ".WWWWWWWWWWW.", ".WWWWWWWWWWW.", "..WwWwWwWwW..", "..WWWWWWWWW..", "..ggggggggg.."];
  function hat(c, h, job, t) {
    const kind = t.hat, { x0, x1, y0 } = h, cx = fdiv(x0 + x1, 2);
    if (kind === 0) return;
    if (job === "Chef" || (kind === 1 && (job === "Street Food" || job === "Barista"))) { c.rows(cx - 6, y0 - 7, CHEF, { W: "wh", w: "g3", g: "g2" }); return; }
    if (job === "Mechanic" || (job === "Farmer" && kind === 2)) {
      c.rows(x0 - 1, y0 - 4, ["....." + rep("k", x1 - x0 - 7) + ".....", "...k" + rep("Y", x1 - x0 - 5) + "k...", "..kY" + rep("Y", x1 - x0 - 5) + "Yk..", ".kYY" + rep("y", x1 - x0 - 5) + "YYk."], { k: "k", Y: "au", y: "au2" });
      c.rect(x0 - 2, y0, x1 + 2, y0, "au2"); c.rect(x0 - 2, y0 + 1, x1 + 2, y0 + 1, "k"); return;
    }
    if (job === "Farmer") {
      c.rows(x0 - 4, y0 - 3, ["......" + rep("S", x1 - x0 - 3) + "......", "....S" + rep("s", x1 - x0 - 1) + "S....", "...S" + rep("R", x1 - x0 + 1) + "S...", "SSSSSS" + rep("S", x1 - x0 - 3) + "SSSSSS"], { S: "br3", s: "wd3", R: "rd" }); return;
    }
    if ((job === "DJ" || job === "Trader" || job === "Coder") && kind === 1) {
      for (let x = x0 - 1; x < x1 + 2; x++) c.set(x, y0 - 2, "k");
      c.set(x0 - 2, y0 - 1, "k"); c.set(x1 + 2, y0 - 1, "k");
      const pad = job !== "DJ" ? "rd" : "vi";
      c.rect(x0 - 3, 9, x0 - 1, 15, "k"); c.rect(x0 - 2, 10, x0 - 2, 14, pad);
      c.rect(x1 + 1, 9, x1 + 3, 15, "k"); c.rect(x1 + 2, 10, x1 + 2, 14, pad); return;
    }
    if (job === "Doctor" && kind === 1) { c.rows(cx - 3, y0 - 3, [".rrrr.", "rrwwrr", "rrrrrr"], { r: "wh", w: "rd" }); return; }
    if (kind === 2) {
      c.rows(x0, y0 - 3, ["...." + rep("R", x1 - x0 - 7) + "....", "..R" + rep("R", x1 - x0 - 3) + "R..", ".RR" + rep("r", x1 - x0 - 3) + "RR."], { R: "bl", r: "bl2" });
      c.rect(x0 - 1, y0, x1 + 5, y0, "bl2"); c.rect(x0 - 1, y0 + 1, x1 + 5, y0 + 1, "k"); return;
    }
    if (kind === 3) { c.rows(cx - 5, y0 - 3, ["..GGGGGGG..", ".GGGGGGGGG.", "GGGGGGGGGGG", "ggggggggggg"], { G: "gr", g: "gr2" }); c.set(cx, y0 - 4, "gr2"); return; }
    if (kind === 4) {
      c.rows(x0 + 1, y0 - 4, [rep(".", fdiv(x1 - x0, 2) - 2) + "ww", "..B" + rep("B", x1 - x0 - 7) + "B..", ".BB" + rep("b", x1 - x0 - 7) + "BB.", "BBB" + rep("B", x1 - x0 - 7) + "BBB"], { B: "vi", b: "vi2", w: "wh" });
      c.rect(x0, y0, x1, y0 + 1, "wh");
    }
  }
  function hat2(c, h, job, t) {
    const { x0, x1, y0 } = h, cx = fdiv(x0 + x1, 2);
    if (t.hat === 0) return true;
    if (job === "Builder") {
      c.rows(x0 - 1, y0 - 4, ["....." + rep("k", x1 - x0 - 7) + ".....", "...k" + rep("Y", x1 - x0 - 5) + "k...", "..kY" + rep("Y", x1 - x0 - 5) + "Yk..", ".kYY" + rep("y", x1 - x0 - 5) + "YYk."], { k: "k", Y: "or", y: "or2" });
      c.rect(x0 - 2, y0, x1 + 2, y0, "or2"); return true;
    }
    if (job === "Firefighter") {
      c.rows(x0 - 2, y0 - 4, ["....." + rep("k", x1 - x0 - 5) + ".....", "...k" + rep("R", x1 - x0 - 3) + "k...", "..kR" + rep("R", x1 - x0 - 3) + "Rk..", "RRRRR" + rep("r", x1 - x0 - 5) + "RRRRR"], { k: "k", R: "rd", r: "rd2" });
      c.rect(cx - 1, y0 - 3, cx + 1, y0 - 1, "au"); return true;
    }
    if (job === "Police" || job === "Pilot" || job === "Security") {
      const col = { Police: ["bl2", "k"], Pilot: ["wh", "k"], Security: ["k", "g0"] }[job];
      c.rows(x0, y0 - 4, ["..AAAAAAAAAAAA..", ".AAAAAAAAAAAAAA.", "AAAAAAyyAAAAAAAA", "BBBBBBBBBBBBBBBB"], { A: col[0], B: col[1], y: "au" }); return true;
    }
    if (job === "Baker") { c.rows(cx - 6, y0 - 7, CHEF, { W: "wh", w: "g3", g: "g2" }); return true; }
    if (job === "Astronaut") {
      for (let y = y0 - 2; y < h.y1 + 3; y++) for (let x = x0 - 3; x < x1 + 4; x++) {
        const d = Math.pow((x - cx) / (x1 - x0 + 6) * 2, 2) + Math.pow((y - (y0 + h.y1) / 2) / (h.y1 - y0 + 5) * 2, 2);
        if (d > 0.85 && d <= 1.0) c.set(x, y, "g3");
      }
      return true;
    }
    if ((job === "Musician" || job === "Streamer" || job === "Photographer") && t.hat === 1) {
      c.rows(x0, y0 - 3, ["...." + rep("R", x1 - x0 - 7) + "....", "..R" + rep("R", x1 - x0 - 3) + "R..", ".RR" + rep("r", x1 - x0 - 3) + "RR."], { R: "k", r: "sk" });
      c.rect(x0 - 5, y0, x1 + 1, y0, "sk"); return true;
    }
    return false;
  }

  function offsets(job, f) {
    const m = MOTION[job] || "type";
    f = ((f % 8) + 8) % 8;
    const body = BODY_DY[f];
    const head = m === "wave" ? body + [0, 1, 0, 1, 0, 1, 0, 1][f] : BODY_DY[(f + 7) % 8];
    return { body, head, lh: HANDS[m][0][f], rh: HANDS[m][1][f] };
  }

  function roundEven(v) {
    const r = Math.round(v);
    if (Math.abs(v % 1) === 0.5 && r % 2 !== 0) return r - 1;
    return r;
  }
  function colorMap(t) {
    const ch = AT.PAL.chassis[t.chassis], glow = AT.PAL.glow[t.glow][1], u = AT.PAL.uniform[t.uniform];
    const mix = (a, b, k) => [0, 1, 2].map((i) => roundEven(a[i] * k + b[i] * (1 - k)));
    return {
      M: ch[1], S: ch[2], L: ch[3], D: ch[4], E: glow, G: P.gl, G3: P.gl3, EG: mix(glow, P.gl, 0.22), GL: [84, 96, 118],
      U: u[1], U2: u[2], T: P[["rd", "bl", "au", "gr"][(t.seat || 0) % 4]]
    };
  }

  function layers(t, f, closed) {
    const job = AT.JOBS[t.job].name, isNew = NEW.includes(job);
    const a = Cv();
    const h = agent(a, t, job, closed);
    const hd = Cv(), bd = Cv();
    for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
      const v = a.p[y * W + x];
      if (v == null) continue;
      if (y <= h.y1) hd.p[y * W + x] = v; else bd.p[y * W + x] = v;
    }
    bd.rect(22, h.y1 - 1, 25, h.y1, "S"); bd.set(21, h.y1, "D"); bd.set(26, h.y1, "D");
    if (!isNew || !hat2(hd, h, job, t)) hat(hd, h, job, t);
    const o = offsets(job, f);
    const c = Cv();
    [[bd, o.body], [hd, o.head]].forEach(([L, dy]) => {
      for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
        const v = L.p[y * W + x];
        if (v != null && y + dy >= 0 && y + dy < W) c.p[(y + dy) * W + x] = v;
      }
    });
    const hb = Cv();
    for (const [hx, d] of [[14, o.lh], [30, o.rh]]) {
      const x = hx + d[0], y = 30 + d[1] + o.body;
      hb.rect(x, y, x + 3, y + 2, "M"); hb.rect(x, y, x + 3, y, "L");
      hb.set(x - 1, y + 1, "D"); hb.set(x + 4, y + 1, "D");
    }
    return { body: c, hands: hb, head: h, off: o };
  }

  function pixels(t, f, closed) {
    const L = layers(t, f, closed), m = colorMap(t);
    const res = (cv) => cv.p.map((v) => (v == null ? null : (m[v] || P[v] || [255, 0, 255])));
    return { body: res(L.body), hands: res(L.hands), keys: L.body.p, off: L.off };
  }

  AT.agentLayers = layers;
  AT.agentPixels = pixels;
  AT.agentColorMap = colorMap;
  AT.AGENT_PAL = P;
})(typeof window !== "undefined" ? window : globalThis);
