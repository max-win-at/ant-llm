import { LLMProvider } from './llm-provider.js';

/**
 * Anthropic Claude provider
 * Supports both API key and OAuth authentication
 */
export class AnthropicProvider extends LLMProvider {
  constructor() {
    super('Anthropic Claude');
    this.apiKey = null;
    this.oauthToken = null;
    this.baseUrl = 'https://api.anthropic.com/v1';
    this.model = 'claude-3-5-sonnet-20241022'; // Latest Sonnet model
  }

  getCredentialFields() {
    return [
      {
        name: 'apiKey',
        type: 'password',
        label: 'API Key',
        required: false,
        placeholder: 'sk-ant-...'
      },
      {
        name: 'useOAuth',
        type: 'checkbox',
        label: 'Use OAuth instead',
        required: false
      }
    ];
  }

  validateCredentials(credentials) {
    if (credentials.useOAuth) {
      return true; // OAuth will be validated during flow
    }
    return credentials.apiKey && credentials.apiKey.startsWith('sk-ant-');
  }

  async initialize(credentials) {
    if (credentials.useOAuth) {
      // OAuth flow for Anthropic
      // Note: Anthropic's OAuth is primarily for enterprise/workspace integrations
      // For this implementation, we'll support the standard OAuth 2.0 flow
      try {
        this.oauthToken = await this._performOAuthFlow();
        this.isAuthenticated = !!this.oauthToken;
        return this.isAuthenticated;
      } catch (error) {
        console.error('Anthropic OAuth failed:', error);
        this.isAuthenticated = false;
        return false;
      }
    } else {
      // API key authentication
      this.apiKey = credentials.apiKey;

      // Validate the key format
      // Testing can fail due to network issues, CORS, etc.
      // The key will be validated on first actual use
      if (this.apiKey && this.apiKey.startsWith('sk-ant-')) {
        this.isAuthenticated = true;
        console.log('Anthropic API key accepted (format valid)');
        return true;
      } else {
        console.error('Anthropic API key format invalid (must start with sk-ant-)');
        this.isAuthenticated = false;
        return false;
      }
    }
  }

  async _performOAuthFlow() {
    // Simplified OAuth flow
    // In production, this would redirect to Anthropic's authorization endpoint
    // and handle the callback with the authorization code

    const clientId = 'YOUR_CLIENT_ID'; // Should be configured
    const redirectUri = window.location.origin + '/oauth-callback';
    const scope = 'api';

    return new Promise((resolve, reject) => {
      // Create OAuth popup window
      const authUrl = `https://console.anthropic.com/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}`;

      const popup = window.open(authUrl, 'Anthropic OAuth', 'width=600,height=700');

      // Listen for OAuth callback
      const messageHandler = async (event) => {
        if (event.origin !== window.location.origin) return;

        if (event.data.type === 'oauth-callback' && event.data.code) {
          window.removeEventListener('message', messageHandler);
          popup.close();

          try {
            // Exchange code for token
            const token = await this._exchangeCodeForToken(event.data.code);
            resolve(token);
          } catch (error) {
            reject(error);
          }
        }
      };

      window.addEventListener('message', messageHandler);

      // Check if popup was closed
      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed);
          window.removeEventListener('message', messageHandler);
          reject(new Error('OAuth flow cancelled'));
        }
      }, 1000);
    });
  }

  async _exchangeCodeForToken(code) {
    // In a real implementation, this would be done through a backend service
    // to keep the client secret secure
    const response = await fetch('https://api.anthropic.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: window.location.origin + '/oauth-callback',
        client_id: 'YOUR_CLIENT_ID',
        client_secret: 'YOUR_CLIENT_SECRET' // Should be handled server-side
      })
    });

    const data = await response.json();
    return data.access_token;
  }

  async _testConnection() {
    // Make a minimal test request to validate the API key
    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01'
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
      throw new Error('Anthropic provider not authenticated');
    }

    const headers = {
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01'
    };

    if (this.oauthToken) {
      headers['Authorization'] = `Bearer ${this.oauthToken}`;
    } else {
      headers['x-api-key'] = this.apiKey;
    }

    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        model: this.model,
        max_tokens: maxTokens,
        temperature: temperature,
        system: systemPrompt,
        messages: [
          { role: 'user', content: userPrompt }
        ]
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Anthropic API error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return data.content[0].text;
  }

  clearCredentials() {
    super.clearCredentials();
    this.apiKey = null;
    this.oauthToken = null;
  }
}
