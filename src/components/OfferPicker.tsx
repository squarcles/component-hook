"use client";

import { useEffect, useRef, useState } from "react";
import { useBuild } from "@/lib/build";
import { getMerchant, merchants, openSearch } from "@/lib/merchants";
import { fetchReviews, hasExtension, searchOffers, variantPrice, verifyOffer } from "@/lib/extension";
import { summarizeReviews, type ReviewSummary } from "@/lib/reviews";
import { formatPrice, matchesAnyKeyword, matchesProduct, SCAM_NOTICE, splitOutliers } from "@/lib/match";
import type { Rating as RatingValue, Search } from "@/lib/criteria";
import type { Merchant, Offer } from "@/lib/types";

const MAX_VARIANT_CHECKS = 12;
const PARALLEL_VARIANT_CHECKS = 3;
const PARALLEL_SEARCHES = 3;
const MAX_REVIEW_CHECKS = 8;
const PARALLEL_REVIEWS = 3;
const REVIEWS_KEY = "pcfinder-use-reviews";

type ReviewState = ReviewSummary | "loading" | "failed";

type Correction = { price: number; previous: number; deliveryDays: number | null | undefined };

const PRICE_TOLERANCE = 0.02;
const MAX_PRICE_CHECKS = 8;
const PARALLEL_PRICE_CHECKS = 3;

const runPool = async <T,>(items: T[], size: number, task: (item: T) => Promise<void>) => {
  const queue = [...items];
  const worker = async () => {
    for (let item = queue.shift(); item !== undefined; item = queue.shift()) await task(item);
  };
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, worker));
};

type Done = {
  scope: Merchant[];
  status: "done";
  failed: string[];
  direct: Offer[];
  resolved: Offer[];
  pending: Offer[];
  unchecked: Offer[];
  others: Offer[];
};

type Lookup =
  | { scope: Merchant[]; status: "loading"; finished: number }
  | Done
  | { scope: Merchant[]; status: "error"; error: string };

type Props = {
  title: string;
  search: Search;
  onTake: (merchant: Merchant, offer?: Offer) => void;
  onClose: () => void;
};

const byPrice = (a: Offer, b: Offer) => a.price - b.price;

const scopeName = (scope: Merchant[]) => (scope.length === 1 ? scope[0].name : "tous les sites");

function Rating({ rating }: { rating: RatingValue }) {
  return <span className={`offer-rating offer-rating-${rating.tone}`}>{rating.label}</span>;
}

const deliveryLabel = (days: number) => (days === 0 ? "aujourd'hui" : days === 1 ? "demain" : `environ ${days} jours`);

