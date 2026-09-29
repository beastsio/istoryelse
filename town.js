(function () {
  const AT = window.AT, el = AT.el, fmt = AT.fmt;
  const $ = (id) => document.getElementById(id);
  const labels = {};
  let town, card = null, mineIds = [], mineIdx = 0;

  town = AT.createTown($("map"), {
    onAgent: (a) => showAgent(a),
    onDistrict: (d, list) => openDistrict(d.id),
    onArrive: (a) => AT.toast("Clocked in", "Agent #" + a.id + " is now working as " + AT.JOBS[a.job].name + "."),
    onFrame: placeLabels
  });

  AT.DISTRICTS.forEach((d) => {
    const b = el("button", { class: "dl", type: "button", onclick: () => openDistrict(d.id) }, [d.name, el("b", { text: "0" })]);
    $("labels").appendChild(b);
    labels[d.id] = b;
  });

  function placeLabels(api) {
    const counts = api.counts();
    for (const id in labels) {
      const bl = api.blocks[id];
      const [x, y] = api.screenOf(bl.x + bl.w / 2, bl.y + 2);
      const lb = labels[id];
      lb.style.transform = "translate(" + Math.round(x - lb.offsetWidth / 2) + "px," + Math.round(y - lb.offsetHeight - 2) + "px)";
      const n = String(counts[id] || 0);
      if (lb.lastChild.textContent !== n) lb.lastChild.textContent = fmt.num(n);
    }
  }

  function stats() {
    const w = town.working().length, all = town.agents().length;
    $("sWork").textContent = fmt.num(w);
    $("sIdle").textContent = fmt.num(all - w);
  }

  function planBadge(a) {
    if (!a.plan) return el("span", { class: "badge idle", text: "Idle" });
    const now = Date.now() / 1000;
    if (a.unlock && now >= a.unlock) return el("span", { class: "badge done", text: (a.plan === 2 ? "Full-time" : "Part-time") + " · free" });
    return el("span", { class: "badge " + (a.plan === 2 ? "full" : "part"), text: a.plan === 2 ? "Full-time 4×" : "Part-time 1×" });
  }

  function openDistrict(id) {
    const d = AT.DISTRICTS.find((q) => q.id === id);
    const list = town.districtList(id).slice().sort((p, q) => p.since - q.since);
    town.select(id);
    Object.values(labels).forEach((l) => l.classList.remove("on"));
    labels[id].classList.add("on");
    $("dName").textContent = d.name;
    $("dSub").textContent = fmt.num(list.length) + " agents at work here";
    const body = $("dBody");
    body.innerHTML = "";
    body.appendChild(el("h3", { text: "Jobs here" }));
    const jobs = el("div", { class: "djobs" });
    const all = town.agents();
    d.jobs.forEach((j) => {
      const c = el("canvas");
      const n = list.filter((a) => a.job === j).length;
      const total = all.filter((a) => a.job === j).length;
      jobs.appendChild(el("div", { class: "djob" }, [c, el("div", {}, [el("b", { text: AT.JOBS[j].name }), el("span", { text: AT.JOBS[j].blurb })]), el("em", { html: fmt.num(n) + "<small>of " + fmt.num(total) + " at work</small>" })]));
      AT.scene(c, j, j);
    });
    body.appendChild(jobs);
    body.appendChild(el("h3", { text: "Who works here" }));
    const box = el("div", { class: "alist" });
    body.appendChild(box);
    let shown = 0;
    const more = el("button", { class: "btn small paper more", type: "button", text: "Show more", onclick: () => page() });
    function page() {
      list.slice(shown, shown + 60).forEach((a) => {
        const c = el("canvas"); AT.portrait(c, a, 2);
        const days = Math.max(0, Math.floor((Date.now() / 1000 - a.since) / 86400));
        box.appendChild(el("button", { class: "arow", type: "button", onclick: () => { town.focus(a.id); showAgent(a); } }, [c, el("div", {}, [el("b", { text: "#" + a.id + " " }), AT.JOBS[a.job].name, el("div", { html: "<small>working " + days + " days</small>" })]), planBadge(a)]));
      });
      shown += 60;
      if (shown >= list.length) more.remove(); else body.appendChild(more);
    }
    if (!list.length) box.appendChild(el("p", { text: "Nobody is working here yet. Be the first!" }));
    else page();
    body.appendChild(el("a", { class: "btn small red more", href: "/agents", text: "Put your agent to work" }));
    $("drawer").classList.add("open");
  }
  $("dClose").addEventListener("click", () => { $("drawer").classList.remove("open"); town.select(null); Object.values(labels).forEach((l) => l.classList.remove("on")); });

  async function showAgent(a) {
    if (card) card.remove();
    const job = AT.JOBS[a.job], d = AT.DISTRICTS.find((q) => q.id === job.district);
    const pic = el("div", { class: "pic" });
    const c = el("canvas"); AT.portrait(c, a, 8); pic.appendChild(c);
    const now = Date.now() / 1000;
    const rows = [["District", d.name], ["Shift", a.plan ? (a.plan === 2 ? "Full-time 4×" : "Part-time 1×") : "Idle, not earning"]];
    if (a.plan) {
      rows.push(["Working", Math.max(0, Math.floor((now - a.since) / 86400)) + " days"]);
      rows.push(["Shift ends", a.unlock <= now ? "Done, can clock out" : fmt.date(a.unlock)]);
    }
    rows.push(["Chassis", AT.PAL.chassis[a.chassis][0]], ["Glow", AT.PAL.glow[a.glow][0]], ["Eyes", AT.PAL.eyes[a.eyes]], ["Head", AT.PAL.heads[a.head]], ["Hat", AT.hatName(a)]);
    const dl = el("dl");
    rows.forEach(([k, v]) => { dl.appendChild(el("dt", { text: k })); dl.appendChild(el("dd", { text: v })); });
    card = el("div", { class: "card-pop px-drop" }, [pic, el("div", {}, [el("h3", { text: "Agent #" + a.id }), el("div", { class: "sub", text: job.name }), dl]), el("button", { class: "x", type: "button", "aria-label": "Close", text: "×", onclick: () => { card.remove(); card = null; } })]);
    $("stage").appendChild(card);
    if (!AT.PREVIEW) {
      try {
        const uri = await AT.town.tokenURI(a.id);
        const json = JSON.parse(uri.startsWith("data:application/json;base64,") ? atob(uri.split(",")[1]) : decodeURIComponent(uri.split(",").slice(1).join(",")));
        if (json.image && card && card.contains(pic)) { pic.innerHTML = ""; pic.appendChild(el("img", { src: json.image, alt: "Agent #" + a.id })); }
      } catch (e) {}
    }
  }

  $("zIn").addEventListener("click", () => town.zoom(1));
  $("zOut").addEventListener("click", () => town.zoom(-1));
  const dn = $("dayNight");
  const paintDN = () => { dn.textContent = town.isNight() ? "Day" : "Night"; };
  dn.addEventListener("click", () => { town.setNight(!town.isNight()); paintDN(); });
  paintDN();
  $("fold").addEventListener("click", () => { $("hud").classList.toggle("min"); $("fold").innerHTML = $("hud").classList.contains("min") ? "+" : "&minus;"; });
  if (window.innerWidth < 760) { $("hud").classList.add("min"); $("fold").textContent = "+"; }

  $("find").addEventListener("submit", (e) => {
    e.preventDefault();
    const id = parseInt($("findId").value, 10);
    const a = town.agents().find((q) => q.id === id);
    if (!a) { AT.toast("Not found", "Agent #" + (id || "?") + " is not in town yet.", "bad"); return; }
    town.focus(id);
    showAgent(a);
    if (!a.plan) AT.toast("Agent #" + id, "This agent is idle and walking around town.");
  });

  $("mineBtn").addEventListener("click", () => {
    if (!mineIds.length) return;
    const id = mineIds[mineIdx++ % mineIds.length];
    const a = town.agents().find((q) => q.id === id);
    town.focus(id); if (a) showAgent(a);
  });

  async function loadMine() {
    const W = AT.wallet;
    if (!W.account || AT.PREVIEW) { $("mineBtn").hidden = true; town.setMine([]); return; }
    try {
      const all = town.agents();
      const max = all.reduce((m, a) => Math.max(m, a.id), 0);
      let ids = [];
      for (let i = 1; i <= max; i += 2000) ids = ids.concat(await AT.town.tokensOfOwner(W.account, i, Math.min(max, i + 1999)));
      mineIds = ids;
      town.setMine(ids);
      $("mineBtn").hidden = !ids.length;
      $("mineBtn").textContent = "My agents (" + ids.length + ")";
    } catch (e) {}
  }
  window.addEventListener("at:wallet", loadMine);

  $("pv").hidden = !AT.PREVIEW;
  AT.loadAgents((p) => { $("lbar").style.width = Math.round(5 + p * 95) + "%"; }).then((r) => {
    town.setAgents(r.list);
    stats();
    $("lbar").style.width = "100%";
    setTimeout(() => $("loading").classList.add("gone"), 250);
    loadMine();
    const q = new URLSearchParams(location.search);
    const aid = parseInt(q.get("agent"), 10);
    if (aid) {
      const a = town.agents().find((x) => x.id === aid);
      if (a) {
        const r2 = town.focus(aid, q.get("walk") === "1" && a.plan > 0);
        if (q.get("walk") === "1" && a.plan > 0) AT.toast("On the way", "Agent #" + aid + " is walking to " + AT.DISTRICTS.find((d) => d.id === AT.JOBS[a.job].district).name + ".");
        else showAgent(a);
      }
    } else if (q.get("d") && labels[q.get("d")]) openDistrict(q.get("d"));
  }).catch((e) => {
    $("loading").firstChild.textContent = "Could not reach the chain. Showing the preview town.";
    town.setAgents(AT.demoTown(6385, 2400)); stats();
    setTimeout(() => $("loading").classList.add("gone"), 1200);
  });
})();
