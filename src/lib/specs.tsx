import type { ReactNode } from "react";
import type { CategoryId, Cpu, Gpu, Product } from "./types";
import { listsOtherModels } from "./match";

type Column<T> = { label: string; value: (p: T) => ReactNode; mobile?: boolean };
type Filter<T> = { label: string; value: (p: T) => string };

export type CategorySpec<T extends Product = Product> = {
  columns: Column<T>[];
  filters: Filter<T>[];
  query: (p: T) => string;
  keywords: (p: T) => string[];
  exclude?: RegExp;
  reject?: (title: string, keywords: string[]) => boolean;
};

const spec = <T extends Product>(s: CategorySpec<T>) => s as unknown as CategorySpec;

export const specs: Partial<Record<CategoryId, CategorySpec>> = {
  cpu: spec<Cpu>({
    columns: [
      { label: "Socket", value: (p: Cpu) => p.socket, mobile: true },
      { label: "Cœurs / Threads", value: (p: Cpu) => `${p.cores} / ${p.threads}` },
      { label: "Fréquence", value: (p: Cpu) => `${p.baseClock} – ${p.boostClock} GHz` },
      { label: "TDP", value: (p: Cpu) => `${p.tdp} W` },
      { label: "iGPU", value: (p: Cpu) => (p.integratedGraphics ? "Oui" : "Non") },
    ],
    filters: [
      { label: "Marque", value: (p: Cpu) => p.brand },
      { label: "Socket", value: (p: Cpu) => p.socket },
    ],
    query: (p: Cpu) => `${p.brand} ${p.name}`,
    keywords: (p: Cpu) =>
      p.name
        .toLowerCase()
        .split(/[\s-]+/)
        .filter((t) => t.length >= 3 && /\d/.test(t)),
    exclude:
      /carte[\s-]?m[eè]re|motherboard|mainboard|^\W*(ventirad|refroidisseur|watercooling|cooler|aio)\b|\bkit\b|\b[abhxz]\d{3}[a-z]?\b/i,
    reject: listsOtherModels,
  }),
  gpu: spec<Gpu>({
    columns: [
      { label: "VRAM", value: (p: Gpu) => `${p.vram} Go`, mobile: true },
      { label: "Conso", value: (p: Gpu) => `${p.power} W` },
    ],
    filters: [
      { label: "Marque", value: (p: Gpu) => p.brand },
      { label: "VRAM", value: (p: Gpu) => `${p.vram} Go` },
    ],
    query: (p: Gpu) => `carte graphique ${p.name}`,
    keywords: (p: Gpu) => p.keywords,
    exclude:
      /^\W*(support|backplate|waterblock|water block|riser|c[aâ]ble|cable|bracket|ventilateur|fan)\b|waterblock|water block|portable|laptop/i,
    reject: listsOtherModels,
  }),
};
