import type { Offer } from "./types";

const EXCLUDED_ALWAYS =
  /^\W*(?:pc|ordinateur|laptop)\b|pc gamer|gaming pc|pc fixe|desktop pc|mini pc|unit[eé] centrale|thinkstation|thinkcentre|optiplex|workstation|\bwin(?:dows)? ?1[01] (?:home|pro|famille|install)/i;

const PREBUILT_MARKERS = [
  /\b(?:rtx|gtx) ?\d{4}|radeon|geforce|\barc b\d{3}/i,
  /\b(?:core (?:ultra|i[3579])|ryzen [3579])\b/i,
  /\b\d+ ?(?:go|gb) (?:de )?(?:ram|ddr\d)/i,
  /\b(?:ssd|nvme|hdd)\b/i,
  /\bpsu\b|\balimentation \d+ ?w|\b\d+ ?w psu/i,
];

function isPrebuilt(title: string) {
  return PREBUILT_MARKERS.filter((r) => r.test(title)).length >= 3;
}

const OUTLIER_RATIO = 0.4;

const MODEL = /(?:^|[^a-z0-9])(?<!ddr\d[-\s]?)(\d{4,5}(?:x3d|xtx|xt|x|f|kf|ks|k|g|t)?)(?![a-z0-9]|\s?(?:mhz|mt|w\b))/gi;

export function listsSeveralCapacities(title: string, minimum: number) {
  const cleaned = title.replace(/\d+\s?x\s?\d+\s?(?:go|gb|to|tb)/gi, "");
  const sizes = [...cleaned.matchAll(/(\d+(?:[.,]\d+)?)\s?(to|tb|go|gb)\b/gi)]
    .map((m) => Math.round(parseFloat(m[1].replace(",", ".")) * (/t/i.test(m[2]) ? 1000 : 1)))
    .filter((size) => size >= minimum);
  return new Set(sizes).size >= 2;
}

export function listsOtherModels(title: string, keywords: string[]) {
  const own = keywords.map((k) => new RegExp(`^(?:${k})$`, "i"));
  const others = new Set(
    [...title.matchAll(MODEL)].map((m) => m[1].toLowerCase()).filter((m) => !own.some((r) => r.test(m))),
  );
  return others.size >= 2;
}

export function matchesProduct(
  offer: Offer,
  keywords: string[],
  exclude?: RegExp,
  reject?: (title: string, keywords: string[]) => boolean,
) {
  if (EXCLUDED_ALWAYS.test(offer.title) || isPrebuilt(offer.title)) return false;
  if (exclude?.test(offer.title)) return false;
  if (reject?.(offer.title, keywords)) return false;
  return keywords.every((k) => new RegExp(`(^|[^a-z0-9])${k}([^a-z0-9]|$)`, "i").test(offer.title));
}

export const SCAM_NOTICE =
  "Vérifiez toujours le prix et la fiabilité de chaque annonce sur le site du marchand avant d'acheter. Des arnaques existent et Component Hook ne les filtre pas toutes : nos avertissements ne remplacent pas une vérification manuelle du vendeur, des avis et des conditions de vente.";

export type Suspicion ={ ratio: number; message: string; outlier?: number } | false;

export const DEFAULT_SUSPICION: Suspicion = {
  ratio: 0.6,
  message: "Prix nettement inférieur aux autres offres : il peut s'agir d'une arnaque ou d'un produit en rupture de stock.",
};

export function splitOutliers(offers: Offer[], suspicion: Suspicion = DEFAULT_SUSPICION) {
  if (offers.length < 3) return { valid: offers, outliers: [] };
  const prices = offers.map((o) => o.price).sort((a, b) => a - b);
  const median = prices[Math.floor(prices.length / 2)];
  const floor = median * ((suspicion && suspicion.outlier) || OUTLIER_RATIO);
  const flag = (o: Offer) =>
    suspicion && o.price < median * suspicion.ratio ? { ...o, suspicious: suspicion.message } : o;
  return {
    valid: offers.filter((o) => o.price >= floor).map(flag),
    outliers: offers.filter((o) => o.price < floor),
  };
}

export function matchesAnyKeyword(offer: Offer, keywords: string[]) {
  return keywords.some((k) => new RegExp(`(^|[^a-z0-9])${k}([^a-z0-9]|$)`, "i").test(offer.title));
}

export function formatPrice(price: number) {
  return price.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}
