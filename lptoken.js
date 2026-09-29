(function () {
  const AT = window.AT, lp = AT.lp, el = AT.el, F = lp.fmt, CFG = AT.CFG;
  const $ = (id) => document.getElementById(id);
  const addr = (new URLSearchParams(location.search).get("a") || "").trim();
  const S = { t: null, name: "", symbol: "", rates: { ethUsd: 0, townEth: 0 }, sqrtP: 0n, vol: 0n, trades: [], mode: "buy", slip: 300, balQ: null, balT: null, quote: null, unit: "usd", busy: false, town: null, fee: null };
  const qName = () => S.t && S.t.townPair ? "TOWN" : "ETH";
  const qAddr = () => S.t.townPair ? S.t.quote : lp.ZERO;
  const price = () => lp.priceOf(S.sqrtP, S.t.token0);
  const usdOf = (q) => lp.toUsd(q, S.t.townPair, S.rates);

  function paintHead() {
    const t = S.t, m = lp.meta(t.meta);
    document.title = S.name + " ($" + S.symbol + ") · Agent Town Launchpad";
    const pic = $("tkPic");
    pic.innerHTML = "";
    pic.appendChild(lp.identicon(t.token));
    lp.image(t.token).then((u) => { if (u) { pic.innerHTML = ""; pic.appendChild(el("img", { src: u, alt: S.name })); } });
    $("tkName").textContent = S.name;
    $("tkSym").textContent = "$" + S.symbol;
    const b = $("tkBadges");
    b.innerHTML = "";
    b.appendChild(el("span", { class: "badge " + (t.townPair ? "town" : "eth"), text: t.townPair ? "$TOWN pair" : "ETH pair" }));
    b.appendChild(el("span", { class: "badge", text: "Trade fee " + F.pct(S.fee.trader) }));
    b.appendChild(el("span", { class: "badge", text: "Creator fee " + F.pct(t.bps) }));
    b.appendChild(el("span", { class: "badge done", text: "LP locked forever" }));
    $("tkDesc").textContent = m.desc;
    $("tkDesc").hidden = !m.desc;
    const lr = $("tkLinks");
    lr.innerHTML = "";
    lr.appendChild(lp.linkRow(m));
    const info = $("info");
    info.innerHTML = "";
    const row = (k, v) => { info.appendChild(el("dt", { text: k })); info.appendChild(el("dd", {}, [v])); };
    row("Contract", el("span", {}, [lp.copyBtn(t.token), " ", el("a", { href: lp.explorer("address", t.token), target: "_blank", rel: "noopener", text: "↗" })]));
    row("Creator", el("a", { href: lp.explorer("address", t.creator), target: "_blank", rel: "noopener", text: AT.fmt.short(t.creator) }));
    row("Supply", document.createTextNode("1,000,000,000"));
    row("Pair", document.createTextNode(t.townPair ? "$TOWN" : "ETH"));
    row("Launched", document.createTextNode(new Date(t.createdAt * 1000).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })));
    row("Pool", document.createTextNode("Uniswap v4, all liquidity locked"));
    row("Fees", document.createTextNode("Creator " + F.pct(Math.max(0, S.fee.trader - S.fee.market)) + " · marketplace " + F.pct(S.fee.market)));
  }

  function paintStats() {
    const p = price(), cap = p * 1e9, capUsd = usdOf(cap), vq = Number(S.vol) / 1e18;
    $("stPrice").textContent = usdOf(p) ? "$" + F.sig(usdOf(p)) : F.sig(p) + " " + qName();
    $("stPriceQ").textContent = usdOf(p) ? F.sig(p) + " " + qName() : "";
    $("stCap").textContent = capUsd ? F.usd(capUsd) : F.q(cap, S.t.townPair);
    $("stCapQ").textContent = capUsd ? F.q(cap, S.t.townPair) : "";
    $("stVol").textContent = usdOf(vq) ? F.usd(usdOf(vq)) : F.q(vq, S.t.townPair);
    $("stVolQ").textContent = usdOf(vq) ? F.q(vq, S.t.townPair) : "";
    $("stTrades").textContent = AT.fmt.num(S.trades.length);
    $("stAge").textContent = "launched " + AT.fmt.ago(S.t.createdAt) + " ago";
    const pct = capUsd ? Math.min(100, capUsd / lp.HIT * 100) : 0;
    $("hitBar").style.width = Math.max(2, pct).toFixed(1) + "%";
    $("hitBar").parentElement.classList.toggle("hit", capUsd >= lp.HIT);
    $("hitPct").textContent = capUsd ? (capUsd >= lp.HIT ? "HIT!" : pct.toFixed(1) + "%") : "–";
    $("hitLabel").textContent = capUsd >= lp.HIT ? "This token is a hit" : "Road to a hit (" + F.usd(lp.HIT) + " market cap)";
  }

  async function fetchTrades() {
    const topic1 = "0x" + S.t.token.slice(2).toLowerCase().padStart(64, "0");
    let logs = null;
    if (CFG.explorer) {
      try {
        const u = CFG.explorer.replace(/\/$/, "") + "/api?module=logs&action=getLogs&fromBlock=0&toBlock=latest&address=" + lp.address + "&topic0=" + lp.TRADE_TOPIC + "&topic1=" + topic1 + "&topic0_1_opr=and";
        const j = await (await fetch(u)).json();
        if (Array.isArray(j.result)) logs = j.result.map((l) => ({ data: l.data, topics: l.topics, block: parseInt(l.blockNumber, 16), ts: parseInt(l.timeStamp, 16), tx: l.transactionHash, idx: parseInt(l.logIndex || "0x0", 16) }));
      } catch (e) {}
    }
    if (!logs) {
      logs = [];
      const latest = parseInt(await AT.rpc("eth_blockNumber", []), 16);
      const q = (from, to) => AT.rpc("eth_getLogs", [{ address: lp.address, fromBlock: "0x" + from.toString(16), toBlock: "0x" + to.toString(16), topics: [lp.TRADE_TOPIC, topic1] }]);
      let got = null;
      try { got = await q(0, latest); } catch (e) {}
      if (!got) {
        got = [];
        for (let end = latest, i = 0; i < 12 && end > 0; i++) {
          const start = Math.max(0, end - 100000);
          try { got = (await q(start, end)).concat(got); } catch (e) { break; }
          end = start - 1;
        }
      }
      const blocks = {};
      const need = [...new Set(got.map((l) => l.blockNumber))].slice(-80);
      await Promise.all(need.map(async (b) => { try { const r = await AT.rpc("eth_getBlockByNumber", [b, false]); blocks[b] = parseInt(r.timestamp, 16); } catch (e) {} }));
      logs = got.map((l) => ({ data: l.data, topics: l.topics, block: parseInt(l.blockNumber, 16), ts: blocks[l.blockNumber] || 0, tx: l.transactionHash, idx: parseInt(l.logIndex, 16) }));
    }
    logs.sort((a, b) => a.block - b.block || a.idx - b.idx);
    S.trades = logs.map((l) => {
      const d = lp.decList(["bool", "uint256", "uint256", "uint256", "uint160"], l.data);
      return { buy: d[0], q: Number(d[1]) / 1e18, tok: Number(d[2]) / 1e18, fee: Number(d[3]) / 1e18, sqrtP: d[4], trader: "0x" + l.topics[2].slice(26), ts: l.ts, tx: l.tx };
    });
  }

  function paintTrades() {
    const box = $("trades");
    box.innerHTML = "";
    if (!S.trades.length) { box.appendChild(el("div", { class: "muted-s", text: "No trades yet. Be the first!" })); return; }
    const list = S.trades.slice(-60).reverse();
    list.forEach((t) => {
      box.appendChild(el("a", { class: "trow " + (t.buy ? "b" : "s"), href: lp.explorer("tx", t.tx), target: "_blank", rel: "noopener" }, [
        el("b", { text: t.buy ? "Buy" : "Sell" }),
        el("span", { class: "q", text: F.sig(t.q, 4) + " " + qName() }),
        el("span", { class: "tk", text: F.sig(t.tok) + " " + S.symbol }),
        el("span", { class: "who", text: AT.fmt.short(t.trader) }),
        el("span", { class: "ago", text: t.ts ? AT.fmt.ago(t.ts) : "" })
      ]));
    });
  }

  function series() {
    const start = S.t.startSqrt ? lp.priceOf(S.t.startSqrt, S.t.token0) : 0;
    const pts = [];
    if (start) pts.push({ ts: S.t.createdAt, p: start });
    S.trades.forEach((t) => pts.push({ ts: t.ts || S.t.createdAt, p: lp.priceOf(t.sqrtP, S.t.token0) }));
    if (S.sqrtP) pts.push({ ts: Math.floor(Date.now() / 1000), p: price() });
    const conv = S.unit === "usd" && usdOf(1) ? usdOf(1) : 1;
    return pts.map((x) => ({ ts: x.ts, v: x.p * 1e9 * conv }));
  }

  let chartPts = [];
  function drawChart() {
    const c = $("chart"), box = c.parentElement;
    const w = box.clientWidth, h = box.clientHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = w * dpr; c.height = h * dpr; c.style.width = w + "px"; c.style.height = h + "px";
    const g = c.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    const pts = series();
    chartPts = [];
    $("chartEmpty").hidden = pts.length > 1;
    if (pts.length < 2) { $("chartEmpty").textContent = "The chart starts with the first trade."; return; }
    const L = 8, R = 72, T = 14, B = 26;
    let lo = Math.min(...pts.map((p) => p.v)), hi = Math.max(...pts.map((p) => p.v));
    if (hi === lo) { hi *= 1.05; lo *= 0.95; }
    const pad = (hi - lo) * 0.12; hi += pad; lo = Math.max(0, lo - pad);
    const t0 = pts[0].ts, t1 = Math.max(pts[pts.length - 1].ts, t0 + 1);
    const n = pts.length;
    const byIndex = (t1 - t0) < 60;
    const X = (p, i) => L + (w - L - R) * (byIndex ? i / (n - 1) : (p.ts - t0) / (t1 - t0));
    const Y = (v) => T + (h - T - B) * (1 - (v - lo) / (hi - lo));
    g.font = "16px VT323, monospace";
    g.textBaseline = "middle";
    for (let k = 0; k <= 4; k++) {
      const v = lo + (hi - lo) * k / 4, y = Math.round(Y(v)) + 0.5;
      g.strokeStyle = "rgba(189,180,230,0.18)"; g.setLineDash([4, 4]); g.beginPath(); g.moveTo(L, y); g.lineTo(w - R + 6, y); g.stroke(); g.setLineDash([]);
      g.fillStyle = "#bdb4e6"; g.fillText((S.unit === "usd" && usdOf(1) ? "$" : "") + F.sig(v, v >= 100 ? 0 : 2), w - R + 10, y);
    }
    const up = pts[n - 1].v >= pts[0].v;
    const col = up ? "#26c6b0" : "#ff5a4e";
    g.beginPath();
    pts.forEach((p, i) => { const x = X(p, i), y = Y(p.v); if (!i) g.moveTo(x, y); else { g.lineTo(x, Y(pts[i - 1].v)); g.lineTo(x, y); } chartPts.push({ x, y, p }); });
    const path = new Path2D();
    pts.forEach((p, i) => { const x = X(p, i), y = Y(p.v); if (!i) path.moveTo(x, y); else { path.lineTo(x, Y(pts[i - 1].v)); path.lineTo(x, y); } });
    const fill = new Path2D(path);
    fill.lineTo(X(pts[n - 1], n - 1), h - B); fill.lineTo(X(pts[0], 0), h - B); fill.closePath();
    const grd = g.createLinearGradient(0, T, 0, h - B);
    grd.addColorStop(0, up ? "rgba(38,198,176,0.35)" : "rgba(255,90,78,0.35)"); grd.addColorStop(1, "rgba(22,20,58,0)");
    g.fillStyle = grd; g.fill(fill);
    g.strokeStyle = col; g.lineWidth = 3; g.lineJoin = "miter"; g.stroke(path);
    const last = chartPts[chartPts.length - 1];
    g.fillStyle = col; g.fillRect(Math.round(last.x) - 4, Math.round(last.y) - 4, 8, 8);
    g.fillStyle = "#bdb4e6"; g.textBaseline = "alphabetic";
    const lab = (ts) => byIndex ? "" : new Date(ts * 1000).toLocaleString("en-US", (t1 - t0) > 172800 ? { month: "short", day: "numeric" } : { hour: "2-digit", minute: "2-digit" });
    g.fillText(lab(t0), L, h - 6);
    const e = lab(t1); g.fillText(e, w - R - g.measureText(e).width, h - 6);
  }

  function chartTip(ev) {
    const tip = $("chartTip");
    if (!chartPts.length) return;
    const r = $("chart").getBoundingClientRect();
    const x = (ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left;
    let best = chartPts[0];
    chartPts.forEach((p) => { if (Math.abs(p.x - x) < Math.abs(best.x - x)) best = p; });
    tip.hidden = false;
    tip.textContent = (S.unit === "usd" && usdOf(1) ? "$" + F.sig(best.p.v) : F.sig(best.p.v) + " " + qName()) + (best.p.ts ? " · " + new Date(best.p.ts * 1000).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "");
    tip.style.left = Math.min(r.width - tip.offsetWidth - 4, Math.max(4, best.x - tip.offsetWidth / 2)) + "px";
    tip.style.top = Math.max(4, best.y - 40) + "px";
  }

  function paintUnits() {
    const seg = $("chartUnit");
    seg.innerHTML = "";
    const opts = usdOf(1) ? [["usd", "USD"], ["q", qName()]] : [["q", qName()]];
    if (!usdOf(1)) S.unit = "q";
    opts.forEach(([v, n]) => seg.appendChild(el("button", { type: "button", class: "chip" + (S.unit === v ? " on" : ""), text: n, onclick: () => { S.unit = v; paintUnits(); drawChart(); } })));
  }

  function paintTradeBox() {
    const buy = S.mode === "buy";
    $("tabs").querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.v === S.mode));
    $("amtUnit").textContent = buy ? qName() : S.symbol;
    $("payLbl").textContent = buy ? "You pay" : "You sell";
    const bal = buy ? S.balQ : S.balT;
    $("bal").textContent = bal !== null ? "Balance " + lp.formatUnits(bal, 4) : "";
    const q = $("quick");
    q.innerHTML = "";
    const set = (v) => { $("amt").value = v; requote(); };
    if (buy) (S.t.townPair ? ["1000", "5000", "10000", "50000"] : ["0.005", "0.01", "0.05", "0.1"]).forEach((v) => q.appendChild(el("button", { type: "button", class: "chip", text: v, onclick: () => set(v) })));
    else [25, 50, 75, 100].forEach((p) => q.appendChild(el("button", { type: "button", class: "chip", text: p + "%", onclick: () => { if (S.balT) set(lp.formatUnits(S.balT * BigInt(p) / 100n, 18)); } })));
    if (buy && bal) q.appendChild(el("button", { type: "button", class: "chip", text: "Max", onclick: () => { let v = bal; if (!S.t.townPair) v = v > 300000000000000n ? v - 300000000000000n : 0n; set(lp.formatUnits(v, 18)); } }));
    const btn = $("tradeBtn");
    btn.textContent = buy ? "Buy $" + S.symbol : "Sell $" + S.symbol;
    btn.classList.toggle("teal", buy); btn.classList.toggle("red", !buy);
    $("slip").textContent = F.pct(S.slip);
    $("tradeNote").textContent = "Includes a " + F.pct(S.fee.trader) + " trade fee. Liquidity is locked forever, nobody can pull it.";
  }

  let qTimer = 0, qSeq = 0;
  function requote() { clearTimeout(qTimer); qTimer = setTimeout(runQuote, 280); }
  async function runQuote() {
    const amt = lp.parseUnits($("amt").value);
    const seq = ++qSeq;
    S.quote = null;
    const buy = S.mode === "buy";
    if (amt === 0n) { $("recv").textContent = "–"; $("feeLine").textContent = "–"; $("impact").textContent = "–"; return; }
    $("recv").textContent = "…";
    try {
      const r = await lp.quote(S.t.token, buy, amt);
      if (seq !== qSeq) return;
      S.quote = { amt, out: r.out, fee: r.fee, buy };
      $("recv").textContent = buy ? F.tok(r.out) + " " + S.symbol : lp.formatUnits(r.out, 6) + " " + qName();
      $("feeLine").textContent = lp.formatUnits(r.fee, 6) + " " + qName();
      const before = price(), after = lp.priceOf(r.sqrtAfter, S.t.token0);
      const imp = before ? Math.abs(after / before - 1) * 100 : 0;
      const ie = $("impact");
      ie.textContent = imp < 0.01 ? "<0.01%" : imp.toFixed(2) + "%";
      ie.className = imp > 10 ? "bad" : "";
    } catch (e) {
      if (seq === qSeq) { $("recv").textContent = "Too large"; }
    }
  }

  async function loadBalances() {
    const W = AT.wallet;
    if (!W.account) { S.balQ = S.balT = null; paintTradeBox(); $("myFees").hidden = true; return; }
    try {
      const [bq, bt] = await Promise.all([
        S.t.townPair ? lp.erc20.balanceOf(S.t.quote, W.account) : AT.rpc("eth_getBalance", [W.account, "latest"]).then(BigInt),
        lp.erc20.balanceOf(S.t.token, W.account)
      ]);
      S.balQ = bq; S.balT = bt;
    } catch (e) {}
    paintTradeBox();
    try {
      const pend = await lp.pending(W.account, qAddr());
      const box = $("myFees");
      const isCreator = W.account.toLowerCase() === S.t.creator.toLowerCase();
      box.hidden = !(pend > 0n || isCreator);
      $("myFeesT").textContent = isCreator ? "You created this token. Fees from all your " + qName() + " pair tokens collect here." : "Fees from your launches collect here.";
      const rows = $("myFeeRows");
      rows.innerHTML = "";
      rows.appendChild(el("div", { class: "fee-row" }, [
        el("b", { text: lp.formatUnits(pend, 6) + " " + qName() }),
        (() => { const cb = el("button", { class: "btn small teal", type: "button", text: "Claim", onclick: async (e) => { e.target.disabled = true; try { await W.txFlow("Claim fees", lp.address, lp.claimData(qAddr())); } catch (x) {} loadBalances(); } }); cb.disabled = pend === 0n; return cb; })()
      ]));
    } catch (e) {}
  }

  async function trade() {
    if (S.busy) return;
    const W = AT.wallet;
    const amt = lp.parseUnits($("amt").value);
    if (amt === 0n) { AT.toast("Enter an amount", "", "bad"); $("amt").focus(); return; }
    const buy = S.mode === "buy";
    S.busy = true; $("tradeBtn").disabled = true;
    try {
      if (!W.account) { await W.connect(); if (!W.account) throw null; await loadBalances(); }
      if (!W.chainOk) await W.ensureChain();
      const bal = buy ? S.balQ : S.balT;
      if (bal !== null && amt > bal) { AT.toast("Not enough balance", "You have " + lp.formatUnits(bal, 6) + " " + (buy ? qName() : S.symbol) + ".", "bad"); throw null; }
      const q = await lp.quote(S.t.token, buy, amt);
      const min = q.out * BigInt(10000 - S.slip) / 10000n;
      const spend = buy ? (S.t.townPair ? S.t.quote : null) : S.t.token;
      if (spend) {
        const al = await lp.erc20.allowance(spend, W.account, lp.address);
        if (al < amt) await W.txFlow("Approve " + (buy ? "$TOWN" : "$" + S.symbol), spend, lp.erc20.approveData(lp.address));
      }
      if (buy) await W.txFlow("Buy $" + S.symbol, lp.address, lp.buyData(S.t.token, amt, min), S.t.townPair ? 0n : amt);
      else await W.txFlow("Sell $" + S.symbol, lp.address, lp.sellData(S.t.token, amt, min));
      $("amt").value = "";
      runQuote();
      await refresh(true);
    } catch (e) {}
    S.busy = false; $("tradeBtn").disabled = false;
  }

  async function refresh(full) {
    const [sp, vol] = await Promise.all([lp.sqrtPrice(S.t.token), lp.volume(S.t.token)]);
    const changed = sp !== S.sqrtP || full;
    S.sqrtP = sp; S.vol = vol;
    if (changed) { try { await fetchTrades(); } catch (e) {} paintTrades(); }
    paintStats();
    drawChart();
    loadBalances();
  }

  async function init() {
    if (!lp.ready) { $("tkName").textContent = "The launchpad opens soon."; return; }
    if (!AT.isAddr(addr)) { $("tkHead").hidden = true; $("tkMissing").hidden = false; return; }
    const t = await lp.launch(addr);
    if (!t) { $("tkHead").hidden = true; $("tkMissing").hidden = false; return; }
    S.t = t;
    const [nm, sy, fee, rates, st] = await Promise.all([
      lp.read(addr, "name()", [], [], ["string"]).then((r) => r[0]),
      lp.read(addr, "symbol()", [], [], ["string"]).then((r) => r[0]),
      lp.feeBps(addr),
      lp.rates(),
      lp.settings()
    ]);
    S.name = nm; S.symbol = sy; S.fee = fee; S.rates = rates;
    const cap = t.townPair ? st.townCap : st.ethCap;
    if (cap > 0n) { const px = Number(cap) / 1e27; const raw = t.token0 ? px : 1 / px; t.startSqrt = BigInt(Math.floor(Math.sqrt(raw) * 2 ** 96)); }
    $("tkGrid").hidden = false;
    paintHead();
    paintUnits();
    paintTradeBox();
    await refresh(true);
    setInterval(() => { if (!document.hidden && !S.busy) refresh(false).catch(() => {}); }, 15000);
  }

  document.addEventListener("DOMContentLoaded", () => {
    $("tabs").addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; S.mode = b.dataset.v; $("amt").value = ""; paintTradeBox(); runQuote(); });
    $("amt").addEventListener("input", requote);
    $("tradeBtn").addEventListener("click", trade);
    $("slip").addEventListener("click", () => { const o = [100, 300, 500, 1000, 2000]; S.slip = o[(o.indexOf(S.slip) + 1) % o.length]; $("slip").textContent = F.pct(S.slip); });
    const c = $("chart");
    c.addEventListener("mousemove", chartTip);
    c.addEventListener("touchmove", chartTip, { passive: true });
    c.addEventListener("mouseleave", () => { $("chartTip").hidden = true; });
    window.addEventListener("resize", () => { if (S.t) drawChart(); });
    window.addEventListener("at:wallet", () => { if (S.t) loadBalances(); });
    init().catch((e) => { $("tkName").textContent = "Could not load this token."; AT.toast("Network", AT.niceError(e), "bad"); });
  });
})();
