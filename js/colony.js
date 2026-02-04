import { CONFIG } from './config.js';
import { Ant } from './ant.js';
import { PheromoneRegistry } from './pheromone.js';
import { CookieManager } from './cookie-manager.js';
import { NetworkTopology } from './environment.js';

/**
 * Colony orchestrator for the stigmergic network topology simulation.
 *
 * Ants are asynchronous state machines that traverse URL-space via fetch().
 * There is no spatial grid or canvas — the network IS the habitat.
 *
 * Tick sequence:
 *   1. Advance all ants (energy decay, cooldowns)
 *   2. Dispatch idle ants to forage (select URL, initiate fetch)
 *   3. Deliver food from returning ants to the nest (cookies)
 *   4. Prune decayed pheromones
 *   5. Attempt reproduction if food threshold met
 *   6. Remove dead ants
 *   7. Persist state periodically
 */
export class Colony {
  constructor() {
    this.ants = [];
    this.pheromones = new PheromoneRegistry();
    this.cookies = new CookieManager();
    this.topology = new NetworkTopology();
    this.tickCount = 0;
    this.activeFetches = 0;
    this.stats = {
      totalFood: 0,
      totalDeaths: 0,
      totalBirths: 0,
    };
    /** @type {Array<{url: string, rtt: number, success: boolean, timestamp: number, antId: string, status: number}>} */
    this.activityLog = [];
  }

  /**
   * Initialise: open IndexedDB, load pheromones, restore ants from LocalStorage.
   */
  async init() {
    await this.pheromones.init();
    await this.pheromones.load();
    this._loadAnts();

    if (this.ants.length === 0) {
      for (let i = 0; i < CONFIG.INITIAL_COLONY_SIZE; i++) {
        this._spawnAnt();
      }
      this.stats.totalBirths = CONFIG.INITIAL_COLONY_SIZE;
    }
  }

  // ─── Persistence (LocalStorage) ─────────────────────────────

  _loadAnts() {
    try {
      const raw = localStorage.getItem(CONFIG.LS_KEY_ANTS);
      if (raw) {
        this.ants = JSON.parse(raw).map((s) => new Ant(s));
      }
      const statsRaw = localStorage.getItem(CONFIG.LS_KEY_STATS);
      if (statsRaw) {
        Object.assign(this.stats, JSON.parse(statsRaw));
      }
    } catch {
      this.ants = [];
    }
  }

  _saveAnts() {
    try {
      localStorage.setItem(
        CONFIG.LS_KEY_ANTS,
        JSON.stringify(this.ants.map((a) => a.serialise()))
      );
      localStorage.setItem(CONFIG.LS_KEY_STATS, JSON.stringify(this.stats));
    } catch {
      // Storage full — the colony has outgrown its habitat
    }
  }

  // ─── Spawning / Death ────────────────────────────────────────

  _spawnAnt(role = 'worker') {
    if (this.ants.length >= CONFIG.MAX_COLONY_SIZE) return;
    const ant = new Ant({
      role: Math.random() < 0.2 ? 'scout' : role,
    });
    this.ants.push(ant);
    this.stats.totalBirths++;
    return ant;
  }

  _removeDeadAnts() {
    const before = this.ants.length;
    this.ants = this.ants.filter((a) => a.state !== 'dead');
    this.stats.totalDeaths += before - this.ants.length;
  }

  _tryReproduce() {
    if (this.cookies.count() >= CONFIG.REPRODUCTION_FOOD_THRESHOLD) {
      this.cookies.consume();
      this._spawnAnt();
    }
  }

  // ─── URL Selection (Stigmergic Decision Making) ──────────────

  /**
   * Select a target URL for an ant based on pheromone-weighted probability.
   *
   * Scouts prefer unexplored or low-pheromone URLs (novelty-seeking).
   * Workers prefer high-pheromone URLs (exploitation of proven trails).
   * Both avoid repellent-marked URLs (danger warnings from the colony).
   */
  _selectTarget(ant) {
    const foodNodes = this.topology.getFoodNodes();
    if (foodNodes.length === 0) return null;

    const weights = foodNodes.map((node) => {
      const intensity = this.pheromones.getEffectiveIntensity(node.url);

      if (ant.role === 'scout') {
        // Scouts are attracted to novelty — low/unknown pheromone
        const novelty = Math.max(0.1, 1 - Math.abs(intensity));
        return intensity < -0.5 ? 0.01 : novelty;
      } else {
        // Workers follow strong pheromone trails (collective preference)
        const attractiveness = Math.max(0.1, intensity + 1);
        return intensity < -0.5 ? 0.05 : attractiveness;
      }
    });

    // Weighted random selection (roulette wheel)
    const totalWeight = weights.reduce((s, w) => s + w, 0);
    let r = Math.random() * totalWeight;
    for (let i = 0; i < foodNodes.length; i++) {
      r -= weights[i];
      if (r <= 0) return foodNodes[i];
    }
    return foodNodes[foodNodes.length - 1];
  }

  // ─── Core Simulation Tick ────────────────────────────────────

