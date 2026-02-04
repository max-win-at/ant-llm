/**
 * Settings Panel UI Component
 * Manages LLM provider configuration and credentials
 */

export class SettingsPanel {
  constructor(llmManager) {
    this.llmManager = llmManager;
    this.isOpen = false;
    this.createPanel();
    this.attachEventListeners();
  }

  createPanel() {
    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.id = 'settings-overlay';
    overlay.className = 'settings-overlay';
    overlay.innerHTML = `
      <div class="settings-panel">
        <div class="settings-header">
          <h2>LLM Configuration</h2>
          <button id="settings-close" class="close-btn">&times;</button>
        </div>

        <div class="settings-content">
          <div class="settings-section">
            <h3>Mode Selection</h3>
            <div class="mode-toggle">
              <label>
                <input type="radio" name="mode" value="traditional" checked>
                <span>Traditional Algorithm</span>
                <small>Stigmergic pheromone-based decision making</small>
              </label>
              <label>
                <input type="radio" name="mode" value="llm">
                <span>LLM-Powered</span>
                <small>AI controls ant colony behavior</small>
              </label>
            </div>
          </div>

          <div class="settings-section llm-config" style="display: none;">
            <h3>LLM Provider</h3>
            <div class="provider-status">
              <div id="provider-list"></div>
            </div>

            <div class="provider-selector">
              <label for="provider-select">Select Provider:</label>
              <select id="provider-select">
                <option value="">-- Choose a provider --</option>
                <option value="anthropic">Anthropic Claude</option>
                <option value="openai">OpenAI</option>
                <option value="gemini">Google Gemini</option>
              </select>
            </div>

            <div id="credential-form" style="display: none;">
              <h4>Configure <span id="provider-name"></span></h4>
              <div id="credential-fields"></div>
              <div class="form-actions">
                <button id="save-credentials" class="btn-primary">Save & Activate</button>
                <button id="test-credentials" class="btn-secondary">Test Connection</button>
              </div>
              <div id="credential-status"></div>
            </div>
          </div>

          <div class="settings-section">
            <h3>About LLM Mode</h3>
            <p>When enabled, a large language model will control the decision-making for all ants in the colony. The LLM receives information about ant states, pheromone trails, and food sources, then decides where each ant should forage.</p>
            <p><strong>Privacy:</strong> Your API keys are stored locally in your browser and never sent to any server except the respective LLM provider.</p>
            <p><strong>Cost:</strong> Each simulation tick makes one LLM API call. Costs vary by provider (~$0.001-0.01 per tick).</p>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    this.overlay = overlay;
  }

  attachEventListeners() {
    // Close button
    document.getElementById('settings-close').addEventListener('click', () => {
      this.close();
    });

    // Click outside to close
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) {
        this.close();
      }
    });

    // Mode toggle
    document.querySelectorAll('input[name="mode"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        const llmConfig = document.querySelector('.llm-config');
        if (e.target.value === 'llm') {
          llmConfig.style.display = 'block';
          this.updateProviderStatus();
        } else {
          llmConfig.style.display = 'none';
        }
      });
    });

    // Provider selection
    document.getElementById('provider-select').addEventListener('change', (e) => {
      const providerId = e.target.value;
      if (providerId) {
        this.showCredentialForm(providerId);
      } else {
        document.getElementById('credential-form').style.display = 'none';
      }
    });

    // Save credentials
    document.getElementById('save-credentials').addEventListener('click', () => {
      this.saveCredentials();
    });

    // Test credentials
    document.getElementById('test-credentials').addEventListener('click', () => {
      this.testCredentials();
    });
  }

  updateProviderStatus() {
    const statusContainer = document.getElementById('provider-list');
    const providers = this.llmManager.getProviderStatus();

    let html = '<div class="provider-status-list">';
    for (const provider of providers) {
      const statusIcon = provider.isAuthenticated ? '✓' : '○';
      const statusClass = provider.isAuthenticated ? 'authenticated' : 'not-authenticated';
      const activeLabel = provider.isActive ? ' (Active)' : '';

      html += `
        <div class="provider-status-item ${statusClass}">
          <span class="status-icon">${statusIcon}</span>
          <span class="provider-name">${provider.name}${activeLabel}</span>
          ${provider.hasStoredCredentials ? '<span class="stored-badge">Saved</span>' : ''}
        </div>
      `;
    }
    html += '</div>';

    statusContainer.innerHTML = html;
  }

  showCredentialForm(providerId) {
    const provider = this.llmManager.getProvider(providerId);
    if (!provider) return;

    document.getElementById('provider-name').textContent = provider.getName();
    const form = document.getElementById('credential-form');
    const fieldsContainer = document.getElementById('credential-fields');

    // Generate form fields
    const fields = provider.getCredentialFields();
    let html = '';

    for (const field of fields) {
      if (field.type === 'checkbox') {
        html += `
          <div class="form-field">
            <label>
              <input type="checkbox" name="${field.name}" ${field.required ? 'required' : ''}>
              ${field.label}
            </label>
          </div>
        `;
      } else {
        html += `
          <div class="form-field">
            <label for="field-${field.name}">${field.label}:</label>
            <input
              type="${field.type}"
              id="field-${field.name}"
              name="${field.name}"
              placeholder="${field.placeholder || ''}"
              ${field.required ? 'required' : ''}
            >
          </div>
        `;
      }
    }

    fieldsContainer.innerHTML = html;
    form.style.display = 'block';

    // Clear previous status
    document.getElementById('credential-status').innerHTML = '';
  }

  async saveCredentials() {
    const providerId = document.getElementById('provider-select').value;
    if (!providerId) return;

    const statusDiv = document.getElementById('credential-status');
    statusDiv.innerHTML = '<div class="status-loading">Initializing provider...</div>';

    try {
      // Collect credentials from form
      const credentials = {};
      const fields = document.querySelectorAll('#credential-fields input');

      fields.forEach(field => {
        if (field.type === 'checkbox') {
          credentials[field.name] = field.checked;
        } else {
          credentials[field.name] = field.value;
        }
      });

      // Initialize provider
      const success = await this.llmManager.initializeProvider(providerId, credentials, true);

      if (success) {
        statusDiv.innerHTML = '<div class="status-success">✓ Provider configured successfully!</div>';
        this.updateProviderStatus();

        // Enable LLM mode
        document.querySelector('input[name="mode"][value="llm"]').checked = true;

        // Trigger mode change event
        if (this.onModeChange) {
          this.onModeChange('llm', providerId);
        }
      } else {
        statusDiv.innerHTML = '<div class="status-error">✗ Failed to initialize provider. Check your credentials.</div>';
      }
    } catch (error) {
      statusDiv.innerHTML = `<div class="status-error">✗ Error: ${error.message}</div>`;
    }
  }

  async testCredentials() {
    const statusDiv = document.getElementById('credential-status');
    statusDiv.innerHTML = '<div class="status-loading">Testing connection...</div>';

    try {
      // Try to make a simple completion
      const response = await this.llmManager.complete({
        systemPrompt: 'You are a helpful assistant.',
        userPrompt: 'Say "test successful" if you can read this.',
        maxTokens: 20,
        temperature: 0
      });

      if (response) {
        statusDiv.innerHTML = '<div class="status-success">✓ Connection test successful!</div>';
      } else {
        statusDiv.innerHTML = '<div class="status-error">✗ Test failed: empty response</div>';
      }
    } catch (error) {
      statusDiv.innerHTML = `<div class="status-error">✗ Test failed: ${error.message}</div>`;
    }
  }

  open() {
    this.isOpen = true;
    this.overlay.classList.add('active');
    this.updateProviderStatus();

    // Check current mode
    if (this.llmManager.hasActiveProvider()) {
      document.querySelector('input[name="mode"][value="llm"]').checked = true;
      document.querySelector('.llm-config').style.display = 'block';
    }
  }

  close() {
    this.isOpen = false;
    this.overlay.classList.remove('active');
  }

  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  /**
   * Set callback for mode changes
   * @param {Function} callback - Called with (mode, providerId)
   */
  onModeChange(callback) {
    this.onModeChangeCallback = callback;
  }
}
