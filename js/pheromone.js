import { CONFIG } from './config.js';

const DB_NAME = 'AntColonyDB';
const DB_VERSION = 2;
const STORE_PHEROMONES = 'pheromone_nodes';

/**
 * Stigmergy 2.0: Temporal pheromone data points on network nodes.
 *
 * Instead of chemical trails on pixels, agents mark URL nodes in a
 * central registry (IndexedDB). Each successful food acquisition
 * (200 OK) deposits a pheromone data point:
 *
 *   { url, intensity, lastSeen, avgRTT, visits }
 *
 * Pheromone intensity decays over time using:
 *   effectiveIntensity = intensity * e^(-λ · Δt)
 *
 * where λ is the decay rate. URLs not visited for a long time lose
 * their attractiveness in the collective selection logic.
 *
 * Negative intensity (repellent) marks dangerous URLs (5xx, 429)
 * to warn the colony away.
 */
export class PheromoneRegistry {
  constructor() {
    this.db = null;
    /** @type {Map<string, {url: string, intensity: number, lastSeen: number, avgRTT: number, visits: number}>} */
    this.registry = new Map();
  }

  /**
   * Open (or upgrade) the IndexedDB database.
   */
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        // Remove legacy stores from the canvas-based version
        for (const name of db.objectStoreNames) {
          db.deleteObjectStore(name);
        }
        db.createObjectStore(STORE_PHEROMONES, { keyPath: 'url' });
      };

      request.onsuccess = (e) => {
        this.db = e.target.result;
        resolve();
      };

      request.onerror = (e) => reject(e.target.error);
    });
  }

  /**
   * Deposit a pheromone data point for a successfully visited URL.
   * Each 200 OK response reinforces the trail.
   *
   * @param {string} url - The base URL of the food source.
   * @param {number} rttMs - The round-trip time of the fetch (distance metric).
   */
  deposit(url, rttMs) {
    const existing = this.registry.get(url);
    if (existing) {
      existing.intensity = Math.min(
        existing.intensity + CONFIG.PHEROMONE_INITIAL_INTENSITY,
        CONFIG.PHEROMONE_MAX_INTENSITY
      );
      existing.lastSeen = Date.now();
      existing.avgRTT =
        (existing.avgRTT * existing.visits + rttMs) / (existing.visits + 1);
      existing.visits++;
    } else {
      this.registry.set(url, {
        url,
        intensity: CONFIG.PHEROMONE_INITIAL_INTENSITY,
        lastSeen: Date.now(),
        avgRTT: rttMs,
        visits: 1,
      });
    }
  }

  /**
   * Mark a URL with a repellent signal (negative pheromone).
   * Used when the colony encounters predators (429), storms (5xx),
   * or other dangers. Warns other ants away.
   */
  depositRepellent(url) {
    const existing = this.registry.get(url);
    if (existing) {
      existing.intensity = Math.max(
        existing.intensity + CONFIG.PHEROMONE_REPELLENT_INTENSITY,
        -CONFIG.PHEROMONE_MAX_INTENSITY
      );
      existing.lastSeen = Date.now();
    } else {
      this.registry.set(url, {
        url,
        intensity: CONFIG.PHEROMONE_REPELLENT_INTENSITY,
        lastSeen: Date.now(),
        avgRTT: Infinity,
        visits: 0,
      });
    }
  }

  /**
   * Get the effective (time-decayed) pheromone intensity for a URL.
   *
   * Uses the temporal decay function:
   *   effectiveIntensity = intensity * e^(-λ · Δt)
   *
   * @param {string} url
   * @returns {number} The decayed intensity (positive = attractive, negative = repellent).
   */
  getEffectiveIntensity(url) {
    const entry = this.registry.get(url);
    if (!entry) return 0;
    const dt = Date.now() - entry.lastSeen;
    return entry.intensity * Math.exp(-CONFIG.PHEROMONE_DECAY_LAMBDA * dt);
  }

  /**
   * Get the raw pheromone data point for a URL.
   */
  getEntry(url) {
    return this.registry.get(url) || null;
  }

  /**
   * Get all registry entries with their effective (decayed) intensities.
   */
  getAllEffective() {
    const now = Date.now();
    const results = [];
    for (const entry of this.registry.values()) {
      const dt = now - entry.lastSeen;
      const effective =
        entry.intensity * Math.exp(-CONFIG.PHEROMONE_DECAY_LAMBDA * dt);
      results.push({ ...entry, effectiveIntensity: effective });
    }
    return results;
  }

  /**
   * Prune entries whose effective intensity has decayed below threshold.
   * This is the evaporation mechanic — forgotten information fades away.
   */
  prune(threshold = 0.01) {
    const now = Date.now();
    for (const [url, entry] of this.registry) {
      const dt = now - entry.lastSeen;
      const effective = Math.abs(
        entry.intensity * Math.exp(-CONFIG.PHEROMONE_DECAY_LAMBDA * dt)
      );
      if (effective < threshold) {
        this.registry.delete(url);
      }
    }
  }

  /**
   * Persist registry to IndexedDB.
   */
  async flush() {
    if (!this.db) return;
    const tx = this.db.transaction(STORE_PHEROMONES, 'readwrite');
    const store = tx.objectStore(STORE_PHEROMONES);
    for (const entry of this.registry.values()) {
      store.put(entry);
    }
    return new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Load registry from IndexedDB (called on startup).
   */
  async load() {
    if (!this.db) return;
    const tx = this.db.transaction(STORE_PHEROMONES, 'readonly');
    const store = tx.objectStore(STORE_PHEROMONES);
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      tx.oncomplete = () => {
        for (const entry of req.result || []) {
          this.registry.set(entry.url, entry);
        }
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  }
}
