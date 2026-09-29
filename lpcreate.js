(function () {
  const AT = window.AT, lp = AT.lp, el = AT.el, F = lp.fmt;
  const $ = (id) => document.getElementById(id);
  const MAX_IMG = 20000;
  const S = { settings: null, rates: { ethUsd: 0, townEth: 0 }, img: null, imgUrl: null, pair: "eth", bal: null, preview: null, busy: false };
  const LAUNCHED = "0x" + Array.from(Keccak.keccak256(new TextEncoder().encode("Launched(address,address,address,uint256,string,string)")), (b) => b.toString(16).padStart(2, "0")).join("");

  const fixUrl = (v) => { v = String(v || "").trim(); if (!v) return ""; if (!/^https?:\/\//i.test(v)) v = "https://" + v; return v.replace(/^http:/i, "https:"); };
  const bps = () => Math.round(Number($("fFee").value) * 100);
  const town = () => S.pair === "town";

  function metaJson() {
    const m = {};
    const d = $("fDesc").value.trim(); if (d) m.d = d;
    [["x", "lX"], ["tg", "lTg"], ["dc", "lDc"], ["web", "lWeb"], ["post", "lPost"]].forEach(([k, id]) => { const u = fixUrl($(id).value); if (u) m[k] = u; });
    return JSON.stringify(m);
  }

  async function shrink(file) {
    const raw = new Uint8Array(await file.arrayBuffer());
    const kind = lp.sniff(raw);
    if (!kind) throw new Error("Please use a PNG, JPG, GIF or WEBP image.");
    if (raw.length <= MAX_IMG) return { bytes: raw, type: kind, note: kind === "image/gif" ? "Kept as is. Animation stays." : "Kept as is." };
    const url = URL.createObjectURL(file);
    const im = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("Could not read this image.")); i.src = url; });
    URL.revokeObjectURL(url);
    const side = Math.min(im.naturalWidth, im.naturalHeight);
    const sx = (im.naturalWidth - side) / 2, sy = (im.naturalHeight - side) / 2;
    const c = document.createElement("canvas");
    const g = c.getContext("2d");
    const webp = c.toDataURL && document.createElement("canvas").toDataURL("image/webp").startsWith("data:image/webp");
    const fmts = webp ? ["image/webp", "image/jpeg"] : ["image/jpeg"];
    for (const size of [256, 224, 192, 160, 128, 96, 64]) {
      const d = Math.min(size, side);
      c.width = c.height = d;
      g.imageSmoothingQuality = "high";
      g.fillStyle = "#ffffff"; g.fillRect(0, 0, d, d);
      g.drawImage(im, sx, sy, side, side, 0, 0, d, d);
      for (const fm of fmts) {
        for (const q of [0.9, 0.8, 0.7, 0.6, 0.5, 0.4]) {
          const blob = await new Promise((r) => c.toBlob(r, fm, q));
          if (blob && blob.size <= MAX_IMG) return { bytes: new Uint8Array(await blob.arrayBuffer()), type: fm, note: "Resized to " + d + "×" + d + "." + (kind === "image/gif" ? " GIF animation is only kept for files under 20 KB." : "") };
        }
      }
    }
    throw new Error("This image is too detailed. Try a simpler one.");
  }

  function feeSplit() {
    const b = bps();
    let trader, creator, market;
    if (town()) { trader = b + 200; creator = b; market = 200; }
    else { const c = Math.max(b, 300); trader = c + 200; creator = c - 300; market = 500; }
    return { trader, creator, market };
  }

  function paintFee() {
    const f = feeSplit();
    $("feeVal").textContent = F.pct(bps());
    const box = $("feeSplit");
    box.innerHTML = "";
    [["Traders pay", f.trader, "t"], ["You earn", f.creator, "c"], ["Marketplace", f.market, "m"]].forEach(([n, v, k]) => box.appendChild(el("div", { class: "fs " + k }, [el("span", { text: n }), el("b", { text: F.pct(v) })])));
    const note = town() ? "on every buy and sell." : (bps() < 300 ? "ETH pairs: the marketplace takes the first 3% of the creator fee, so below 3% you earn nothing." : "on every buy and sell. The marketplace takes the first 3% of the creator fee on ETH pairs.");
    box.appendChild(el("small", { text: note }));
  }

  function capText(p) {
    if (!S.settings) return "";
    const cap = p === "town" ? S.settings.townCap : S.settings.ethCap;
    if (p === "town" && cap === 0n) return "Opens soon";
    const q = Number(cap) / 1e18;
    const usd = lp.toUsd(q, p === "town", S.rates);
    return "Starts at " + F.q(q, p === "town") + " market cap" + (usd ? " (" + F.usd(usd) + ")" : "");
  }

  function paintPairs() {
    $("ethCapT").textContent = capText("eth");
    $("townCapT").textContent = capText("town");
    const townOk = S.settings && S.settings.townCap > 0n;
    const tb = $("pairs").querySelector('[data-v="town"]');
    tb.disabled = !townOk;
    $("pairs").querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.v === S.pair));
    $("buyUnit").textContent = town() ? "TOWN" : "ETH";
    const q = $("quickBuy");
    q.innerHTML = "";
    (town() ? ["1000", "5000", "10000", "50000"] : ["0.01", "0.05", "0.1", "0.25"]).forEach((v) => q.appendChild(el("button", { type: "button", class: "chip", text: v, onclick: () => { $("fBuy").value = v; onBuy(); } })));
  }

  let pvTimer = 0, pvSeq = 0;
  function onBuy() {
    clearTimeout(pvTimer);
    pvTimer = setTimeout(runPreview, 250);
  }
  async function runPreview() {
    const amt = lp.parseUnits($("fBuy").value);
    const info = $("buyInfo");
    info.classList.remove("bad");
    S.preview = null;
    if (!S.settings || amt === 0n) { info.textContent = "Buy before anyone else, in the same transaction."; paintSummary(); return; }
    const seq = ++pvSeq;
    try {
      const r = await lp.preview(town(), bps(), amt);
      if (seq !== pvSeq) return;
      S.preview = r;
      const pct = Number(r.out * 10000n / lp.SUPPLY) / 100;
      if (r.out > lp.SUPPLY / 5n) { info.textContent = "That buys " + pct.toFixed(2) + "% of the supply. The limit is 20%."; info.classList.add("bad"); }
      else info.textContent = "You get about " + F.tok(r.out) + " tokens (" + pct.toFixed(2) + "% of supply).";
      if (S.bal !== null && amt > S.bal) { info.textContent += " Your balance is too low."; info.classList.add("bad"); }
    } catch (e) { if (seq === pvSeq) info.textContent = "Could not preview this amount."; }
    paintSummary();
  }

  function paintPreview() {
    const name = $("fName").value.trim() || "Your token";
    const sym = ($("fSym").value.trim() || "TICKER").toUpperCase();
    const box = $("pv");
    box.innerHTML = "";
    const c = el("div", { class: "tcard px-drop static" });
    const pic = el("div", { class: "tpic" });
    if (S.imgUrl) pic.appendChild(el("img", { src: S.imgUrl, alt: "" })); else pic.appendChild(el("span", { class: "noimg", text: "?" }));
    c.appendChild(pic);
    const cap = S.settings ? Number(town() ? S.settings.townCap : S.settings.ethCap) / 1e18 : 0;
    const usd = lp.toUsd(cap, town(), S.rates);
    c.appendChild(el("div", { class: "tbody" }, [
      el("h3", {}, [el("span", { class: "nm", text: name }), el("small", { text: "$" + sym })]),
      el("div", { class: "tbadges" }, [el("span", { class: "badge " + (town() ? "town" : "eth"), text: town() ? "$TOWN pair" : "ETH pair" }), el("span", { class: "badge", text: "Fee " + F.pct(bps()) }), el("span", { class: "badge idle", text: "new" })]),
      el("div", { class: "tmc" }, [el("span", { text: "Market cap" }), el("b", { text: usd ? F.usd(usd) : F.q(cap, town()) })]),
      el("div", { class: "hitbar" }, [el("i", { style: "width:" + Math.max(2, Math.min(100, usd / lp.HIT * 100)).toFixed(1) + "%" })])
    ]));
    box.appendChild(c);
    const m = lp.meta(metaJson());
    if (m.desc) box.appendChild(el("p", { class: "pv-desc", text: m.desc }));
    const lr = lp.linkRow(m);
    if (lr.childNodes.length) box.appendChild(lr);
  }

  function paintSummary() {
    const f = feeSplit();
    const cap = S.settings ? Number(town() ? S.settings.townCap : S.settings.ethCap) / 1e18 : 0;
    const usd = lp.toUsd(cap, town(), S.rates);
    const amt = lp.parseUnits($("fBuy").value);
    const rows = [
      ["Supply", "1,000,000,000"],
      ["Start market cap", cap ? F.q(cap, town()) + (usd ? " · " + F.usd(usd) : "") : "–"],
      ["Liquidity", "100% in the pool, locked forever"],
      ["Trade fee", F.pct(f.trader) + " per buy and sell"],
      ["You earn", F.pct(f.creator) + " of every trade"],
      ["First buy", amt > 0n ? lp.formatUnits(amt, 6) + (town() ? " TOWN" : " ETH") + (S.preview ? " → " + F.tok(S.preview.out) + " tokens" : "") : "None"],
      ["You pay", (amt > 0n ? lp.formatUnits(amt, 6) + (town() ? " TOWN" : " ETH") + " + " : "") + "gas"]
    ];
    const dl = $("sum");
    dl.innerHTML = "";
    rows.forEach(([k, v]) => { dl.appendChild(el("dt", { text: k })); dl.appendChild(el("dd", { text: v })); });
  }

  async function loadBal() {
    const W = AT.wallet;
    S.bal = null;
    if (!W.account || !S.settings) return;
    try {
      S.bal = town() ? await lp.erc20.balanceOf(S.settings.town, W.account) : BigInt(await AT.rpc("eth_getBalance", [W.account, "latest"]));
      $("buyInfo").dataset.bal = lp.formatUnits(S.bal, 4);
    } catch (e) {}
  }

  function counters() {
    document.querySelectorAll(".cnt").forEach((c) => { const i = $(c.dataset.for); c.textContent = new TextEncoder().encode(i.value).length + "/" + i.maxLength; });
  }

  function fail(msg, id) {
    AT.toast("Check the form", msg, "bad");
    if (id) { const x = $(id); x.focus(); x.classList.add("err"); setTimeout(() => x.classList.remove("err"), 1600); }
    return null;
  }

  function collect() {
    const name = $("fName").value.trim();
    const symbol = $("fSym").value.trim().toUpperCase();
    const enc = (s) => new TextEncoder().encode(s).length;
    if (!name) return fail("Give your token a name.", "fName");
    if (enc(name) > 32) return fail("The name is too long.", "fName");
    if (!symbol) return fail("Give your token a symbol.", "fSym");
    if (enc(symbol) > 12) return fail("The symbol is too long.", "fSym");
    for (const id of ["lX", "lTg", "lDc", "lWeb", "lPost"]) { const u = fixUrl($(id).value); if (u && !/^https:\/\/[^\s"'<>]+\.[^\s"'<>]+$/i.test(u)) return fail("This link does not look right.", id); }
    const meta = metaJson();
    if (enc(meta) > 1200) return fail("Description and links are too long together.", "fDesc");
    const buyAmount = lp.parseUnits($("fBuy").value);
    if ($("fBuy").value.trim() && buyAmount === 0n && Number($("fBuy").value) !== 0) return fail("Enter a valid amount.", "fBuy");
    if (town() && !(S.settings.townCap > 0n)) return fail("$TOWN pairs are not open yet.");
    return { name, symbol, townPair: town(), bps: bps(), image: S.img ? S.img.bytes : new Uint8Array(0), meta, buyAmount };
  }

  async function submit(e) {
    e.preventDefault();
    if (S.busy) return;
    if (!lp.ready) { AT.toast("Not open yet", "The launchpad opens soon.", "bad"); return; }
    const a = collect();
    if (!a) return;
    const W = AT.wallet;
    const btn = $("go");
    S.busy = true; btn.disabled = true;
    try {
      if (!W.account) { await W.connect(); if (!W.account) throw new Error("Wallet not connected"); }
      if (!W.chainOk) await W.ensureChain();
      if (S.settings.paused) { AT.toast("Not launched", "New launches are paused.", "bad"); throw null; }
      a.minTokens = 0n;
      if (a.buyAmount > 0n) {
        const pv = await lp.preview(a.townPair, a.bps, a.buyAmount);
        if (pv.out > lp.SUPPLY / 5n) { fail("Your first buy is above 20% of the supply. Lower the amount.", "fBuy"); throw null; }
        const have = a.townPair ? await lp.erc20.balanceOf(S.settings.town, W.account) : BigInt(await AT.rpc("eth_getBalance", [W.account, "latest"]));
        if (have < a.buyAmount) { fail("Your balance is too low for this first buy.", "fBuy"); throw null; }
        a.minTokens = pv.out * 97n / 100n;
        if (a.townPair) {
          const al = await lp.erc20.allowance(S.settings.town, W.account, lp.address);
          if (al < a.buyAmount) await W.txFlow("Approve $TOWN", S.settings.town, lp.erc20.approveData(lp.address));
        }
      }
      const r = await W.txFlow("Launch " + a.symbol, lp.address, lp.launchData(a), a.townPair ? 0n : a.buyAmount);
      const log = (r.logs || []).find((l) => l.topics && l.topics[0] && l.topics[0].toLowerCase() === LAUNCHED);
      const token = log ? "0x" + log.topics[1].slice(26) : null;
      if (token) {
        AT.toast("Your token is live!", "Opening its page…");
        setTimeout(() => { location.href = "token?a=" + token; }, 900);
      } else location.href = "launchpad";
    } catch (err) {}
    S.busy = false; btn.disabled = false;
  }

  document.addEventListener("DOMContentLoaded", async () => {
    const f = $("cform");
    f.addEventListener("submit", submit);
    f.addEventListener("input", (e) => {
      if (e.target.id === "fSym") { const p = e.target.selectionStart; e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9$._-]/g, ""); try { e.target.setSelectionRange(p, p); } catch (x) {} }
      if (e.target.id === "fFee") { paintFee(); onBuy(); }
      if (e.target.id === "fBuy") onBuy();
      counters(); paintPreview(); paintSummary();
    });
    $("pairs").addEventListener("click", async (e) => {
      const b = e.target.closest("button"); if (!b || b.disabled) return;
      S.pair = b.dataset.v;
      $("fBuy").value = "";
      paintPairs(); paintFee(); paintPreview(); paintSummary(); onBuy();
      await loadBal();
    });
    $("file").addEventListener("change", async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      $("imgInfo").textContent = "Shrinking…";
      try {
        const r = await shrink(file);
        S.img = r;
        if (S.imgUrl) URL.revokeObjectURL(S.imgUrl);
        S.imgUrl = URL.createObjectURL(new Blob([r.bytes], { type: r.type }));
        $("dropPic").innerHTML = "";
        $("dropPic").appendChild(el("img", { src: S.imgUrl, alt: "" }));
        $("imgInfo").textContent = (r.bytes.length / 1000).toFixed(1) + " KB · " + r.note + " Tap to change.";
      } catch (err) {
        $("imgInfo").textContent = err.message;
      }
      e.target.value = "";
      paintPreview();
    });
    paintFee(); paintPairs(); counters(); paintPreview(); paintSummary();
    if (!lp.ready) { $("ethCapT").textContent = "Opens soon"; $("townCapT").textContent = "Opens soon"; return; }
    try {
      const [st, rates] = await Promise.all([lp.settings(), lp.rates()]);
      S.settings = st; S.rates = rates;
      paintPairs(); paintPreview(); paintSummary();
      await loadBal();
    } catch (err) { AT.toast("Network", AT.niceError(err), "bad"); }
    window.addEventListener("at:wallet", () => { loadBal().then(runPreview); });
  });
})();
