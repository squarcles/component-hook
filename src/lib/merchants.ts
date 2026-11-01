import type { Merchant } from "./types";

const q = encodeURIComponent;

export const merchants: Merchant[] = [
  {
    id: "amazon",
    name: "Amazon",
    searchUrl: (s) => `https://www.amazon.fr/s?k=${q(s)}`,
    hosts: ["www.amazon.fr"],
    reviews: true,
  },
  {
    id: "ldlc",
    name: "LDLC",
    searchUrl: (s) => `https://www.ldlc.com/recherche/${q(s)}/`,
    hosts: ["www.ldlc.com"],
    reviews: true,
  },
  {
    id: "materielnet",
    name: "Materiel.net",
    searchUrl: (s) => `https://www.materiel.net/recherche/${q(s)}/`,
    hosts: ["www.materiel.net"],
    reviews: true,
  },
  {
    id: "topachat",
    name: "TopAchat",
    searchUrl: (s) => `https://www.topachat.com/search/${q(s)}`,
    hosts: ["www.topachat.com"],
    reviews: true,
  },
  {
    id: "cdiscount",
    name: "Cdiscount",
    searchUrl: (s) => `https://www.cdiscount.com/search/10/${q(s)}.html`,
    hosts: ["www.cdiscount.com"],
    reviews: true,
  },
  {
    id: "fnac",
    name: "Fnac",
    searchUrl: (s) => `https://www.fnac.com/SearchResult/ResultList.aspx?Search=${q(s)}`,
    hosts: ["www.fnac.com"],
    reviews: true,
  },
  {
    id: "joybuy",
    name: "Joybuy",
    searchUrl: (s) => `https://www.joybuy.fr/s?k=${q(s)}`,
    hosts: ["www.joybuy.fr"],
  },
  {
    id: "aliexpress",
    name: "AliExpress",
    searchUrl: (s) => `https://fr.aliexpress.com/wholesale?SearchText=${q(s)}`,
    hosts: ["fr.aliexpress.com", "www.aliexpress.com"],
    variants: true,
    reviews: true,
  },
];

export function getMerchant(id: string) {
  return merchants.find((m) => m.id === id);
}

export function isMerchantUrl(merchant: Merchant, value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && merchant.hosts.includes(url.hostname);
  } catch {
    return false;
  }
}

export function openSearch(merchant: Merchant, query: string) {
  const width = Math.min(1200, Math.round(window.screen.availWidth * 0.6));
  const height = Math.round(window.screen.availHeight * 0.9);
  const left = window.screen.availWidth - width;
  window.open(merchant.searchUrl(query), "pcfinder-search", `width=${width},height=${height},left=${left},top=0`);
}
