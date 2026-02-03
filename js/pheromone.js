import { CONFIG } from './config.js';

const DB_NAME = 'AntColonyDB';
const DB_VERSION = 1;
const STORE_GRID = 'pheromone_grid';
const STORE_URL = 'pheromone_urls';

/**
 * Manages pheromone data using IndexedDB.
 *
 * Two object stores:
 *  - pheromone_grid: spatial pheromone intensities keyed by "col_row"
 *  - pheromone_urls: URL attractiveness scores keyed by URL string
 */
export class PheromoneMap {
  constructor() {
    this.db = null;
    // In-memory grid cache for fast reads during rendering
    this.gridCache = new Map();
    this.urlCache = new Map();
    this.cols = Math.ceil(CONFIG.CANVAS_WIDTH / CONFIG.PHEROMONE_GRID_CELL_SIZE);
    this.rows = Math.ceil(CONFIG.CANVAS_HEIGHT / CONFIG.PHEROMONE_GRID_CELL_SIZE);
  }

  /**
   * Open (or create) the IndexedDB database.
   * Must be called before any other method.
   */
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_GRID)) {
          db.createObjectStore(STORE_GRID, { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains(STORE_URL)) {
          db.createObjectStore(STORE_URL, { keyPath: 'url' });
        }
      };

      request.onsuccess = (e) => {
        this.db = e.target.result;
        resolve();
      };

      request.onerror = (e) => reject(e.target.error);
    });
  }

  // ─── Spatial Grid ────────────────────────────────────────────

  _gridKey(x, y) {
    const col = Math.floor(x / CONFIG.PHEROMONE_GRID_CELL_SIZE);
    const row = Math.floor(y / CONFIG.PHEROMONE_GRID_CELL_SIZE);
    return `${col}_${row}`;
  }

  /**
   * Deposit pheromone at a world-space position.
   */
  deposit(x, y, amount = CONFIG.PHEROMONE_DEPOSIT_AMOUNT) {
    const key = this._gridKey(x, y);
    const current = this.gridCache.get(key) || 0;
    const updated = Math.min(current + amount, CONFIG.PHEROMONE_MAX);
    this.gridCache.set(key, updated);
  }

  /**
   * Read pheromone intensity at a world-space position.
   */
  read(x, y) {
    return this.gridCache.get(this._gridKey(x, y)) || 0;
  }

  /**
   * Apply global evaporation to the grid cache.
   */
  evaporate() {
    const rho = CONFIG.PHEROMONE_EVAPORATION_RATE;
    for (const [key, val] of this.gridCache) {
      const updated = val * (1 - rho);
      if (updated < 0.01) {
        this.gridCache.delete(key);
      } else {
        this.gridCache.set(key, updated);
      }
    }
  }

  /**
   * Find the direction with the strongest pheromone near (x, y).
   * Samples a few neighbouring cells and returns the angle towards the best one.
   * Returns null if no pheromone is detected.
   */
  sniff(x, y, radius = CONFIG.ANT_SIGHT_RADIUS) {
    const cellSize = CONFIG.PHEROMONE_GRID_CELL_SIZE;
    const steps = Math.ceil(radius / cellSize);
    let bestVal = 0;
    let bestX = x;
    let bestY = y;

    for (let dx = -steps; dx <= steps; dx++) {
      for (let dy = -steps; dy <= steps; dy++) {
        const sx = x + dx * cellSize;
        const sy = y + dy * cellSize;
        const val = this.read(sx, sy);
        if (val > bestVal) {
          bestVal = val;
          bestX = sx;
          bestY = sy;
        }
      }
    }

    if (bestVal <= 0) return null;
    return Math.atan2(bestY - y, bestX - x);
  }

  // ─── URL Scores ──────────────────────────────────────────────

  /**
   * Record a pheromone score for a URL (food source attractiveness).
   */
  async depositUrl(url, delta) {
    const current = this.urlCache.get(url) || 0;
    const updated = Math.min(current + delta, CONFIG.PHEROMONE_MAX);
    this.urlCache.set(url, updated);

    if (!this.db) return;
    const tx = this.db.transaction(STORE_URL, 'readwrite');
    tx.objectStore(STORE_URL).put({ url, score: updated, ts: Date.now() });
  }

  /**
   * Get the attractiveness score for a URL.
   */
  getUrlScore(url) {
    return this.urlCache.get(url) || 0;
  }

  /**
   * Evaporate URL scores.
   */
  evaporateUrls() {
    const rho = CONFIG.PHEROMONE_EVAPORATION_RATE;
    for (const [url, score] of this.urlCache) {
      const updated = score * (1 - rho);
      if (updated < 0.01) {
        this.urlCache.delete(url);
      } else {
        this.urlCache.set(url, updated);
      }
    }
  }

  // ─── Persistence ─────────────────────────────────────────────

  /**
   * Flush the in-memory grid cache to IndexedDB (called periodically).
   */
  async flush() {
    if (!this.db) return;
    const tx = this.db.transaction(STORE_GRID, 'readwrite');
    const store = tx.objectStore(STORE_GRID);
    for (const [key, value] of this.gridCache) {
      store.put({ key, value, ts: Date.now() });
    }
    return new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Load grid cache from IndexedDB (called on startup).
   */
  async load() {
    if (!this.db) return;
    const tx = this.db.transaction([STORE_GRID, STORE_URL], 'readonly');

    const gridStore = tx.objectStore(STORE_GRID);
    const urlStore = tx.objectStore(STORE_URL);

    return new Promise((resolve, reject) => {
      const gridReq = gridStore.getAll();
      const urlReq = urlStore.getAll();

      tx.oncomplete = () => {
        for (const entry of gridReq.result || []) {
          this.gridCache.set(entry.key, entry.value);
        }
        for (const entry of urlReq.result || []) {
          this.urlCache.set(entry.url, entry.score);
        }
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  }
}
