import { CONFIG } from './config.js';

/**
 * Represents the "outside world" — the landscape of public APIs
 * that serve as food sources and dangers for the colony.
 *
 * Each source is placed at a virtual position on the canvas,
 * so ants can physically navigate toward them.
 */
export class Environment {
  constructor() {
    this.sources = [];
    this._init();
  }

  _init() {
    // Place food sources around the canvas edges (away from the nest)
    const foods = CONFIG.FOOD_SOURCES.map((src, i) => {
      const angle = (i / CONFIG.FOOD_SOURCES.length) * Math.PI * 2;
      const radius = Math.min(CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT) * 0.4;
      return {
        ...src,
        kind: 'food',
        x: CONFIG.CANVAS_WIDTH / 2 + Math.cos(angle) * radius,
        y: CONFIG.CANVAS_HEIGHT / 2 + Math.sin(angle) * radius,
        radius: 20,
      };
    });

    // Place danger sources in semi-random positions
    const dangers = CONFIG.DANGER_SOURCES.map((src, i) => {
      const angle = ((i + 0.5) / CONFIG.DANGER_SOURCES.length) * Math.PI * 2;
      const radius = Math.min(CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT) * 0.3;
      return {
        ...src,
        kind: 'danger',
        x: CONFIG.CANVAS_WIDTH / 2 + Math.cos(angle) * radius,
        y: CONFIG.CANVAS_HEIGHT / 2 + Math.sin(angle) * radius,
        radius: 15,
      };
    });

    this.sources = [...foods, ...dangers];
  }

  /**
   * Find the nearest source to a given point.
   * @param {number} x
   * @param {number} y
   * @param {'food'|'danger'|null} kindFilter - Optional filter by kind.
   * @returns {{source: object, distance: number}|null}
   */
  nearest(x, y, kindFilter = null) {
    let best = null;
    let bestDist = Infinity;
    for (const src of this.sources) {
      if (kindFilter && src.kind !== kindFilter) continue;
      const d = Math.hypot(src.x - x, src.y - y);
      if (d < bestDist) {
        bestDist = d;
        best = src;
      }
    }
    return best ? { source: best, distance: bestDist } : null;
  }

  /**
   * Check if a point is within any source's radius.
   * @returns {object|null} The source the point is inside, or null.
   */
  sourceAt(x, y) {
    for (const src of this.sources) {
      if (Math.hypot(src.x - x, src.y - y) < src.radius) {
        return src;
      }
    }
    return null;
  }

  /**
   * Attempt to forage from a food source.
   * Makes an actual fetch() call to the source's URL.
   * Returns the food payload on success, or an error descriptor on failure.
   */
  async forage(source) {
    const randomId = Math.floor(Math.random() * 20) + 1;
    const url = source.url.endsWith('/')
      ? source.url + randomId
      : source.url;

    const startTime = performance.now();

    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
      const latency = performance.now() - startTime;

      if (!response.ok) {
        return {
          success: false,
          status: response.status,
          latency,
          danger: response.status === 429 ? 'predator' : 'storm',
        };
      }

      const data = await response.json();
      const keys = Object.keys(data);
      const nutrition = keys.length * source.nutritionMultiplier;
      const title = data.title || data.name || data.id || JSON.stringify(data).slice(0, 60);

      return {
        success: true,
        status: response.status,
        latency,
        nutrition,
        title: String(title).slice(0, 80),
        payload: JSON.stringify(data).slice(0, 500),
      };
    } catch (err) {
      return {
        success: false,
        status: 0,
        latency: performance.now() - startTime,
        danger: 'timeout',
        message: err.message,
      };
    }
  }
}
