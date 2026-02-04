import { AnthropicProvider } from './anthropic-provider.js';
import { GeminiProvider } from './gemini-provider.js';
import { OpenAIProvider } from './openai-provider.js';
import { CredentialStorage } from './credential-storage.js';

/**
 * Central manager for LLM providers
 * Handles registration, selection, and credential management
 */
export class LLMManager {
  constructor() {
    this.providers = new Map();
    this.activeProvider = null;

    // Register built-in providers
    this.registerProvider('anthropic', new AnthropicProvider());
    this.registerProvider('gemini', new GeminiProvider());
    this.registerProvider('openai', new OpenAIProvider());
  }

  /**
   * Register a new provider
   * @param {string} id - Unique identifier for the provider
   * @param {LLMProvider} provider - Provider instance
   */
  registerProvider(id, provider) {
    this.providers.set(id, provider);
  }

  /**
   * Get all registered providers
   * @returns {Map<string, LLMProvider>}
   */
  getProviders() {
    return this.providers;
  }

  /**
   * Get a specific provider by ID
   * @param {string} id - Provider identifier
   * @returns {LLMProvider|null}
   */
  getProvider(id) {
    return this.providers.get(id) || null;
  }

  /**
   * Get the currently active provider
   * @returns {LLMProvider|null}
   */
  getActiveProvider() {
    return this.activeProvider;
  }

  /**
   * Check if any provider is ready to use
   * @returns {boolean}
   */
  hasActiveProvider() {
    return this.activeProvider !== null && this.activeProvider.isReady();
  }

  /**
   * Initialize a provider with credentials
   * @param {string} providerId - Provider identifier
   * @param {Object} credentials - Provider credentials
   * @param {boolean} saveCredentials - Whether to save to localStorage
   * @returns {Promise<boolean>} Success status
   */
  async initializeProvider(providerId, credentials, saveCredentials = true) {
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new Error(`Provider ${providerId} not found`);
    }

    // Validate credentials format
    if (!provider.validateCredentials(credentials)) {
      throw new Error('Invalid credentials format');
    }

    // Initialize provider
    const success = await provider.initialize(credentials);

    if (success) {
      this.activeProvider = provider;

      if (saveCredentials) {
        CredentialStorage.saveCredentials(providerId, credentials);
        CredentialStorage.saveSelectedProvider(providerId);
      }
    }

    return success;
  }

  /**
   * Load and initialize a provider from stored credentials
   * @param {string} providerId - Provider identifier
   * @returns {Promise<boolean>} Success status
   */
  async loadProvider(providerId) {
    const credentials = CredentialStorage.loadCredentials(providerId);
    if (!credentials) {
      return false;
    }

    try {
      return await this.initializeProvider(providerId, credentials, false);
    } catch (error) {
      console.error(`Failed to load provider ${providerId}:`, error);
      return false;
    }
  }

  /**
   * Try to restore the previously selected provider
   * @returns {Promise<boolean>} Success status
   */
  async restoreLastProvider() {
    const providerId = CredentialStorage.getSelectedProvider();
    if (!providerId) {
      return false;
    }

    return await this.loadProvider(providerId);
  }

  /**
   * Switch to a different provider
   * @param {string} providerId - Provider identifier
   * @returns {Promise<boolean>} Success status
   */
  async switchProvider(providerId) {
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new Error(`Provider ${providerId} not found`);
    }

    // Try to load from storage
    const loaded = await this.loadProvider(providerId);
    if (loaded) {
      return true;
    }

    // If not in storage, provider needs to be initialized manually
    return false;
  }

  /**
   * Clear credentials for a provider
   * @param {string} providerId - Provider identifier
   */
  clearProviderCredentials(providerId) {
    const provider = this.providers.get(providerId);
    if (provider) {
      provider.clearCredentials();
    }
    CredentialStorage.deleteCredentials(providerId);

    // If this was the active provider, clear it
    if (this.activeProvider && this.providers.get(providerId) === this.activeProvider) {
      this.activeProvider = null;
    }
  }

  /**
   * Clear all credentials and reset
   */
  clearAll() {
    this.providers.forEach(provider => provider.clearCredentials());
    CredentialStorage.clearAll();
    this.activeProvider = null;
  }

  /**
   * Make an LLM completion request using the active provider
   * @param {Object} params - Completion parameters
   * @returns {Promise<string>} LLM response
   */
  async complete(params) {
    if (!this.hasActiveProvider()) {
      throw new Error('No active LLM provider. Please configure credentials.');
    }

    return await this.activeProvider.complete(params);
  }

  /**
   * Get list of providers with stored credentials
   * @returns {Array<string>}
   */
  getConfiguredProviders() {
    return CredentialStorage.getConfiguredProviders();
  }

  /**
   * Get provider status information for UI
   * @returns {Array<Object>}
   */
  getProviderStatus() {
    const status = [];
    this.providers.forEach((provider, id) => {
      status.push({
        id: id,
        name: provider.getName(),
        isAuthenticated: provider.isReady(),
        isActive: provider === this.activeProvider,
        hasStoredCredentials: CredentialStorage.hasCredentials(id)
      });
    });
    return status;
  }
}
