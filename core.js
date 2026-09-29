(function () {
  const AT = window.AT;
  const CFG = Object.assign({ chainId: 4663, chainName: "Robinhood Chain", rpc: "", explorer: "", town: "", token: "", xProfile: "" }, window.TOWN_CONFIG || {});
  AT.CFG = CFG;
  const isAddr = (a) => /^0x[0-9a-fA-F]{40}$/.test(a || "");
  AT.PREVIEW = !isAddr(CFG.town);
  AT.isAddr = isAddr;

  const utf8 = new TextEncoder();
  const hexOf = (bytes) => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  const selCache = {};
  function selector(sig) { return selCache[sig] || (selCache[sig] = hexOf(Keccak.keccak256(utf8.encode(sig))).slice(0, 8)); }
  const word = (v) => BigInt.asUintN(256, BigInt(v)).toString(16).padStart(64, "0");

  function encode(types, vals) {
    let head = "", tail = "";
    const headLen = types.length * 32;
    types.forEach((t, i) => {
      const v = vals[i];
      if (t.endsWith("[]")) {
        head += word(headLen + tail.length / 2);
        tail += word(v.length) + v.map((x) => word(x)).join("");
      } else if (t === "address") head += word(BigInt(v));
      else if (t === "bool") head += word(v ? 1 : 0);
      else if (t === "bytes32") head += String(v).replace(/^0x/, "").padStart(64, "0");
      else head += word(v);
    });
    return head + tail;
  }
  function decode(types, hex) {
    hex = (hex || "0x").replace(/^0x/, "");
    const w = (i) => hex.slice(i * 64, i * 64 + 64);
    const at = (byteOff) => hex.slice(byteOff * 2, byteOff * 2 + 64);
    return types.map((t, i) => {
      if (t.endsWith("[]")) {
        const off = Number(BigInt("0x" + w(i)));
        const n = Number(BigInt("0x" + at(off)));
        const out = [];
        for (let k = 0; k < n; k++) out.push(BigInt("0x" + at(off + 32 + k * 32)));
        return out;
      }
      if (t === "string") {
        const off = Number(BigInt("0x" + w(i)));
        const n = Number(BigInt("0x" + at(off)));
        const hs = hex.slice((off + 32) * 2, (off + 32 + n) * 2);
        const bytes = new Uint8Array(hs.match(/../g) ? hs.match(/../g).map((x) => parseInt(x, 16)) : []);
        return new TextDecoder().decode(bytes);
      }
      const v = w(i);
      if (t === "bool") return BigInt("0x" + v) !== 0n;
      if (t === "address") return "0x" + v.slice(24);
      if (t === "bytes32") return "0x" + v;
      return BigInt("0x" + (v || "0"));
    });
  }
  function calldata(sig, types, vals) { return "0x" + selector(sig) + encode(types || [], vals || []); }

  let rid = 1;
  async function rpc(method, params) {
    if (CFG.rpc) {
      try {
        const r = await fetch(CFG.rpc, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: rid++, method, params: params || [] }) });
        const j = await r.json();
        if (j.error) throw Object.assign(new Error(j.error.message || "RPC error"), { rpc: j.error });
        return j.result;
      } catch (e) {
        if (e.rpc || !W.p) throw e;
      }
    }
    if (W.p && W.chainOk) return W.p.request({ method, params: params || [] });
    throw new Error("Network unavailable");
  }
  async function call(to, sig, types, vals, out) {
    const res = await rpc("eth_call", [{ to, data: calldata(sig, types, vals) }, "latest"]);
    return decode(out, res);
  }
  AT.abi = { selector, encode, decode, calldata, word };
  AT.rpc = rpc;
  AT.call = call;

  const T = {
    miningState: () => call(CFG.town, "miningState()", [], [], ["bool", "uint256", "uint256", "uint256", "uint256", "uint256", "bytes32", "uint256"]).then((r) => ({ started: r[0], minted: Number(r[1]), alive: Number(r[2]), epoch: Number(r[3]), price: r[4], target: r[5], lastWork: r[6], lastMint: Number(r[7]) })),
    townStats: () => call(CFG.town, "townStats()", [], [], ["uint256", "uint256", "uint256", "uint256", "uint256", "uint256"]).then((r) => ({ minted: Number(r[0]), alive: Number(r[1]), working: Number(r[2]), weight: Number(r[3]), salaryTotal: r[4], totalPaid: r[5] })),
    workforce: (from, to) => call(CFG.town, "workforce(uint256,uint256)", ["uint256", "uint256"], [from, to], ["uint256[]"]).then((r) => r[0]),
    tokensOfOwner: (o, from, to) => call(CFG.town, "tokensOfOwner(address,uint256,uint256)", ["address", "uint256", "uint256"], [o, from, to], ["uint256[]"]).then((r) => r[0].map(Number)),
    agentInfo: (ids) => call(CFG.town, "agentInfo(uint256[])", ["uint256[]"], [ids], ["uint256[]", "uint256[]", "uint256[]"]),
    salaryState: () => Promise.all(["rewardRate()", "totalWeight()", "periodFinish()"].map((s) => call(CFG.town, s, [], [], ["uint256"]).then((r) => r[0]))).then(([rate, weight, finish]) => ({ rate, weight, finish: Number(finish) })),
    buybackQueue: () => AT.isAddr(CFG.buyback) ? rpc("eth_getBalance", [CFG.buyback, "latest"]).then((v) => BigInt(v)) : Promise.resolve(0n),
    tokenURI: (id) => call(CFG.town, "tokenURI(uint256)", ["uint256"], [id], ["string"]).then((r) => r[0])
  };
  AT.town = T;

  async function loadAgents(onProgress) {
    if (AT.PREVIEW) return { list: AT.demoTown(6385, 2400), preview: true };
    const st = await T.townStats();
    const list = [];
    const step = 400;
    for (let i = 1; i <= st.minted; i += step) {
      const words = await T.workforce(i, Math.min(st.minted, i + step - 1));
      words.forEach((v) => { if (v > 0n) list.push(AT.decodeAgent(v)); });
      if (onProgress) onProgress(Math.min(1, (i + step) / Math.max(1, st.minted)));
    }
    return { list, stats: st, preview: false };
  }
  AT.loadAgents = loadAgents;

  const fmt = {
    eth(wei, dp) {
      const v = typeof wei === "bigint" ? wei : BigInt(wei || 0);
      const d = dp === undefined ? 5 : dp;
      const whole = v / 10n ** 18n, frac = v % 10n ** 18n;
      let s = whole.toString();
      if (d > 0) { let f = frac.toString().padStart(18, "0").slice(0, d).replace(/0+$/, ""); if (f) s += "." + f; }
      if (s === "0" && v > 0n) return "<0." + "0".repeat(Math.max(0, d - 1)) + "1";
      return s;
    },
    num(n) { return Number(n).toLocaleString("en-US"); },
    short(a) { return a ? a.slice(0, 6) + "…" + a.slice(-4) : ""; },
    date(ts) { return new Date(ts * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" }); },
    ago(ts) {
      const s = Math.max(0, Math.floor(Date.now() / 1000) - ts);
      if (s < 60) return s + "s";
      if (s < 3600) return Math.floor(s / 60) + "m";
      if (s < 86400) return Math.floor(s / 3600) + "h";
      return Math.floor(s / 86400) + "d";
    }
  };
  AT.fmt = fmt;
  AT.priceOf = (n) => {
    const S = AT.RULES.epochSize, e = Math.min(4, Math.floor(n / S)), p = Math.min(S - 1, n - e * S);
    const a = BigInt(AT.RULES.prices[e]), b = BigInt(AT.RULES.prices[e + 1]);
    return a + (b - a) * BigInt(p) / BigInt(S - 1);
  };

  function el(tag, attrs, kids) {
    const e = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      if (k === "class") e.className = attrs[k];
      else if (k === "html") e.innerHTML = attrs[k];
      else if (k === "text") e.textContent = attrs[k];
      else if (k.startsWith("on")) e.addEventListener(k.slice(2), attrs[k]);
      else e.setAttribute(k, attrs[k]);
    }
    (kids || []).forEach((c) => c && e.appendChild(typeof c === "string" ? document.createTextNode(c) : c));
    return e;
  }
  AT.el = el;

  let toastBox = null;
  function toast(title, msg, kind, ms) {
    if (!toastBox) { toastBox = el("div", { class: "toasts" }); document.body.appendChild(toastBox); }
    const t = el("div", { class: "toast " + (kind || "") });
    t.appendChild(el("b", { text: title }));
    if (msg) { const m = el("div"); if (msg instanceof Node) m.appendChild(msg); else m.textContent = msg; t.appendChild(m); }
    toastBox.appendChild(t);
    const kill = () => { t.remove(); };
    if (ms !== 0) setTimeout(kill, ms || 6000);
    t.addEventListener("click", kill);
    return { el: t, close: kill };
  }
  AT.toast = toast;

  function modal(title, body, actions, onClose) {
    const bg = el("div", { class: "modal-bg" });
    const m = el("div", { class: "modal px-drop", role: "dialog", "aria-modal": "true", "aria-label": title });
    const close = () => { bg.remove(); document.removeEventListener("keydown", esc); if (onClose) onClose(); };
    const esc = (e) => { if (e.key === "Escape") close(); };
    const head = el("div", { class: "mh" }, [el("span", { text: title }), el("button", { class: "x", "aria-label": "Close", text: "×", onclick: close })]);
    const mb = el("div", { class: "mb" });
    if (typeof body === "string") mb.innerHTML = body; else if (body) mb.appendChild(body);
    m.appendChild(head); m.appendChild(mb);
    if (actions && actions.length) {
      const a = el("div", { class: "actions" });
      actions.forEach((b) => a.appendChild(el("button", { class: "btn small " + (b.cls || ""), text: b.label, onclick: () => { if (b.run) b.run(close); else close(); } })));
      m.appendChild(a);
    }
    bg.appendChild(m);
    bg.addEventListener("click", (e) => { if (e.target === bg) close(); });
    document.addEventListener("keydown", esc);
    document.body.appendChild(bg);
    const f = m.querySelector("button:not(.x), a"); if (f) f.focus();
    return { close, body: mb };
  }
  AT.modal = modal;

  const W = { p: null, info: null, account: null, chainOk: false, providers: [] };
  AT.wallet = W;
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} }
  };
  window.addEventListener("eip6963:announceProvider", (e) => {
    const d = e.detail;
    if (!d || !d.info || !d.provider) return;
    if (!W.providers.some((q) => q.info.uuid === d.info.uuid || q.info.rdns === d.info.rdns)) W.providers.push(d);
  });
  window.dispatchEvent(new Event("eip6963:requestProvider"));

  const emit = () => window.dispatchEvent(new CustomEvent("at:wallet", { detail: W }));
  const hexChain = "0x" + CFG.chainId.toString(16);
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

  async function ensureChain() {
    const id = await W.p.request({ method: "eth_chainId" });
    if (parseInt(id, 16) === CFG.chainId) { W.chainOk = true; return true; }
    try {
      await W.p.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hexChain }] });
    } catch (e) {
      const code = e && (e.code || (e.data && e.data.originalError && e.data.originalError.code));
      if (code === 4902 || /unrecognized|not added|unknown chain/i.test(String(e && e.message))) {
        await W.p.request({ method: "wallet_addEthereumChain", params: [{ chainId: hexChain, chainName: CFG.chainName, nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: [CFG.rpc], blockExplorerUrls: CFG.explorer ? [CFG.explorer] : [] }] });
      } else throw e;
    }
    const id2 = await W.p.request({ method: "eth_chainId" });
    W.chainOk = parseInt(id2, 16) === CFG.chainId;
    return W.chainOk;
  }
  function attach(p) {
    if (!p || p._atHooked || !p.on) return;
    p._atHooked = true;
    p.on("accountsChanged", async (acc) => {
      if (W.p !== p) return;
      const a = acc && acc[0] ? acc[0] : null;
      if (!a) { W.account = null; store.set("at_wallet", null); emit(); return; }
      if (a === W.account) return;
      W.account = null; emit();
      try { await verifyOwner(p, a); W.account = a; } catch (e) { toast("Not connected", e.message, "bad"); store.set("at_wallet", null); }
      emit();
    });
    p.on("chainChanged", (id) => { if (W.p !== p) return; W.chainOk = parseInt(id, 16) === CFG.chainId; emit(); });
  }
  const vKey = (a) => "at_verified_" + String(a).toLowerCase();
  function isVerified(a) { const v = Number(store.get(vKey(a)) || 0); return v > Date.now() - 30 * 86400000; }
  async function verifyOwner(p, account) {
    if (isVerified(account)) return true;
    const nonce = Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, "0")).join("");
    const msg = "Agent Town wants you to verify that you own this wallet.\n\nWallet: " + account + "\nSite: " + location.host + "\nNonce: " + nonce + "\nIssued: " + new Date().toISOString() + "\n\nThis is only a signature. It does not send a transaction, move funds or give any approval.";
    const hex = "0x" + Array.from(new TextEncoder().encode(msg), (b) => b.toString(16).padStart(2, "0")).join("");
    const t = toast("Verify ownership", "Sign the message in your wallet. It is free.", "wait", 0);
    try {
      await p.request({ method: "personal_sign", params: [hex, account] });
      store.set(vKey(account), String(Date.now()));
      t.close();
      toast("Wallet verified", fmt.short(account));
      return true;
    } catch (e) {
      t.close();
      throw new Error("Ownership was not verified. " + niceError(e));
    }
  }
  async function connectWith(p, info) {
    W.p = p; W.info = info;
    attach(p);
    const acc = await p.request({ method: "eth_requestAccounts" });
    const account = acc && acc[0] ? acc[0] : null;
    if (!account) throw new Error("No account");
    try { await verifyOwner(p, account); } catch (e) { W.p = null; W.info = null; W.account = null; emit(); throw e; }
    W.account = account;
    store.set("at_wallet", info && info.rdns ? info.rdns : "injected");
    try { await ensureChain(); } catch (e) { W.chainOk = false; toast("Switch network", "Please switch your wallet to " + CFG.chainName + ".", "bad"); }
    emit();
    return W.account;
  }
  function deepLinks() {
    const url = location.href, hostPath = location.host + location.pathname + location.search;
    return [
      { name: "Bitget Wallet", href: "https://bkcode.vip?action=dapp&url=" + encodeURIComponent(url) },
      { name: "MetaMask", href: "https://metamask.app.link/dapp/" + hostPath },
      { name: "Trust Wallet", href: "https://link.trustwallet.com/open_url?coin_id=60&url=" + encodeURIComponent(url) },
      { name: "OKX Wallet", href: "okx://wallet/dapp/url?dappUrl=" + encodeURIComponent(url) },
      { name: "Coinbase Wallet", href: "https://go.cb-w.com/dapp?cb_url=" + encodeURIComponent(url) }
    ];
  }
  function legacy() {
    const out = [];
    const seen = new Set(W.providers.map((d) => d.provider));
    const add = (p, name, rdns) => { if (p && p.request && !seen.has(p)) { seen.add(p); out.push({ info: { name, rdns, icon: "" }, provider: p }); } };
    add(window.bitkeep && window.bitkeep.ethereum, "Bitget Wallet", "com.bitget.web3");
    add(window.okxwallet, "OKX Wallet", "com.okex.wallet");
    add(window.trustwallet && (window.trustwallet.ethereum || window.trustwallet), "Trust Wallet", "com.trustwallet.app");
    add(window.coinbaseWalletExtension, "Coinbase Wallet", "com.coinbase.wallet");
    const eth = window.ethereum;
    if (eth && Array.isArray(eth.providers)) eth.providers.forEach((p, i) => add(p, p.isMetaMask ? "MetaMask" : p.isCoinbaseWallet ? "Coinbase Wallet" : "Browser Wallet " + (i + 1), "injected." + i));
    if (eth) add(eth, eth.isBitKeep ? "Bitget Wallet" : eth.isOkxWallet ? "OKX Wallet" : eth.isTrust ? "Trust Wallet" : eth.isMetaMask ? "MetaMask" : "Browser Wallet", "injected");
    return out;
  }
  function picker() {
    return new Promise((resolve) => {
      window.dispatchEvent(new Event("eip6963:requestProvider"));
      setTimeout(() => {
        const box = el("div");
        const list = el("div", { class: "wlist" });
        const provs = W.providers.concat(legacy());
        let m, picked = false;
        provs.forEach((d) => {
          const ic = d.info.icon ? el("img", { src: d.info.icon, alt: "" }) : el("span", { class: "wi", text: "W" });
          list.appendChild(el("button", {
            class: "wopt", onclick: async () => {
              picked = true;
              m.close();
              try { resolve(await connectWith(d.provider, d.info)); }
              catch (e) { toast("Not connected", niceError(e), "bad"); resolve(null); }
            }
          }, [ic, el("span", { text: d.info.name })]));
        });
        if (provs.length) box.appendChild(el("p", { text: provs.length > 1 ? "Choose the wallet you want to use:" : "Connect with:" }));
        const appList = el("div", { class: "wlist" });
        if (mobile) {
          deepLinks().forEach((d) => appList.appendChild(el("a", { class: "wopt", href: d.href, rel: "noopener" }, [el("span", { class: "wi", text: d.name[0] }), el("span", { text: d.name }), el("small", { text: "Open app" })])));
          appList.appendChild(el("button", { class: "wopt", type: "button", onclick: () => { if (navigator.clipboard) navigator.clipboard.writeText(location.href); toast("Link copied", "Paste it in your wallet app's browser."); } }, [el("span", { class: "wi", text: "+" }), el("span", { text: "Other wallet" }), el("small", { text: "Copy link" })]));
        }
        if (!provs.length) {
          if (mobile) {
            box.appendChild(el("p", { text: "Open this page inside your wallet app:" }));
          } else {
            box.appendChild(el("p", { text: "No wallet found in this browser. Install a wallet extension, then reload this page." }));
            [["MetaMask", "https://metamask.io/download/"], ["Rabby", "https://rabby.io/"], ["OKX Wallet", "https://www.okx.com/web3"]].forEach(([n, h]) => list.appendChild(el("a", { class: "wopt", href: h, target: "_blank", rel: "noopener" }, [el("span", { class: "wi", text: n[0] }), el("span", { text: n }), el("small", { text: "Install" })])));
          }
        } else if (mobile) {
          box.appendChild(el("p", { text: "Choose a wallet:" }));
        }
        box.appendChild(list);
        if (mobile) {
          if (provs.length) box.appendChild(el("p", { class: "muted", text: "Or open this page in another wallet app:" }));
          box.appendChild(appList);
        }
        box.appendChild(el("p", { class: "muted", text: "After connecting you sign one plain message to prove you own the wallet. It is free and can never move your funds." }));
        m = modal("Connect wallet", box, null, () => { if (!picked) resolve(null); });
      }, 250);
    });
  }
  async function connect() { if (W.account) return W.account; return picker(); }
  function disconnect() { W.p = null; W.info = null; W.account = null; W.chainOk = false; store.set("at_wallet", null); emit(); }
  async function autoReconnect() {
    const saved = store.get("at_wallet");
    if (!saved) return;
    await new Promise((r) => setTimeout(r, 350));
    const d = W.providers.concat(legacy()).find((q) => q.info.rdns === saved);
    if (!d) return;
    try {
      const acc = await d.provider.request({ method: "eth_accounts" });
      if (acc && acc[0] && isVerified(acc[0])) {
        W.p = d.provider; W.info = d.info; W.account = acc[0]; attach(d.provider);
        const id = await d.provider.request({ method: "eth_chainId" });
        W.chainOk = parseInt(id, 16) === CFG.chainId;
        emit();
      }
    } catch (e) {}
  }
  function niceError(e) {
    const m = String((e && (e.shortMessage || (e.data && e.data.message) || e.message)) || e);
    if ((e && e.code === 4001) || /reject|denied|cancel/i.test(m)) return "You cancelled the request.";
    if (/insufficient funds/i.test(m)) return "Not enough ETH for this transaction.";
    const custom = { WeakHash: "Your proof is not strong enough anymore. Keep mining.", BadBlock: "That block is too old. Mining a fresh proof.", Underpaid: "The price went up. Try again.", Locked: "This agent is still on its shift.", NotOwner: "You don't own this agent.", NotWorking: "This agent is not working.", AlreadyWorking: "This agent is already working.", Working: "Clock out first.", WallReached: "All 6,385 agents are hired.", NotStarted: "Hiring has not started yet.", MintPaused: "Hiring is paused." };
    for (const k in custom) if (m.includes(k)) return custom[k];
    return m.length > 160 ? m.slice(0, 160) + "…" : m;
  }
  AT.niceError = niceError;
  async function sendTx(to, data, value) {
    if (!W.account) { await connect(); if (!W.account) throw new Error("Wallet not connected"); }
    if (!W.chainOk) await ensureChain();
    const tx = { from: W.account, to, data };
    if (value && value > 0n) tx.value = "0x" + value.toString(16);
    return W.p.request({ method: "eth_sendTransaction", params: [tx] });
  }
  async function waitTx(hash, ms) {
    const end = Date.now() + (ms || 240000);
    while (Date.now() < end) {
      try {
        const r = await rpc("eth_getTransactionReceipt", [hash]);
        if (r) { if (r.status === "0x1") return r; throw new Error("Transaction failed on chain."); }
      } catch (e) { if (/failed on chain/.test(e.message)) throw e; }
      await new Promise((r) => setTimeout(r, 2000));
    }
    throw new Error("Still pending. Check the explorer.");
  }
  async function txFlow(label, to, data, value) {
    const t = toast(label, "Confirm in your wallet…", "wait", 0);
    try {
      const hash = await sendTx(to, data, value);
      t.el.lastChild.textContent = "Sent. Waiting for the block…";
      const r = await waitTx(hash);
      t.close();
      const link = CFG.explorer ? el("a", { href: CFG.explorer.replace(/\/$/, "") + "/tx/" + hash, target: "_blank", rel: "noopener", text: "View on explorer" }) : null;
      toast(label + " done", link, "", 9000);
      return r;
    } catch (e) {
      t.close();
      toast(label + " failed", niceError(e), "bad", 9000);
      throw e;
    }
  }
  W.connect = connect; W.disconnect = disconnect; W.sendTx = sendTx; W.waitTx = waitTx; W.txFlow = txFlow; W.ensureChain = ensureChain;

  function header() {
    const head = document.querySelector(".site-head");
    if (!head) return;
    const logo = head.querySelector(".logo canvas");
    if (logo) AT.portrait(logo, { id: 1, job: 0, chassis: 9, glow: 0, uniform: 0, eyes: 1, head: 0, hat: 0, seat: 0, key: "logo", phase: 0 }, 3);
    const path = location.pathname.replace(/\.html$/, "").replace(/\/$/, "") || "/";
    head.querySelectorAll(".nav a").forEach((a) => { const h = a.getAttribute("href"); if (h === path || (h !== "/" && path.startsWith(h))) a.classList.add("on"); });
    const mb = head.querySelector(".menu-btn");
    if (mb) mb.addEventListener("click", () => { document.body.classList.toggle("menu-open"); mb.setAttribute("aria-expanded", document.body.classList.contains("menu-open")); });
    head.querySelectorAll(".nav a").forEach((a) => a.addEventListener("click", () => document.body.classList.remove("menu-open")));
    const wb = head.querySelector(".wallet-btn");
    if (!wb) return;
    const label = wb.querySelector("span.t");
    let pop = null;
    const paint = () => {
      if (W.account) { label.textContent = W.chainOk ? fmt.short(W.account) : "Wrong network"; wb.classList.add("on"); }
      else { label.textContent = "Connect"; wb.classList.remove("on"); }
    };
    wb.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (!W.account) { await connect(); return; }
      if (!W.chainOk) { try { await ensureChain(); emit(); } catch (err) { toast("Network", niceError(err), "bad"); } return; }
      if (pop) { pop.remove(); pop = null; return; }
      pop = el("div", { class: "menu-pop px-drop" }, [
        el("button", { text: "Copy address", onclick: () => { navigator.clipboard && navigator.clipboard.writeText(W.account); toast("Copied", fmt.short(W.account)); } }),
        el("a", { href: "/agents", text: "My agents" }),
        CFG.explorer ? el("a", { href: CFG.explorer.replace(/\/$/, "") + "/address/" + W.account, target: "_blank", rel: "noopener", text: "View on explorer" }) : null,
        el("button", { text: "Disconnect", onclick: () => { disconnect(); pop.remove(); pop = null; } })
      ]);
      wb.parentElement.appendChild(pop);
    });
    document.addEventListener("click", () => { if (pop) { pop.remove(); pop = null; } });
    window.addEventListener("at:wallet", paint);
    paint();
  }

  function reveal() {
    const items = document.querySelectorAll(".reveal");
    if (!("IntersectionObserver" in window)) { items.forEach((e) => e.classList.add("in")); return; }
    const io = new IntersectionObserver((es) => es.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } }), { rootMargin: "0px 0px -8% 0px" });
    items.forEach((e) => io.observe(e));
  }

  function footer() {
    document.querySelectorAll("[data-x]").forEach((a) => { if (CFG.xProfile) a.href = CFG.xProfile; else a.remove(); });
    const ad = document.querySelector(".site-foot .addr");
    if (ad) {
      const rows = [];
      if (isAddr(CFG.town)) rows.push("Agents: " + CFG.town);
      if (isAddr(CFG.token)) rows.push("$TOWN: " + CFG.token);
      ad.textContent = rows.length ? rows.join("  ·  ") : "Contracts go live on " + CFG.chainName + " soon.";
    }
  }

  document.addEventListener("DOMContentLoaded", () => { header(); reveal(); footer(); autoReconnect(); });
})();
