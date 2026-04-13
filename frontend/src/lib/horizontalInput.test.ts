import { describe, expect, it } from "vitest";

import { createHorizontalInputTracker } from "./horizontalInput";

describe("horizontal input tracker", () => {
  it("restores the still-held key when the newer key is released", () => {
    const tracker = createHorizontalInputTracker();

    expect(tracker.keyDown("ArrowLeft")).toBe(-1);
    expect(tracker.keyDown("ArrowRight")).toBe(1);
    expect(tracker.keyUp("ArrowRight")).toBe(-1);
    expect(tracker.keyUp("ArrowLeft")).toBe(0);
  });

  it("lets the latest pressed key win while both are held", () => {
    const tracker = createHorizontalInputTracker();

    expect(tracker.keyDown("ArrowRight")).toBe(1);
    expect(tracker.keyDown("ArrowLeft")).toBe(-1);
    expect(tracker.keyUp("ArrowLeft")).toBe(1);
  });

  it("supports press and release for pointer controls too", () => {
    const tracker = createHorizontalInputTracker();

    expect(tracker.press(-1)).toBe(-1);
    expect(tracker.press(1)).toBe(1);
    expect(tracker.release(1)).toBe(-1);
    expect(tracker.release(-1)).toBe(0);
  });
});
