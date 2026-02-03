import { CONFIG } from './config.js';

/**
 * Generates a unique ID for an ant.
 */
function generateId() {
  return 'ant_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

/**
 * Represents a single ant agent in the colony.
 *
 * State is serialisable so it can be persisted to LocalStorage.
 */
export class Ant {
  constructor(state = {}) {
    this.id = state.id || generateId();
    this.x = state.x ?? CONFIG.NEST_X;
    this.y = state.y ?? CONFIG.NEST_Y;
    this.heading = state.heading ?? Math.random() * Math.PI * 2;
    this.energy = state.energy ?? CONFIG.ANT_INITIAL_ENERGY;
    this.carrying = state.carrying ?? null; // food data packet or null
    this.role = state.role || 'worker'; // 'scout' | 'worker'
    this.state = state.state || 'exploring'; // 'exploring' | 'returning' | 'foraging' | 'dead'
    this.forageCooldown = state.forageCooldown ?? 0;
    this.visitedUrls = state.visitedUrls || [];
    this.ticksAlive = state.ticksAlive ?? 0;
  }

  /**
   * Returns a plain object suitable for JSON serialisation / LocalStorage.
   */
  serialise() {
    return {
      id: this.id,
      x: this.x,
      y: this.y,
      heading: this.heading,
      energy: this.energy,
      carrying: this.carrying,
      role: this.role,
      state: this.state,
      forageCooldown: this.forageCooldown,
      visitedUrls: this.visitedUrls,
      ticksAlive: this.ticksAlive,
    };
  }

  /**
   * Advance the ant by one simulation tick.
   * Movement, energy decay, and cooldown are handled here.
   * Decision-making (foraging, pheromone following) is handled by Colony.
   */
  tick() {
    if (this.state === 'dead') return;

    this.ticksAlive++;
    this.energy -= CONFIG.ANT_ENERGY_DECAY_PER_TICK;
    if (this.forageCooldown > 0) this.forageCooldown--;

    if (this.energy <= 0) {
      this.state = 'dead';
      return;
    }

    this._move();
  }

  /**
   * Basic movement: advance in current heading direction with slight random wander.
   */
  _move() {
    // Wander: add small random angular change
    this.heading += (Math.random() - 0.5) * CONFIG.ANT_WANDER_JITTER * 2;

    const dx = Math.cos(this.heading) * CONFIG.ANT_SPEED;
    const dy = Math.sin(this.heading) * CONFIG.ANT_SPEED;

    this.x += dx;
    this.y += dy;

    // Bounce off walls
    if (this.x < 0 || this.x > CONFIG.CANVAS_WIDTH) {
      this.heading = Math.PI - this.heading;
      this.x = Math.max(0, Math.min(CONFIG.CANVAS_WIDTH, this.x));
    }
    if (this.y < 0 || this.y > CONFIG.CANVAS_HEIGHT) {
      this.heading = -this.heading;
      this.y = Math.max(0, Math.min(CONFIG.CANVAS_HEIGHT, this.y));
    }
  }

  /**
   * Steer the ant towards a target point.
   */
  steerTowards(tx, ty) {
    const desired = Math.atan2(ty - this.y, tx - this.x);
    // Blend current heading towards desired
    let diff = desired - this.heading;
    // Normalise to [-PI, PI]
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    this.heading += diff * 0.1;
  }

  /**
   * Distance from this ant to a point.
   */
  distanceTo(px, py) {
    return Math.hypot(this.x - px, this.y - py);
  }

  /**
   * Whether the ant is at the nest.
   */
  isAtNest() {
    return this.distanceTo(CONFIG.NEST_X, CONFIG.NEST_Y) < CONFIG.NEST_RADIUS;
  }

  /**
   * Whether the ant can attempt a forage (API call).
   */
  canForage() {
    return this.forageCooldown <= 0 && !this.carrying && this.state === 'exploring';
  }
}
