import { LLMProvider } from './llm-provider.js';

/**
 * OpenAI provider
 * Supports API key authentication (OAuth available for enterprise)
 */
export class OpenAIProvider extends LLMProvider {
  constructor() {
    super('OpenAI');
    this.apiKey = null;
    this.baseUrl = 'https://api.openai.com/v1';
    this.model = 'gpt-4o'; // GPT-4o model
  }

  getCredentialFields() {
    return [
      {
        name: 'apiKey',
        type: 'password',
        label: 'API Key',
        required: true,
        placeholder: 'sk-proj-...'
      }
    ];
  }

  validateCredentials(credentials) {
    return credentials.apiKey && (
      credentials.apiKey.startsWith('sk-') ||
      credentials.apiKey.startsWith('sk-proj-')
    );
  }

  async initialize(credentials) {
    this.apiKey = credentials.apiKey;

    // Validate by making a test request
    try {
      await this._testConnection();
      this.isAuthenticated = true;
      return true;
    } catch (error) {
      console.error('OpenAI API key validation failed:', error);
      this.isAuthenticated = false;
      return false;
    }
  }

  async _testConnection() {
    // Make a minimal test request to validate the API key
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 10,
        messages: [
          { role: 'user', content: 'Hi' }
        ]
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'API key validation failed');
    }

    return true;
  }

  async complete({ systemPrompt, userPrompt, maxTokens = 4096, temperature = 1.0 }) {
    if (!this.isAuthenticated) {
      throw new Error('OpenAI provider not authenticated');
    }

    const messages = [];

    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }

    messages.push({ role: 'user', content: userPrompt });

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: maxTokens,
        temperature: temperature,
        messages: messages
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  clearCredentials() {
    super.clearCredentials();
    this.apiKey = null;
  }
}
