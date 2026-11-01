importScripts("extract.js");

const q = encodeURIComponent;

const merchants = {
  amazon: { searchUrl: (s) => `https://www.amazon.fr/s?k=${q(s)}`, host: "www.amazon.fr" },
  ldlc: {
    searchUrl: (s) => `https://www.ldlc.com/recherche/${q(s)}/`,
    host: "www.ldlc.com",
    reviewsUrl: (url) => url.replace("/fiche/", "/avis/"),
  },
  materielnet: { searchUrl: (s) => `https://www.materiel.net/recherche/${q(s)}/`, host: "www.materiel.net" },
  topachat: { searchUrl: (s) => `https://www.topachat.com/search/${q(s)}`, host: "www.topachat.com", detail: true },
  cdiscount: { searchUrl: (s) => `https://www.cdiscount.com/search/10/${q(s)}.html`, host: "www.cdiscount.com" },
  fnac: { searchUrl: (s) => `https://www.fnac.com/SearchResult/ResultList.aspx?Search=${q(s)}`, host: "www.fnac.com" },
  joybuy: { searchUrl: (s) => `https://www.joybuy.fr/s?k=${q(s)}`, host: "www.joybuy.fr" },
  aliexpress: {
    searchUrl: (s) => `https://fr.aliexpress.com/wholesale?SearchText=${q(s)}`,
    host: "fr.aliexpress.com",
    variants: true,
  },
};

const MAX_DETAIL_PAGES = 3;
const WINDOW_IDLE_CLOSE = 15000;
const LOAD_TIMEOUT = 10000;
const INCOGNITO_ERROR =
  "Veuillez autoriser l'extension en navigation privée : chrome://extensions, Component Hook, Détails, puis « Autoriser en mode navigation privée ».";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const matches = (title, keywords) =>
  keywords.every((k) => new RegExp(`(^|[^a-z0-9])${k}([^a-z0-9]|$)`, "i").test(title));

let windowPromise = null;
let users = 0;

chrome.windows.onRemoved.addListener(async (id) => {
  if (windowPromise && (await windowPromise.catch(() => null)) === id) windowPromise = null;
});

async function acquireWindow() {
  users++;
  if (!windowPromise) {
    windowPromise = (async () => {
      if (!(await chrome.extension.isAllowedIncognitoAccess())) throw new Error(INCOGNITO_ERROR);
      const win = await chrome.windows.create({ incognito: true, focused: false, state: "minimized" });
      return win.id;
    })();
    windowPromise.catch(() => {
      windowPromise = null;
    });
  }
  return windowPromise;
}

function releaseWindow() {
  users--;
  setTimeout(async () => {
    if (users > 0 || !windowPromise) return;
    const id = await windowPromise.catch(() => null);
    windowPromise = null;
    if (id) chrome.windows.remove(id).catch(() => {});
  }, WINDOW_IDLE_CLOSE);
}

async function withTab(url, task) {
  let tab = null;
  try {
    const windowId = await acquireWindow();
    tab = await chrome.tabs.create({ windowId, url, active: false });
    await waitForLoad(tab.id, true, LOAD_TIMEOUT).catch(() => {});
    return await task(tab.id);
  } catch (e) {
    return { ok: false, error: e.message };
  } finally {
    if (tab) chrome.tabs.remove(tab.id).catch(() => {});
    releaseWindow();
  }
}

function waitForLoad(tabId, checkNow = true, timeout = 25000) {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(listener);
    };
    const listener = (id, info) => {
      if (id === tabId && info.status === "complete") {
        cleanup();
        resolve();
      }
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("Le site met trop de temps à répondre"));
    }, timeout);
    chrome.tabs.onUpdated.addListener(listener);
    if (!checkNow) return;
    chrome.tabs.get(tabId).then((tab) => {
      if (tab.status === "complete" && tab.url !== "about:blank") {
        cleanup();
        resolve();
      }
    });
  });
}

async function run(tabId, func, args = []) {
  await chrome.scripting.executeScript({ target: { tabId }, files: ["extract.js"] });
  const [injection] = await chrome.scripting.executeScript({ target: { tabId }, func, args });
  return injection?.result;
}

async function navigate(tabId, url) {
  const loaded = waitForLoad(tabId, false, LOAD_TIMEOUT).catch(() => {});
  await chrome.tabs.update(tabId, { url });
  await loaded;
}

async function retry(tabId, func, accept, args = [], attempts = 5) {
  let result;
  for (let attempt = 0; attempt < attempts; attempt++) {
    result = await run(tabId, func, args);
    if (accept(result)) break;
    await sleep(1500);
  }
  return result;
}

async function listingOffers(tabId) {
  const first = (await retry(tabId, pcfinderExtract, (r) => r?.length)) || [];
  await run(tabId, pcfinderScroll).catch(() => {});
  const after = (await run(tabId, pcfinderExtract).catch(() => null)) || [];
  return after.length > first.length ? after : first;
}

async function detailOffers(tabId, keywords) {
  const relevant = (r) => (r || []).filter((l) => matches(l.title, keywords));
  const links = relevant(await retry(tabId, pcfinderLinks, (r) => relevant(r).length));
  const offers = [];
  for (const link of links.slice(0, MAX_DETAIL_PAGES)) {
    await navigate(tabId, link.url);
    const offer = await retry(tabId, pcfinderProductPage, Boolean);
    if (offer) offers.push(offer);
  }
  return offers;
}

function allowedUrl(merchant, url) {
  try {
    return new URL(url).hostname === merchant.host;
  } catch {
    return false;
  }
}

async function search({ merchantId, query, keywords }) {
  const merchant = merchants[merchantId];
  if (!merchant) return { ok: false, error: "Marchand inconnu" };

  return withTab(merchant.searchUrl(query), async (tabId) => {
    const offers = merchant.detail ? await detailOffers(tabId, keywords) : await listingOffers(tabId);
    return { ok: true, offers };
  });
}

async function variant({ merchantId, url, keywords }) {
  const merchant = merchants[merchantId];
  if (!merchant?.variants || !allowedUrl(merchant, url)) return { ok: false, error: "Adresse non autorisée" };

  return withTab(url, async (tabId) => {
    const result = await retry(tabId, pcfinderVariantPrice, Boolean, [keywords]);
    if (!result?.found) return { ok: false, error: "Variante introuvable" };
    return { ok: true, price: result.price, variant: result.variant };
  });
}

async function reviews({ merchantId, url }) {
  const merchant = merchants[merchantId];
  if (!merchant || !allowedUrl(merchant, url)) return { ok: false, error: "Adresse non autorisée" };

  const target = merchant.reviewsUrl ? merchant.reviewsUrl(url) : url;
  return withTab(target, async (tabId) => {
    const list = await retry(tabId, pcfinderReviews, (r) => r?.length, [], 3);
    return { ok: true, reviews: list || [] };
  });
}

async function verify({ merchantId, url }) {
  const merchant = merchants[merchantId];
  if (!merchant || !allowedUrl(merchant, url)) return { ok: false, error: "Adresse non autorisée" };

  return withTab(url, async (tabId) => {
    const result = await retry(tabId, pcfinderPagePrice, (r) => r?.price, [], 3);
    if (!result?.price) return { ok: false, error: "Prix introuvable sur la fiche produit" };
    return { ok: true, price: result.price, deliveryDays: result.deliveryDays };
  });
}

const handlers = { search, variant, reviews, verify };

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handler = handlers[message?.type];
  if (!handler || !sender.tab) return;
  handler(message).then(sendResponse);
  return true;
});
