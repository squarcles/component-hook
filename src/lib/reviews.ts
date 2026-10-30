export type Review = { rating: number; date: string };

export type ReviewSummary = { label: string; warning?: string };

const RECENT_MONTHS = 6;
const MIN_REVIEWS = 5;
const NEGATIVE_SHARE = 0.3;

export function summarizeReviews(reviews: Review[]): ReviewSummary {
  const limit = new Date();
  limit.setMonth(limit.getMonth() - RECENT_MONTHS);
  const recent = reviews.filter((r) => new Date(r.date) >= limit);

  if (recent.length === 0) {
    return { label: reviews.length ? "Aucun avis au cours des 6 derniers mois" : "Aucun avis" };
  }

  const average = recent.reduce((sum, r) => sum + r.rating, 0) / recent.length;
  const negative = recent.filter((r) => r.rating <= 2).length;
  const share = negative / recent.length;
  const label = `${average.toFixed(1).replace(".", ",")}/5 sur ${recent.length} avis récent${recent.length > 1 ? "s" : ""}`;

  if (recent.length >= MIN_REVIEWS && share >= NEGATIVE_SHARE) {
    return {
      label,
      warning: `Avis récents majoritairement défavorables : ${Math.round(share * 100)} % de notes à 1 ou 2 étoiles sur les ${recent.length} derniers avis.`,
    };
  }
  return { label };
}
