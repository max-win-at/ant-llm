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
    const url = source.url.endsWith('/')
      ? source.url + randomId
      : source.url;

    // Food sources: fetch with mode:'no-cors' for real RTT measurement,
    // then synthesise the response body locally. The APIs block cross-origin
    // reads, but the opaque round-trip still gives us genuine network distance.
    if (source.kind === 'food') {
      return this._forageFood(source, url, randomId);
    }

    // Danger sources (httpstat.us supports CORS): normal fetch.
    return this._forageDanger(source, url);
  }

  /**
   * Food foraging — opaque fetch for RTT + synthetic payload.
   */
  async _forageFood(source, url, id) {
    const startTime = performance.now();
    try {
      await fetch(url, {
        mode: 'no-cors',
        signal: AbortSignal.timeout(CONFIG.ANT_FETCH_TIMEOUT_MS),
      });
      const rtt = performance.now() - startTime;

      const data = this._syntheticFood(source, id);
      const nutrition = this.evaluateNutrition(data, source);
      const title = data.title || data.name || `food-${id}`;
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
          url,
        };
      }
      if (!response.ok) {
        return {
          success: false,
          status: response.status,
          rtt,
          danger: 'camouflage',
          url,
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
        url,
      };
    }
  }

  /**
   * Generate a synthetic food payload matching the expected JSON shape.
   *
   * Sugar (flat JSON)   — mirrors JSONPlaceholder posts / todos.
   * Protein (nested)    — mirrors PokeAPI / REST Countries depth.
   */
  _syntheticFood(source, id) {
    if (source.type === 'sugar') {
      return {
        userId: Math.ceil(id / 2),
        id,
        title: `${source.name} item ${id}`,
        body: `Foraging payload collected from ${source.url}`,
        completed: id % 2 === 0,
      };
    }

    // Protein: nested structure for higher nutrition scoring
    return {
      id,
      name: `specimen-${id}`,
      height: id * 3 + 10,
      weight: id * 10 + 50,
      types: [
        { type: { name: 'alpha' } },
        { type: { name: 'beta' } },
      ],
      stats: [
        { stat: { name: 'hp' }, base_stat: 40 + id * 3 },
        { stat: { name: 'attack' }, base_stat: 30 + id * 2 },
        { stat: { name: 'defense' }, base_stat: 35 + id },
      ],
      abilities: [
        { ability: { name: `trait-${id}` }, is_hidden: false },
      ],
    };
  }
}
