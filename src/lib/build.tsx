"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Build, BuildPart, CategoryId } from "./types";

const STORAGE_KEY = "pcfinder-build";
const DELIVERY_KEY = "pcfinder-max-delivery";

export const DELIVERY_LIMITS = [
  { value: 0, label: "Peu importe" },
  { value: 7, label: "1 semaine" },
  { value: 14, label: "2 semaines" },
  { value: 30, label: "1 mois" },
  { value: 60, label: "2 mois" },
];

type BuildContextValue = {
  build: Build;
  loaded: boolean;
  setPart: (category: CategoryId, part: BuildPart) => void;
  removePart: (category: CategoryId) => void;
  replaceBuild: (build: Build) => void;
  maxDelivery: number;
  setMaxDelivery: (days: number) => void;
};

const BuildContext = createContext<BuildContextValue | null>(null);

export function BuildProvider({ children }: { children: ReactNode }) {
  const [build, setBuild] = useState<Build>({});
  const [maxDelivery, setMaxDeliveryState] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setBuild(JSON.parse(saved));
      const delivery = Number(localStorage.getItem(DELIVERY_KEY));
      if (DELIVERY_LIMITS.some((d) => d.value === delivery)) setMaxDeliveryState(delivery);
    } catch {}
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(build));
    } catch {}
  }, [build, loaded]);

  const setPart = (category: CategoryId, part: BuildPart) => setBuild((b) => ({ ...b, [category]: part }));

  const removePart = (category: CategoryId) =>
    setBuild((b) => {
      const next = { ...b };
      delete next[category];
      return next;
    });

  const setMaxDelivery = (days: number) => {
    setMaxDeliveryState(days);
    try {
      localStorage.setItem(DELIVERY_KEY, String(days));
    } catch {}
  };

  return (
    <BuildContext.Provider
      value={{ build, loaded, setPart, removePart, replaceBuild: setBuild, maxDelivery, setMaxDelivery }}
    >
      {children}
    </BuildContext.Provider>
  );
}

export function useBuild() {
  const ctx = useContext(BuildContext);
  if (!ctx) throw new Error("useBuild must be used inside BuildProvider");
  return ctx;
}
