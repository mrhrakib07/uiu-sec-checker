(() => {
  const DAYS = ["Sat", "Sun", "Tue", "Wed"];
  const PAIRS = [["Sat", "Tue"], ["Sun", "Wed"]];
  const DAY_START = 8 * 60 + 30;   // 08:30
  const DAY_END = 16 * 60 + 30;    // 16:30

  const t = (h, m) => h * 60 + m;
  const THEORY_SLOTS = [
    [t(8, 30), t(9, 50)], [t(9, 51), t(11, 10)], [t(11, 11), t(12, 30)],
    [t(12, 31), t(13, 50)], [t(13, 51), t(15, 10)], [t(15, 11), t(16, 30)],
  ];
  const LAB_SLOTS = [
    [t(8, 30), t(11, 0)], [t(11, 11), t(13, 40)], [t(14, 0), t(16, 30)],
  ];
  const COLORS = ["#ea580c", "#2563eb", "#7c3aed", "#059669", "#db2777", "#0891b2", "#ca8a04", "#4f46e5"];

  const pad = n => String(n).padStart(2, "0");
  const fmt = m => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
  const dur = m => { const h = Math.floor(m / 60), r = m % 60; return h ? (r ? `${h}h ${r}m` : `${h}h`) : `${r}m`; };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const $ = id => document.getElementById(id);

  // ---------- state ----------
  let courses = [];
  try { courses = JSON.parse(localStorage.getItem("uiu-planner") || "[]"); } catch (e) { courses = []; }
  const save = () => { try { localStorage.setItem("uiu-planner", JSON.stringify(courses)); } catch (e) {} };

  const form = { type: "theory", pair: 0, labDay: "Sat", slot: 0, editId: null };
  const slotsFor = type => (type === "lab" ? LAB_SLOTS : THEORY_SLOTS);
  const colorFor = c => COLORS[courses.findIndex(x => x.id === c.id) % COLORS.length];

  // ---------- helpers ----------
  const getRange = c => slotsFor(c.type)[c.slot];
  const daysOf = c => c.days;
  const overlap = (a, b) => a[0] < b[1] && b[0] < a[1];

  function currentDraft() {
    return {
      id: form.editId || "draft",
      type: form.type,
      slot: form.slot,
      days: form.type === "lab" ? [form.labDay] : PAIRS[form.pair],
    };
  }

  function conflictsWith(draft, ignoreId) {
    const out = [];
    const r = getRange(draft);
    courses.forEach(c => {
      if (c.id === ignoreId) return;
      const shared = daysOf(c).filter(d => draft.days.includes(d));
      if (shared.length && overlap(r, getRange(c))) out.push({ course: c, days: shared });
    });
    return out;
  }

  function allConflicts() {
    const list = [];
    for (let i = 0; i < courses.length; i++)
      for (let j = i + 1; j < courses.length; j++) {
        const a = courses[i], b = courses[j];
        const shared = daysOf(a).filter(d => daysOf(b).includes(d));
        if (shared.length && overlap(getRange(a), getRange(b))) list.push({ a, b, days: shared });
      }
    return list;
  }

  const label = c => `${c.code}${c.section ? " (" + c.section + ")" : ""}`;

  // ---------- form UI ----------
  function renderForm() {
    document.querySelectorAll("#typeSeg button").forEach(b => b.classList.toggle("on", b.dataset.v === form.type));

    const daySeg = $("daySeg");
    if (form.type === "lab") {
      daySeg.innerHTML = DAYS.map(d => `<button type="button" data-day="${d}" class="${d === form.labDay ? "on" : ""}">${d}</button>`).join("");
    } else {
      daySeg.innerHTML = PAIRS.map((p, i) => `<button type="button" data-pair="${i}" class="${i === form.pair ? "on" : ""}">${p[0]} + ${p[1]}</button>`).join("");
    }

    const draftDays = currentDraft().days;
    const slots = slotsFor(form.type);
    $("slotChips").innerHTML = slots.map((s, i) => {
      const probe = { id: "probe", type: form.type, slot: i, days: draftDays };
      const busy = conflictsWith(probe, form.editId).length > 0;
      return `<button type="button" class="chip ${i === form.slot ? "on" : ""} ${busy ? "busy" : ""}" data-slot="${i}">${fmt(s[0])}–${fmt(s[1])}${busy ? "<small>clashes</small>" : ""}</button>`;
    }).join("");
    $("slotChips").style.gridTemplateColumns = form.type === "lab" ? "1fr" : "1fr 1fr";

    const cl = conflictsWith(currentDraft(), form.editId);
    const live = $("liveCheck");
    if (!courses.length && !form.editId) { live.className = "live"; live.textContent = ""; }
    else if (cl.length) {
      live.className = "live warn";
      live.textContent = "Clashes with " + cl.map(x => `${label(x.course)} on ${x.days.join("/")}`).join(", ");
    } else { live.className = "live ok"; live.textContent = "✓ No conflict with your other courses"; }
  }

  $("typeSeg").addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    form.type = b.dataset.v; form.slot = 0;
    renderForm();
  });
  $("daySeg").addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.pair !== undefined) form.pair = +b.dataset.pair;
    if (b.dataset.day) form.labDay = b.dataset.day;
    renderForm();
  });
  $("slotChips").addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    form.slot = +b.dataset.slot; renderForm();
  });

  function resetForm() {
    form.editId = null;
    $("form").reset();
    $("formTitle").textContent = "Add a course";
    $("submitBtn").textContent = "Add course";
    $("cancelEdit").hidden = true;
    renderForm();
  }
  $("cancelEdit").addEventListener("click", resetForm);

  $("form").addEventListener("submit", e => {
    e.preventDefault();
    const code = $("code").value.trim().replace(/\s+/g, " ");
    const section = $("section").value.trim().toUpperCase();
    const faculty = $("faculty").value.trim();
    if (!code || !section || !faculty) return;
    const draft = currentDraft();
    const data = {
      code, section, faculty,
      credit: form.type === "lab" ? 1 : 3,
      type: form.type, slot: form.slot, days: draft.days,
    };
    if (form.editId) {
      courses = courses.map(c => (c.id === form.editId ? { ...c, ...data } : c));
    } else {
      courses.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), ...data });
    }
    save();
    resetForm();
    renderAll();
    $("code").focus();
  });

  // ---------- course list ----------
  function renderList() {
    const conf = allConflicts();
    const inConf = new Set(conf.flatMap(x => [x.a.id, x.b.id]));
    $("emptyList").style.display = courses.length ? "none" : "block";
    $("courseList").innerHTML = courses.map(c => {
      const r = getRange(c);
      const dup = courses.filter(x => x.code.toLowerCase() === c.code.toLowerCase() && x.type === c.type).length > 1;
      return `<li class="ci ${inConf.has(c.id) ? "hasconf" : ""}" style="border-left-color:${colorFor(c)}">
        <div class="body">
          <b>${esc(c.code)} · ${esc(c.section)}</b> <span class="muted">${c.type === "lab" ? "Lab" : "Theory"} · ${c.credit} cr</span>
          <div class="meta">${c.days.join(" + ")} · ${fmt(r[0])}–${fmt(r[1])}${c.faculty ? " · " + esc(c.faculty) : ""}</div>
          ${dup ? `<div class="meta" style="color:var(--bad)">Same course added more than once</div>` : ""}
        </div>
        <div class="btns">
          <button class="ib" data-edit="${c.id}" title="Change section / time">✎</button>
          <button class="ib del" data-del="${c.id}" title="Remove">✕</button>
        </div>
      </li>`;
    }).join("");
  }

  $("courseList").addEventListener("click", e => {
    const del = e.target.closest("[data-del]");
    const ed = e.target.closest("[data-edit]");
    if (del) { courses = courses.filter(c => c.id !== del.dataset.del); if (form.editId === del.dataset.del) resetForm(); save(); renderAll(); }
    if (ed) startEdit(ed.dataset.edit);
  });

  function startEdit(id) {
    const c = courses.find(x => x.id === id); if (!c) return;
    form.editId = id; form.type = c.type; form.slot = c.slot;
    if (c.type === "lab") form.labDay = c.days[0];
    else form.pair = PAIRS.findIndex(p => p[0] === c.days[0]);
    $("code").value = c.code; $("section").value = c.section;
    $("faculty").value = c.faculty || "";
    $("formTitle").textContent = `Edit ${c.code}`;
    $("submitBtn").textContent = "Save changes";
    $("cancelEdit").hidden = false;
    renderForm();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  $("clearAll").addEventListener("click", () => {
    if (courses.length && confirm("Remove all courses?")) { courses = []; save(); resetForm(); renderAll(); }
  });

  // ---------- timetable ----------
  function renderTimetable() {
    const PX = 1.15;                          // px per minute
    const H = (DAY_END - DAY_START) * PX;
    const conf = allConflicts();
    const confIds = new Set(conf.flatMap(x => [x.a.id, x.b.id]));
    const tt = $("timetable");
    tt.style.setProperty("--h", H + "px");
    tt.style.setProperty("--hr", 60 * PX + "px");

    let html = `<div></div>` + DAYS.map(d => `<div class="head">${d}</div>`).join("");
    // axis
    let axis = "";
    for (let m = DAY_START; m <= DAY_END; m += 60) axis += `<span style="top:${(m - DAY_START) * PX}px">${fmt(m)}</span>`;
    html += `<div class="axis">${axis}</div>`;

    DAYS.forEach(d => {
      const evs = courses.filter(c => c.days.includes(d)).map(c => ({ c, r: getRange(c) })).sort((a, b) => a.r[0] - b.r[0]);
      // lane assignment
      const lanes = [];
      evs.forEach(ev => {
        let l = lanes.findIndex(end => end <= ev.r[0]);
        if (l === -1) { l = lanes.length; lanes.push(0); }
        lanes[l] = ev.r[1]; ev.lane = l;
      });
      const nl = Math.max(lanes.length, 1);

      // free gaps between classes
      let gapHtml = "";
      freeRanges(evs.map(e => e.r)).forEach(g => {
        if (g[1] - g[0] >= 40 && evs.length)
          gapHtml += `<div class="gapzone" style="top:${(g[0] - DAY_START) * PX}px;height:${(g[1] - g[0]) * PX}px">${dur(g[1] - g[0])} free</div>`;
      });

      const blocks = evs.map(ev => {
        const c = ev.c, w = 100 / nl;
        return `<div class="blk ${confIds.has(c.id) && hasClashOnDay(c, d) ? "conflict" : ""}" data-edit="${c.id}"
          style="top:${(ev.r[0] - DAY_START) * PX}px;height:${(ev.r[1] - ev.r[0]) * PX - 2}px;left:calc(${ev.lane * w}% + 2px);width:calc(${w}% - 4px);background:${colorFor(c)}">
          <b>${esc(c.code)} · ${esc(c.section)}</b><small>${fmt(ev.r[0])}–${fmt(ev.r[1])}</small>${c.faculty && nl === 1 ? `<br><small>${esc(c.faculty)}</small>` : ""}
        </div>`;
      }).join("");
      html += `<div class="col">${gapHtml}${blocks}</div>`;
    });
    tt.innerHTML = html;
    tt.querySelectorAll(".blk").forEach(b => b.addEventListener("click", () => startEdit(b.dataset.edit)));
  }

  function hasClashOnDay(c, d) {
    return courses.some(o => o.id !== c.id && o.days.includes(d) && overlap(getRange(o), getRange(c)));
  }

  function freeRanges(ranges) {
    const sorted = ranges.slice().sort((a, b) => a[0] - b[0]);
    const out = []; let cur = DAY_START;
    sorted.forEach(r => { if (r[0] > cur) out.push([cur, r[0]]); cur = Math.max(cur, r[1]); });
    if (cur < DAY_END) out.push([cur, DAY_END]);
    return out;
  }

  // ---------- gaps ----------
  function renderGaps() {
    const confs = allConflicts();
    $("gaps").innerHTML = DAYS.map(d => {
      const evs = courses.filter(c => c.days.includes(d)).map(c => ({ c, r: getRange(c) })).sort((a, b) => a.r[0] - b.r[0]);
      if (!evs.length) return `<div class="gd"><h3>${d}<small>no class</small></h3><ul><li class="off">Off day 🎉</li></ul></div>`;
      const dayConf = confs.filter(x => x.days.includes(d));
      const clashIds = new Set(dayConf.flatMap(x => [x.a.id, x.b.id]));
      const first = evs[0].r[0], last = Math.max(...evs.map(e => e.r[1]));
      const items = []; let cur = first;
      evs.forEach(ev => {
        if (ev.r[0] > cur) {
          const g = ev.r[0] - cur;
          items.push(`<li class="free ${g >= 80 ? "long" : ""}"><span>Gap ${fmt(cur)}–${fmt(ev.r[0])}</span><span>${dur(g)}</span></li>`);
        }
        items.push(`<li class="cls ${clashIds.has(ev.c.id) ? "clash" : ""}"><span>${esc(ev.c.code)} ${esc(ev.c.section)}</span><span>${fmt(ev.r[0])}–${fmt(ev.r[1])}</span></li>`);
        cur = Math.max(cur, ev.r[1]);
      });
      const total = freeRanges(evs.map(e => e.r)).filter(g => g[0] >= first && g[1] <= last).reduce((s, g) => s + g[1] - g[0], 0);
      const warn = dayConf.length
        ? `<div class="warn">⚠ Class conflict: ${dayConf.map(x => `${esc(label(x.a))} ↔ ${esc(label(x.b))}`).join(", ")}</div>`
        : "";
      return `<div class="gd ${dayConf.length ? "conflict" : ""}"><h3>${d}<small>${fmt(first)}–${fmt(last)}${total ? " · " + dur(total) + " gap" : ""}</small></h3>${warn}<ul>${items.join("")}</ul></div>`;
    }).join("");
  }

  // ---------- conflicts + stats ----------
  function renderConflicts() {
    const conf = allConflicts();
    $("conflictCard").hidden = !conf.length;
    $("conflicts").innerHTML = conf.map(x =>
      `<li><b>${esc(label(x.a))}</b> ↔ <b>${esc(label(x.b))}</b> · ${x.days.join(", ")} · ${fmt(getRange(x.a)[0])}–${fmt(getRange(x.a)[1])} vs ${fmt(getRange(x.b)[0])}–${fmt(getRange(x.b)[1])}</li>`).join("");
    $("statCourses").textContent = courses.length;
    $("statCredits").textContent = courses.reduce((s, c) => s + (+c.credit || 0), 0);
    $("statConf").textContent = conf.length;
    $("statConfBox").className = "stat" + (conf.length ? " bad" : "");
  }

  function renderAll() {
    renderForm(); renderList(); renderTimetable(); renderGaps(); renderConflicts();
  }

  resetForm();
  renderAll();
})();
