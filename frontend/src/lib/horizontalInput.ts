export type HorizontalDirection = -1 | 0 | 1;

type HorizontalKey = "left" | "right";

function toHorizontalKey(key: string): HorizontalKey | null {
  if (key === "ArrowLeft") {
    return "left";
  }
  if (key === "ArrowRight") {
    return "right";
  }
  return null;
}

export function createHorizontalInputTracker() {
  const pressed = new Set<HorizontalKey>();
  let lastPressed: HorizontalKey | null = null;

  function currentDirection(): HorizontalDirection {
    const hasLeft = pressed.has("left");
    const hasRight = pressed.has("right");

    if (hasLeft && hasRight) {
      return lastPressed === "left" ? -1 : 1;
    }
    if (hasLeft) {
      return -1;
    }
    if (hasRight) {
      return 1;
    }
    return 0;
  }

  return {
    keyDown(key: string): HorizontalDirection | null {
      const horizontalKey = toHorizontalKey(key);
      if (!horizontalKey) {
        return null;
      }
      pressed.add(horizontalKey);
      lastPressed = horizontalKey;
      return currentDirection();
    },
    keyUp(key: string): HorizontalDirection | null {
      const horizontalKey = toHorizontalKey(key);
      if (!horizontalKey) {
        return null;
      }
      pressed.delete(horizontalKey);
      if (lastPressed === horizontalKey) {
        if (pressed.has("left")) {
          lastPressed = "left";
        } else if (pressed.has("right")) {
          lastPressed = "right";
        } else {
          lastPressed = null;
        }
      }
      return currentDirection();
    },
    press(direction: HorizontalDirection) {
      if (direction === -1) {
        pressed.add("left");
        lastPressed = "left";
      } else if (direction === 1) {
        pressed.add("right");
        lastPressed = "right";
      }
      return currentDirection();
    },
    release(direction: HorizontalDirection) {
      if (direction === -1) {
        pressed.delete("left");
        if (lastPressed === "left") {
          lastPressed = pressed.has("right") ? "right" : null;
        }
      } else if (direction === 1) {
        pressed.delete("right");
        if (lastPressed === "right") {
          lastPressed = pressed.has("left") ? "left" : null;
        }
      }
      return currentDirection();
    },
    clear() {
      pressed.clear();
      lastPressed = null;
      return 0 as HorizontalDirection;
    },
  };
}
