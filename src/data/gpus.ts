import type { Gpu } from "@/lib/types";

const not = (suffixes: string) => `(?![\\s-]*(?:${suffixes})(?![a-z]))`;
const vram = (gb: number) => `${gb} ?(?:go|gb)`;

export const gpus: Gpu[] = [
  { id: "rtx-3060-12", brand: "NVIDIA", name: "GeForce RTX 3060 12 Go", vram: 12, power: 170, keywords: ["rtx", `3060${not("ti")}`, vram(12)] },
  { id: "rtx-4060", brand: "NVIDIA", name: "GeForce RTX 4060", vram: 8, power: 115, keywords: ["rtx", `4060${not("ti")}`] },
  { id: "rtx-4060-ti-8", brand: "NVIDIA", name: "GeForce RTX 4060 Ti 8 Go", vram: 8, power: 160, keywords: ["rtx", "4060[\\s-]*ti", vram(8)] },
  { id: "rtx-5060", brand: "NVIDIA", name: "GeForce RTX 5060", vram: 8, power: 145, keywords: ["rtx", `5060${not("ti")}`] },
  { id: "rtx-5060-ti-8", brand: "NVIDIA", name: "GeForce RTX 5060 Ti 8 Go", vram: 8, power: 180, keywords: ["rtx", "5060[\\s-]*ti", vram(8)] },
  { id: "rtx-5060-ti-16", brand: "NVIDIA", name: "GeForce RTX 5060 Ti 16 Go", vram: 16, power: 180, keywords: ["rtx", "5060[\\s-]*ti", vram(16)] },
  { id: "rtx-5070", brand: "NVIDIA", name: "GeForce RTX 5070", vram: 12, power: 250, keywords: ["rtx", `5070${not("ti|super")}`] },
  { id: "rtx-5070-ti", brand: "NVIDIA", name: "GeForce RTX 5070 Ti", vram: 16, power: 300, keywords: ["rtx", "5070[\\s-]*ti"] },
  { id: "rtx-5080", brand: "NVIDIA", name: "GeForce RTX 5080", vram: 16, power: 360, keywords: ["rtx", `5080${not("ti|super")}`] },
  { id: "rtx-5090", brand: "NVIDIA", name: "GeForce RTX 5090", vram: 32, power: 575, keywords: ["rtx", "5090"] },
  { id: "rx-7600", brand: "AMD", name: "Radeon RX 7600", vram: 8, power: 165, keywords: [`7600${not("xt")}`, "(?:rx|radeon)"] },
  { id: "rx-7800-xt", brand: "AMD", name: "Radeon RX 7800 XT", vram: 16, power: 263, keywords: ["7800[\\s-]*xt"] },
  { id: "rx-7900-xtx", brand: "AMD", name: "Radeon RX 7900 XTX", vram: 24, power: 355, keywords: ["7900[\\s-]*xtx"] },
  { id: "rx-9060-xt-8", brand: "AMD", name: "Radeon RX 9060 XT 8 Go", vram: 8, power: 150, keywords: ["9060[\\s-]*xt", vram(8)] },
  { id: "rx-9060-xt-16", brand: "AMD", name: "Radeon RX 9060 XT 16 Go", vram: 16, power: 160, keywords: ["9060[\\s-]*xt", vram(16)] },
  { id: "rx-9070", brand: "AMD", name: "Radeon RX 9070", vram: 16, power: 220, keywords: [`9070${not("xt|gre")}`] },
  { id: "rx-9070-xt", brand: "AMD", name: "Radeon RX 9070 XT", vram: 16, power: 304, keywords: ["9070[\\s-]*xt"] },
  { id: "arc-b570", brand: "Intel", name: "Arc B570", vram: 10, power: 150, keywords: ["b570"] },
  { id: "arc-b580", brand: "Intel", name: "Arc B580", vram: 12, power: 190, keywords: ["b580"] },
];
