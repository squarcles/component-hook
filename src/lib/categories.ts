import type { Category, CategoryId, Product } from "./types";
import { cpus } from "@/data/cpus";
import { gpus } from "@/data/gpus";

export const categories: Category[] = [
  { id: "cpu", name: "Processeur", available: true },
  { id: "cooler", name: "Ventirad / Watercooling", available: true },
  { id: "motherboard", name: "Carte mère", available: true },
  { id: "ram", name: "Mémoire vive", available: true },
  { id: "gpu", name: "Carte graphique", available: true },
  { id: "storage", name: "Stockage", available: true },
  { id: "psu", name: "Alimentation", available: true },
  { id: "case", name: "Boîtier", available: true },
  { id: "fans", name: "Ventilateurs", available: true, accessory: true },
  { id: "thermal", name: "Pâte thermique", available: true, accessory: true },
  { id: "fanhub", name: "Hub / contrôleur de ventilateurs", available: true, accessory: true },
  { id: "cables", name: "Câbles et rallonges", available: true, accessory: true },
  { id: "wifi", name: "Carte Wi-Fi / Bluetooth", available: true, accessory: true },
];

export const catalogue: Partial<Record<CategoryId, Product[]>> = {
  cpu: cpus,
  gpu: gpus,
};

export function getCategory(id: string) {
  return categories.find((c) => c.id === id);
}

export function getProduct(category: CategoryId, productId: string) {
  return catalogue[category]?.find((p) => p.id === productId);
}
