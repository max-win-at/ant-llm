import { CONFIG } from './config.js';

/**
 * Manages browser cookies as the colony's food storage.
 *
 * Each cookie represents a food packet with a natural expiry time,
 * mirroring the "perishability" of real ant food stores.
 */
export class CookieManager {
  /**
   * Store a food item as a cookie.
   * @param {string} label - Short identifier for the food.
   * @param {string} value - Serialised food content (kept small).
   * @param {number} [maxAge] - Seconds until expiry. Defaults to config value.
   * @returns {boolean} Whether the cookie was stored successfully.
   */
  store(label, value, maxAge = CONFIG.COOKIE_MAX_AGE_SECONDS) {
    const key = CONFIG.COOKIE_PREFIX + label;
    // Truncate value to stay within per-cookie limits (~4 KB)
    const safeValue = encodeURIComponent(value).slice(0, 3800);
    try {
      document.cookie = `${key}=${safeValue}; max-age=${maxAge}; path=/; SameSite=Lax`;
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Retrieve all food cookies currently stored.
   * @returns {Array<{name: string, value: string}>}
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
   * @returns {string|null} The food value, or null if storage is empty.
   */
  consume() {
    const all = this.getAll();
    if (all.length === 0) return null;
    const oldest = all[0];
    // Delete by setting max-age to 0
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
   * Estimate the total "metabolic weight": every cookie adds overhead
   * to every HTTP request on this domain (as described in the abstract).
   * Returns approximate byte count of food cookies.
   */
  estimateWeight() {
    return this.getAll().reduce((sum, c) => sum + c.name.length + c.value.length + 3, 0);
  }
}
