import { CONFIG } from './config.js';
import { Ant } from './ant.js';
import { PheromoneMap } from './pheromone.js';
import { CookieManager } from './cookie-manager.js';
import { Environment } from './environment.js';

/**
 * Colony orchestrates the full simulation lifecycle:
 *  - Manages the ant population (stored in LocalStorage)
 *  - Runs the simulation loop (tick)
 *  - Coordinates foraging, pheromone updates, reproduction and death
 */
export class Colony {
  constructor() {
    this.ants = [];
    this.pheromones = new PheromoneMap();
    this.cookies = new CookieManager();
    this.environment = new Environment();
    this.tickCount = 0;
    this.stats = {
      totalFood: 0,
      totalDeaths: 0,
      totalBirths: 0,
    };
    this._forageQueue = [];
  }

  /**
   * Initialise: open IndexedDB, load pheromones, restore ants from LocalStorage.
   */
  async init() {
    await this.pheromones.init();
    await this.pheromones.load();
    this._loadAnts();

    // Bootstrap colony if empty
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
        const parsed = JSON.parse(raw);
        this.ants = parsed.map((s) => new Ant(s));
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
      // Storage full — the colony has outgrown its nest
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

  // ─── Reproduction ────────────────────────────────────────────

  _tryReproduce() {
    if (this.cookies.count() >= CONFIG.REPRODUCTION_FOOD_THRESHOLD) {
      // Consume food to create a new ant
      this.cookies.consume();
      this._spawnAnt();
    }
  }

  // ─── Core Simulation Tick ────────────────────────────────────

  async tick() {
    this.tickCount++;

    for (const ant of this.ants) {
      // 1. Advance physics / energy
      ant.tick();

      if (ant.state === 'dead') continue;

      // 2. Deposit pheromone trail
      this.pheromones.deposit(ant.x, ant.y, CONFIG.PHEROMONE_DEPOSIT_AMOUNT * 0.2);

      // 3. Behaviour based on state
      if (ant.state === 'returning' && ant.isAtNest()) {
        this._deliverFood(ant);
      } else if (ant.state === 'returning') {
        // Head home
        ant.steerTowards(CONFIG.NEST_X, CONFIG.NEST_Y);
      } else if (ant.state === 'exploring') {
        this._explore(ant);
      }
    }

    // 4. Evaporate pheromones
    this.pheromones.evaporate();
    this.pheromones.evaporateUrls();

    // 5. Reproduction check
    this._tryReproduce();

    // 6. Remove dead ants
    this._removeDeadAnts();

    // 7. Persist periodically
    if (this.tickCount % 20 === 0) {
      this._saveAnts();
    }
    if (this.tickCount % 100 === 0) {
      this.pheromones.flush();
    }

    // 8. Process one pending forage
    await this._processForageQueue();
  }

  // ─── Ant Behaviours ──────────────────────────────────────────

  _explore(ant) {
    // Follow pheromones if detected
    const pDir = this.pheromones.sniff(ant.x, ant.y);
    if (pDir !== null && Math.random() < 0.6) {
      const px = ant.x + Math.cos(pDir) * CONFIG.ANT_SIGHT_RADIUS;
      const py = ant.y + Math.sin(pDir) * CONFIG.ANT_SIGHT_RADIUS;
      ant.steerTowards(px, py);
    }

    // Check if ant reached a source
    const source = this.environment.sourceAt(ant.x, ant.y);
    if (source && ant.canForage()) {
      if (source.kind === 'food') {
        this._enqueueForage(ant, source);
      } else if (source.kind === 'danger') {
        this._handleDanger(ant, source);
      }
    }
  }

  _enqueueForage(ant, source) {
    ant.state = 'foraging';
    ant.forageCooldown = CONFIG.FORAGE_COOLDOWN_TICKS;
    this._forageQueue.push({ ant, source });
  }

  async _processForageQueue() {
    if (this._forageQueue.length === 0) return;
    const { ant, source } = this._forageQueue.shift();

    const result = await this.environment.forage(source);

    if (result.success) {
      ant.carrying = { title: result.title, nutrition: result.nutrition };
      ant.state = 'returning';
      ant.visitedUrls.push(source.url);
      // Strong pheromone at food site
      this.pheromones.deposit(ant.x, ant.y, CONFIG.PHEROMONE_DEPOSIT_AMOUNT * 3);
      await this.pheromones.depositUrl(source.url, result.nutrition);
    } else {
      // The request failed — treat as danger
      this._handleDanger(ant, {
        damage: result.status === 429 ? 50 : 20,
        type: result.danger,
      });
      ant.state = 'exploring';
    }
  }

  _deliverFood(ant) {
    if (ant.carrying) {
      const label = Date.now().toString(36);
      this.cookies.store(label, ant.carrying.title);
      ant.energy = Math.min(ant.energy + CONFIG.ANT_ENERGY_GAIN_ON_FOOD, CONFIG.ANT_MAX_ENERGY);
      this.stats.totalFood++;
      // Strong pheromone at nest
      this.pheromones.deposit(ant.x, ant.y, CONFIG.PHEROMONE_DEPOSIT_AMOUNT * 2);
    }
    ant.carrying = null;
    ant.state = 'exploring';
  }

  _handleDanger(ant, source) {
    ant.energy -= source.damage || 30;
    if (ant.energy <= 0) {
      ant.state = 'dead';
    } else {
      // Flee: reverse heading
      ant.heading += Math.PI + (Math.random() - 0.5) * 0.5;
      ant.state = 'exploring';
    }
  }

  // ─── Public Getters ──────────────────────────────────────────

  get aliveCount() {
    return this.ants.filter((a) => a.state !== 'dead').length;
  }

  get foodCount() {
    return this.cookies.count();
  }

  /**
   * Reset the entire colony (for debugging / fresh start).
   */
  reset() {
    this.ants = [];
    this.cookies.clear();
    localStorage.removeItem(CONFIG.LS_KEY_ANTS);
    localStorage.removeItem(CONFIG.LS_KEY_STATS);
    this.stats = { totalFood: 0, totalDeaths: 0, totalBirths: 0 };
  }
}
