import type { Offer } from "./types";
import type { Review } from "./reviews";

type SearchResult = { ok: true; offers: Offer[] } | { ok: false; error: string };

type SearchPayload = {
  merchantId: string;
  query: string;
  keywords: string[];
};

let detection: Promise<boolean> | null = null;

function request<T>(type: string, payload: unknown, timeout: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = crypto.randomUUID();
    const cleanup = () => {
      clearTimeout(timer);
      window.removeEventListener("message", listener);
    };
    const listener = (event: MessageEvent) => {
      if (event.source !== window || event.data?.source !== "pcfinder-ext" || event.data.id !== id) return;
      cleanup();
      resolve(event.data as T);
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("timeout"));
    }, timeout);
    window.addEventListener("message", listener);
    window.postMessage({ source: "pcfinder-page", id, type, payload }, window.location.origin);
  });
}

export function hasExtension() {
  detection ??= request("ping", null, 500).then(
    () => true,
    () => false,
  );
  return detection;
}

type VariantResult = { ok: true; price: number; variant: string } | { ok: false; error: string };

export async function variantPrice(payload: { merchantId: string; url: string; keywords: string[] }) {
  try {
    const response = await request<{ result: VariantResult }>("variant", payload, 60000);
    return response.result;
  } catch {
    return { ok: false, error: "L'extension met trop de temps à répondre" } as VariantResult;
  }
}

type VerifyResult = { ok: true; price: number; deliveryDays: number | null } | { ok: false; error: string };

export async function verifyOffer(payload: { merchantId: string; url: string }) {
  try {
    const response = await request<{ result: VerifyResult }>("verify", payload, 35000);
    return response.result;
  } catch {
    return { ok: false, error: "L'extension met trop de temps à répondre" } as VerifyResult;
  }
}

type ReviewsResult = { ok: true; reviews: Review[] } | { ok: false; error: string };

export async function fetchReviews(payload: { merchantId: string; url: string }) {
  try {
    const response = await request<{ result: ReviewsResult }>("reviews", payload, 35000);
    return response.result;
  } catch {
    return { ok: false, error: "L'extension met trop de temps à répondre" } as ReviewsResult;
  }
}

export async function searchOffers(payload: SearchPayload): Promise<SearchResult> {
  try {
    const response = await request<{ result: SearchResult }>("search", payload, 90000);
    return response.result;
  } catch {
    return { ok: false, error: "L'extension met trop de temps à répondre" };
  }
}
