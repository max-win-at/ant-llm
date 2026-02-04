/**
 * Abstract base class for LLM providers
 * Provides a common interface for different LLM APIs
 */
export class LLMProvider {
  constructor(name) {
    if (new.target === LLMProvider) {
      throw new Error('LLMProvider is an abstract class');
    }
    this.name = name;
    this.isAuthenticated = false;
  }

  /**
   * Initialize the provider with credentials
   * @param {Object} credentials - API keys, tokens, etc.
   * @returns {Promise<boolean>} - Success status
   */
  async initialize(credentials) {
    throw new Error('initialize() must be implemented by subclass');
  }

  /**
   * Check if the provider is properly authenticated
   * @returns {boolean}
   */
  isReady() {
    return this.isAuthenticated;
  }

  /**
   * Make a completion request to the LLM
   * @param {Object} params
   * @param {string} params.systemPrompt - System instructions
   * @param {string} params.userPrompt - User message
   * @param {number} params.maxTokens - Maximum response tokens
   * @param {number} params.temperature - Sampling temperature
   * @returns {Promise<string>} - LLM response text
   */
  async complete(params) {
    throw new Error('complete() must be implemented by subclass');
  }

  /**
   * Get the display name for this provider
   * @returns {string}
   */
  getName() {
    return this.name;
  }

  /**
   * Get required credential fields for this provider
   * @returns {Array<Object>} Array of {name, type, label, required}
   */
  getCredentialFields() {
    throw new Error('getCredentialFields() must be implemented by subclass');
  }

  /**
   * Clear stored credentials
   */
  clearCredentials() {
    this.isAuthenticated = false;
  }

  /**
   * Validate credentials format
   * @param {Object} credentials
   * @returns {boolean}
   */
  validateCredentials(credentials) {
    throw new Error('validateCredentials() must be implemented by subclass');
  }
}
