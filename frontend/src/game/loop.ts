export function createLoop(step: (deltaSeconds: number) => void) {
  let frame = 0;
  let lastTime = 0;

  function tick(time: number) {
    if (!lastTime) {
      lastTime = time;
    }

    const deltaSeconds = Math.min((time - lastTime) / 1000, 0.032);
    lastTime = time;
    step(deltaSeconds);
    frame = requestAnimationFrame(tick);
  }

  return {
    start() {
      frame = requestAnimationFrame(tick);
    },
    stop() {
      cancelAnimationFrame(frame);
    },
  };
}
