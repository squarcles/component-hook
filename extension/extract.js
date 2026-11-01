function pcfinderParseDelivery(text) {
  const MONTHS = ["janv", "févr", "mars", "avr", "mai", "juin", "juil", "août", "sept", "oct", "nov", "déc"];
  const DAYS = ["dim", "lun", "mar", "mer", "jeu", "ven", "sam"];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysUntil = (date) => Math.max(0, Math.round((date - today) / 86400000));
  const upcoming = (month, day) => {
    const date = new Date(today.getFullYear(), month, day);
    if (date < today) date.setFullYear(date.getFullYear() + 1);
    return daysUntil(date);
  };
  const plain = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");

  const results = [];
  const trigger = /livr|exp[ée]di|re[çc]u|arriv/gi;
  let t;
  while ((t = trigger.exec(text))) {
    const s = text.slice(t.index, t.index + 90).toLowerCase();
    if (/aujourd/.test(s)) results.push(0);
    else if (/demain/.test(s)) results.push(1);

    let m = /(\d+)\s*(?:[-–à]\s*(\d+)\s*)?(jours?|j\b|semaines?|sem\b)/.exec(s);
    if (m) {
      const n = Number(m[2] || m[1]);
      results.push(/^s/.test(m[3]) ? n * 7 : n);
      continue;
    }

    const numeric = [...s.matchAll(/\b(\d{1,2})\/(\d{1,2})(?:\/\d{2,4})?\b/g)]
      .map((d) => [Number(d[1]), Number(d[2])])
      .filter(([day, month]) => day >= 1 && day <= 31 && month >= 1 && month <= 12);
    if (numeric.length) {
      results.push(Math.max(...numeric.map(([day, month]) => upcoming(month - 1, day))));
      continue;
    }

    m = /(\d{1,2})(?:\s*[-–]\s*(\d{1,2}))?\s+([a-zéû]+)\.?/.exec(s);
    const month = m ? MONTHS.findIndex((p) => plain(m[3]).startsWith(plain(p))) : -1;
    if (m && month >= 0) {
      results.push(upcoming(month, Number(m[2] || m[1])));
      continue;
    }

    m = /\b([a-zéû]+)\.?\s+(\d{1,2})(?:\s*[-–]\s*(\d{1,2}))?\b/.exec(s);
    const monthFirst = m ? MONTHS.findIndex((p) => plain(m[1]).startsWith(plain(p))) : -1;
    if (m && monthFirst >= 0) {
      results.push(upcoming(monthFirst, Number(m[3] || m[2])));
      continue;
    }

    m = /\b(dim|lun|mar|mer|jeu|ven|sam)\b/.exec(s);
    if (m) results.push((DAYS.indexOf(m[1]) - today.getDay() + 7) % 7 || 7);
  }
  return results.length ? Math.min(...results) : null;
}

async function pcfinderScroll() {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  let last = -1;
  for (let step = 0; step < 8 && document.body.scrollHeight !== last; step++) {
    last = document.body.scrollHeight;
    window.scrollTo(0, last);
    await wait(700);
  }
  window.scrollTo(0, 0);
  return true;
}

function pcfinderPagePrice() {
  const parse = (text) => {
    const m = /(\d{1,3}(?:[   .]\d{3})+|\d+)(?:[,.](\d{2}))?\s*€/.exec(text || "");
    if (!m) return null;
    const value = parseFloat(`${m[1].replace(/[   .]/g, "")}.${m[2] || "00"}`);
    return value > 0 ? value : null;
  };

  let price = null;
  const host = location.hostname;

  if (host.endsWith("amazon.fr")) {
    const el = document.querySelector(
      "#corePrice_feature_div .a-offscreen, #corePriceDisplay_desktop_feature_div .a-offscreen, .priceToPay .a-offscreen",
    );
    price = parse(el?.textContent);
  }

  if (!price) price = pcfinderProductPage()?.price ?? null;

  if (!price) {
    const meta = document.querySelector('[itemprop="price"], meta[property="product:price:amount"]');
    const value = parseFloat((meta?.getAttribute("content") || meta?.textContent || "").replace(",", "."));
    if (value > 0) price = value;
  }

  const deliveryText = [...document.querySelectorAll("body *")]
    .filter((el) => el.children.length < 4 && /livr|exp[ée]di/i.test(el.textContent) && el.textContent.length < 200)
    .map((el) => el.textContent.replace(/\s+/g, " "))
    .join(" | ");

  return { price, deliveryDays: pcfinderParseDelivery(deliveryText) };
}

function pcfinderItemList() {
  const offers = [];
  for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
    let data = null;
    try {
      data = JSON.parse(script.textContent);
    } catch {}
    if (data?.["@type"] !== "ItemList") continue;
    for (const entry of data.itemListElement || []) {
      const item = entry?.item;
      const price = parseFloat(item?.offers?.price);
      if (!item?.name || !item.url || !(price > 0)) continue;
      offers.push({ title: item.name, price, url: item.url, image: item.image || null, deliveryDays: null });
    }
  }
  return offers;
}

