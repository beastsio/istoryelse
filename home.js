(function () {
  const AT = window.AT, el = AT.el, fmt = AT.fmt;

  const town = AT.createTown(document.getElementById("heroTown"), { hero: true });
  let stats = null;
  AT.loadAgents().then((r) => { town.setAgents(r.list); stats = r; ticker(); }).catch(() => { town.setAgents(AT.demoTown(6385, 2400)); ticker(); });

  async function ticker() {
    const box = document.getElementById("ticker");
    const items = [];
    if (AT.PREVIEW) {
      items.push("Mining opens <b>soon</b>", "6,385 agents", "35 jobs", "Every job pays the <b>same</b>", "Salary: <b>60%</b> of every hire", "Part-time <b>1&times;</b> &middot; Full-time <b>4&times;</b>", "First hire <b>0.0005 ETH</b>");
    } else {
      let ms = null;
      try { ms = await AT.town.miningState(); } catch (e) {}
      const st = stats && stats.stats;
      if (st) items.push("Hired <b>" + fmt.num(st.minted) + "</b> / 6,385", "Working now <b>" + fmt.num(st.working) + "</b>", "Salary paid <b>" + fmt.eth(st.salaryTotal, 4) + " ETH</b>");
      if (ms) items.push("Next hire <b>" + fmt.eth(ms.price, 5) + " ETH</b>", "Epoch <b>" + (ms.epoch + 1) + "</b> / 5");
      items.push("35 jobs", "Every job pays the <b>same</b>");
    }
    const html = items.map((t) => "<span>" + t + "</span>").join("");
    box.innerHTML = html + html;
  }

  const art = document.getElementById("equalArt");
  const pick = [0, 2, 8, 25, 6, 11, 23, 12, 26, 3];
  pick.forEach((j, i) => { const c = el("canvas", { "aria-label": AT.JOBS[j].name }); art.insertBefore(c, art.lastElementChild); AT.scene(c, j, i); });
  art.lastElementChild.lastElementChild.remove();

  const grid = document.getElementById("jobGrid"), filters = document.getElementById("filters");
  const dname = {}; AT.DISTRICTS.forEach((d) => { dname[d.id] = d.name; });
  const cards = [];
  AT.DISTRICTS.forEach((d) => d.jobs.forEach((j) => {
    const job = AT.JOBS[j];
    const c = el("canvas", { "aria-label": job.name + " agent" });
    const card = el("div", { class: "job px-drop" }, [c, el("h3", { text: job.name }), el("p", { text: job.blurb }), el("span", { class: "where", text: d.name })]);
    card.dataset.d = d.id;
    grid.appendChild(card); cards.push(card);
    AT.scene(c, j, j);
  }));
  const chips = [];
  const addChip = (id, label) => {
    const b = el("button", { class: "chip" + (id === "all" ? " on" : ""), type: "button", text: label, onclick: () => { chips.forEach((q) => q.classList.remove("on")); b.classList.add("on"); cards.forEach((c) => c.classList.toggle("hide", id !== "all" && c.dataset.d !== id)); } });
    chips.push(b); filters.appendChild(b);
  };
  addChip("all", "All 35");
  AT.DISTRICTS.forEach((d) => addChip(d.id, d.name));

  document.querySelectorAll("canvas[data-step]").forEach((c) => {
    const k = +c.dataset.step;
    const g = c.getContext("2d");
    c.width = 56; c.height = 44; c.style.width = "112px"; c.style.height = "88px";
    const a = AT.makeAgent(100 + k, AT.rng(11 + k * 7));
    a.job = [0, 29, 32, 10][k]; a.hat = [1, 0, 0, 4][k]; a.key = AT.agentKey(a);
    const pose = ["work", "walk", "work", "stand"][k];
    let f = 0;
    const draw = () => {
      g.clearRect(0, 0, 56, 44);
      g.fillStyle = "rgba(26,21,48,0.14)"; g.fillRect(8, 41, 36, 3);
      const s = AT.drawAgent(g, 0, k === 1 ? 2 : 3, a, pose, f & 7, (f % 30) < 2, true);
      g.drawImage(s.body, s.ox, (k === 1 ? 2 : 3) + s.oy);
      if (k === 0 || k === 2) { g.fillStyle = "#c48c58"; g.fillRect(6, 33, 36, 2); g.fillStyle = "#a0693c"; g.fillRect(6, 35, 36, 7); }
      g.drawImage(s.eyes, s.ox, (k === 1 ? 2 : 3) + s.oy);
      g.drawImage(s.hands, s.ox, (k === 1 ? 2 : 3) + s.oy);
      if (k === 0) { g.fillStyle = "#1a1530"; g.fillRect(42, 14, 13, 17); g.fillStyle = "#0d2b1a"; g.fillRect(43, 15, 11, 12); g.fillStyle = "#46e07a"; for (let i = 0; i < 4; i++) g.fillRect(44, 16 + i * 3, 2 + ((f + i * 3) % 8), 1); g.fillStyle = "#1a1530"; g.fillRect(47, 31, 3, 2); }
      if (k === 2) { g.fillStyle = "#ffd23f"; for (let i = 0; i < 3; i++) { const hh = 4 + ((i + (f >> 1)) % 4) * 3; g.fillRect(44 + i * 4, 33 - hh, 3, hh); g.fillStyle = "#fff0a0"; g.fillRect(44 + i * 4, 33 - hh, 3, 1); g.fillStyle = "#ffd23f"; } }
      if (k === 3) { g.fillStyle = "#ff5a4e"; g.fillRect(44, 6 - (f % 4), 9, 9); g.fillStyle = "#fff"; g.fillRect(46, 8 - (f % 4), 5, 1); g.fillRect(46, 10 - (f % 4), 5, 1); g.fillRect(46, 12 - (f % 4), 3, 1); }
      f++;
    };
    draw(); setInterval(draw, 150);
  });

  const tb = document.querySelector("#epochs tbody");
  for (let e = 0; e < 5; e++) {
    const a = e * AT.RULES.epochSize + 1, b = Math.min(AT.RULES.supply, (e + 1) * AT.RULES.epochSize);
    const p0 = AT.priceOf(a - 1);
    const p1 = AT.priceOf(b - 1);
    tb.appendChild(el("tr", { html: "<td><b>" + (e + 1) + "</b></td><td>#" + fmt.num(a) + " &ndash; #" + fmt.num(b) + "</td><td>" + fmt.eth(p0, 5) + " &rarr; " + fmt.eth(p1, 5) + " ETH</td>" }));
  }

  const tr = document.getElementById("traits");
  const sw = (cols) => { const d = el("div", { class: "sw" }); cols.forEach((c) => d.appendChild(el("i", { style: "background:" + c }))); return d; };
  const P = AT.PAL;
  const faces = (list) => {
    const d = el("div", { class: "faces" });
    list.forEach((o, i) => {
      const a = Object.assign({ id: i, job: 0, chassis: 0, glow: 0, uniform: 0, eyes: 0, head: 0, hat: 0, seat: 0, phase: 0 }, o);
      a.key = "t" + JSON.stringify(o);
      const c = el("canvas"); AT.portrait(c, a, 3); d.appendChild(c);
    });
    return d;
  };
  [
    ["12", "Chassis colors", sw(P.chassis.map((c) => AT.hex(c[1])))],
    ["8", "Eye glows", sw(P.glow.map((c) => AT.hex(c[1])))],
    ["8", "Uniforms", sw(P.uniform.map((c) => AT.hex(c[1])))],
    ["10", "Eye shapes", faces([{ eyes: 0, chassis: 11 }, { eyes: 5, chassis: 5, glow: 1 }, { eyes: 3, chassis: 1 }, { eyes: 4, chassis: 7, glow: 2 }, { eyes: 9, chassis: 2 }])],
    ["4", "Head shapes", faces([{ head: 0, chassis: 6 }, { head: 1, chassis: 8, glow: 3 }, { head: 2, chassis: 3, glow: 2 }, { head: 3, chassis: 4, glow: 5 }])],
    ["5", "Hats", faces([{ hat: 0, chassis: 9 }, { hat: 2, chassis: 10, job: 0 }, { hat: 3, chassis: 0, glow: 4 }, { hat: 4, chassis: 5, glow: 6 }, { hat: 1, job: 3, chassis: 8 }])],
    ["35", "Jobs, all equal", null],
    ["2", "Day or night", sw(["#8fd3ff", "#16143a"])]
  ].forEach(([n, l, s]) => tr.appendChild(el("div", { class: "trait px reveal in" }, [el("b", { text: n }), el("span", { text: l }), s])));
})();

(function () {
  const AT = window.AT;
  const a = document.getElementById("tokenAddr");
  if (a && AT.isAddr(AT.CFG.token)) {
    a.textContent = "Contract: " + AT.CFG.token;
    a.style.cursor = "pointer";
    a.addEventListener("click", () => { if (navigator.clipboard) navigator.clipboard.writeText(AT.CFG.token); AT.toast("Copied", "$TOWN contract address"); });
  }
})();
