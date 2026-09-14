// MVP-ресурсы (раздел 9 брифа). Не добавлять новые без явной геймплейной причины.
export type ResourceKind = "food" | "water" | "energy" | "scrap";

export type Resources = Record<ResourceKind, number>;

export const RESOURCE_KEYS: ResourceKind[] = ["food", "water", "energy", "scrap"];

export function createInitialResources(): Resources {
  return {
    food: 20,
    water: 20,
    energy: 10,
    scrap: 15,
  };
}

export function clampResources(resources: Resources): Resources {
  const clamped = { ...resources };
  for (const key of RESOURCE_KEYS) {
    clamped[key] = Math.max(0, Math.round(clamped[key]));
  }
  return clamped;
}
