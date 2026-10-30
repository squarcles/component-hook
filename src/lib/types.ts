export type CategoryId =
  | "cpu"
  | "cooler"
  | "motherboard"
  | "ram"
  | "gpu"
  | "storage"
  | "psu"
  | "case"
  | "fans"
  | "thermal"
  | "fanhub"
  | "cables"
  | "wifi";

export type Category = {
  id: CategoryId;
  name: string;
  available: boolean;
  accessory?: boolean;
};

export type Socket = "AM4" | "AM5" | "LGA1700" | "LGA1851";

export type MemoryType = "DDR4" | "DDR5";

export type Cpu = {
  id: string;
  brand: "AMD" | "Intel";
  name: string;
  socket: Socket;
  cores: number;
  threads: number;
  baseClock: number;
  boostClock: number;
  tdp: number;
  power: number;
  memory: MemoryType[];
  integratedGraphics: boolean;
};

export type Gpu = {
  id: string;
  brand: "NVIDIA" | "AMD" | "Intel";
  name: string;
  vram: number;
  power: number;
  keywords: string[];
};

export type Product = Cpu | Gpu;

export type CriteriaValues = Record<string, string>;

export type Merchant = {
  id: string;
  name: string;
  searchUrl: (query: string) => string;
  hosts: string[];
  variants?: boolean;
  reviews?: boolean;
};

export type Offer = {
  title: string;
  price: number;
  url: string;
  image?: string | null;
  variant?: string;
  suspicious?: string;
  merchantId?: string;
  reviewWarning?: string;
  manual?: boolean;
  deliveryDays?: number | null;
};

export type BuildPart = {
  merchantId: string;
  productId?: string;
  criteria?: CriteriaValues;
  offer?: Offer;
};

export type Build = Partial<Record<CategoryId, BuildPart>>;
