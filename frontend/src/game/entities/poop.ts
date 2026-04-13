import type { Hazard, HazardOwner, HazardVariant } from "../state";

type CreateHazardOptions = {
  height?: number;
  owner?: HazardOwner;
  variant?: HazardVariant;
  width?: number;
};

function inferVariant(width: number, height: number, size: number): HazardVariant {
  if (width >= 120 || height >= 60) {
    return "giant";
  }
  if (size >= 28) {
    return "boss";
  }
  if (size >= 24) {
    return "large";
  }
  if (size >= 20) {
    return "medium";
  }
  return "small";
}

export function createHazard(id: number, x: number, speed: number, size = 18, options: CreateHazardOptions = {}): Hazard {
  const width = options.width ?? size;
  const height = options.height ?? size;
  return {
    id,
    x,
    y: -height,
    size,
    width,
    height,
    speed,
    owner: options.owner ?? "wave",
    variant: options.variant ?? inferVariant(width, height, size),
  };
}
