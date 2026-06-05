/* =========================================================
   The timeline / scrapbook — our memories.
   Two views of the same data:
     • Scrapbook  — tilted polaroids on paper
     • Constellation — memories as connected stars
   Photos live in a private Supabase Storage bucket ("memories")
   and are shown via short-lived signed URLs.
   ========================================================= */

import { supabase } from "./supabase.js";

let root = null;
let memories = [];
let mode = "scrapbook";

export async function initTimeline(container) {
  root = container;
  root.innerHTML = shell();
  wire();
  await load();
}

/* ---------- data ---------- */
async function load() {
  const { data, error } = await supabase
    .from("memories")
    .select("*")
    .order("event_date", { ascending: true });

  if (error) { setStatus("couldn't load memories 😿 — " + error.message); return; }
  memories = data || [];
  render();
}

async function addMemory(form) {
  const fd = new FormData(form);
  const title = (fd.get("title") || "").toString().trim();
  const date  = fd.get("date");
  const note  = (fd.get("note") || "").toString().trim() || null;
  const file  = fd.get("photo");
  if (!title || !date) return;

  setSaving(true);
  let photo_path = null;

  if (file && file.size) {
    if (file.size > 10 * 1024 * 1024) {
      setStatus("that photo's a bit big (max 10MB) 🐾"); setSaving(false); return;
    }
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    photo_path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error: upErr } = await supabase.storage.from("memories").upload(photo_path, file);
    if (upErr) { setStatus("photo upload failed 😿 — " + upErr.message); setSaving(false); return; }
  }

  const { error } = await supabase.from("memories")
    .insert({ title, note, event_date: date, photo_path });

  setSaving(false);
  if (error) { setStatus("couldn't save 😿 — " + error.message); return; }

  closeForm();
  setStatus("");
  await load();
}

/* signed URL for a private photo (1h) */
async function signed(path) {
  const { data } = await supabase.storage.from("memories").createSignedUrl(path, 3600);
  return data ? data.signedUrl : null;
}

/* ---------- render ---------- */
function render() {
  root.querySelectorAll(".tl-toggle button").forEach((b) =>
    b.classList.toggle("active", b.dataset.mode === mode));

  const view = root.querySelector(".tl-view");
  if (memories.length === 0) {
    view.innerHTML = `<p class="tl-empty">no memories yet —
      tap <strong>+ add a memory</strong> to start our scrapbook 🤍</p>`;
    return;
  }
  if (mode === "scrapbook") renderScrapbook(view);
  else renderConstellation(view);
}

function renderScrapbook(view) {
  view.innerHTML = `<div class="scrapbook">${memories.map(polaroid).join("")}</div>`;
  memories.forEach(async (m) => {
    if (!m.photo_path) return;
    const url = await signed(m.photo_path);
    const holder = view.querySelector(`.po-photo[data-id="${m.id}"]`);
    if (url && holder) {
      holder.style.backgroundImage = `url("${url}")`;
      holder.classList.add("loaded");
      holder.innerHTML = "";
    }
  });
}

function polaroid(m) {
  const dateStr = fmtDate(m.event_date);
  const note = m.note ? `<p class="po-note">${esc(m.note)}</p>` : "";
  const photo = m.photo_path
    ? `<div class="po-photo" data-id="${m.id}"><span class="po-loading">🐾</span></div>`
    : `<div class="po-photo po-nophoto">🤍</div>`;
  return `
  <figure class="polaroid" style="--rot:${rot(m.id)}deg">
    <span class="po-tape" aria-hidden="true"></span>
    ${photo}
    <figcaption>
      <span class="po-title">${esc(m.title)}</span>
      <span class="po-date">${dateStr}</span>
      ${note}
    </figcaption>
  </figure>`;
}

