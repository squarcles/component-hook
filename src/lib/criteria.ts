import { getProduct } from "./categories";
import { COOLERS, PSU_WATTAGES, psuRequirement, recommendedWattage } from "./power";
import { DEFAULT_SUSPICION, listsSeveralCapacities, type Suspicion } from "./match";
import { ratePsu } from "./psuTiers";
import type { Build, CategoryId, Cpu, CriteriaValues, Gpu, MemoryType, Socket } from "./types";

type Option = { value: string; label: string };

type Field = {
  key: string;
  label: string;
  options: (v: CriteriaValues, build: Build) => Option[];
};

export type Search = {
  query: string;
  keywords: string[];
  exclude?: RegExp;
  reject?: (title: string, keywords: string[]) => boolean;
  variantKeywords?: string[];
  suspicion?: Suspicion;
  rate?: (title: string) => Rating;
};

export type Rating = { rank: number; label: string; tone: "good" | "bad" | "neutral" };

export type CriteriaSpec = {
  fields: Field[];
  defaults: (build: Build) => CriteriaValues;
  label: (v: CriteriaValues) => string;
  search: (v: CriteriaValues) => Search;
  requires?: { category: CategoryId; message: string };
  hint?: (v: CriteriaValues, build: Build) => string | null;
};

const SOCKETS: Socket[] = ["AM4", "AM5", "LGA1700", "LGA1851"];

const CHIPSETS: Record<Socket, string[]> = {
  AM4: ["A520", "B450", "B550", "X570"],
  AM5: ["A620", "B650", "B650E", "X670", "X670E", "B850", "X870", "X870E"],
  LGA1700: ["H610", "B660", "B760", "H770", "Z690", "Z790"],
  LGA1851: ["H810", "B860", "Z890"],
};

const SOCKET_MEMORY: Record<Socket, MemoryType[]> = {
  AM4: ["DDR4"],
  AM5: ["DDR5"],
  LGA1700: ["DDR5", "DDR4"],
  LGA1851: ["DDR5"],
};

const SPEEDS: Record<MemoryType, string[]> = {
  DDR4: ["3200", "3600"],
  DDR5: ["5200", "5600", "6000", "6400", "7200"],
};

const ANY: Option = { value: "", label: "Peu importe" };
const YES_NO: Option[] = [ANY, { value: "oui", label: "Oui" }, { value: "non", label: "Non" }];

const options = (values: (string | number)[], suffix = "") =>
  values.map((v) => ({ value: String(v), label: `${v}${suffix}` }));

const pick = (opts: Option[], value: string) => opts.find((o) => o.value === value)?.label ?? value;

const rx = (parts: string[]) => new RegExp(parts.join("|"), "i");

const word = (pattern: string) => `(^|[^a-z0-9])(?:${pattern})([^a-z0-9]|$)`;

const chipsetPattern = (chipset: string) => `${chipset.toLowerCase()}m?`;

const MICRO_ATX = "micro[\\s-]?atx|m-?atx";
const MINI_ITX = "mini[\\s-]?itx|itx";
const BOARD_MICRO = `${MICRO_ATX}|[abhxz]\\d{3}e?m`;
const BOARD_MINI = `${MINI_ITX}|[abhxz]\\d{3}e?-?i`;
const FULL_ATX = "(?<!micro[\\s-])(?<!m-)atx";
const WIFI = "(?:wi-?fi|ax)";
const RGB = "a?rgb";

const cpuOf = (build: Build) => (build.cpu?.productId ? (getProduct("cpu", build.cpu.productId) as Cpu) : undefined);
const gpuOf = (build: Build) => (build.gpu?.productId ? (getProduct("gpu", build.gpu.productId) as Gpu) : undefined);

const rgbFilter = (v: CriteriaValues, keywords: string[], exclude: string[]) => {
  if (v.rgb === "oui") keywords.push(RGB);
  if (v.rgb === "non") exclude.push(word(RGB));
};