  async tick() {
    this.tickCount++;

    // 1. Advance all ants (energy decay, cooldowns)
    for (const ant of this.ants) {
      ant.tick();
    }

    // 2. Dispatch idle ants to forage (network movement via fetch)
    const idleAnts = this.ants.filter((a) => a.canForage());
    const slotsAvailable = CONFIG.MAX_CONCURRENT_FETCHES - this.activeFetches;
    const toDispatch = idleAnts.slice(0, Math.max(0, slotsAvailable));

    const fetchPromises = toDispatch.map((ant) => this._dispatchAnt(ant));

    // 3. Process returning ants — deliver food at nest
    for (const ant of this.ants) {
      if (ant.state === 'returning' && ant.carrying) {
        this._deliverFood(ant);
      }
    }

    // 4. Prune decayed pheromones (evaporation)
    this.pheromones.prune();

    // 5. Reproduction check
    this._tryReproduce();

    // 6. Remove dead ants
    this._removeDeadAnts();

    // 7. Persist periodically
    if (this.tickCount % 10 === 0) {
      this._saveAnts();
    }
    if (this.tickCount % 30 === 0) {
      this.pheromones.flush();
    }

    // 8. Trim activity log
    if (this.activityLog.length > 200) {
      this.activityLog = this.activityLog.slice(-100);
    }

    // Wait for in-flight fetches to complete
    await Promise.allSettled(fetchPromises);
  }

  // ─── Ant Dispatch (Network Movement) ─────────────────────────

  /**
   * Send an ant on a forage mission.
   * The fetch() call is the ant's physical movement through the network.
   */
  async _dispatchAnt(ant) {
    const target = this._selectTarget(ant);
    if (!target) return;

    ant.state = 'fetching';
    ant.currentUrl = target.url;
    ant.forageCooldown = CONFIG.FORAGE_COOLDOWN_TICKS;
    this.activeFetches++;

    try {
      const result = await this.topology.forage(target);

      this.activityLog.push({
        url: target.url,
        rtt: result.rtt,
        success: result.success,
        timestamp: Date.now(),
        antId: ant.id,
        status: result.status,
      });

      if (result.success) {
        // Successful forage — deposit pheromone, carry food home
        ant.carrying = {
          title: result.title,
          nutrition: result.nutrition,
          foodType: result.foodType,
          payload: result.payload,
        };
        ant.state = 'returning';
        ant.applyLatencyPenalty(result.rtt);
        ant.visitedUrls.push(target.url);
        this.pheromones.deposit(target.url, result.rtt);
      } else {
        // Failed forage — encounter ecological danger
        this._handleDanger(ant, target, result);
      }
    } catch {
      ant.state = 'idle';
    } finally {
      this.activeFetches--;
    }
  }

  /**
   * Deliver food at the nest.
   * Sugar → stored as cookies (quick energy).
   * Protein → enables brood generation (new ant instances via reproduction).
   */
  _deliverFood(ant) {
    if (ant.carrying) {
      const label = Date.now().toString(36);
      this.cookies.store(label, ant.carrying.title);
      ant.energy = Math.min(
        ant.energy + CONFIG.ANT_ENERGY_GAIN_ON_FOOD,
        CONFIG.ANT_MAX_ENERGY
      );
      this.stats.totalFood++;
    }
    ant.carrying = null;
    ant.currentUrl = null;
    ant.state = 'idle';
  }

  /**
   * Handle ecological dangers in REST-space.
   *
   * Predator (429): Ant-Lion — immediate energy drain, possible termination
   * Storm (5xx):    Habitat collapse — repellent pheromone warns colony
   * Timeout:        Swamp — energy drain from prolonged RTT
   * Camouflage:     Redirect loops — wasted energy, no yield
   */
  _handleDanger(ant, source, result) {
    switch (result.danger) {
      case 'predator':
        ant.energy -= source.damage || 50;
        break;
      case 'storm':
        ant.energy -= source.damage || 30;
        this.pheromones.depositRepellent(source.url);
        break;
      case 'timeout':
        ant.applyLatencyPenalty(result.rtt);
        break;
      case 'camouflage':
        ant.energy -= 15;
        break;
    }

    if (ant.energy <= 0) {
      ant.state = 'dead';
    } else {
      ant.currentUrl = null;
      ant.state = 'idle';
    }
  }

  // ─── Public Getters ──────────────────────────────────────────

  get aliveCount() {
    return this.ants.filter((a) => a.state !== 'dead').length;
  }

  get foodCount() {
    return this.cookies.count();
  }

  get fetchingCount() {
    return this.ants.filter((a) => a.state === 'fetching').length;
  }

  /**
   * Reset the entire colony for a fresh start.
   */
  reset() {
    this.ants = [];
    this.cookies.clear();
    this.activityLog = [];
    localStorage.removeItem(CONFIG.LS_KEY_ANTS);
    localStorage.removeItem(CONFIG.LS_KEY_STATS);
    this.stats = { totalFood: 0, totalDeaths: 0, totalBirths: 0 };
  }
}
