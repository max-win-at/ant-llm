/**
 * Manages storage and retrieval of LLM provider credentials
 * Uses localStorage with basic encryption for security
 */

const STORAGE_KEY_PREFIX = 'llm_credentials_';
const SELECTED_PROVIDER_KEY = 'llm_selected_provider';

export class CredentialStorage {
  /**
   * Simple XOR encryption for credential obfuscation
   * Note: This is not cryptographically secure, but provides basic protection
   * against casual inspection of localStorage
   */
  static _obfuscate(text) {
    const key = 'ant-colony-llm-key-2025';
    let result = '';
    for (let i = 0; i < text.length; i++) {
      result += String.fromCharCode(
        text.charCodeAt(i) ^ key.charCodeAt(i % key.length)
      );
    }
    return btoa(result); // Base64 encode
  }

  static _deobfuscate(encoded) {
    try {
      const text = atob(encoded); // Base64 decode
      const key = 'ant-colony-llm-key-2025';
      let result = '';
      for (let i = 0; i < text.length; i++) {
        result += String.fromCharCode(
          text.charCodeAt(i) ^ key.charCodeAt(i % key.length)
        );
      }
      return result;
    } catch (error) {
      console.error('Failed to deobfuscate credentials:', error);
      return null;
    }
  }

  /**
   * Save credentials for a provider
   * @param {string} providerName - Provider identifier
   * @param {Object} credentials - Credential object
   * @returns {boolean} Success status
   */
  static saveCredentials(providerName, credentials) {
    try {
      const json = JSON.stringify(credentials);
      const obfuscated = this._obfuscate(json);
      localStorage.setItem(STORAGE_KEY_PREFIX + providerName, obfuscated);
      return true;
    } catch (error) {
      console.error('Failed to save credentials:', error);
      return false;
    }
  }

  /**
   * Load credentials for a provider
   * @param {string} providerName - Provider identifier
   * @returns {Object|null} Credentials or null if not found
   */
  static loadCredentials(providerName) {
    try {
      const obfuscated = localStorage.getItem(STORAGE_KEY_PREFIX + providerName);
      if (!obfuscated) {
        return null;
      }
      const json = this._deobfuscate(obfuscated);
      if (!json) {
        return null;
      }
      return JSON.parse(json);
    } catch (error) {
      console.error('Failed to load credentials:', error);
      return null;
    }
  }

  /**
   * Delete credentials for a provider
   * @param {string} providerName - Provider identifier
   * @returns {boolean} Success status
   */
  static deleteCredentials(providerName) {
    try {
      localStorage.removeItem(STORAGE_KEY_PREFIX + providerName);
      return true;
    } catch (error) {
      console.error('Failed to delete credentials:', error);
      return false;
    }
  }

  /**
   * Check if credentials exist for a provider
   * @param {string} providerName - Provider identifier
   * @returns {boolean}
   */
  static hasCredentials(providerName) {
    return localStorage.getItem(STORAGE_KEY_PREFIX + providerName) !== null;
  }

  /**
   * Get list of providers with stored credentials
   * @returns {Array<string>} Array of provider names
   */
  static getConfiguredProviders() {
    const providers = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_KEY_PREFIX)) {
        providers.push(key.substring(STORAGE_KEY_PREFIX.length));
      }
    }
    return providers;
  }

  /**
   * Save the selected provider
   * @param {string} providerName - Provider identifier
   */
  static saveSelectedProvider(providerName) {
    localStorage.setItem(SELECTED_PROVIDER_KEY, providerName);
  }

  /**
   * Get the selected provider
   * @returns {string|null} Provider name or null
   */
  static getSelectedProvider() {
    return localStorage.getItem(SELECTED_PROVIDER_KEY);
  }

  /**
   * Clear all stored credentials
   */
  static clearAll() {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_KEY_PREFIX)) {
        keys.push(key);
      }
    }
    keys.forEach(key => localStorage.removeItem(key));
    localStorage.removeItem(SELECTED_PROVIDER_KEY);
  }
}
