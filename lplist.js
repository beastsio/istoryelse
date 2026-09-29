(function () {
  const AT = window.AT, lp = AT.lp, el = AT.el, F = lp.fmt;
  const $ = (id) => document.getElementById(id);
  let all = [], rates = { ethUsd: 0, townEth: 0 }, settings = null, pair = "all", query = "", newShown = 24;

  function card(t) {
    const a = el("a", { class: "tcard px-drop", href: "token?a=" + t.token });
    a.appendChild(lp.pic(t.token));
    const body = el("div", { class: "tbody" });
    body.appendChild(el("h3", {}, [el("span", { class: "nm", text: t.name }), el("small", { text: "$" + t.symbol })]));
    const badges = el("div", { class: "tbadges" }, [
      el("span", { class: "badge " + (t.townPair ? "town" : "eth"), text: t.townPair ? "$TOWN pair" : "ETH pair" }),
      el("span", { class: "badge", text: "Fee " + F.pct(t.bps) }),
      el("span", { class: "badge idle", text: AT.fmt.ago(t.createdAt) + " ago" })
    ]);
    body.appendChild(badges);
    const row = el("div", { class: "tmc" }, [el("span", { text: "Market cap" }), el("b", { text: t.usd > 0 ? F.usd(t.usd) : F.q(t.mcap, t.townPair) })]);
    body.appendChild(row);
    const pr = Math.max(2, Math.min(100, t.usd > 0 ? t.usd / lp.HIT * 100 : 0));
    const bar = el("div", { class: "hitbar" + (t.usd >= lp.HIT ? " hit" : "") }, [el("i", { style: "width:" + pr.toFixed(1) + "%" })]);
    body.appendChild(bar);
    a.appendChild(body);
    if (t.usd >= lp.HIT) a.appendChild(el("span", { class: "hit-flag", text: "HIT" }));
    return a;
  }

  function startUsd(t) {
    const cap = t.townPair ? Number(settings.townCap) / 1e18 : Number(settings.ethCap) / 1e18;
    return lp.toUsd(cap, t.townPair, rates);
  }

  function render() {
    const q = query.trim().toLowerCase();
    const list = all.filter((t) => (pair === "all" || (pair === "town") === t.townPair) && (!q || t.name.toLowerCase().includes(q) || t.symbol.toLowerCase().includes(q) || t.token.toLowerCase() === q || t.token.toLowerCase().includes(q.replace(/^\$/, ""))));
    const hits = [], near = [], fresh = [];
    list.forEach((t) => {
      if (t.usd >= lp.HIT) hits.push(t);
      else if (t.usd >= lp.NEAR && t.usd >= startUsd(t) * 1.3) near.push(t);
      else fresh.push(t);
    });
    hits.sort((a, b) => b.usd - a.usd);
    near.sort((a, b) => b.usd - a.usd);
    fresh.sort((a, b) => b.index - a.index);
    const fill = (block, grid, arr) => { $(grid).innerHTML = ""; arr.forEach((t) => $(grid).appendChild(card(t))); $(block).hidden = !arr.length; };
    fill("bHits", "gHits", hits);
    fill("bNear", "gNear", near);
    fill("bNew", "gNew", fresh.slice(0, newShown));
    $("moreNew").hidden = fresh.length <= newShown;
    $("hHits").textContent = F.usd(lp.HIT) + "+ market cap";
    $("hNear").textContent = "on the way to " + F.usd(lp.HIT);
    $("sHits").textContent = all.filter((t) => t.usd >= lp.HIT).length;
    const empty = !list.length;
    $("lpEmpty").hidden = !empty;
    if (empty) $("lpMsg").textContent = all.length ? "No token matches your search." : "No tokens yet. Be the first to launch one!";
  }

  async function load() {
    settings = await lp.settings();
    $("sCount").textContent = AT.fmt.num(settings.count);
    const pages = [];
    for (let i = 0; i < settings.count; i += 60) pages.push(lp.list(i, 60));
    const [lists, r] = await Promise.all([Promise.all(pages), lp.rates()]);
    rates = r;
    $("sEth").textContent = rates.ethUsd ? "$" + AT.fmt.num(Math.round(rates.ethUsd)) : "–";
    $("sHit").textContent = F.usd(lp.HIT);
    all = [].concat(...lists).map((t) => {
      t.mcap = lp.mcapQuote(t.sqrtP, t.token0);
      t.usd = lp.toUsd(t.mcap, t.townPair, rates);
      return t;
    });
    render();
  }

  async function fees() {
    const W = AT.wallet;
    const box = $("feesBox");
    if (!W.account) { box.hidden = true; return; }
    const curs = [[lp.ZERO, "ETH"]];
    if (settings && AT.isAddr(settings.town) && !/^0x0+$/.test(settings.town)) curs.push([settings.town, "$TOWN"]);
    const vals = await Promise.all(curs.map(([c]) => lp.pending(W.account, c).catch(() => 0n)));
    const rows = $("feeRows");
    rows.innerHTML = "";
    let any = false;
    curs.forEach(([c, n], i) => {
      if (vals[i] <= 0n) return;
      any = true;
      rows.appendChild(el("div", { class: "fee-row" }, [
        el("b", { text: lp.formatUnits(vals[i], 6) + " " + n }),
        el("button", { class: "btn small teal", type: "button", text: "Claim", onclick: async (e) => {
          e.target.disabled = true;
          try { await W.txFlow("Claim " + n, lp.address, lp.claimData(c)); } catch (err) {}
          e.target.disabled = false;
          fees();
        } })
      ]));
    });
    box.hidden = !any;
  }

  document.addEventListener("DOMContentLoaded", () => {
    $("q").addEventListener("input", (e) => { query = e.target.value; render(); });
    $("pairSeg").addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      pair = b.dataset.v;
      $("pairSeg").querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
      render();
    });
    $("moreNew").addEventListener("click", () => { newShown += 24; render(); });
    if (!lp.ready) { $("lpMsg").textContent = "The launchpad opens soon."; return; }
    load().then(fees).catch((e) => { $("lpMsg").textContent = "Could not load tokens. " + AT.niceError(e); });
    window.addEventListener("at:wallet", () => { if (settings) fees(); });
    setInterval(() => { if (!document.hidden) load().catch(() => {}); }, 30000);
  });
})();
