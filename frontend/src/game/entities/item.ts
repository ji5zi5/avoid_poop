import type { Item, ItemType } from "../state.js";

export function createItem(id: number, x: number, type: ItemType): Item {
  return {
    id,
    x,
    y: -14,
    size: 14,
    speed: 90,
    type,
  };
}
