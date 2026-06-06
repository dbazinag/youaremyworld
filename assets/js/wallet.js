/* =========================================================
   The treats economy 🐟 — shared currency, shop catalog,
   owned unlocks, and what's equipped (cat hats + room decor).
   One shared wallet row; syncs live via Supabase realtime.
   Other modules subscribe via onWalletChange().
   ========================================================= */

import { supabase } from "./supabase.js";

// flat hand-drawn SVG objects (warm palette, dark outline) — not emoji
const HAT = {
  bow:    `<svg viewBox="0 0 40 28"><g stroke="#9a5a44" stroke-width="2" stroke-linejoin="round"><path d="M20 16 L6 8 L6 24 Z" fill="#e3a692"/><path d="M20 16 L34 8 L34 24 Z" fill="#e3a692"/><circle cx="20" cy="16" r="4.5" fill="#c8785b"/></g></svg>`,
  flower: `<svg viewBox="0 0 36 30"><g stroke="#7a8a5a" stroke-width="1.5"><g fill="#e3a692"><circle cx="18" cy="8" r="5.5"/><circle cx="27" cy="14" r="5.5"/><circle cx="23" cy="24" r="5.5"/><circle cx="13" cy="24" r="5.5"/><circle cx="9" cy="14" r="5.5"/></g><circle cx="18" cy="16" r="4.5" fill="#f2c14e"/></g></svg>`,
  party:  `<svg viewBox="0 0 32 38"><g stroke="#9a5a44" stroke-width="2" stroke-linejoin="round"><path d="M16 3 L27 33 L5 33 Z" fill="#e7b66a"/><path d="M9 23 q7 3 14 0" fill="none" stroke="#c8785b" stroke-width="2"/><path d="M7 30 q9 3 18 0" fill="none" stroke="#8a9a7b" stroke-width="2"/><circle cx="16" cy="3.5" r="3.5" fill="#c8785b"/></g></svg>`,
  beanie: `<svg viewBox="0 0 40 28"><g stroke="#465a4a" stroke-width="2" stroke-linejoin="round"><path d="M7 22 q-1 -19 26 -16 q7 1 6 16 z" fill="#8a9a7b"/><rect x="5" y="20" width="30" height="6" rx="3" fill="#6f7e60"/><circle cx="20" cy="5" r="3" fill="#e3a692"/></g></svg>`,
  crown:  `<svg viewBox="0 0 40 26"><g stroke="#b07b1e" stroke-width="2" stroke-linejoin="round"><path d="M6 23 L6 10 L14 16 L20 6 L26 16 L34 10 L34 23 Z" fill="#f2c14e"/><circle cx="20" cy="8" r="1.8" fill="#c8785b"/></g></svg>`,
};
const ITEM = {
  plant:   `<svg viewBox="0 0 40 46"><g stroke="#5a4632" stroke-width="2" stroke-linejoin="round"><path d="M20 26 q-4 -16 -11 -20 q4 11 7 20 z" fill="#8a9a7b"/><path d="M20 26 q4 -18 13 -20 q-6 12 -9 20 z" fill="#8a9a7b"/><path d="M11 28 L29 28 L26 44 L14 44 Z" fill="#c8785b"/></g></svg>`,
  lamp:    `<svg viewBox="0 0 34 50"><g stroke="#5a4632" stroke-width="2" stroke-linejoin="round"><path d="M8 17 L26 17 L22 5 L12 5 Z" fill="#e7b66a"/><path d="M17 17 L17 45"/><path d="M9 46 L25 46" stroke-width="3"/></g></svg>`,
  pouf:    `<svg viewBox="0 0 46 30"><g stroke="#5a4632" stroke-width="2" stroke-linejoin="round"><ellipse cx="23" cy="19" rx="19" ry="9" fill="#c8785b"/><path d="M23 10 L23 19 M13 13 L33 13" stroke="#a85c41" stroke-width="1.4" fill="none"/></g></svg>`,
  ball:    `<svg viewBox="0 0 30 30"><g stroke="#5a4632" stroke-width="1.6" fill="none"><circle cx="15" cy="15" r="12" fill="#8a9a7b"/><path d="M15 3 q8 12 0 24 M3 15 q12 -7 24 0"/></g></svg>`,
  balloon: `<svg viewBox="0 0 30 46"><g stroke="#9a5a44" stroke-width="1.6"><ellipse cx="15" cy="14" rx="11" ry="13" fill="#e3a692"/><path d="M15 27 q-3 9 0 17" fill="none"/></g></svg>`,
};

