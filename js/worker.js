/**
 * Web Worker for offloading ant decision-making from the main thread.
 *
 * Currently handles batch physics updates for the ant population.
 * Can be extended with LLM-based decision making (Section 7 of the abstract).
 *
 * Communication protocol:
 *   Main -> Worker: { type: 'tick', ants: [...serialised ant states] }
 *   Worker -> Main: { type: 'tick_result', ants: [...updated ant states] }
 */

const CONFIG = {
  ANT_SPEED: 2,
  ANT_ENERGY_DECAY_PER_TICK: 0.1,
  ANT_WANDER_JITTER: 0.3,
  CANVAS_WIDTH: 800,
  CANVAS_HEIGHT: 600,
};

function tickAnt(ant) {
  if (ant.state === 'dead') return ant;

  ant.ticksAlive++;
  ant.energy -= CONFIG.ANT_ENERGY_DECAY_PER_TICK;

  if (ant.energy <= 0) {
    ant.state = 'dead';
    return ant;
  }

  // Wander
  ant.heading += (Math.random() - 0.5) * CONFIG.ANT_WANDER_JITTER * 2;

  const dx = Math.cos(ant.heading) * CONFIG.ANT_SPEED;
  const dy = Math.sin(ant.heading) * CONFIG.ANT_SPEED;

  ant.x += dx;
  ant.y += dy;

  // Bounce
  if (ant.x < 0 || ant.x > CONFIG.CANVAS_WIDTH) {
    ant.heading = Math.PI - ant.heading;
    ant.x = Math.max(0, Math.min(CONFIG.CANVAS_WIDTH, ant.x));
  }
  if (ant.y < 0 || ant.y > CONFIG.CANVAS_HEIGHT) {
    ant.heading = -ant.heading;
    ant.y = Math.max(0, Math.min(CONFIG.CANVAS_HEIGHT, ant.y));
  }

  return ant;
}

self.onmessage = function (e) {
  const { type, ants } = e.data;

  if (type === 'tick') {
    const updated = ants.map(tickAnt);
    self.postMessage({ type: 'tick_result', ants: updated });
  }
};
