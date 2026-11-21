"use client";

const KEY = "fz-recent-orders";
const CONTACT_KEY = "fz-contact";

export interface RecentOrder {
  token: string;
  number: number;
  placedAt: string;
}

export function rememberOrder(o: RecentOrder) {
  try {
    const list = getRecentOrders().filter((x) => x.token !== o.token);
    localStorage.setItem(KEY, JSON.stringify([o, ...list].slice(0, 10)));
  } catch {}
}

export function getRecentOrders(): RecentOrder[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x?.token === "string" && /^[a-f0-9]{32}$/.test(x.token)) : [];
  } catch {
    return [];
  }
}

export interface SavedContact {
  name?: string;
  phone?: string;
  zoneId?: string;
  street?: string;
  building?: string;
  floor?: string;
  apartment?: string;
  landmark?: string;
}

export function saveContact(c: SavedContact) {
  try {
    localStorage.setItem(CONTACT_KEY, JSON.stringify(c));
  } catch {}
}

export function loadContact(): SavedContact {
  try {
    return JSON.parse(localStorage.getItem(CONTACT_KEY) ?? "{}") as SavedContact;
  } catch {
    return {};
  }
}
