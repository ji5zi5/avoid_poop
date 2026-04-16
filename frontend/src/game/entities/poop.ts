import type { Hazard, HazardBehavior, HazardOwner, HazardVariant } from "../state.js";

type CreateHazardOptions = {
  awardOnExit?: boolean;
  behavior?: HazardBehavior;
  bouncesRemaining?: number;
  gravity?: number;
  height?: number;
  owner?: HazardOwner;
  pendingRemoval?: boolean;
  splitAtY?: number;
  splitChildCount?: number;
  splitChildSize?: number;
  splitChildSpeed?: number;
  splitChildSpread?: number;
  triggered?: boolean;
  variant?: HazardVariant;
  velocityX?: number;
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
    behavior: options.behavior,
    velocityX: options.velocityX,
    gravity: options.gravity,
    splitAtY: options.splitAtY,
    splitChildCount: options.splitChildCount,
    splitChildSize: options.splitChildSize,
    splitChildSpeed: options.splitChildSpeed,
    splitChildSpread: options.splitChildSpread,
    bouncesRemaining: options.bouncesRemaining,
    triggered: options.triggered,
    awardOnExit: options.awardOnExit,
    pendingRemoval: options.pendingRemoval,
  };
}
