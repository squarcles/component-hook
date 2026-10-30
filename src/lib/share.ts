import { categories, getProduct } from "./categories";
import { criteriaSpecs } from "./criteria";
import { getMerchant } from "./merchants";
import type { Build, BuildPart, CategoryId, Offer } from "./types";

export const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const CODE_LENGTH = 6;
export const CODE_PATTERN = new RegExp(`^[${CODE_ALPHABET}]{${CODE_LENGTH}}$`);

const MAX_TEXT = 300;
const MAX_PRICE = 100000;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

const text = (v: unknown) => (typeof v === "string" && v.length > 0 ? v.slice(0, MAX_TEXT) : undefined);

function safeUrl(value: unknown, hosts?: string[]) {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return undefined;
    if (hosts && !hosts.includes(url.hostname)) return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

function sanitizeOffer(value: unknown, hosts: string[]): Offer | undefined {
  if (!isRecord(value)) return undefined;
  const title = text(value.title);
  const url = safeUrl(value.url, hosts);
  const price = typeof value.price === "number" && value.price > 0 && value.price < MAX_PRICE ? value.price : undefined;
  if (!title || !url || !price) return undefined;
  return {
    title,
    url,
    price,
    image: safeUrl(value.image) ?? null,
    variant: text(value.variant),
    suspicious: text(value.suspicious),
    reviewWarning: text(value.reviewWarning),
  };
}

function sanitizePart(category: CategoryId, value: unknown): BuildPart | undefined {
  if (!isRecord(value) || typeof value.merchantId !== "string") return undefined;
  const merchant = getMerchant(value.merchantId);
  if (!merchant) return undefined;

  const part: BuildPart = { merchantId: merchant.id };

  if (typeof value.productId === "string" && getProduct(category, value.productId)) {
    part.productId = value.productId;
  }

  const spec = criteriaSpecs[category];
  if (spec && isRecord(value.criteria)) {
    const criteria: Record<string, string> = {};
    for (const field of spec.fields) {
      const v = value.criteria[field.key];
      if (typeof v === "string" && v.length <= 40) criteria[field.key] = v;
    }
    part.criteria = criteria;
  }

  if (!part.productId && !part.criteria) return undefined;

  const offer = sanitizeOffer(value.offer, merchant.hosts);
  if (offer) part.offer = offer;
  return part;
}

export function sanitizeBuild(value: unknown): Build | null {
  if (!isRecord(value)) return null;
  const build: Build = {};
  for (const category of categories) {
    const part = sanitizePart(category.id, value[category.id]);
    if (part) build[category.id] = part;
  }
  return Object.keys(build).length ? build : null;
}
