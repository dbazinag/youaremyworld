/* =========================================================
   The treats economy 🐟 — shared currency, shop catalog,
   owned unlocks, and what's equipped (cat hats + room decor).
   One shared wallet row; syncs live via Supabase realtime.
   Other modules subscribe via onWalletChange().
   ========================================================= */

import { supabase } from "./supabase.js";

export const CATALOG = {
  hats: [
    { id: "bow",    emoji: "🎀", name: "bow",        price: 8 },
    { id: "flower", emoji: "🌸", name: "flower",     price: 10 },
    { id: "party",  emoji: "🎉", name: "party hat",  price: 14 },
    { id: "berry",  emoji: "🍓", name: "berry hat",  price: 16 },
    { id: "tophat", emoji: "🎩", name: "top hat",    price: 22 },
    { id: "crown",  emoji: "👑", name: "crown",      price: 35 },
  ],
  decor: [
    { id: "plant",    emoji: "🪴", name: "plant",    price: 10, style: "top:42px;left:40px" },
    { id: "balloon",  emoji: "🎈", name: "balloon",  price: 12, style: "top:26px;right:72px" },
    { id: "lantern",  emoji: "🏮", name: "lantern",  price: 15, style: "top:30px;left:50%;transform:translateX(-50%)" },
    { id: "cactus",   emoji: "🌵", name: "cactus",   price: 14, style: "bottom:14px;left:36px" },
    { id: "fish",     emoji: "🐠", name: "fishbowl", price: 18, style: "bottom:16px;right:38px" },
    { id: "painting", emoji: "🖼️", name: "painting", price: 16, style: "top:58px;right:28px" },
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

export async function earn(n) {
  state.treats += n;
  notify();
  await supabase.from("wallet").update({ treats: state.treats }).eq("id", 1);
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