const motherboard: CriteriaSpec = {
  fields: [
    { key: "socket", label: "Socket", options: () => options(SOCKETS) },
    { key: "chipset", label: "Chipset", options: (v) => [ANY, ...options(CHIPSETS[v.socket as Socket])] },
    { key: "formFactor", label: "Format", options: () => [ANY, ...options(["ATX", "Micro-ATX", "Mini-ITX"])] },
    { key: "memory", label: "Mémoire", options: (v) => options(SOCKET_MEMORY[v.socket as Socket]) },
    { key: "wifi", label: "Wi-Fi", options: () => YES_NO },
  ],
  defaults: (build) => {
    const socket = cpuOf(build)?.socket ?? "AM5";
    const memory = build.ram?.criteria?.type ?? SOCKET_MEMORY[socket][0];
    return { socket, chipset: "", formFactor: "", memory, wifi: "" };
  },
  label: (v) =>
    [v.chipset || v.socket, v.formFactor, v.memory, v.wifi === "oui" ? "Wi-Fi" : ""].filter(Boolean).join(" · "),
  search: (v) => {
    const socket = v.socket as Socket;
    const keywords = [
      v.chipset ? chipsetPattern(v.chipset) : `(?:${CHIPSETS[socket].map(chipsetPattern).join("|")})`,
    ];
    const exclude = ["\\bkit\\b", "\\bpack\\b", "bundle"];

    if (v.formFactor === "Micro-ATX") keywords.push(`(?:${BOARD_MICRO})`);
    if (v.formFactor === "Mini-ITX") keywords.push(`(?:${BOARD_MINI})`);
    if (v.formFactor === "ATX") exclude.push(word(`${BOARD_MICRO}|${BOARD_MINI}`));
    if (v.wifi === "oui") keywords.push(WIFI);
    if (v.wifi === "non") exclude.push(word(WIFI));
    if (socket === "LGA1700" && v.memory === "DDR4") keywords.push("ddr4");
    if (socket === "LGA1700" && v.memory === "DDR5") exclude.push("ddr4");

    const query = [
      "carte mère",
      v.chipset || socket,
      v.formFactor,
      socket === "LGA1700" ? v.memory : "",
      v.wifi === "oui" ? "wifi" : "",
    ]
      .filter(Boolean)
      .join(" ");

    return {
      query,
      keywords,
      exclude: rx(exclude),
      suspicion: { ...(DEFAULT_SUSPICION as Exclude<Suspicion, false>), ratio: 0.3, outlier: 0.15 },
    };
  },
};

const ram: CriteriaSpec = {
  fields: [
    { key: "type", label: "Type", options: () => options(["DDR4", "DDR5"]) },
    { key: "capacity", label: "Capacité", options: () => options([8, 16, 32, 48, 64, 96], " Go") },
    {
      key: "modules",
      label: "Barrettes",
      options: () => [
        { value: "1", label: "1 barrette" },
        { value: "2", label: "2 barrettes" },
        { value: "4", label: "4 barrettes" },
      ],
    },
    { key: "speed", label: "Fréquence", options: (v) => [ANY, ...options(SPEEDS[v.type as MemoryType], " MT/s")] },
  ],
  defaults: (build) => {
    const cpu = cpuOf(build);
    const type = build.motherboard?.criteria?.memory ?? (cpu?.memory.length === 1 ? cpu.memory[0] : "DDR5");
    return { type, capacity: "32", modules: "2", speed: "" };
  },
  label: (v) => {
    const total = Number(v.capacity);
    const modules = Number(v.modules);
    return [v.type, `${total} Go (${modules}×${total / modules})`, v.speed ? `${v.speed} MT/s` : ""]
      .filter(Boolean)
      .join(" · ");
  },
  search: (v) => {
    const total = Number(v.capacity);
    const modules = Number(v.modules);
    const size = total / modules;
    const keywords = [v.type.toLowerCase(), `(?:${total} ?(?:go|gb)|${modules} ?x ?${size} ?(?:go|gb)?)`];
    if (v.speed) keywords.push(`${v.speed}(?: ?(?:mhz|mt\\/?s))?`);
    const exclude = new RegExp(`so-?dimm|portable|laptop|notebook|\\b\\d ?x ?(?!${size}(?!\\d))\\d+ ?(?:go|gb)`, "i");
    const query = ["ram", v.type, `${total} Go`, modules > 1 ? `${modules}x${size}` : "", v.speed].filter(Boolean).join(" ");
    return {
      query,
      keywords,
      exclude,
      reject: (title) => listsSeveralCapacities(title, 4),
      variantKeywords: [keywords[1]],
    };
  },
};

