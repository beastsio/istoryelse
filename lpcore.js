(function () {
  const AT = window.AT, CFG = AT.CFG, el = AT.el, fmt = AT.fmt;
  const LPA = CFG.launchpad || "";
  const ZERO = "0x0000000000000000000000000000000000000000";
  const utf8 = new TextEncoder();
  const hexOf = (b) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  const word = (v) => BigInt.asUintN(256, BigInt(v)).toString(16).padStart(64, "0");
  const toBytes = (hex) => { hex = String(hex || "").replace(/^0x/, ""); const out = new Uint8Array(hex.length / 2); for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16); return out; };
  const padBytes = (b) => { const h = hexOf(b); return h + "0".repeat((64 - (h.length % 64)) % 64); };

  const isDyn = (t) => t === "string" || t === "bytes" || /\[\]$/.test(t) || (Array.isArray(t) && t.some(isDyn));
  function encOne(t, v) {
    if (Array.isArray(t)) return encList(t, v);
    if (t === "string" || t === "bytes") { const b = t === "string" ? utf8.encode(v) : (v instanceof Uint8Array ? v : toBytes(v)); return word(b.length) + padBytes(b); }
    if (t === "address") return word(BigInt(v || 0));
    if (t === "bool") return word(v ? 1 : 0);
    return word(v);
  }
  function encList(types, vals) {
    const heads = [];
    let tail = "";
    const hl = types.length * 32;
    types.forEach((t, i) => {
      if (isDyn(t)) { heads.push(word(hl + tail.length / 2)); tail += encOne(t, vals[i]); }
      else heads.push(encOne(t, vals[i]));
    });
    return heads.join("") + tail;
  }
  function decList(types, hex, base) {
    hex = String(hex || "0x").replace(/^0x/, "");
    base = base || 0;
    const at = (off) => hex.slice(off * 2, off * 2 + 64);
    const num = (off) => BigInt("0x" + (at(off) || "0"));
    const bytesAt = (off) => { const n = Number(num(off)); return toBytes(hex.slice((off + 32) * 2, (off + 32 + n) * 2)); };
    const one = (t, off) => {
      if (t === "string") return new TextDecoder().decode(bytesAt(off));
      if (t === "bytes") return bytesAt(off);
      if (/\[\]$/.test(t)) {
        const it = t.slice(0, -2), n = Number(num(off)), start = off + 32, out = [];
        for (let k = 0; k < n; k++) out.push(isDyn(it) ? one(it, start + Number(num(start + k * 32))) : one(it, start + k * 32));
        return out;
      }
      const w = at(off);
      if (t === "address") return "0x" + w.slice(24);
      if (t === "bool") return BigInt("0x" + w) !== 0n;
      if (/^int/.test(t)) return BigInt.asIntN(256, BigInt("0x" + w));
      return BigInt("0x" + (w || "0"));
    };
    return types.map((t, i) => isDyn(t) ? one(t, base + Number(num(base + i * 32))) : one(t, base + i * 32));
  }
  const cd = (sig, types, vals) => "0x" + AT.abi.selector(sig) + encList(types || [], vals || []);
  async function read(to, sig, types, vals, out) { return decList(out, await AT.rpc("eth_call", [{ to, data: cd(sig, types, vals) }, "latest"])); }

  const LAUNCH_T = ["string", "string", "bool", "uint16", "bytes", "string", "uint256", "uint256"];
  const TRADE_TOPIC = "0x" + hexOf(Keccak.keccak256(utf8.encode("Trade(address,address,bool,uint256,uint256,uint256,uint160)")));
  const QUOTE_SEL = AT.abi.selector("Quote(uint256,uint256,uint160)");

  const lp = {
    address: LPA,
    ready: AT.isAddr(LPA),
    SUPPLY: 10n ** 27n,
    settings: async () => {
      const [e, t, p, n, town] = await Promise.all([
        read(LPA, "ethStartCap()", [], [], ["uint256"]),
        read(LPA, "townStartCap()", [], [], ["uint256"]),
        read(LPA, "paused()", [], [], ["bool"]),
        read(LPA, "launchCount()", [], [], ["uint256"]),
        read(LPA, "town()", [], [], ["address"])
      ]);
      return { ethCap: e[0], townCap: t[0], paused: p[0], count: Number(n[0]), town: town[0] };
    },
    list: async (from, count) => {
      const r = await read(LPA, "list(uint256,uint256)", ["uint256", "uint256"], [from, count], ["address[]", "address[]", "uint256[]", "uint256[]", "string[]", "string[]"]);
      return r[0].map((a, i) => {
        const info = r[2][i];
        return { token: a, creator: r[1][i], bps: Number(info & 0xffffn), createdAt: Number((info >> 16n) & 0xffffffffffn), townPair: ((info >> 56n) & 1n) === 1n, token0: ((info >> 57n) & 1n) === 1n, sqrtP: r[3][i], name: r[4][i], symbol: r[5][i], index: from + i };
      });
    },
    launch: async (token) => {
      const r = await read(LPA, "launches(address)", ["address"], [token], ["address", "address", "uint16", "uint40", "address", "string", "bool"]);
      if (/^0x0+$/.test(r[0])) return null;
      return { token, creator: r[0], quote: r[1], townPair: !/^0x0+$/.test(r[1]), bps: Number(r[2]), createdAt: Number(r[3]), meta: r[5], token0: r[6] };
    },
    sqrtPrice: async (token) => (await read(LPA, "sqrtPriceOf(address)", ["address"], [token], ["uint160"]))[0],
    volume: async (token) => (await read(LPA, "volume(address)", ["address"], [token], ["uint256"]))[0],
    pending: async (acct, cur) => (await read(LPA, "pending(address,address)", ["address", "address"], [acct, cur], ["uint256"]))[0],
    feeBps: async (token) => { const r = await read(LPA, "feeBps(address)", ["address"], [token], ["uint256", "uint256"]); return { trader: Number(r[0]), market: Number(r[1]) }; },
    preview: async (townPair, bps, amt) => { const r = await read(LPA, "previewLaunch(bool,uint16,uint256)", ["bool", "uint16", "uint256"], [townPair, bps, amt], ["uint256", "uint256"]); return { out: r[0], fee: r[1] }; },
    quote: async (token, buying, amt) => {
      try {
        await AT.rpc("eth_call", [{ to: LPA, data: cd("quote(address,bool,uint256)", ["address", "bool", "uint256"], [token, buying, amt]) }, "latest"]);
      } catch (e) {
        const d = revertData(e);
        if (d && d.slice(2, 10) === QUOTE_SEL) { const r = decList(["uint256", "uint256", "uint160"], "0x" + d.slice(10)); return { out: r[0], fee: r[1], sqrtAfter: r[2] }; }
        throw e;
      }
      throw new Error("No quote");
    },
    launchData: (a) => cd("launch((string,string,bool,uint16,bytes,string,uint256,uint256))", [LAUNCH_T], [[a.name, a.symbol, a.townPair, a.bps, a.image, a.meta, a.buyAmount, a.minTokens]]),
    buyData: (token, amt, min) => cd("buy(address,uint256,uint256)", ["address", "uint256", "uint256"], [token, amt, min]),
    sellData: (token, amt, min) => cd("sell(address,uint256,uint256)", ["address", "uint256", "uint256"], [token, amt, min]),
    claimData: (cur) => cd("claim(address)", ["address"], [cur]),
    TRADE_TOPIC
  };
  function revertData(e) {
    const c = [e && e.rpc && e.rpc.data, e && e.data, e && e.data && e.data.data, e && e.error && e.error.data];
    for (const x of c) { if (typeof x === "string" && /^0x[0-9a-f]{8}/i.test(x)) return x; if (x && typeof x.data === "string") return x.data; }
    return null;
  }
  const erc20 = {
    balanceOf: async (t, a) => (await read(t, "balanceOf(address)", ["address"], [a], ["uint256"]))[0],
    allowance: async (t, o, s) => (await read(t, "allowance(address,address)", ["address", "address"], [o, s], ["uint256"]))[0],
    approveData: (s) => cd("approve(address,uint256)", ["address", "uint256"], [s, (1n << 256n) - 1n])
  };
  lp.erc20 = erc20;
  lp.encList = encList; lp.decList = decList; lp.cd = cd; lp.read = read; lp.ZERO = ZERO;

  const cache = {
    get(k, ms) { try { const v = JSON.parse(localStorage.getItem(k) || "null"); if (v && Date.now() - v.t < ms) return v.v; } catch (e) {} return null; },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify({ t: Date.now(), v })); } catch (e) {} }
  };
  let ethUsdP = null;
  lp.ethUsd = () => {
    if (CFG.ethUsd) return Promise.resolve(Number(CFG.ethUsd));
    if (ethUsdP) return ethUsdP;
    const c = cache.get("lp_ethusd", 300000);
    if (c) return (ethUsdP = Promise.resolve(c));
    const tries = [
      () => fetch("https://api.coinbase.com/v2/prices/ETH-USD/spot").then((r) => r.json()).then((j) => Number(j.data.amount)),
      () => fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd").then((r) => r.json()).then((j) => Number(j.ethereum.usd)),
      () => fetch("https://api.kraken.com/0/public/Ticker?pair=ETHUSD").then((r) => r.json()).then((j) => Number(Object.values(j.result)[0].c[0]))
    ];
    ethUsdP = (async () => {
      for (const t of tries) { try { const v = await t(); if (v > 0) { cache.set("lp_ethusd", v); return v; } } catch (e) {} }
      const old = cache.get("lp_ethusd", 7 * 86400000);
      return old || 0;
    })();
    return ethUsdP;
  };
  let townEthP = null;
  lp.townEth = () => {
    if (townEthP) return townEthP;
    townEthP = (async () => {
      try {
        if (!AT.isAddr(CFG.token) || !AT.isAddr(CFG.weth) || !AT.isAddr(CFG.v3factory)) return 0;
        const pool = (await read(CFG.v3factory, "getPool(address,address,uint24)", ["address", "address", "uint24"], [CFG.token, CFG.weth, 10000], ["address"]))[0];
        if (/^0x0+$/.test(pool)) return 0;
        const s = (await read(pool, "slot0()", [], [], ["uint160"]))[0];
        if (!s) return 0;
        const px = Math.pow(Number(s) / 2 ** 96, 2);
        return BigInt(CFG.token) < BigInt(CFG.weth) ? px : 1 / px;
      } catch (e) { return 0; }
    })();
    return townEthP;
  };

  lp.priceOf = (sqrtP, token0) => {
    const px = Math.pow(Number(sqrtP) / 2 ** 96, 2);
    if (!px || !isFinite(px)) return 0;
    return token0 ? px : 1 / px;
  };
  lp.mcapQuote = (sqrtP, token0) => lp.priceOf(sqrtP, token0) * 1e9;
  lp.toUsd = (quoteAmt, townPair, rates) => {
    if (!rates.ethUsd) return 0;
    return townPair ? (rates.townEth ? quoteAmt * rates.townEth * rates.ethUsd : 0) : quoteAmt * rates.ethUsd;
  };
  lp.rates = async () => { const [ethUsd, townEth] = await Promise.all([lp.ethUsd(), lp.townEth()]); return { ethUsd, townEth }; };
  lp.HIT = Number(CFG.hitUsd || 10000);
  lp.NEAR = Number(CFG.nearUsd || 5000);

  const sig = (n, d) => {
    if (!isFinite(n)) return "–";
    if (n === 0) return "0";
    const a = Math.abs(n);
    if (a >= 1e9) return (n / 1e9).toFixed(2).replace(/\.?0+$/, "") + "B";
    if (a >= 1e6) return (n / 1e6).toFixed(2).replace(/\.?0+$/, "") + "M";
    if (a >= 1e4) return (n / 1e3).toFixed(1).replace(/\.?0+$/, "") + "K";
    if (a >= 1) return n.toLocaleString("en-US", { maximumFractionDigits: d === undefined ? 2 : d });
    const z = Math.floor(-Math.log10(a));
    if (z >= 4) { const m = String(Math.min(999, Math.round(a * Math.pow(10, z + 3)))); return (n < 0 ? "-" : "") + "0.0" + String(z).split("").map((c) => "₀₁₂₃₄₅₆₇₈₉"[c]).join("") + m.replace(/0+$/, ""); }
    return n.toPrecision(4).replace(/\.?0+$/, "");
  };
  lp.fmt = {
    sig,
    usd: (n) => n > 0 ? "$" + sig(n, n >= 100 ? 0 : 2) : "–",
    q: (n, townPair) => sig(n, 4) + (townPair ? " TOWN" : " ETH"),
    wei: (v) => Number(v) / 1e18,
    tok: (v) => sig(Number(v) / 1e18, 2),
    pct: (bps) => (bps / 100).toFixed(bps % 100 ? (bps % 10 ? 2 : 1) : 0) + "%"
  };
  lp.parseUnits = (s) => {
    s = String(s || "").trim().replace(/,/g, "");
    if (!/^\d*\.?\d*$/.test(s) || s === "" || s === ".") return 0n;
    const [w, f = ""] = s.split(".");
    return BigInt(w || "0") * 10n ** 18n + BigInt((f + "0".repeat(18)).slice(0, 18) || "0");
  };
  lp.formatUnits = (v, dp) => {
    const neg = v < 0n; if (neg) v = -v;
    const w = v / 10n ** 18n; let f = (v % 10n ** 18n).toString().padStart(18, "0").slice(0, dp === undefined ? 6 : dp).replace(/0+$/, "");
    return (neg ? "-" : "") + w.toString() + (f ? "." + f : "");
  };

  function sniff(b) {
    if (!b || b.length < 8) return null;
    if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return "image/gif";
    if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
    if (b[0] === 0xff && b[1] === 0xd8) return "image/jpeg";
    if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45) return "image/webp";
    return null;
  }
  lp.sniff = sniff;
  const imgCache = {};
  lp.image = (token) => {
    const k = token.toLowerCase();
    if (!imgCache[k]) imgCache[k] = read(LPA, "imageOf(address)", ["address"], [token], ["bytes"]).then((r) => {
      const b = r[0], m = sniff(b);
      return m ? URL.createObjectURL(new Blob([b], { type: m })) : null;
    }).catch(() => null);
    return imgCache[k];
  };
  lp.identicon = (addr, size) => {
    const c = document.createElement("canvas");
    c.width = c.height = 8;
    const g = c.getContext("2d");
    const h = Keccak.keccak256(toBytes(addr.replace(/^0x/, "").toLowerCase()));
    const hue = h[0] / 255 * 360, hue2 = (hue + 140 + h[1] / 4) % 360;
    g.fillStyle = "hsl(" + hue2 + ",60%,22%)"; g.fillRect(0, 0, 8, 8);
    g.fillStyle = "hsl(" + hue + ",85%,62%)";
    for (let y = 0; y < 8; y++) for (let x = 0; x < 4; x++) if ((h[2 + y] >> x) & 1) { g.fillRect(x, y, 1, 1); g.fillRect(7 - x, y, 1, 1); }
    c.className = "ident";
    if (size) { c.style.width = size + "px"; c.style.height = size + "px"; }
    return c;
  };
  lp.pic = (token, cls) => {
    const box = el("div", { class: "tpic " + (cls || "") });
    box.appendChild(lp.identicon(token));
    lp.image(token).then((u) => { if (u) { box.innerHTML = ""; box.appendChild(el("img", { src: u, alt: "", loading: "lazy" })); } });
    return box;
  };
  lp.meta = (s) => {
    let m = {};
    try { m = JSON.parse(s || "{}") || {}; } catch (e) { m = {}; }
    const safe = (u) => { u = String(u || "").trim(); return /^https:\/\/[^\s"'<>]+$/i.test(u) ? u : ""; };
    return { desc: String(m.d || "").slice(0, 400), x: safe(m.x), tg: safe(m.tg), dc: safe(m.dc), web: safe(m.web), post: safe(m.post) };
  };
  lp.linkRow = (m) => {
    const row = el("div", { class: "tlinks" });
    [["x", "X"], ["tg", "Telegram"], ["dc", "Discord"], ["web", "Website"], ["post", "X post"]].forEach(([k, n]) => {
      if (m[k]) row.appendChild(el("a", { class: "chip", href: m[k], target: "_blank", rel: "noopener nofollow ugc", text: n }));
    });
    return row;
  };
  lp.explorer = (kind, v) => CFG.explorer ? CFG.explorer.replace(/\/$/, "") + "/" + kind + "/" + v : "#";
  lp.copyBtn = (text, label) => el("button", { class: "copy", type: "button", title: "Copy", onclick: (e) => { e.preventDefault(); e.stopPropagation(); if (navigator.clipboard) navigator.clipboard.writeText(text); AT.toast("Copied", label || fmt.short(text)); } }, [label || fmt.short(text)]);

  const ERRS = { CreatorBuyTooLarge: "Your first buy is above 20% of the supply. Lower the amount.", Slippage: "The price moved. Try again or raise slippage.", TownDisabled: "$TOWN pairs are not open yet.", Paused: "New launches are paused.", BadInput: "Please check the form.", UnknownToken: "Unknown token.", SendFailed: "A transfer failed. Check your balance and approval.", Reentrant: "Busy. Try again." };
  const ERR_SEL = {};
  Object.keys(ERRS).forEach((k) => { ERR_SEL[AT.abi.selector(k + "()")] = k; });
  const baseNice = AT.niceError;
  lp.niceError = (e) => {
    let m = "";
    try { m = String((e && (e.message || e)) || "") + " " + JSON.stringify(e && (e.data || (e.rpc && e.rpc.data) || "")); } catch (x) { m = String(e); }
    for (const k in ERRS) if (m.includes(k)) return ERRS[k];
    const hit = m.match(/0x([0-9a-f]{8})/gi) || [];
    for (const h of hit) { const k = ERR_SEL[h.slice(2).toLowerCase()]; if (k) return ERRS[k]; }
    return baseNice(e);
  };
  AT.niceError = lp.niceError;

  AT.lp = lp;
})();
