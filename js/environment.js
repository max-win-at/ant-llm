import { CONFIG } from './config.js';

/**
 * The network habitat — a graph of URL nodes and RTT edges.
 *
 * In the new paradigm, the pixel-based canvas environment is replaced
 * by the address space of the network. There are no x,y coordinates.
 *
 *   Habitat  = a graph of URLs (nodes) and latencies (edges)
 *   Movement = the act of fetch() — physical locomotion
 *   Distance = RTT (round-trip time) — the terrain traversed
 *
 * Food quality is evaluated by biological criteria:
 *   Sugar   (flat JSON)   → quick energy, stored in cookies
 *   Protein (nested JSON) → complex nutrients, enables brood generation
 */
export class NetworkTopology {
  constructor() {
    this.nodes = [];
    this._init();
  }

  _init() {
    const foods = CONFIG.FOOD_SOURCES.map((src) => ({
      ...src,
      kind: 'food',
    }));

    const dangers = CONFIG.DANGER_SOURCES.map((src) => ({
      ...src,
      kind: 'danger',
    }));

    this.nodes = [...foods, ...dangers];
  }

  /**
   * Get all food nodes in the habitat.
   */
  getFoodNodes() {
    return this.nodes.filter((n) => n.kind === 'food');
  }

  /**
   * Get all danger nodes (predators, storms, swamps).
   */
  getDangerNodes() {
    return this.nodes.filter((n) => n.kind === 'danger');
  }

  /**
   * Find a node by URL prefix match.
   */
  getNode(url) {
    return this.nodes.find((n) => url.startsWith(n.url)) || null;
  }

  /**
   * Evaluate the nutritional value of a JSON response body.
   *
   * Sugar (flat JSON): simple key count — quick energy for cookie storage.
   * Protein (nested objects): structural complexity (entropy) —
   *   deep structures allow the colony to generate new brood (agent instances).
   */
  evaluateNutrition(data, source) {
    if (Array.isArray(data)) {
      const sample = data[0] || {};
      return this._scoreObject(sample) * source.nutritionMultiplier;
    }
    return this._scoreObject(data) * source.nutritionMultiplier;
  }

  /**
   * Score an object by its structural complexity.
   * Flat = sugar (quick), deeply nested = protein (complex).
   */
  _scoreObject(obj, depth = 0) {
    if (typeof obj !== 'object' || obj === null) return 1;
    let score = Object.keys(obj).length;
    for (const val of Object.values(obj)) {
      if (typeof val === 'object' && val !== null && depth < 3) {
        score += this._scoreObject(val, depth + 1) * 0.5;
      }
    }
    return score;
  }

  /**
   * Execute a forage operation — the physical act of ant movement.
   *
   * The fetch() call IS the locomotion. The RTT IS the distance traveled.
   * The response body IS the food to be metabolised.
   *
   * Ecological dangers in REST-space:
   *   HTTP 429 — Apex-Predator (Ant-Lion): rate limiting terminates the ant
   *   HTTP 5xx — Storm: habitat collapse, repellent pheromone deposited
   *   Timeout  — Swamp: energy drain from prolonged waiting
   *   Redirect — Camouflage: wasted energy, no food yield
   */
  async forage(source) {
    const randomId = Math.floor(Math.random() * 20) + 1;
    const rawUrl = source.url.endsWith('/')
      ? source.url + randomId
      : source.url;

    // Route through CORS proxy to avoid cross-origin blocks
    const url = CONFIG.CORS_PROXY_PREFIX
      ? CONFIG.CORS_PROXY_PREFIX + encodeURIComponent(rawUrl)
      : rawUrl;

    const startTime = performance.now();

    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(CONFIG.ANT_FETCH_TIMEOUT_MS),
      });
      const rtt = performance.now() - startTime;

      // HTTP 429: Apex-Predator (Ant-Lion)
      if (response.status === 429) {
        return {
          success: false,
          status: 429,
          rtt,
          danger: 'predator',
          url: rawUrl,
        };
      }

      // HTTP 5xx: Storm (habitat collapse)
      if (response.status >= 500) {
        return {
          success: false,
          status: response.status,
          rtt,
          danger: 'storm',
          url: rawUrl,
        };
      }

      // Non-OK status: Camouflage (redirect loops, client errors)
      if (!response.ok) {
        return {
          success: false,
          status: response.status,
          rtt,
          danger: 'camouflage',
          url: rawUrl,
        };
      }

      // 200 OK: Successful food acquisition
      const data = await response.json();
      const nutrition = this.evaluateNutrition(data, source);
      const title =
        data.title || data.name || data.id || JSON.stringify(data).slice(0, 60);
      const payload = JSON.stringify(data).slice(0, 500);
      const foodType = source.type; // 'sugar' or 'protein'

      return {
        success: true,
        status: 200,
        rtt,
        nutrition,
        title: String(title).slice(0, 80),
        payload,
        foodType,
        url: rawUrl,
      };
    } catch (err) {
      // Timeout / network error: Swamp terrain
      const rtt = performance.now() - startTime;
      return {
        success: false,
        status: 0,
        rtt,
        danger: 'timeout',
        message: err.message,
        url: rawUrl,
      };
    }
  }
}