const COOLER_EXCLUDE = [
  "p[aâ]te",
  "thermal paste",
  "\\bpad\\b",
  "ventilateur (?:de )?bo[iî]tier",
  "case fan",
  "portable",
  "laptop",
  "gpu",
  "carte graphique",
  "\\bssd\\b",
  "m\\.2",
  "\\bram\\b",
  "\\bhub\\b",
];

const cooler: CriteriaSpec = {
  requires: { category: "cpu", message: "Sélectionnez d'abord votre processeur afin que nous puissions vous proposer un refroidissement adapté." },
  fields: [
    {
      key: "type",
      label: "Type",
      options: (_v, build) => {
        const power = cpuOf(build)?.power ?? 0;
        return COOLERS.filter((c) => c.capacity >= power).map((c) => ({ value: c.value, label: c.label }));
      },
    },
    { key: "rgb", label: "RGB", options: () => YES_NO },
  ],
  defaults: (build) => {
    const power = cpuOf(build)?.power ?? 0;
    const airCooled = COOLERS.some((c) => !c.value.startsWith("aio") && c.capacity >= power);
    return { type: airCooled ? "" : "aio360", rgb: "" };
  },
  hint: (_v, build) => {
    const cpu = cpuOf(build);
    return cpu ? `Votre ${cpu.name} peut consommer jusqu'à ${cpu.power} W. Seuls les refroidissements adaptés vous sont proposés.` : null;
  },
  label: (v) => [pick(COOLERS, v.type), v.rgb === "oui" ? "RGB" : ""].filter(Boolean).join(" · "),
  search: (v) => {
    const keywords: string[] = [];
    const exclude = [...COOLER_EXCLUDE];
    let query: string;

    if (v.type.startsWith("aio")) {
      const size = v.type.slice(3);
      query = `watercooling AIO ${size} mm`;
      keywords.push("(?:watercooling|water cooling|aio|liquid|liquide)", `${size}(?: ?mm)?`);
    } else {
      const dual = "(?:double|dual|twin)[\\s-]?(?:tour|tower)";
      keywords.push("(?:ventirad|refroidisseur|cooler)");
      exclude.push("watercooling", "water cooling", "\\baio\\b", "liquid", "liquide");
      if (v.type === "double") {
        query = "ventirad double tour";
        keywords.push(dual);
      } else {
        query = "ventirad processeur";
        exclude.push(dual);
      }
    }

    rgbFilter(v, keywords, exclude);
    if (v.rgb === "oui") query += " rgb";
    return { query, keywords, exclude: rx(exclude), suspicion: false };
  },
};

const STORAGE_TYPES: Option[] = [
  { value: "nvme", label: "SSD NVMe M.2" },
  { value: "sata", label: "SSD SATA 2,5\"" },
  { value: "hdd", label: "Disque dur 3,5\"" },
];

const capacityLabel = (go: number) => (go >= 1000 ? `${go / 1000} To` : `${go} Go`);

const capacityPattern = (go: number) =>
  go >= 1000 ? `(?:${go / 1000} ?(?:to|tb)|${go} ?(?:go|gb))` : `(?:${go === 500 ? "500|512" : go}) ?(?:go|gb)`;