export default function OfferPicker({ title, search, onTake, onClose }: Props) {
  const { maxDelivery } = useBuild();
  const [lookup, setLookup] = useState<Lookup | null>(null);
  const [showOthers, setShowOthers] = useState(false);
  const [extension, setExtension] = useState(false);
  const [useReviews, setUseReviews] = useState(false);
  const [reviewInfo, setReviewInfo] = useState<Record<string, ReviewState>>({});
  const [corrections, setCorrections] = useState<Record<string, Correction>>({});
  const [verifying, setVerifying] = useState<string | null>(null);
  const [priceChecks, setPriceChecks] = useState<Record<string, boolean>>({});
  const runId = useRef(0);

  useEffect(() => {
    hasExtension().then(setExtension);
    try {
      setUseReviews(localStorage.getItem(REVIEWS_KEY) === "1");
    } catch {}
    return () => {
      runId.current++;
    };
  }, []);

  const toggleReviews = (value: boolean) => {
    setUseReviews(value);
    try {
      localStorage.setItem(REVIEWS_KEY, value ? "1" : "0");
    } catch {}
  };

  const checkReviews = async (offers: Offer[], id: number) => {
    setReviewInfo(Object.fromEntries(offers.map((o) => [o.url, "loading" as ReviewState])));
    await runPool(offers, PARALLEL_REVIEWS, async (offer) => {
      if (runId.current !== id) return;
      const result = await fetchReviews({ merchantId: offer.merchantId!, url: offer.url });
      if (runId.current !== id) return;
      setReviewInfo((prev) => ({ ...prev, [offer.url]: result.ok ? summarizeReviews(result.reviews) : "failed" }));
    });
  };

  const checkPrices = async (offers: Offer[], id: number) => {
    setPriceChecks(Object.fromEntries(offers.map((o) => [o.url, true])));
    await runPool(offers, PARALLEL_PRICE_CHECKS, async (offer) => {
      if (runId.current !== id) return;
      const result = await verifyOffer({ merchantId: offer.merchantId!, url: offer.url });
      if (runId.current !== id) return;
      if (result.ok) {
        setCorrections((prev) => ({
          ...prev,
          [offer.url]: { price: result.price, previous: offer.price, deliveryDays: result.deliveryDays ?? offer.deliveryDays },
        }));
      }
      setPriceChecks((prev) => ({ ...prev, [offer.url]: false }));
    });
  };

  const checkVariants = async (offers: Offer[], id: number) => {
    await runPool(offers, PARALLEL_VARIANT_CHECKS, async (offer) => {
      if (runId.current !== id) return;
      const keywords = search.variantKeywords ?? search.keywords;
      const result = await variantPrice({ merchantId: offer.merchantId!, url: offer.url, keywords });
      if (runId.current !== id) return;
      setLookup((prev) => {
        if (prev?.status !== "done") return prev;
        return {
          ...prev,
          pending: prev.pending.filter((p) => p !== offer),
          resolved: result.ok ? [...prev.resolved, { ...offer, price: result.price, variant: result.variant }] : prev.resolved,
          unchecked: result.ok ? prev.unchecked : [...prev.unchecked, offer],
        };
      });
    });
  };

  const collect = async (scope: Merchant[], id: number) => {
    const offers: Offer[] = [];
    const failed: string[] = [];
    let finished = 0;
    const queue = [...scope];

    const worker = async () => {
      for (let merchant = queue.shift(); merchant; merchant = queue.shift()) {
        const result = await searchOffers({ merchantId: merchant.id, query: search.query, keywords: search.keywords });
        if (result.ok) offers.push(...result.offers.map((o) => ({ ...o, merchantId: merchant!.id })));
        else failed.push(`${merchant.name} (${result.error})`);
        finished++;
        if (runId.current === id) setLookup({ scope, status: "loading", finished });
      }
    };

    await Promise.all(Array.from({ length: Math.min(PARALLEL_SEARCHES, scope.length) }, worker));
    return { offers, failed };
  };

  const startSearch = async (scope: Merchant[]) => {
    if (!extension) {
      openSearch(scope[0], search.query);
      onTake(scope[0]);
      return;
    }

    const id = ++runId.current;
    setLookup({ scope, status: "loading", finished: 0 });
    setShowOthers(false);
    setReviewInfo({});
    setCorrections({});
    setPriceChecks({});
    const { offers, failed } = await collect(scope, id);
    if (runId.current !== id) return;
    if (failed.length === scope.length) {
      setLookup({ scope, status: "error", error: failed.join(", ") });
      return;
    }

    const sorted = [...offers].sort(byPrice);
    const tooSlow = (o: Offer) => maxDelivery > 0 && o.deliveryDays != null && o.deliveryDays > maxDelivery;
    const relevant = sorted.filter((o) => matchesProduct(o, search.keywords, search.exclude));
    const matching = relevant.filter((o) => !tooSlow(o));
    const isVariant = (o: Offer) => Boolean(search.reject?.(o.title, search.keywords));
    const canCheck = (o: Offer) => Boolean(getMerchant(o.merchantId!)?.variants);
    const variants = matching.filter((o) => isVariant(o) && canCheck(o));
    const pending = variants.slice(0, MAX_VARIANT_CHECKS);

    setLookup({
      scope,
      status: "done",
      failed,
      direct: matching.filter((o) => !isVariant(o)),
      resolved: [],
      pending,
      unchecked: [...variants.slice(MAX_VARIANT_CHECKS), ...matching.filter((o) => isVariant(o) && !canCheck(o))],
      others: [
        ...relevant.filter(tooSlow),
        ...sorted.filter((o) => !relevant.includes(o) && matchesAnyKeyword(o, search.keywords)),
      ],
    });

    checkVariants(pending, id);

    const direct = matching.filter((o) => !isVariant(o));
    checkPrices(splitOutliers(direct, false).valid.slice(0, MAX_PRICE_CHECKS), id);

    if (useReviews) {
      const candidates = splitOutliers(direct, false)
        .valid.filter((o) => getMerchant(o.merchantId!)?.reviews)
        .slice(0, MAX_REVIEW_CHECKS);
      checkReviews(candidates, id);
    }
  };

  const corrected = (offer: Offer): Offer => {
    const fix = corrections[offer.url];
    return fix ? { ...offer, price: fix.price, deliveryDays: fix.deliveryDays } : offer;
  };

  const finalize = (merchant: Merchant, offer: Offer) => {
    const info = reviewInfo[offer.url];
    const reviewWarning = typeof info === "object" ? info.warning : undefined;
    onTake(merchant, reviewWarning ? { ...offer, reviewWarning } : offer);
  };

  const take = async (merchant: Merchant, offer: Offer) => {
    if (!extension || offer.variant || corrections[offer.url]) {
      finalize(merchant, corrected(offer));
      return;
    }

    setVerifying(offer.url);
    const result = await verifyOffer({ merchantId: merchant.id, url: offer.url });
    setVerifying(null);
    if (!result.ok) {
      finalize(merchant, offer);
      return;
    }

    const deliveryDays = result.deliveryDays ?? offer.deliveryDays;
    const priceChanged = Math.abs(result.price - offer.price) / offer.price > PRICE_TOLERANCE;
    const tooSlow = maxDelivery > 0 && deliveryDays != null && deliveryDays > maxDelivery;
    if (priceChanged || tooSlow) {
      setCorrections((prev) => ({ ...prev, [offer.url]: { price: result.price, previous: offer.price, deliveryDays } }));
      return;
    }
    finalize(merchant, { ...offer, price: result.price, deliveryDays });
  };

  const reviewLine = (offer: Offer) => {
    if (!useReviews) return null;
    if (!getMerchant(offer.merchantId!)?.reviews) {
      return <span className="offer-reviews">Avis non disponibles sur ce site</span>;
    }
    const info = reviewInfo[offer.url];
    if (!info) return null;
    if (info === "loading") return <span className="offer-reviews">Lecture des avis en cours...</span>;
    if (info === "failed") return <span className="offer-reviews">Avis indisponibles</span>;
    return (
      <>
        <span className="offer-reviews">{info.label}</span>
        {info.warning && <span className="offer-warning">{info.warning}</span>}
      </>
    );
  };

  const backToMerchants = () => {
    runId.current++;
    setLookup(null);
  };

  const offerRow = (showMerchant: boolean, checking = false) => (original: Offer) => {
    const merchant = getMerchant(original.merchantId!)!;
    const offer = corrected(original);
    const fix = corrections[original.url];
    const busy = checking || verifying === original.url;
    return (
      <li key={offer.url} className={offer.suspicious ? "offer offer-suspicious" : "offer"}>
        {offer.image ? <img src={offer.image} alt="" /> : <span className="offer-noimg" />}
        <span>
          {showMerchant && <span className="offer-merchant">{merchant.name}</span>}
          <a href={offer.url} target="_blank" rel="noreferrer" className="offer-title">
            {offer.title}
          </a>
          {offer.variant && <span className="offer-variant">Variante : {offer.variant}</span>}
          {offer.suspicious && <span className="offer-warning">{offer.suspicious}</span>}
          {search.rate && <Rating rating={search.rate(offer.title)} />}
          {reviewLine(offer)}
          {offer.deliveryDays != null ? (
            <span className={maxDelivery > 0 && offer.deliveryDays > maxDelivery ? "offer-warning" : "offer-delivery"}>
              Livraison : {deliveryLabel(offer.deliveryDays)}
            </span>
          ) : (
            maxDelivery > 0 && <span className="offer-delivery">Délai de livraison non précisé</span>
          )}
          {priceChecks[original.url] && <span className="offer-delivery">Vérification du prix en cours...</span>}
          {fix &&
            (Math.abs(fix.price - fix.previous) / fix.previous > PRICE_TOLERANCE ? (
              <span className="offer-warning">
                Le prix affiché sur la fiche produit est de {formatPrice(fix.price)}, et non de {formatPrice(fix.previous)}.
              </span>
            ) : (
              <span className="offer-verified">Prix confirmé sur la fiche produit</span>
            ))}
        </span>
        <strong className="offer-price">{checking ? "Vérification..." : formatPrice(offer.price)}</strong>
        <button className="btn" disabled={busy} onClick={() => take(merchant, original)}>
          {verifying === original.url ? "Vérification..." : "Prendre"}
        </button>
      </li>
    );
  };

  let shown: Offer[] = [];
  let others: Offer[] = [];
  if (lookup?.status === "done") {
    const { valid, outliers } = splitOutliers(
      [...lookup.direct, ...lookup.resolved].map(corrected).sort(byPrice),
      search.suspicion,
    );
    const rank = (o: Offer) => search.rate?.(o.title).rank ?? 0;
    shown = [...valid].sort((a, b) => rank(a) - rank(b) || byPrice(a, b));
    others = [...outliers, ...lookup.others];
  }

  const multi = (lookup?.scope.length ?? 0) > 1;
  const reviewStates = Object.values(reviewInfo);
  const reviewsTotal = reviewStates.length;
  const reviewsDone = reviewStates.filter((s) => s !== "loading").length;

  return (
    <div className="overlay" onClick={onClose}>
      <div className={lookup ? "modal modal-wide" : "modal"} onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>

        {!lookup && (
          <>
            <p>Sur quel site souhaitez-vous l&apos;acheter ?</p>
            {extension && (
              <button className="merchant-btn merchant-all" onClick={() => startSearch(merchants)}>
                Tous les sites
              </button>
            )}
            <div className="merchant-grid">
              {merchants.map((m) => (
                <button key={m.id} className="merchant-btn" onClick={() => startSearch([m])}>
                  {m.name}
                </button>
              ))}
            </div>
            {extension && (
              <label className="checkbox reviews-toggle">
                <input type="checkbox" checked={useReviews} onChange={(e) => toggleReviews(e.target.checked)} />
                Tenir compte des avis récents (recherche un peu plus longue)
              </label>
            )}
            {!extension && <p className="hint">Installez l&apos;extension Component Hook pour afficher les prix directement ici.</p>}
            <button className="btn-ghost" onClick={onClose}>
              Annuler
            </button>
          </>
        )}

        {lookup?.status === "loading" && (
          <p>
            Recherche en cours sur {scopeName(lookup.scope)}...
            {multi && ` (${lookup.finished}/${lookup.scope.length})`}
          </p>
        )}

        {lookup?.status === "error" && (
          <p className="error">
            Impossible de récupérer les offres sur {scopeName(lookup.scope)} ({lookup.error}).
          </p>
        )}

        {lookup?.status === "done" && (
          <>
            <p>
              {shown.length} offre{shown.length > 1 ? "s" : ""} sur {scopeName(lookup.scope)}
              {lookup.pending.length > 0 && ` · ${lookup.pending.length} annonce${lookup.pending.length > 1 ? "s" : ""} à variantes en cours de vérification`}
              {reviewsTotal > 0 && reviewsDone < reviewsTotal && ` · avis analysés : ${reviewsDone}/${reviewsTotal}`}
            </p>
            <p className="scam-notice">{SCAM_NOTICE}</p>
            {lookup.failed.length > 0 && <p className="error">Sites inaccessibles : {lookup.failed.join(", ")}</p>}
            {(shown.length > 0 || lookup.pending.length > 0) && (
              <ul className="offers">
                {shown.map(offerRow(multi))}
                {lookup.pending.map(offerRow(multi, true))}
              </ul>
            )}
            {lookup.unchecked.length > 0 && (
              <>
                <p className="section-title">
                  Annonces proposant plusieurs versions ({lookup.unchecked.length}) : le prix indiqué peut correspondre à
                  une autre version, vérifiez-le sur la fiche produit.
                </p>
                <ul className="offers">{[...lookup.unchecked].sort(byPrice).map(offerRow(multi))}</ul>
              </>
            )}
            {others.length > 0 && (
              <button className="link-btn" onClick={() => setShowOthers((v) => !v)}>
                {showOthers ? "Masquer" : "Afficher"} les autres résultats ({others.length})
              </button>
            )}
            {showOthers && <ul className="offers">{others.map(offerRow(multi))}</ul>}
          </>
        )}

        {lookup && lookup.status !== "loading" && (
          <div className="modal-actions">
            <button className="btn-ghost" onClick={backToMerchants}>
              Choisir un autre site
            </button>
            {!multi && (
              <button className="btn-ghost" onClick={() => openSearch(lookup.scope[0], search.query)}>
                Voir sur {lookup.scope[0].name}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