function pcfinderExtract() {
  if (location.hostname.endsWith("joybuy.fr")) return pcfinderItemList();

  const priceRe = /(\d{1,3}(?:[   .]\d{3})+|\d+)(?:[,.](\d{2}))?\s*€(?:\s*(\d{2})(?!\d))?/;

  const parsePrice = (text) => {
    const m = priceRe.exec(text);
    if (!m) return null;
    const int = m[1].replace(/[   .]/g, "");
    const dec = m[2] || m[3] || "00";
    const value = parseFloat(`${int}.${dec}`);
    return value > 0 ? value : null;
  };

  const isStruck = (el, root) => {
    for (let e = el; e && e !== root.parentElement; e = e.parentElement) {
      if (e.tagName === "DEL" || e.tagName === "S") return true;
      if (getComputedStyle(e).textDecorationLine.includes("line-through")) return true;
      if (/old|strike|barre|was|before|crossed/i.test(e.className?.toString?.() || "")) return true;
    }
    return false;
  };

  const findPrice = (container) => {
    for (const el of container.querySelectorAll("*")) {
      const text = el.textContent.trim();
      if (text.length > 25 || !priceRe.test(text)) continue;
      const parentText = el.parentElement?.textContent.trim() || "";
      if (el !== container && parentText.length <= 25 && priceRe.test(parentText)) continue;
      if (isStruck(el, container)) continue;
      const value = parsePrice(text);
      if (value) return { value, el };
    }
    return null;
  };

  const titleOf = (a) => {
    const heading = a.querySelector("h1, h2, h3, h4, [class*='title' i]");
    const raw = (heading && (heading.innerText || heading.textContent)) || a.innerText || a.textContent || "";
    const text = raw
      .replace(/\s+/g, " ")
      .replace(/\s*\d[\d\s .]*(?:,\d{2})?\s*€.*$/, "")
      .trim();
    if (text.length >= 20) return text;
    const attr = a.getAttribute("title") || a.querySelector("img")?.alt || "";
    return attr.trim().length >= 20 ? attr.trim() : null;
  };

  const offers = new Map();
  const priceOwners = new Map();
  for (const a of document.querySelectorAll("a[href]")) {
    const title = titleOf(a);
    if (!title || title.length > 300) continue;
    let container = a;
    let found = null;
    for (let depth = 0; depth < 8 && container.parentElement; depth++) {
      container = container.parentElement;
      if ((container.innerText || container.textContent).length > 1500) break;
      found = findPrice(container);
      if (found) break;
    }
    if (!found) continue;
    const url = a.href.split("#")[0];
    if (offers.has(url)) continue;
    let image = null;
    for (let e = container, d = 0; e && d < 4 && !image; e = e.parentElement, d++) {
      if ((e.innerText || e.textContent).length > 1500) break;
      image = e.querySelector("img")?.src || null;
    }
    const deliveryDays = pcfinderParseDelivery(container.textContent.replace(/\s+/g, " "));
    offers.set(url, { title, price: found.value, url, image, deliveryDays, priceEl: found.el });
    if (!priceOwners.has(found.el)) priceOwners.set(found.el, new Set());
    priceOwners.get(found.el).add(url);
  }
  return [...offers.values()]
    .filter((o) => priceOwners.get(o.priceEl).size <= 2)
    .map(({ priceEl, ...offer }) => offer);
}

async function pcfinderVariantPrice(keywords) {
  const matches = (text) =>
    keywords.every((k) => new RegExp(`(^|[^a-z0-9])${k}([^a-z0-9]|$)`, "i").test(text));
  const label = (el) => el.getAttribute("title") || el.querySelector("img")?.alt || el.textContent.trim();

  const items = [...document.querySelectorAll('[class*="sku-item--text"], [class*="sku-item--image"]')];
  const target = items.find((el) => matches(label(el)));
  if (!target) return items.length ? { found: false } : null;

  if (!/sku-item--selected/.test(target.className)) {
    target.click();
    await new Promise((r) => setTimeout(r, 1500));
  }

  const text = document.querySelector('[class*="price-default--current"]')?.textContent || "";
  const m = /(\d{1,3}(?:[   .]\d{3})+|\d+)(?:[,.](\d{2}))?\s*€/.exec(text);
  if (!m) return null;
  const price = parseFloat(`${m[1].replace(/[   .]/g, "")}.${m[2] || "00"}`);
  return price > 0 ? { found: true, price, variant: label(target) } : null;
}