const storage: CriteriaSpec = {
  fields: [
    { key: "type", label: "Type", options: () => STORAGE_TYPES },
    {
      key: "capacity",
      label: "Capacité",
      options: (v) =>
        (v.type === "hdd" ? [1000, 2000, 4000, 8000] : [500, 1000, 2000, 4000]).map((c) => ({
          value: String(c),
          label: capacityLabel(c),
        })),
    },
    {
      key: "gen",
      label: "PCIe",
      options: (v) => (v.type === "nvme" ? [ANY, ...options([3, 4, 5]).map((o) => ({ ...o, label: `Gen ${o.label}` }))] : [ANY]),
    },
  ],
  defaults: () => ({ type: "nvme", capacity: "1000", gen: "" }),
  label: (v) => [pick(STORAGE_TYPES, v.type), capacityLabel(Number(v.capacity)), v.gen ? `Gen ${v.gen}` : ""].filter(Boolean).join(" · "),
  search: (v) => {
    const capacity = Number(v.capacity);
    const keywords = [capacityPattern(capacity)];
    const exclude = ["externe", "\\busb\\b", "bo[iî]tier", "enclosure", "adaptateur", "\\bcarte d.extension\\b"];
    let query: string;

    if (v.type === "nvme") {
      query = `ssd nvme m.2 ${capacityLabel(capacity)}${v.gen ? ` gen${v.gen}` : ""}`;
      keywords.push("(?:nvme|m\\.?2)");
      exclude.push("\\bsata\\b");
      if (v.gen) keywords.push(`(?:gen ?${v.gen}|pcie ?${v.gen}(?:\\.0)?)`);
    } else if (v.type === "sata") {
      query = `ssd sata 2.5 ${capacityLabel(capacity)}`;
      keywords.push("ssd", "sata");
      exclude.push("nvme", "\\bm\\.?2\\b", "msata");
    } else {
      query = `disque dur interne 3.5 ${capacityLabel(capacity)}`;
      keywords.push("(?:hdd|disque dur)");
      exclude.push("\\bssd\\b", "2[.,]5");
    }

    return {
      query,
      keywords,
      exclude: rx(exclude),
      reject: (title) => listsSeveralCapacities(title, 100),
      variantKeywords: [capacityPattern(capacity)],
    };
  },
};

const CERTIFICATIONS: Option[] = [
  ANY,
  { value: "bronze", label: "80+ Bronze" },
  { value: "gold", label: "80+ Gold" },
  { value: "platinum", label: "80+ Platinum" },
];

const PSU_SUSPICION: Suspicion = {
  ratio: 0.75,
  message: "Prix anormalement bas pour une alimentation. Un modèle de mauvaise qualité peut endommager vos composants.",
};

const powerNeed = (build: Build) => psuRequirement(cpuOf(build)?.power, gpuOf(build)?.power);

const psu: CriteriaSpec = {
  fields: [
    {
      key: "wattage",
      label: "Puissance",
      options: (_v, build) => {
        const { required } = powerNeed(build);
        return PSU_WATTAGES.map((w) => ({ value: String(w), label: `${w} W${w < required ? " (insuffisant)" : ""}` }));
      },
    },
    { key: "certification", label: "Certification", options: () => CERTIFICATIONS },
    { key: "modular", label: "Modulaire", options: () => [ANY, { value: "oui", label: "Oui" }] },
  ],
  defaults: (build) => ({ wattage: String(recommendedWattage(powerNeed(build).required)), certification: "", modular: "" }),
  hint: (_v, build) => {
    const { estimate, required } = powerNeed(build);
    const parts = [cpuOf(build) ? "processeur" : "", gpuOf(build) ? "carte graphique" : ""].filter(Boolean);
    const basis = parts.length ? `d'après votre ${parts.join(" et votre ")}` : "sans processeur ni carte graphique sélectionnés";
    return `Consommation estimée ${basis} : environ ${estimate} W. Nous recommandons une alimentation d'au moins ${recommendedWattage(required)} W. Les offres sont notées d'après la PSU Tier List de SPL (psutierlist.org).`;
  },
  label: (v) =>
    [`${v.wattage} W`, v.certification ? pick(CERTIFICATIONS, v.certification) : "", v.modular === "oui" ? "Modulaire" : ""]
      .filter(Boolean)
      .join(" · "),
  search: (v) => {
    const keywords = [`${v.wattage} ?w(?:atts?)?`, "(?:alimentation|psu|power supply)"];
    if (v.certification) keywords.push(v.certification === "platinum" ? "platin(?:um)?" : v.certification);
    if (v.modular === "oui") keywords.push("modula(?:ire|r)");
    const exclude = ["c[aâ]ble", "\\bcable", "extension", "rallonge", "testeur", "tester", "laptop", "portable", "chargeur", "adaptateur", "onduleur", "\\bups\\b"];
    const query = ["alimentation pc", `${v.wattage}W`, v.certification ? `80+ ${v.certification}` : "", v.modular === "oui" ? "modulaire" : ""]
      .filter(Boolean)
      .join(" ");
    return { query, keywords, exclude: rx(exclude), suspicion: PSU_SUSPICION, rate: ratePsu };
  },
};

