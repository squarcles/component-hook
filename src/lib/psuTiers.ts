import { psuTierEntries } from "@/data/psuTiers";
import type { Rating } from "./criteria";

export type PsuTierEntry = [brand: string, series: string, variant: string, wattages: [number, number][], tier: string];

const TIER_ORDER = ["A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D", "D-", "E", "F"];
const UNKNOWN_RANK = TIER_ORDER.indexOf("D") - 0.5;

const BRAND_ALIASES: Record<string, string[]> = { "ADATA XPG": ["xpg", "adata"] };

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const compact = (s: string) => normalize(s).replace(/ /g, "");

function brandAliases(brand: string) {
  const parts = brand.split(/[/()]/).map(normalize).filter(Boolean);
  return [...new Set([...(BRAND_ALIASES[brand] ?? []), ...parts])];
}

const words = (s: string) => normalize(s).split(" ").filter(Boolean);

const indexed = psuTierEntries.map((entry) => {
  const [brand, series, variant] = entry;
  const main = series.replace(/\(.*?\)/g, "");
  return {
    entry,
    brands: brandAliases(brand),
    series: compact(main),
    seriesWords: words(main),
    variantWords: words(variant),
    variantCodes: variant.split(/\s+/).map(compact).filter((c) => c.length >= 2),
  };
});

function titleIndex(title: string) {
  const list = words(title)
    .map((w) => w.replace(/\d{3,4}/g, ""))
    .filter(Boolean);
  const sequences = new Set<string>();
  for (let i = 0; i < list.length; i++) {
    let joined = "";
    for (let j = i; j < Math.min(list.length, i + 6); j++) {
      joined += list[j];
      sequences.add(joined);
    }
  }
  return { tokens: new Set(list), sequences, list };
}

function matchScore(item: (typeof indexed)[number], title: ReturnType<typeof titleIndex>) {
  let base = 0;
  if (item.series.length >= 2 && title.sequences.has(item.series)) base = 10 * Math.max(1, item.seriesWords.length);
  else if (item.seriesWords.length && item.seriesWords.every((w) => title.tokens.has(w))) base = 10 * item.seriesWords.length;
  else if (item.series.length >= 2 && title.list.some((t) => t.startsWith(item.series))) base = 5;
  if (!base) return 0;
  const codes = item.variantCodes.filter((c) => title.tokens.has(c)).length;
  return base + codes * 2 + item.variantWords.filter((w) => title.tokens.has(w)).length;
}

function titleWattage(title: string) {
  const m = /(\d{3,4})\s?w(?:atts?)?\b/i.exec(title) ?? /[a-z](\d{3,4})[a-z]?\b/i.exec(title);
  return m ? Number(m[1]) : null;
}

export function findPsuTier(title: string) {
  const padded = ` ${normalize(title)} `;
  const brandMatches = indexed.filter((i) => i.brands.some((b) => padded.includes(` ${b} `)));
  if (!brandMatches.length) return { brand: null, tier: null };

  const index = titleIndex(title);
  let best = 0;
  let candidates: PsuTierEntry[] = [];
  for (const item of brandMatches) {
    const score = matchScore(item, index);
    if (score === 0 || score < best) continue;
    if (score > best) {
      best = score;
      candidates = [];
    }
    candidates.push(item.entry);
  }

  const brand = brandMatches[0].entry[0];
  if (!candidates.length) return { brand, tier: null };

  const watts = titleWattage(title);
  const sized = watts ? candidates.filter((c) => c[3].some(([min, max]) => watts >= min && watts <= max)) : [];
  const pool = sized.length ? sized : candidates;
  const tier = pool.map((c) => c[4]).sort((a, b) => TIER_ORDER.indexOf(b) - TIER_ORDER.indexOf(a))[0];
  return { brand, tier };
}

export function ratePsu(title: string): Rating {
  const { brand, tier } = findPsuTier(title);
  if (!tier) {
    return {
      rank: UNKNOWN_RANK,
      label: brand
        ? "Modèle absent de la tier list : consultez les tests avant d'acheter"
        : "Marque absente de la tier list : prudence",
      tone: "neutral",
    };
  }

  const rank = TIER_ORDER.indexOf(tier);
  const letter = tier[0];
  const labels: Record<string, [string, Rating["tone"]]> = {
    A: ["excellente alimentation", "good"],
    B: ["bonne alimentation", "good"],
    C: ["correcte pour une configuration d'entrée de gamme", "neutral"],
    D: ["déconseillée avec une carte graphique", "bad"],
    E: ["à éviter", "bad"],
    F: ["dangereuse, à éviter absolument", "bad"],
  };
  const [text, tone] = labels[letter];
  return { rank, label: `Tier ${tier} : ${text}`, tone };
}
