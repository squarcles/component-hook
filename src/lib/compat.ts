import { getProduct } from "./categories";
import { coolerCapacity, psuRequirement } from "./power";
import type { Build, BuildPart, CategoryId, Cpu, Gpu, MemoryType, Socket } from "./types";

type Board = { socket: Socket; memory: MemoryType; memorySlots: number; formFactor: string };
type Memory = { type: MemoryType; modules: number };
type Parts = {
  cpu?: Cpu;
  gpu?: Gpu;
  motherboard?: Board;
  ram?: Memory;
  cooler?: { capacity: number };
  psu?: { wattage: number };
  case?: { format: string };
};
type Key = keyof Parts;

type Rule = {
  needs: Key[];
  involves?: Key[];
  check: (p: Parts) => string | null;
};

const FORMAT_SIZE: Record<string, number> = { "Mini-ITX": 1, "Micro-ATX": 2, ATX: 3 };

const rules: Rule[] = [
  {
    needs: ["cpu", "motherboard"],
    check: ({ cpu, motherboard }) =>
      cpu!.socket !== motherboard!.socket
        ? `Le processeur (${cpu!.socket}) n'est pas compatible avec le socket de la carte mère (${motherboard!.socket}).`
        : null,
  },
  {
    needs: ["motherboard", "ram"],
    check: ({ motherboard, ram }) =>
      motherboard!.memory !== ram!.type ? `La carte mère accepte uniquement la ${motherboard!.memory}, et non la ${ram!.type}.` : null,
  },
  {
    needs: ["motherboard", "ram"],
    check: ({ motherboard, ram }) =>
      ram!.modules > motherboard!.memorySlots
        ? `La carte mère ne dispose que de ${motherboard!.memorySlots} emplacements pour ${ram!.modules} barrettes.`
        : null,
  },
  {
    needs: ["cpu", "ram"],
    check: ({ cpu, ram }) => (!cpu!.memory.includes(ram!.type) ? `Le processeur n'est pas compatible avec la ${ram!.type}.` : null),
  },
  {
    needs: ["cpu", "cooler"],
    check: ({ cpu, cooler }) =>
      cooler!.capacity < cpu!.power
        ? `Ce refroidissement (environ ${cooler!.capacity} W) est insuffisant pour un processeur pouvant atteindre ${cpu!.power} W.`
        : null,
  },
  {
    needs: ["psu"],
    involves: ["psu", "cpu", "gpu"],
    check: ({ psu, cpu, gpu }) => {
      const { required } = psuRequirement(cpu?.power, gpu?.power);
      return psu!.wattage < required ? `L'alimentation (${psu!.wattage} W) est sous-dimensionnée : prévoyez au moins ${required} W.` : null;
    },
  },
  {
    needs: ["motherboard", "case"],
    check: ({ motherboard, case: pcCase }) =>
      motherboard!.formFactor && FORMAT_SIZE[motherboard!.formFactor] > FORMAT_SIZE[pcCase!.format]
        ? `Une carte mère ${motherboard!.formFactor} ne peut pas être installée dans un boîtier ${pcCase!.format}.`
        : null,
  },
];

function resolve(build: Build): Parts {
  const product = <T>(c: CategoryId) => {
    const id = build[c]?.productId;
    return id ? (getProduct(c, id) as T | undefined) : undefined;
  };
  const criteria = (c: CategoryId) => build[c]?.criteria;
  const board = criteria("motherboard");
  const memory = criteria("ram");
  const cooler = criteria("cooler");
  const psu = criteria("psu");
  const pcCase = criteria("case");

  return {
    cpu: product<Cpu>("cpu"),
    gpu: product<Gpu>("gpu"),
    motherboard: board && {
      socket: board.socket as Socket,
      memory: board.memory as MemoryType,
      memorySlots: board.formFactor === "Mini-ITX" ? 2 : 4,
      formFactor: board.formFactor,
    },
    ram: memory && { type: memory.type as MemoryType, modules: Number(memory.modules) },
    cooler: cooler && { capacity: coolerCapacity(cooler.type) },
    psu: psu && { wattage: Number(psu.wattage) },
    case: pcCase && { format: pcCase.format },
  };
}

function run(parts: Parts, only?: CategoryId) {
  const problems: string[] = [];
  for (const rule of rules) {
    if (only && !(rule.involves ?? rule.needs).includes(only as Key)) continue;
    if (!rule.needs.every((c) => parts[c])) continue;
    const problem = rule.check(parts);
    if (problem) problems.push(problem);
  }
  return problems;
}

export function buildProblems(build: Build) {
  return run(resolve(build));
}

export function candidateProblems(build: Build, category: CategoryId, part: BuildPart) {
  return run(resolve({ ...build, [category]: part }), category);
}