async function pcfinderReviews() {
  const MONTHS = ["janv", "févr", "mars", "avr", "mai", "juin", "juil", "août", "sept", "oct", "nov", "déc"];

  const parseDate = (text) => {
    if (!text) return null;
    let m = /(\d{4})-(\d{2})-(\d{2})/.exec(text);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    m = /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(text);
    if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    m = /(\d{1,2})(?:er)?\s+([a-zéû]+)\.?\s+(\d{4})/i.exec(text);
    if (m) {
      const name = m[2].toLowerCase();
      const index = MONTHS.findIndex((p) => name.startsWith(p) || name.startsWith(p.replace("é", "e").replace("û", "u")));
      if (index >= 0) return `${m[3]}-${String(index + 1).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    }
    return null;
  };

  const collect = (items, rating, date) =>
    items
      .map((el) => ({ rating: rating(el), date: parseDate(date(el)) }))
      .filter((r) => r.rating > 0 && r.date);

  const q = (sel) => [...document.querySelectorAll(sel)];
  const host = location.hostname;

  if (host.endsWith("ldlc.com")) {
    return collect(
      q(".reviews > li"),
      (el) => Number(/star-(\d+)/.exec(el.querySelector("[class*='star-']")?.className || "")?.[1] || 0) / 2,
      (el) => el.querySelector(".date")?.textContent,
    );
  }

  if (host.endsWith("materiel.net")) {
    return collect(
      q(".c-product__review"),
      (el) => el.querySelectorAll(".o-star.is-on").length + el.querySelectorAll(".fa-star-half-stroke").length * 0.5,
      (el) => el.querySelector(".o-review__info-date")?.textContent,
    );
  }

  if (host.endsWith("aliexpress.com")) {
    const infos = () => q('[class*="list--itemInfo"]');
    if (!infos().length) return [];
    const more = q("button, a, span, div").find((el) => {
      if (el.children.length > 2 || !/^voir plus$/i.test(el.textContent.trim())) return false;
      let parent = el;
      for (let i = 0; i < 6 && parent; i++, parent = parent.parentElement) {
        if (parent.querySelector('[class*="list--itemInfo"]')) return true;
      }
      return false;
    });
    if (more) {
      more.click();
      await new Promise((r) => setTimeout(r, 2500));
    }
    return collect(
      infos(),
      (el) => {
        let item = el;
        while (item && !item.querySelector('[class*="stars--box"]')) item = item.parentElement;
        if (!item) return 0;
        const stars = item.querySelector('[class*="stars--box"]');
        return (
          stars.querySelectorAll(".comet-icon-starreviewfilled").length +
          stars.querySelectorAll(".comet-icon-starhalfreview").length * 0.5
        );
      },
      (el) => el.textContent,
    );
  }

  if (host.endsWith("amazon.fr")) {
    return collect(
      q('[data-hook="review"]'),
      (el) => parseFloat((el.querySelector(".a-icon-alt")?.textContent || "").replace(",", ".")) || 0,
      (el) => el.querySelector('[data-hook="review-date"]')?.textContent,
    );
  }

  const found = [];
  const walk = (node) => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!node || typeof node !== "object") return;
    for (const review of [].concat(node.review || [])) {
      const value = parseFloat(review?.reviewRating?.ratingValue);
      const best = parseFloat(review?.reviewRating?.bestRating) || 5;
      const date = parseDate(review?.datePublished);
      if (value > 0 && date) found.push({ rating: (value / best) * 5, date });
    }
    walk(node["@graph"]);
  };
  for (const script of q('script[type="application/ld+json"]')) {
    try {
      walk(JSON.parse(script.textContent));
    } catch {}
  }
  return found;
}

function pcfinderLinks() {
  const links = new Map();
  for (const a of document.querySelectorAll("a[href]")) {
    const title = (a.innerText || a.textContent || a.getAttribute("title") || "").trim().replace(/\s+/g, " ");
    if (title.length < 15 || title.length > 300) continue;
    const url = a.href.split("#")[0];
    if (!links.has(url)) links.set(url, { title, url });
  }
  return [...links.values()];
}

function pcfinderProductPage() {
  const find = (node) => {
    if (!node || typeof node !== "object") return null;
    if (Array.isArray(node)) {
      for (const n of node) {
        const found = find(n);
        if (found) return found;
      }
      return null;
    }
    const type = [].concat(node["@type"] || []);
    if (type.includes("Product") && node.offers) return node;
    return find(node["@graph"]);
  };

  for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
    let product = null;
    try {
      product = find(JSON.parse(script.textContent));
    } catch {}
    if (!product) continue;
    const offer = [].concat(product.offers)[0];
    const price = parseFloat(offer.price ?? offer.lowPrice);
    if (!(price > 0)) continue;
    const image = [].concat(product.image || [])[0];
    return {
      title: product.name,
      price,
      url: location.href.split("#")[0],
      image: typeof image === "string" ? image : image?.url || null,
    };
  }
  return null;
}
