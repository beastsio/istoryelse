(function () {
  const AT = window.AT, el = AT.el, fmt = AT.fmt, W = AT.wallet;
  const app = document.getElementById("app");
  const DAY = 86400;
  let agents = [], sel = new Set(), filter = "all", loading = false;

  function hero(text, btn) {
    app.innerHTML = "";
    const c = el("canvas");
    AT.portrait(c, { id: 7, job: 32, chassis: 1, glow: 4, uniform: 4, eyes: 3, head: 1, hat: 0, seat: 2, key: "payroll", phase: 0 }, 6);
    const box = el("div", { class: "panel light px-drop connect-card" }, [c, el("h2", { text: text[0] }), el("p", { text: text[1] })]);
    if (btn) box.appendChild(btn);
    app.appendChild(box);
  }

  function status(a) {
    const now = Date.now() / 1000;
    if (!a.plan) return { cls: "idle", text: "Idle", note: "Not earning" };
    const name = a.plan === 2 ? "Full-time 4×" : "Part-time 1×";
    if (now >= a.unlock) return { cls: "done", text: name, note: "Shift done · can clock out" };
    const left = a.unlock - now;
    return { cls: a.plan === 2 ? "full" : "part", text: name, note: "Shift ends in " + (left > DAY ? Math.ceil(left / DAY) + "d" : Math.ceil(left / 3600) + "h") };
  }

  function render() {
    app.innerHTML = "";
    const working = agents.filter((a) => a.plan > 0);
    const unpaid = agents.reduce((s, a) => s + (a.salary || 0n), 0n);
    const shares = working.reduce((s, a) => s + (a.plan === 2 ? 4 : 1), 0);
    const stat = (k, v, hot) => el("div", { class: "mstat px" }, [el("span", { text: k }), el("b", { class: hot ? "hot" : "", text: v })]);
    const claimAll = el("button", { class: "btn red", type: "button", text: "Claim all salary", onclick: () => act("claim", agents.filter((a) => a.salary > 0n)) });
    if (unpaid === 0n) claimAll.disabled = true;
    app.appendChild(el("div", { class: "sumbar" }, [stat("Agents", fmt.num(agents.length)), stat("At work", fmt.num(working.length)), stat("Unpaid salary", fmt.eth(unpaid, 6) + " ETH", true), stat("Your shares", fmt.num(shares)), claimAll]));

    const bar = el("div", { class: "toolbar px-drop" });
    const count = el("span", { class: "count", text: sel.size + " selected" });
    bar.appendChild(count);
    const chip = (label, on, fn) => el("button", { class: "chip" + (on ? " on" : ""), type: "button", text: label, onclick: fn });
    bar.appendChild(chip("All", false, () => { visible().forEach((a) => sel.add(a.id)); render(); }));
    bar.appendChild(chip("None", false, () => { sel.clear(); render(); }));
    bar.appendChild(el("span", { class: "sep" }));
    ["all", "idle", "working"].forEach((f) => bar.appendChild(chip(f === "all" ? "Show all" : f === "idle" ? "Idle" : "Working", filter === f, () => { filter = f; render(); })));
    bar.appendChild(el("span", { class: "sep" }));
    const chosen = agents.filter((a) => sel.has(a.id));
    const idle = chosen.filter((a) => !a.plan), done = chosen.filter((a) => a.plan && Date.now() / 1000 >= a.unlock), pay = chosen.filter((a) => a.salary > 0n);
    const b = (label, cls, list, fn) => { const x = el("button", { class: "btn small " + cls, type: "button", text: label + (list.length ? " (" + list.length + ")" : ""), onclick: fn }); if (!list.length) x.disabled = true; return x; };
    bar.appendChild(b("Part-time 7d · 1×", "teal", idle, () => act("stake1", idle)));
    bar.appendChild(b("Full-time 30d · 4×", "", idle, () => act("stake2", idle)));
    bar.appendChild(b("Clock out", "paper", done, () => act("unstake", done)));
    bar.appendChild(b("Claim", "violet", pay, () => act("claim", pay)));
    bar.appendChild(b("Retire", "red", idle, () => act("burn", idle)));
    app.appendChild(bar);

    const grid = el("div", { class: "agrid" });
    const list = visible();
    if (!list.length) app.appendChild(el("div", { class: "empty", text: agents.length ? "No agents in this view." : "You have no agents yet." }));
    list.forEach((a) => grid.appendChild(card(a)));
    app.appendChild(grid);
    if (!agents.length) app.lastChild.previousSibling.appendChild(el("div", {}, [el("a", { class: "btn red", href: "/mine", text: "Mine your first agent" })]));
  }
  function visible() { return agents.filter((a) => filter === "all" || (filter === "idle" ? !a.plan : a.plan > 0)); }

  let live = null, liveAt = 0;
  const pays = new Map();
  function payEl(a) {
    const e = el("div", { class: "pay", text: "Salary: " + fmt.eth(a.salary || 0n, 7) + " ETH" });
    pays.set(a.id, [e, a]);
    return e;
  }
  function perSec(a) {
    if (!live || !a.plan || live.weight === 0n) return 0n;
    return BigInt(a.plan === 2 ? 4 : 1) * live.rate / live.weight / 10n ** 18n;
  }
  setInterval(() => {
    if (!live) return;
    const now = Date.now() / 1000;
    const secs = BigInt(Math.max(0, Math.floor(Math.min(now, live.finish) - liveAt)));
    for (const [id, [e, a]] of pays) {
      if (!document.body.contains(e)) { pays.delete(id); continue; }
      const v = (a.salary || 0n) + perSec(a) * secs;
      e.textContent = "Salary: " + fmt.eth(v, 7) + " ETH" + (perSec(a) > 0n ? " \u2191" : "");
    }
  }, 1000);
  const imgCache = {};
  function card(a) {
    const st = status(a);
    const img = el("div", { class: "img" });
    if (imgCache[a.id]) img.appendChild(el("img", { src: imgCache[a.id], alt: "Agent #" + a.id }));
    else { const c = el("canvas"); AT.scene(c, a.job, a.id); img.appendChild(c); lazyImg(a, img); }
    const c = el("div", { class: "acard px-drop" + (sel.has(a.id) ? " sel" : ""), role: "checkbox", "aria-checked": sel.has(a.id) ? "true" : "false", tabindex: "0" }, [
      img,
      el("span", { class: "tick", text: "✓" }),
      el("h3", {}, [el("span", { text: "#" + a.id }), el("small", { text: AT.JOBS[a.job].name })]),
      el("div", { class: "meta" }, [el("span", { class: "badge " + st.cls, text: st.text }), el("span", { text: st.note })]),
      payEl(a)
    ]);
    const toggle = () => { if (sel.has(a.id)) sel.delete(a.id); else sel.add(a.id); render(); };
    c.addEventListener("click", toggle);
    c.addEventListener("keydown", (e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); toggle(); } });
    return c;
  }
  let io = null;
  function lazyImg(a, box) {
    if (AT.PREVIEW) return;
    io = io || new IntersectionObserver((es) => es.forEach(async (en) => {
      if (!en.isIntersecting) return;
      io.unobserve(en.target);
      const ag = en.target._agent;
      try {
        const uri = await AT.town.tokenURI(ag.id);
        const json = JSON.parse(uri.startsWith("data:application/json;base64,") ? atob(uri.split(",")[1]) : decodeURIComponent(uri.split(",").slice(1).join(",")));
        if (json.image) { imgCache[ag.id] = json.image; en.target.innerHTML = ""; en.target.appendChild(el("img", { src: json.image, alt: "Agent #" + ag.id })); }
      } catch (e) {}
    }), { rootMargin: "200px" });
    box._agent = a; io.observe(box);
  }

  async function act(kind, list) {
    if (!list.length) return;
    const ids = list.map((a) => a.id);
    const to = AT.CFG.town;
    try {
      if (kind === "stake1" || kind === "stake2") {
        const plan = kind === "stake1" ? 1 : 2;
        await W.txFlow("Clock in", to, AT.abi.calldata("stake(uint256[],uint8)", ["uint256[]", "uint8"], [ids, plan]));
        const first = ids[0];
        AT.toast("Off to work!", el("a", { href: "/town?agent=" + first + "&walk=1", text: "Watch #" + first + " walk to work" }), "", 12000);
      } else if (kind === "unstake") {
        await W.txFlow("Clock out", to, AT.abi.calldata("unstake(uint256[])", ["uint256[]"], [ids]));
      } else if (kind === "claim") {
        await W.txFlow("Claim salary", to, AT.abi.calldata("claimSalary(uint256[])", ["uint256[]"], [ids]));
      } else if (kind === "burn") {
        const reward = list.reduce((s, a) => s + (a.reward || 0n), 0n);
        const ok = await new Promise((res) => AT.modal("Retire " + ids.length + " agent" + (ids.length > 1 ? "s" : "") + "?", el("div", {}, [
          el("p", { text: "Retiring burns " + ids.map((i) => "#" + i).join(", ") + " forever. This cannot be undone." }),
          el("p", { text: "You receive their unpaid salary plus about " + fmt.num(Number(reward / 10n ** 18n)) + " $TOWN." })
        ]), [{ label: "Cancel", cls: "paper", run: (c) => { c(); res(false); } }, { label: "Retire forever", cls: "red", run: (c) => { c(); res(true); } }]));
        if (!ok) return;
        for (const id of ids) await W.txFlow("Retire #" + id, to, AT.abi.calldata("burn(uint256)", ["uint256"], [id]));
      }
      sel.clear();
      await load();
    } catch (e) {}
  }

  async function load() {
    if (loading) return;
    loading = true;
    try {
      const ms = await AT.town.miningState();
      let ids = [];
      for (let i = 1; i <= ms.minted; i += 2000) ids = ids.concat(await AT.town.tokensOfOwner(W.account, i, Math.min(ms.minted, i + 1999)));
      const out = [];
      for (let i = 0; i < ids.length; i += 100) {
        const part = ids.slice(i, i + 100);
        const [packed, salary, reward] = await AT.town.agentInfo(part);
        part.forEach((id, k) => { const a = AT.decodeAgent(packed[k]); a.id = id; a.salary = salary[k]; a.reward = reward[k]; out.push(a); });
      }
      agents = out.sort((p, q) => p.id - q.id);
      try { live = await AT.town.salaryState(); liveAt = Date.now() / 1000; } catch (e) { live = null; }
      [...sel].forEach((id) => { if (!agents.some((a) => a.id === id)) sel.delete(id); });
      render();
    } catch (e) {
      hero(["Could not load", "The chain did not answer. Please try again in a moment."], el("button", { class: "btn", type: "button", text: "Retry", onclick: () => load() }));
    }
    loading = false;
  }

  function boot() {
    if (AT.PREVIEW) {
      hero(["Hiring opens soon", "Once agents can be mined, the ones in your wallet will show up here. You can clock them in, claim salary and retire them."], el("a", { class: "btn red", href: "/mine", text: "Test your miner" }));
      const demo = AT.demoTown(6, 3).map((a, i) => Object.assign(a, { salary: BigInt(i * 137) * 10n ** 12n }));
      const grid = el("div", { class: "agrid" });
      app.appendChild(el("div", { class: "sec-head" }, [el("span", { class: "tag", html: "<i></i>Example" }), el("h2", { text: "How it will look" })]));
      demo.forEach((a) => { const c = card(a); c.style.pointerEvents = "none"; grid.appendChild(c); });
      app.appendChild(grid);
      return;
    }
    if (!W.account) {
      hero(["Connect your wallet", "See your agents, put them to work and collect salary."], el("button", { class: "btn big red", type: "button", text: "Connect wallet", onclick: () => W.connect() }));
      return;
    }
    hero(["Loading your agents…", "Checking the town records."], null);
    load();
  }
  window.addEventListener("at:wallet", boot);
  boot();
})();
