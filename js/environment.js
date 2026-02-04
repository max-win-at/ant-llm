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
    this._restricted = false;
    this._fallbackCache = new Map();
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
   * Probe whether external APIs are reachable with CORS.
   *
   * Restricted networks (corporate proxies, content filters) inject 403
   * responses without CORS headers, making every cross-origin fetch fail.
   * When detected, food sources fall back to same-origin static JSON.
   */
  async probeNetwork() {
    const testUrl = CONFIG.FOOD_SOURCES[0]?.url;
    if (!testUrl) return;

    try {
      const url = testUrl.endsWith('/') ? testUrl + '1' : testUrl;
      const resp = await fetch(url, {
        signal: AbortSignal.timeout(5000),
      });
      if (!resp.ok) {
        this._restricted = true;
        return;
      }
      await resp.json();
      this._restricted = false;
    } catch {
      this._restricted = true;
    }

    if (this._restricted) {
      console.warn(
        '[ant-llm] External APIs unreachable (restricted network detected). ' +
          'Falling back to same-origin food sources.'
      );
    }
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

    if (source.kind === 'food') {
      if (this._restricted && source.fallbackUrl) {
        return this._forageLocal(source, randomId);
      }
      return this._forageRemote(source, randomId);
    }

    // Danger sources (httpstat.us supports CORS): normal fetch.
    const url = source.url.endsWith('/')
      ? source.url + randomId
      : source.url;
    return this._forageDanger(source, url);
  }

  /**
   * Remote food foraging — direct fetch to external API.
   * Used on unrestricted networks where CORS succeeds.
   */
  async _forageRemote(source, id) {
    const url = source.url.endsWith('/')
      ? source.url + id
      : source.url;
    const startTime = performance.now();

    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(CONFIG.ANT_FETCH_TIMEOUT_MS),
      });
      const rtt = performance.now() - startTime;

      if (!response.ok) {
        return {
          success: false,
          status: response.status,
          rtt,
          danger: 'camouflage',
          url,
        };
      }

      const data = await response.json();
      const nutrition = this.evaluateNutrition(data, source);
      const title =
        data.title || data.name || data.id || JSON.stringify(data).slice(0, 60);
      const payload = JSON.stringify(data).slice(0, 500);

      return {
        success: true,
        status: 200,
        rtt,
        nutrition,
        title: String(title).slice(0, 80),
        payload,
        foodType: source.type,
        url,
      };
    } catch (err) {
      const rtt = performance.now() - startTime;
      return {
        success: false,
        status: 0,
        rtt,
        danger: 'timeout',
        message: err.message,
        url,
      };
    }
  }

  /**
   * Local food foraging — fetch same-origin static JSON fallback.
   * Used on restricted networks where cross-origin requests are blocked.
   * The fallback files contain real API data snapshots (arrays of items).
   */
  async _forageLocal(source, id) {
    const canonicalUrl = source.url.endsWith('/')
      ? source.url + id
      : source.url;
    const startTime = performance.now();

    try {
      let items = this._fallbackCache.get(source.fallbackUrl);
      if (!items) {
        const response = await fetch(source.fallbackUrl, {
          signal: AbortSignal.timeout(CONFIG.ANT_FETCH_TIMEOUT_MS),
        });
        if (!response.ok) {
          const rtt = performance.now() - startTime;
          return {
            success: false,
            status: response.status,
            rtt,
            danger: 'camouflage',
            url: canonicalUrl,
          };
        }
        items = await response.json();
        this._fallbackCache.set(source.fallbackUrl, items);
      }
      const rtt = performance.now() - startTime;

      const data = Array.isArray(items)
        ? items[(id - 1) % items.length]
        : items;
      const nutrition = this.evaluateNutrition(data, source);
      const title =
        data.title ||
        data.name?.common ||
        data.name ||
        data.id ||
        JSON.stringify(data).slice(0, 60);
      const payload = JSON.stringify(data).slice(0, 500);

      return {
        success: true,
        status: 200,
        rtt,
        nutrition,
        title: String(title).slice(0, 80),
        payload,
        foodType: source.type,
        url: canonicalUrl,
      };
    } catch (err) {
      const rtt = performance.now() - startTime;
      return {
        success: false,
        status: 0,
        rtt,
        danger: 'timeout',
        message: err.message,
        url: canonicalUrl,
      };
    }
  }

  /**
   * Danger foraging — full CORS fetch to read status codes.
   */
  async _forageDanger(source, url) {
    const startTime = performance.now();
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(CONFIG.ANT_FETCH_TIMEOUT_MS),
      });
      const rtt = performance.now() - startTime;

      if (response.status === 429) {
        return { success: false, status: 429, rtt, danger: 'predator', url };
      }
      if (response.status >= 500) {
        return {
          success: false,
          status: response.status,
          rtt,
          danger: 'storm',
          url: rawUrl,
        };
      }
      if (!response.ok) {
        return {
          success: false,
          status: response.status,
          rtt,
          danger: 'camouflage',
          url: rawUrl,
        };
      }

      // A danger source that somehow returns 200 — treat as swamp (wasted trip).
      return { success: false, status: 200, rtt, danger: 'swamp', url };
    } catch (err) {
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
