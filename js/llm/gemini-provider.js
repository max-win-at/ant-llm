import { LLMProvider } from './llm-provider.js';

/**
 * Google Gemini provider
 * Uses API key authentication
 */
export class GeminiProvider extends LLMProvider {
  constructor() {
    super('Google Gemini');
    this.apiKey = null;
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
    this.model = 'gemini-2.0-flash-exp'; // Latest Gemini model
  }

  getCredentialFields() {
    return [
      {
        name: 'apiKey',
        type: 'password',
        label: 'API Key',
        required: true,
        placeholder: 'AIza...'
      }
    ];
  }

  validateCredentials(credentials) {
    return credentials.apiKey && credentials.apiKey.length > 0;
  }

  async initialize(credentials) {
    this.apiKey = credentials.apiKey;

    // For Gemini, we'll validate the key format and trust it
    // Testing the connection can fail due to CORS or other issues
    // The key will be validated on first actual use
    if (this.apiKey && this.apiKey.length > 10) {
      this.isAuthenticated = true;
      console.log('Gemini API key accepted (format valid)');
      return true;
    } else {
      console.error('Gemini API key format invalid');
      this.isAuthenticated = false;
      return false;
    }
  }

  async _testConnection() {
    const url = `${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: 'Hi' }
            ]
          }
        ],
        generationConfig: {
          maxOutputTokens: 10,
          temperature: 1.0
        }
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'API key validation failed');
    }

    return true;
  }

  async complete({ systemPrompt, userPrompt, maxTokens = 8192, temperature = 1.0 }) {
    if (!this.isAuthenticated) {
      throw new Error('Gemini provider not authenticated');
    }

    const url = `${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`;

    // Gemini combines system and user prompts differently
    // We'll prepend the system prompt to the user prompt
    const combinedPrompt = systemPrompt
      ? `${systemPrompt}\n\n${userPrompt}`
      : userPrompt;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: combinedPrompt }
            ]
          }
        ],
        generationConfig: {
          maxOutputTokens: maxTokens,
          temperature: temperature,
          topP: 0.95,
          topK: 40
        },
        safetySettings: [
          {
            category: 'HARM_CATEGORY_HARASSMENT',
            threshold: 'BLOCK_NONE'
          },
          {
            category: 'HARM_CATEGORY_HATE_SPEECH',
            threshold: 'BLOCK_NONE'
          },
          {
            category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
            threshold: 'BLOCK_NONE'
          },
          {
            category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
            threshold: 'BLOCK_NONE'
          }
        ]
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Gemini API error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();

    if (!data.candidates || data.candidates.length === 0) {
      throw new Error('Gemini returned no candidates');
    }

    const candidate = data.candidates[0];
    if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
      throw new Error('Gemini returned empty response');
    }

    return candidate.content.parts[0].text;
  }

  clearCredentials() {
    super.clearCredentials();
    this.apiKey = null;
  }
}
