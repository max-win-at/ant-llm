import { CONFIG } from './config.js';

/**
 * Manages browser cookies as the colony's food storage (Nest).
 *
 * Each cookie represents a food packet with a natural expiry time,
 * mirroring the perishability of real ant food stores.
 *
 * In the network topology paradigm:
 *   Sugar (flat JSON)   → stored as cookies for quick energy retrieval
 *   Protein (nested JSON) → also stored here, but enables brood generation
 *     when reproduction threshold is met
 */
export class CookieManager {
  /**
   * Store a food item as a cookie.
   * @param {string} label - Short identifier for the food.
   * @param {string} value - Serialised food content (kept small).
   * @param {number} [maxAge] - Seconds until expiry.
   */
  store(label, value, maxAge = CONFIG.COOKIE_MAX_AGE_SECONDS) {
    const key = CONFIG.COOKIE_PREFIX + label;
    const safeValue = encodeURIComponent(value).slice(0, 3800);
    try {
      document.cookie = `${key}=${safeValue}; max-age=${maxAge}; path=/; SameSite=Lax`;
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Retrieve all food cookies currently stored in the nest.
   */
  getAll() {
    if (!document.cookie) return [];
    return document.cookie
      .split(';')
      .map((c) => c.trim())
      .filter((c) => c.startsWith(CONFIG.COOKIE_PREFIX))
      .map((c) => {
        const [name, ...rest] = c.split('=');
        return {
          name: name.trim(),
          value: decodeURIComponent(rest.join('=')),
        };
      });
  }

  /**
   * Count how many food cookies the colony currently has.
   */
  count() {
    return this.getAll().length;
  }

  /**
   * Consume (delete) the oldest food cookie and return its value.
   * Used during reproduction to fuel brood generation.
   */
  consume() {
    const all = this.getAll();
    if (all.length === 0) return null;
    const oldest = all[0];
    document.cookie = `${oldest.name}=; max-age=0; path=/; SameSite=Lax`;
    return oldest.value;
  }

  /**
   * Delete all food cookies.
   */
  clear() {
    for (const item of this.getAll()) {
      document.cookie = `${item.name}=; max-age=0; path=/; SameSite=Lax`;
    }
  }

  /**
   * Estimate the total metabolic weight of stored food.
   * Every cookie adds overhead to every HTTP request on this domain,
   * simulating the metabolic cost of maintaining food stores.
   */
  estimateWeight() {
    return this.getAll().reduce(
      (sum, c) => sum + c.name.length + c.value.length + 3,
      0
    );
  }
}
