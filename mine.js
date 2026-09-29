(function () {
  const AT = window.AT, el = AT.el, fmt = AT.fmt, W = AT.wallet;
  const $ = (id) => document.getElementById(id);
  const PROBE = "0x4360019003804060205260005260406000f3";
  const HIRED = "0x" + Array.from(Keccak.keccak256(new TextEncoder().encode("Hired(address,uint256,uint256,bytes32,uint256)")), (b) => b.toString(16).padStart(2, "0")).join("");
  const hw = Math.max(1, Math.min(8, (navigator.hardwareConcurrency || 4)));
  let threads = Math.max(1, hw - 1);
  let workers = [], running = false, jobId = 0, job = null, rates = {}, tried = 0, ms = null, t0 = 0, poll = null, blockPoll = null;

  const tc = $("threads");
  const chips = [];
  for (let i = 1; i <= hw; i++) {
    const b = el("button", { class: "chip" + (i === threads ? " on" : ""), type: "button", text: String(i), onclick: () => { threads = i; chips.forEach((c) => c.classList.toggle("on", c === b)); if (running) { spawn(); postJob(); } } });
    chips.push(b); tc.appendChild(b);
  }

  function log(t, cls) {
    const box = $("log");
    box.appendChild(el("div", { class: cls || "", text: "> " + t }));
    while (box.children.length > 80) box.firstChild.remove();
    box.scrollTop = box.scrollHeight;
  }
  function status(t) { $("status").lastChild.textContent = t; }

  const reel = Array.from(document.querySelectorAll("#reel canvas")).map((c) => { c.width = 48; c.height = 48; return c.getContext("2d"); });
  const rj = [3, 17, 26];
  let rt = 0;
  AT.loadAtlas().then(() => reel.forEach((g, i) => AT.drawScene(g, rj[i], 0, false)));
  setInterval(() => {
    rt++;
    const speed = running ? 1 : 6;
    if (rt % speed === 0) {
      if (running) { rj[0] = (rj[0] + 3) % 35; rj[1] = (rj[1] + 7) % 35; rj[2] = (rj[2] + 11) % 35; }
    }
    reel.forEach((g, i) => AT.drawScene(g, rj[i], (rt + i * 3) & 7, ((rt + i * 11) % 34) < 2));
  }, 130);

  function bits(t) { return t > 0n ? 256 - t.toString(2).length : 256; }
  function paintState() {
    if (AT.PREVIEW) {
      $("mPrice").textContent = "0.001 ETH";
      $("mEpoch").textContent = "1 / 5";
      $("mDiff").textContent = "22 bits";
      $("mLast").textContent = "Soon";
      $("mHired").textContent = "0 / 6,385 hired";
      $("mLeft").textContent = "Hiring opens soon";
      return;
    }
    if (!ms) return;
    $("mPrice").textContent = fmt.eth(ms.price, 5) + " ETH";
    $("mEpoch").textContent = (ms.epoch + 1) + " / 5";
    $("mDiff").textContent = bits(ms.target) + " bits";
    $("mLast").textContent = ms.lastMint ? fmt.ago(ms.lastMint) + " ago" : "–";
    $("mHired").textContent = fmt.num(ms.minted) + " / 6,385 hired";
    $("mLeft").textContent = fmt.num(6385 - ms.minted) + " jobs open";
    $("mBar").style.width = (ms.minted / 6385 * 100).toFixed(2) + "%";
  }

  function spawn() {
    workers.forEach((w) => w.terminate());
    workers = []; rates = {};
    for (let i = 0; i < threads; i++) {
      const w = new Worker("worker.js");
      w.onmessage = (e) => onWorker(i, e.data);
      workers.push(w);
    }
  }
  function postJob() {
    if (!job) return;
    workers.forEach((w) => w.postMessage(Object.assign({ type: "job" }, job)));
  }
  function stopWorkers() { workers.forEach((w) => w.postMessage({ type: "stop" })); }

  let rateTimer = null;
  function paintRate() {
    const r = Object.values(rates).reduce((a, b) => a + b, 0);
    $("mRate").textContent = r > 1e6 ? (r / 1e6).toFixed(2) + " MH/s" : Math.round(r / 1000) + " kH/s";
    $("mTried").textContent = tried > 1e6 ? (tried / 1e6).toFixed(1) + "M" : fmt.num(tried);
    if (job && r > 0) {
      const exp = Math.pow(2, bits(BigInt(job.target)));
      const sec = exp / r;
      $("mLeft").textContent = "Luck estimate: ~" + (sec < 90 ? Math.round(sec) + "s" : sec < 5400 ? Math.round(sec / 60) + " min" : Math.round(sec / 3600) + " h");
    }
  }

  function onWorker(i, d) {
    if (d.type === "rate") { rates[i] = d.hashes / d.ms * 1000; tried += d.hashes; return; }
    if (d.type === "found" && d.id === jobId && running) { if (AT.PREVIEW) testFound(d); else found(d); }
  }

  function hexToBytes(h) { h = h.replace(/^0x/, ""); return new Uint8Array(h.match(/../g).map((x) => parseInt(x, 16))); }
  function verify(d) {
    const msg = new Uint8Array(116);
    msg.set(hexToBytes(job.miner), 0); msg.set(hexToBytes(d.nonce), 20); msg.set(hexToBytes(job.lastWork), 52); msg.set(hexToBytes(job.bh), 84);
    const h = "0x" + Array.from(Keccak.keccak256(msg), (b) => b.toString(16).padStart(2, "0")).join("");
    return h === d.hash && BigInt(h) <= BigInt(job.target);
  }

  async function probe() {
    const r = await AT.rpc("eth_call", [{ data: PROBE }, "latest"]);
    const [bn, bh] = AT.abi.decode(["uint256", "bytes32"], r);
    return { bn: Number(bn), bh };
  }

  async function refresh(force) {
    const prev = ms;
    ms = await AT.town.miningState();
    paintState();
    if (!running) return;
    if (!ms.started) { stop("Hiring has not started yet."); return; }
    if (ms.minted >= 6385) { stop("All agents are hired!"); return; }
    if (force || !prev || prev.lastWork !== ms.lastWork || prev.target !== ms.target) {
      if (prev && prev.lastWork !== ms.lastWork) log("Someone hired agent #" + ms.minted + ". New puzzle.", "y");
      await newJob();
    }
  }
  async function newJob() {
    const b = await probe();
    jobId++;
    job = { id: jobId, miner: W.account, lastWork: ms.lastWork, bh: b.bh, bn: b.bn, target: "0x" + ms.target.toString(16).padStart(64, "0") };
    log("Block " + fmt.num(b.bn) + " · target " + bits(ms.target) + " bits", "c");
    postJob();
  }

  async function start() {
    if (running) return;
    if (AT.PREVIEW) return testRun();
    if (!W.account) { await W.connect(); if (!W.account) return; }
    running = true; tried = 0; t0 = performance.now();
    $("go").textContent = "Stop mining";
    status("Mining");
    spawn();
    try { await refresh(true); } catch (e) { log("Network error: " + AT.niceError(e), "r"); stop(); return; }
    if (!running) return;
    poll = setInterval(() => refresh(false).catch(() => {}), 4000);
    blockPoll = setInterval(async () => { if (!running || !job) return; try { const b = await probe(); if (b.bn - job.bn > 60) { await newJob(); } } catch (e) {} }, 15000);
    rateTimer = setInterval(paintRate, 500);
  }
  function stop(msg) {
    running = false;
    clearInterval(poll); clearInterval(blockPoll); clearInterval(rateTimer);
    workers.forEach((w) => w.terminate()); workers = []; rates = {};
    $("go").textContent = AT.PREVIEW ? "Test my machine" : "Start mining";
    status(msg ? "Stopped" : "Ready");
    if (msg) log(msg, "y");
    paintRate();
  }

  async function found(d) {
    stopWorkers();
    if (!verify(d)) { log("Bad result, retrying.", "r"); postJob(); return; }
    const secs = ((performance.now() - t0) / 1000).toFixed(1);
    log("Found! " + d.hash.slice(0, 18) + "… after " + secs + "s", "y");
    status("Found!");
    try {
      const now = await AT.town.miningState();
      if (now.lastWork !== job.lastWork) { log("Too late, someone hired first. Mining again.", "y"); ms = now; await newJob(); return; }
      const data = AT.abi.calldata("mint(uint256,uint256)", ["uint256", "uint256"], [BigInt(d.nonce), d.bn]);
      status("Confirm in wallet");
      const rc = await W.txFlow("Hire agent", AT.CFG.town, data, now.price);
      const lg = (rc.logs || []).find((l) => l.topics && l.topics[0] === HIRED);
      const id = lg ? Number(BigInt(lg.topics[2])) : null;
      stop();
      celebrate(id);
      loadHires();
    } catch (e) {
      log("Not hired: " + AT.niceError(e), "r");
      if (running) { status("Mining"); try { await refresh(true); } catch (err) {} }
    }
  }

  async function testRun() {
    running = true; tried = 0; t0 = performance.now();
    $("go").textContent = "Stop";
    status("Test run");
    log("Test run. Hiring is not open yet, so nothing is sent.", "y");
    spawn();
    const rnd = () => "0x" + Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, "0")).join("");
    jobId++;
    job = { id: jobId, miner: W.account || rnd().slice(0, 42), lastWork: rnd(), bh: rnd(), bn: 1, target: "0x" + ((1n << 234n) - 1n).toString(16).padStart(64, "0") };
    postJob();
    rateTimer = setInterval(paintRate, 500);
  }
  function testFound(d) {
    if (!verify(d)) return;
    const secs = ((performance.now() - t0) / 1000).toFixed(1);
    log("Found " + d.hash.slice(0, 18) + "\u2026 in " + secs + "s. Your machine is ready.", "y");
    stop();
    celebrate(null, true);
  }

  function celebrate(id, test) {
    const box = el("div", { class: "win" });
    const c = el("canvas", { width: 48, height: 48 });
    const job = id ? null : Math.floor(Math.random() * 35);
    const inner = el("div", { class: "box px-drop" }, [
      el("span", { class: "tag", html: "<i></i>" + (test ? "Test run" : "New hire") }),
      el("h2", { text: test ? "You found one!" : "Welcome, #" + (id || "?") }),
      c,
      el("p", { text: test ? "Your browser can mine. When hiring opens, this hash would hire a new agent." : "Your agent is ready. Put it to work to start earning salary." }),
      el("div", { class: "cta" }, [
        test ? el("button", { class: "btn small", type: "button", text: "Nice!", onclick: () => box.remove() }) : el("a", { class: "btn small red", href: "agents", text: "Put it to work" }),
        el("button", { class: "btn small paper", type: "button", text: test ? "Close" : "Keep mining", onclick: () => { box.remove(); if (!test) start(); } })
      ])
    ]);
    box.appendChild(inner);
    box.addEventListener("click", (e) => { if (e.target === box) box.remove(); });
    document.body.appendChild(box);
    const g = c.getContext("2d");
    let f = 0, shownJob = job === null ? 0 : job;
    const iv = setInterval(() => { if (!document.body.contains(box)) { clearInterval(iv); return; } AT.drawScene(g, shownJob, f & 7, (f % 30) < 2); f++; }, 140);
    if (id && !AT.PREVIEW) AT.town.workforce(id, id).then((w) => { if (w[0]) shownJob = AT.decodeAgent(w[0]).job; }).catch(() => {});
    confetti();
  }

  function confetti() {
    const cv = el("canvas", { class: "confetti" });
    document.body.appendChild(cv);
    cv.width = innerWidth; cv.height = innerHeight;
    const g = cv.getContext("2d");
    const cols = ["#ffd23f", "#ff5a4e", "#26c6b0", "#8b5cf6", "#fff3d6"];
    const ps = Array.from({ length: 140 }, () => ({ x: Math.random() * cv.width, y: -Math.random() * cv.height * 0.5, v: 2 + Math.random() * 4, s: 6 + Math.floor(Math.random() * 3) * 3, c: cols[Math.floor(Math.random() * 5)], w: Math.random() * 6 }));
    let n = 0;
    const tick = () => {
      g.clearRect(0, 0, cv.width, cv.height);
      ps.forEach((p) => { p.y += p.v; p.x += Math.sin((p.y + p.w * 40) / 30) * 1.5; g.fillStyle = p.c; g.fillRect(Math.round(p.x / 3) * 3, Math.round(p.y / 3) * 3, p.s, p.s); });
      if (++n < 170) requestAnimationFrame(tick); else cv.remove();
    };
    tick();
  }

  async function loadHires() {
    const box = $("hires");
    box.innerHTML = "";
    let list = [];
    if (AT.PREVIEW) list = AT.demoTown(8, 0);
    else {
      try {
        const m = ms || await AT.town.miningState();
        if (m.minted > 0) { const w = await AT.town.workforce(Math.max(1, m.minted - 7), m.minted); list = w.filter((v) => v > 0n).map(AT.decodeAgent).reverse(); }
      } catch (e) {}
    }
    if (!list.length) { box.appendChild(el("p", { text: "No hires yet. Be the first!" })); return; }
    list.forEach((a) => { const c = el("canvas"); AT.portrait(c, a, 4); box.appendChild(el("div", { class: "hire" }, [c, el("b", { text: "#" + a.id }), el("span", { text: AT.JOBS[a.job].name })])); });
  }

  $("go").addEventListener("click", () => running ? stop() : start());
  if (!AT.PREVIEW && AT.isAddr(AT.CFG.buyback)) {
    $("bbBox").hidden = false;
    const bbBtn = el("button", { class: "btn small teal", type: "button", text: "Run buy & burn", hidden: "hidden", onclick: async () => { try { await W.txFlow("Buy & burn", AT.CFG.buyback, AT.abi.calldata("autoBuy()")); paintBB(); } catch (e) {} } });
    $("go").parentElement.appendChild(bbBtn);
    let bbOwner = null;
    const bbAdmin = async () => {
      try { if (!bbOwner) bbOwner = (await AT.call(AT.CFG.buyback, "owner()", [], [], ["address"]))[0]; } catch (e) {}
      bbBtn.hidden = !(W.account && bbOwner && W.account.toLowerCase() === bbOwner.toLowerCase());
    };
    window.addEventListener("at:wallet", bbAdmin);
    bbAdmin();
    const paintBB = () => AT.town.buybackQueue().then((v) => { $("mBB").textContent = fmt.eth(v, 5) + " ETH"; }).catch(() => {});
    paintBB(); setInterval(paintBB, 20000);
  }
  if (AT.PREVIEW) { $("go").textContent = "Test my machine"; document.querySelector("#hires").previousElementSibling.textContent = "Sample agents"; }
  paintState();
  loadHires();
  if (AT.PREVIEW) { log("Hiring opens soon. Press Start for a test run of your machine.", "c"); }
  else AT.town.miningState().then((m) => { ms = m; paintState(); log(m.started ? "Hiring is open. Connect and press Start." : "Hiring has not started yet.", "c"); }).catch(() => log("Could not reach the chain.", "r"));
  window.addEventListener("beforeunload", () => workers.forEach((w) => w.terminate()));
})();
