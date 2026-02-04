import { CONFIG } from './config.js';

function generateId() {
  return 'ant_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

/**
 * A digital ant — an asynchronous state machine whose lifecycle
 * is defined by network I/O (Fetch-Kinetik).
 *
 * There are no spatial coordinates. Instead:
 *   Position  = the URL endpoint the ant is currently addressing
 *   Movement  = the act of fetch() — the physical locomotion
 *   Distance  = RTT (round-trip time) — the terrain traversed
 *   Exhaustion = latency penalty — slow APIs drain energy like swamps
 */
export class Ant {
  constructor(state = {}) {
    this.id = state.id || generateId();
    this.energy = state.energy ?? CONFIG.ANT_INITIAL_ENERGY;
    this.role = state.role || 'worker'; // 'scout' | 'worker'
    this.state = state.state || 'idle'; // 'idle' | 'fetching' | 'returning' | 'dead'
    this.currentUrl = state.currentUrl || null; // network position
    this.carrying = state.carrying || null; // food data packet or null
    this.lastRTT = state.lastRTT ?? 0; // last measured round-trip time (ms)
    this.forageCooldown = state.forageCooldown ?? 0;
    this.visitedUrls = state.visitedUrls || [];
    this.ticksAlive = state.ticksAlive ?? 0;
  }

  /**
   * Serialise for LocalStorage persistence.
   * Transient fetch state is reset to 'idle' on restore.
   */
  serialise() {
    return {
      id: this.id,
      energy: this.energy,
      role: this.role,
      state: this.state === 'fetching' ? 'idle' : this.state,
      currentUrl: this.currentUrl,
      carrying: this.carrying,
      lastRTT: this.lastRTT,
      forageCooldown: this.forageCooldown,
      visitedUrls: this.visitedUrls.slice(-20),
      ticksAlive: this.ticksAlive,
    };
  }

  /**
   * Advance by one simulation tick.
   * Energy decay and cooldown management only — no spatial movement.
   * Actual locomotion (fetch) is orchestrated by the Colony.
   */
  tick() {
    if (this.state === 'dead') return;

    this.ticksAlive++;
    this.energy -= CONFIG.ANT_ENERGY_DECAY_PER_TICK;
    if (this.forageCooldown > 0) this.forageCooldown--;

    if (this.energy <= 0) {
      this.state = 'dead';
    }
  }

  /**
   * Apply latency penalty — high RTT drains energy.
   * A slow API (2000ms) is like traversing a swamp.
   */
  applyLatencyPenalty(rttMs) {
    this.lastRTT = rttMs;
    const penalty = rttMs * CONFIG.ANT_LATENCY_PENALTY_FACTOR;
    this.energy -= penalty;
    if (this.energy <= 0) {
      this.state = 'dead';
    }
  }

  /**
   * Whether the ant can attempt a new forage (fetch request).
   */
  canForage() {
    return (
      this.forageCooldown <= 0 &&
      !this.carrying &&
      this.state === 'idle'
    );
  }
}