function renderConstellation(view) {
  const W = 820, H = 460, n = memories.length;
  const pts = memories.map((m, i) => ({
    x: 70 + (W - 140) * (n === 1 ? 0.5 : i / (n - 1)),
    y: H / 2 + Math.sin(i * 1.7 + 0.5) * (H / 2 - 90),
    m,
  }));
  const path = pts.map((p, i) => (i ? "L" : "M") + p.x.toFixed(0) + " " + p.y.toFixed(0)).join(" ");
  const stars = pts.map((p) => `
    <g class="cstar" data-id="${p.m.id}" transform="translate(${p.x.toFixed(0)},${p.y.toFixed(0)})">
      <circle r="16" fill="transparent"/>
      <path class="star-shape" d="M0 -8 L2.2 -2.4 L8 -2.4 L3.4 1.6 L5.2 7.4 L0 3.8 L-5.2 7.4 L-3.4 1.6 L-8 -2.4 L-2.2 -2.4 Z"/>
    </g>`).join("");

  view.innerHTML = `
    <div class="sky-wrap">
      <svg viewBox="0 0 ${W} ${H}" class="sky-svg" preserveAspectRatio="xMidYMid meet">
        <path d="${path}" fill="none" stroke="rgba(246,231,176,0.4)" stroke-width="1.5" stroke-dasharray="3 5"/>
        ${stars}
      </svg>
      <div class="star-pop" hidden></div>
    </div>
    <p class="sky-hint">tap a star ✦</p>`;

  view.querySelectorAll(".cstar").forEach((s) =>
    s.addEventListener("click", () => showStar(s.dataset.id)));
  view.querySelector(".sky-svg").addEventListener("click", (e) => {
    if (!e.target.closest(".cstar")) view.querySelector(".star-pop").hidden = true;
  });
}

async function showStar(id) {
  const m = memories.find((x) => x.id === id);
  if (!m) return;
  const pop = root.querySelector(".star-pop");
  let img = "";
  if (m.photo_path) {
    const url = await signed(m.photo_path);
    if (url) img = `<img src="${url}" alt="" />`;
  }
  pop.innerHTML = `${img}<strong>${esc(m.title)}</strong>
    <span class="pop-date">${fmtDate(m.event_date)}</span>
    ${m.note ? `<p>${esc(m.note)}</p>` : ""}`;
  pop.hidden = false;
}

/* ---------- wiring ---------- */
function wire() {
  root.querySelector(".tl-add").addEventListener("click", openForm);
  root.querySelector(".tl-cancel").addEventListener("click", closeForm);
  root.querySelector(".tl-modal").addEventListener("click", (e) => {
    if (e.target.classList.contains("tl-modal")) closeForm();
  });
  root.querySelector(".tl-form").addEventListener("submit", (e) => {
    e.preventDefault();
    addMemory(e.currentTarget);
  });
  root.querySelector(".tl-toggle").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (b) { mode = b.dataset.mode; render(); }
  });
}

function openForm()  { root.querySelector(".tl-modal").hidden = false; }
function closeForm() { root.querySelector(".tl-modal").hidden = true; root.querySelector(".tl-form").reset(); }
function setStatus(t){ root.querySelector(".tl-status").textContent = t; }
function setSaving(on) {
  const btn = root.querySelector(".tl-save");
  btn.disabled = on;
  btn.textContent = on ? "saving…" : "save it 🤍";
}

/* ---------- helpers ---------- */
function fmtDate(d) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-GB",
    { day: "numeric", month: "short", year: "numeric" });
}
function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function rot(id) {
  let h = 0;
  for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) % 9;
  return ((h - 4) * 0.8).toFixed(2);
}

/* ---------- markup ---------- */
function shell() {
  return `
  <div class="journal tl">
    <p class="kicker">our memories, kept</p>
    <h2 class="title title--sm">the scrapbook</h2>
    <p class="tl-status"></p>

    <div class="tl-bar">
      <div class="tl-toggle">
        <button data-mode="scrapbook" class="active">📖 scrapbook</button>
        <button data-mode="constellation">✦ constellation</button>
      </div>
      <button class="tl-add btn">+ add a memory</button>
    </div>

    <div class="tl-view"></div>
  </div>

  <div class="tl-modal" hidden>
    <form class="tl-form">
      <p class="tl-form-title">a new memory</p>
      <label>what happened?
        <input name="title" required maxlength="80" placeholder="our first…" />
      </label>
      <label>when?
        <input name="date" type="date" required />
      </label>
      <label>a little note <span class="opt">(optional)</span>
        <textarea name="note" maxlength="500" rows="2" placeholder="something to remember about it…"></textarea>
      </label>
      <label>a photo <span class="opt">(optional)</span>
        <input name="photo" type="file" accept="image/*" />
      </label>
      <div class="tl-form-actions">
        <button type="button" class="tl-cancel">never mind</button>
        <button type="submit" class="btn tl-save">save it 🤍</button>
      </div>
    </form>
  </div>`;
}
