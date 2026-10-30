export const COOLERS = [
  { value: "tour", label: "Ventirad simple tour", capacity: 150 },
  { value: "double", label: "Ventirad double tour", capacity: 220 },
  { value: "aio240", label: "Watercooling AIO 240 mm", capacity: 220 },
  { value: "aio280", label: "Watercooling AIO 280 mm", capacity: 250 },
  { value: "aio360", label: "Watercooling AIO 360 mm", capacity: 300 },
];

export const PSU_WATTAGES = [550, 650, 750, 850, 1000, 1200, 1600];

const BASE_POWER = 100;
const MARGIN = 1.3;
const DEFAULT_CPU_POWER = 150;

export function coolerCapacity(type: string) {
  return COOLERS.find((c) => c.value === type)?.capacity ?? 0;
}

export function psuRequirement(cpuPower?: number, gpuPower?: number) {
  const estimate = (cpuPower ?? DEFAULT_CPU_POWER) + (gpuPower ?? 0) + BASE_POWER;
  return { estimate, required: Math.ceil(estimate * MARGIN) };
}

export function recommendedWattage(required: number) {
  return PSU_WATTAGES.find((w) => w >= required) ?? PSU_WATTAGES[PSU_WATTAGES.length - 1];
}