const CASE_FORMATS: Option[] = [
  { value: "ATX", label: "ATX (moyen tour)" },
  { value: "Micro-ATX", label: "Micro-ATX" },
  { value: "Mini-ITX", label: "Mini-ITX" },
];

const COLORS: Option[] = [ANY, { value: "noir", label: "Noir" }, { value: "blanc", label: "Blanc" }];

const pcCase: CriteriaSpec = {
  fields: [
    { key: "format", label: "Format", options: () => CASE_FORMATS },
    { key: "color", label: "Couleur", options: () => COLORS },
  ],
  defaults: (build) => ({ format: build.motherboard?.criteria?.formFactor || "ATX", color: "" }),
  hint: () =>
    "Le choix du boîtier relève avant tout de vos goûts. Assurez-vous simplement qu'il offre une bonne ventilation et suffisamment de place pour votre carte graphique.",
  label: (v) => [pick(CASE_FORMATS, v.format), v.color ? pick(COLORS, v.color) : ""].filter(Boolean).join(" · "),
  search: (v) => {
    const keywords = ["(?:bo[iî]tier|case|tour)"];
    if (v.format === "ATX") keywords.push(FULL_ATX);
    if (v.format === "Micro-ATX") keywords.push(`(?:${MICRO_ATX})`);
    if (v.format === "Mini-ITX") keywords.push(`(?:${MINI_ITX})`);
    if (v.color === "noir") keywords.push("(?:noir|black)");
    if (v.color === "blanc") keywords.push("(?:blanc|white)");
    const exclude = ["^\\W*(?:ventilateur|fan|c[aâ]ble|support|riser|filtre)\\b", "externe", "enclosure", "disque", "\\bssd\\b", "nvme", "\\bhdd\\b"];
    const query = ["boitier pc", v.format, v.color].filter(Boolean).join(" ");
    return { query, keywords, exclude: rx(exclude) };
  },
};

const PACK = "3 ?(?:x|pack|pcs|pi[eè]ces)|(?:pack|lot|kit) de 3|3-pack|triple pack";

const fans: CriteriaSpec = {
  fields: [
    { key: "size", label: "Taille", options: () => options([120, 140], " mm") },
    {
      key: "pack",
      label: "Quantité",
      options: () => [
        { value: "1", label: "À l'unité" },
        { value: "3", label: "Pack de 3" },
      ],
    },
    { key: "rgb", label: "RGB", options: () => YES_NO },
  ],
  defaults: () => ({ size: "120", pack: "3", rgb: "" }),
  label: (v) => [`${v.size} mm`, v.pack === "3" ? "Pack de 3" : "À l'unité", v.rgb === "oui" ? "RGB" : ""].filter(Boolean).join(" · "),
  search: (v) => {
    const keywords = ["(?:ventilateur|fan)", `${v.size} ?mm`];
    const exclude = ["ventirad", "cpu cooler", "refroidisseur", "watercooling", "\\baio\\b", "laptop", "portable", "gpu", "carte graphique", "alimentation", "grille", "filtre", "\\bhub\\b", "contr[oô]leur", "c[aâ]ble"];
    if (v.pack === "3") keywords.push(`(?:${PACK})`);
    else exclude.push(word(PACK));
    rgbFilter(v, keywords, exclude);
    const query = ["ventilateur boitier", `${v.size}mm`, v.pack === "3" ? "pack de 3" : "", v.rgb === "oui" ? "rgb" : ""]
      .filter(Boolean)
      .join(" ");
    return { query, keywords, exclude: rx(exclude), suspicion: false };
  },
};

const THERMAL_TYPES: Option[] = [
  { value: "pate", label: "Pâte thermique" },
  { value: "metal", label: "Métal liquide" },
  { value: "pad", label: "Pad thermique" },
];

const LIQUID_METAL = "m[eé]tal liquide|liquid metal";