export const CATALOG = {
  hats: [
    { id: "bow",    svg: HAT.bow,    name: "bow",        price: 8 },
    { id: "flower", svg: HAT.flower, name: "flower",     price: 12 },
    { id: "party",  svg: HAT.party,  name: "party hat",  price: 16 },
    { id: "beanie", svg: HAT.beanie, name: "beanie",     price: 18 },
    { id: "crown",  svg: HAT.crown,  name: "crown",      price: 35 },
  ],
  decor: [
    { id: "plant",   svg: ITEM.plant,   name: "plant",    price: 10, style: "bottom:8px;left:24px" },
    { id: "lamp",    svg: ITEM.lamp,    name: "lamp",     price: 15, style: "bottom:6px;right:24px" },
    { id: "pouf",    svg: ITEM.pouf,    name: "pouf",     price: 14, style: "bottom:8px;left:33%" },
    { id: "ball",    svg: ITEM.ball,    name: "toy ball", price: 8,  style: "bottom:16px;left:54%" },
    { id: "balloon", svg: ITEM.balloon, name: "balloon",  price: 12, style: "top:44px;right:150px" },
  ],
};

const DEFAULT_EQUIP = { lion: null, mimi: null, decor: [] };
let state = { treats: 0, owned: new Set(), equipped: { ...DEFAULT_EQUIP } };
const listeners = new Set();
let inited = false;

export function onWalletChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function notify() { const s = getState(); for (const fn of listeners) fn(s); }

export function getState() {
  return {
    treats: state.treats,
    owned: new Set(state.owned),
    equipped: JSON.parse(JSON.stringify(state.equipped)),
  };
}

export function itemById(id) {
  return [...CATALOG.hats, ...CATALOG.decor].find((x) => x.id === id);
}

export async function initWallet() {
  if (inited) return;
  inited = true;
  await refresh();
  supabase
    .channel("wallet-rt")
    .on("postgres_changes", { event: "*", schema: "public", table: "wallet" }, refresh)
    .on("postgres_changes", { event: "*", schema: "public", table: "unlocks" }, refresh)
    .subscribe();
}

async function refresh() {
  const [{ data: w }, { data: u }] = await Promise.all([
    supabase.from("wallet").select("*").eq("id", 1).maybeSingle(),
    supabase.from("unlocks").select("item"),
  ]);
  if (w) {
    state.treats = w.treats || 0;
    state.equipped = { ...DEFAULT_EQUIP, ...(w.equipped || {}) };
    if (!Array.isArray(state.equipped.decor)) state.equipped.decor = [];
  }
  state.owned = new Set((u || []).map((x) => x.item));
  notify();
}

let earnTimer = null;
export function earn(n) {
  state.treats += n;
  notify();
  clearTimeout(earnTimer);          // coalesce rapid earns into one write
  earnTimer = setTimeout(() => {
    supabase.from("wallet").update({ treats: state.treats }).eq("id", 1);
  }, 500);
}

export async function buy(id) {
  const it = itemById(id);
  if (!it) return { ok: false };
  if (state.owned.has(id)) return { ok: false, reason: "owned" };
  if (state.treats < it.price) return { ok: false, reason: "poor" };
  state.treats -= it.price;
  state.owned.add(id);
  notify();
  const { error } = await supabase.from("unlocks").insert({ item: id });
  if (error) { state.treats += it.price; state.owned.delete(id); notify(); return { ok: false, reason: "error", error: error.message }; }
  await supabase.from("wallet").update({ treats: state.treats }).eq("id", 1);
  return { ok: true };
}

export async function equipHat(cat, id) {
  state.equipped[cat] = id || null;
  notify();
  await saveEquipped();
}

export async function toggleDecor(id) {
  const d = new Set(state.equipped.decor || []);
  d.has(id) ? d.delete(id) : d.add(id);
  state.equipped.decor = [...d];
  notify();
  await saveEquipped();
}

async function saveEquipped() {
  await supabase.from("wallet").update({ equipped: state.equipped }).eq("id", 1);
}