const thermal: CriteriaSpec = {
  fields: [{ key: "type", label: "Type", options: () => THERMAL_TYPES }],
  defaults: () => ({ type: "pate" }),
  label: (v) => pick(THERMAL_TYPES, v.type),
  search: (v) => {
    const exclude = ["ventirad", "ventilateur", "watercooling", "\\baio\\b", "nettoyant", "cleaner", "souris", "mouse"];
    if (v.type === "pate") {
      exclude.push(LIQUID_METAL, "\\bpads?\\b");
      return { query: "pâte thermique", keywords: ["(?:p[aâ]te|paste|compound)"], exclude: rx(exclude), suspicion: false };
    }
    if (v.type === "metal") {
      return { query: "métal liquide thermique", keywords: [`(?:${LIQUID_METAL})`], exclude: rx(exclude), suspicion: false };
    }
    exclude.push("p[aâ]te", "paste");
    return { query: "pad thermique", keywords: ["(?:pads?|tampons?)"], exclude: rx(exclude), suspicion: false };
  },
};

const typeField = (types: Option[]): Field => ({ key: "type", label: "Type", options: () => types });

const accessory = (
  types: Option[],
  search: Record<string, { query: string; keywords: string[]; exclude?: string[] }>,
  commonExclude: string[],
): CriteriaSpec => ({
  fields: [typeField(types)],
  defaults: () => ({ type: types[0].value }),
  label: (v) => pick(types, v.type),
  search: (v) => {
    const s = search[v.type];
    return { query: s.query, keywords: s.keywords, exclude: rx([...commonExclude, ...(s.exclude ?? [])]), suspicion: false };
  },
});

const fanhub = accessory(
  [
    { value: "pwm", label: "Hub PWM (vitesse)" },
    { value: "argb", label: "Contrôleur ARGB (éclairage)" },
  ],
  {
    pwm: { query: "hub ventilateur pwm", keywords: ["(?:hub|splitter|r[eé]partiteur|contr[oô]leur)", "pwm"] },
    argb: { query: "contrôleur argb ventilateur", keywords: ["(?:hub|contr[oô]leur|controller)", RGB] },
  },
  ["\\b(?:120|140) ?mm\\b", "ventirad", "watercooling", "\\baio\\b", "laptop", "portable"],
);

const cables = accessory(
  [
    { value: "sleeved", label: "Rallonges gainées (sleeved)" },
    { value: "12vhpwr", label: "Câble 12VHPWR / 12V-2x6 (carte graphique)" },
  ],
  {
    sleeved: { query: "rallonge câble alimentation gainé sleeved", keywords: ["(?:rallonge|extension|c[aâ]bles?)", "(?:sleeve[ds]?|gain[ée]e?s?)"] },
    "12vhpwr": { query: "câble 12VHPWR 12V-2x6", keywords: ["(?:12v ?hpwr|12v-?2x6|16 ?pin)"] },
  },
  ["\\b\\d{3,4} ?w\\b", "\\bpsu\\b", "laptop"],
);

const wifi = accessory(
  [
    { value: "pcie", label: "Carte PCIe Wi-Fi + Bluetooth" },
    { value: "usb", label: "Clé USB Wi-Fi" },
  ],
  {
    pcie: { query: "carte wifi pcie bluetooth", keywords: ["(?:wi-?fi|wireless)", "pci-?e"], exclude: ["\\busb\\b"] },
    usb: { query: "clé usb wifi", keywords: ["(?:wi-?fi|wireless)", "usb"], exclude: ["pci-?e"] },
  },
  ["routeur", "router", "r[eé]p[eé]teur", "repeater", "mesh", "point d'acc[eè]s", "carte m[eè]re", "motherboard", "\\bcam[eé]ra\\b"],
);

export const criteriaSpecs: Partial<Record<CategoryId, CriteriaSpec>> = {
  motherboard,
  ram,
  cooler,
  storage,
  psu,
  case: pcCase,
  fans,
  thermal,
  fanhub,
  cables,
  wifi,
};

export function normalizeCriteria(spec: CriteriaSpec, values: CriteriaValues, build: Build) {
  const result = { ...values };
  for (const field of spec.fields) {
    const opts = field.options(result, build);
    if (!opts.some((o) => o.value === result[field.key])) result[field.key] = opts[0]?.value ?? "";
  }
  return result;
}
