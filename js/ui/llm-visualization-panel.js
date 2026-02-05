/**
 * LLM Visualization Panel
 * Shows real-time LLM interactions including individual ant thoughts,
 * swarm intelligence decisions, and prompts/responses
 */

export class LLMVisualizationPanel {
  constructor() {
    this.panel = null;
    this.isVisible = false;
    this.currentPrompt = null;
    this.currentResponse = null;
    this.antDecisions = [];
    this.maxHistoryItems = 10;
    this.decisionHistory = [];
    this.init();
  }

  init() {
    this.createPanelHTML();
    this.attachEventListeners();
  }

  createPanelHTML() {
    // Create backdrop
    const backdrop = document.createElement('div');
    backdrop.id = 'llm-viz-backdrop';
    backdrop.className = 'llm-viz-backdrop hidden';
    backdrop.addEventListener('click', () => this.hide());
    document.body.appendChild(backdrop);
    this.backdrop = backdrop;

    // Create panel container
    const panel = document.createElement('div');
    panel.id = 'llm-visualization-panel';
    panel.className = 'llm-viz-panel hidden';

    panel.innerHTML = `
      <div class="llm-viz-header">
        <h3>🧠 LLM Intelligence Visualization</h3>
        <button id="close-llm-viz" class="close-btn" aria-label="Close LLM Visualization">×</button>
      </div>

      <div class="llm-viz-content">
        <!-- Tab Navigation -->
        <div class="llm-viz-tabs">
          <button class="tab-btn active" data-tab="decisions">🐜 Ant Thoughts</button>
          <button class="tab-btn" data-tab="swarm">🌐 Swarm Intelligence</button>
          <button class="tab-btn" data-tab="prompts">📝 Prompts & Responses</button>
        </div>

        <!-- Tab Content -->
        <div class="llm-viz-tab-content">
          <!-- Individual Ant Decisions Tab -->
          <div id="decisions-tab" class="tab-pane active">
            <div class="tab-header">
              <h4>Individual Ant Decisions</h4>
              <span class="ant-count">0 ants decided</span>
            </div>
            <div id="ant-decisions-list" class="decisions-list">
              <div class="empty-state">No LLM decisions yet. Enable LLM mode and wait for ants to make decisions.</div>
            </div>
          </div>

          <!-- Swarm Intelligence Tab -->
          <div id="swarm-tab" class="tab-pane">
            <div class="tab-header">
              <h4>Emergent Swarm Intelligence</h4>
              <span class="decision-time">Last update: Never</span>
            </div>
            <div id="swarm-analysis" class="swarm-content">
              <div class="empty-state">No swarm intelligence data yet.</div>
            </div>
          </div>

          <!-- Prompts & Responses Tab -->
          <div id="prompts-tab" class="tab-pane">
            <div class="tab-header">
              <h4>LLM Communication</h4>
              <span class="prompt-count">0 prompts sent</span>
            </div>
            <div id="prompts-content" class="prompts-content">
              <div class="prompt-section">
                <h5>System Prompt</h5>
                <div id="system-prompt" class="code-block">
                  <div class="empty-state">No system prompt available.</div>
                </div>
              </div>
              <div class="prompt-section">
                <h5>Latest User Prompt</h5>
                <div id="user-prompt" class="code-block">
                  <div class="empty-state">No user prompt sent yet.</div>
                </div>
              </div>
              <div class="prompt-section">
                <h5>Latest LLM Response</h5>
                <div id="llm-response" class="code-block">
                  <div class="empty-state">No response received yet.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(panel);
    this.panel = panel;
  }

  attachEventListeners() {
    // Close button
    const closeBtn = document.getElementById('close-llm-viz');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.hide());
    }

    // Tab switching
    const tabBtns = this.panel.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tabName = e.target.dataset.tab;
        this.switchTab(tabName);
      });
    });
  }

  switchTab(tabName) {
    // Update active tab button
    const tabBtns = this.panel.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    // Update active tab pane
    const tabPanes = this.panel.querySelectorAll('.tab-pane');
    tabPanes.forEach(pane => {
      pane.classList.remove('active');
    });

    const activePane = this.panel.querySelector(`#${tabName}-tab`);
    if (activePane) {
      activePane.classList.add('active');
    }
  }

  show() {
    if (this.panel) {
      this.panel.classList.remove('hidden');
      this.isVisible = true;
    }
    if (this.backdrop) {
      this.backdrop.classList.remove('hidden');
    }
  }

  hide() {
    if (this.panel) {
      this.panel.classList.add('hidden');
      this.isVisible = false;
    }
    if (this.backdrop) {
      this.backdrop.classList.add('hidden');
    }
  }

  toggle() {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  /**
   * Update with new LLM decision data
   * @param {Object} data - LLM interaction data
   * @param {Array} data.decisions - Individual ant decisions
   * @param {string} data.systemPrompt - System prompt sent to LLM
   * @param {string} data.userPrompt - User prompt sent to LLM
   * @param {string} data.response - Raw LLM response
   * @param {Object} data.colonyState - Current colony state
   */
  updateVisualization(data) {
    console.log('[LLM Viz] Received visualization data:', {
      decisionsCount: data?.decisions?.length || 0,
      hasSystemPrompt: !!data?.systemPrompt,
      hasUserPrompt: !!data?.userPrompt,
      hasResponse: !!data?.response,
      colonyState: data?.colonyState
    });

    const { decisions, systemPrompt, userPrompt, response, colonyState } = data;

    // Store current data
    this.currentPrompt = { system: systemPrompt, user: userPrompt };
    this.currentResponse = response;
    this.antDecisions = decisions || [];

    console.log('[LLM Viz] Processed decisions:', this.antDecisions);

    // Add to history
    this.addToHistory({
      timestamp: new Date(),
      decisions: this.antDecisions,
      colonyState
    });

    // Update all tabs
    this.updateAntDecisionsTab();
    this.updateSwarmIntelligenceTab();
    this.updatePromptsTab();

    console.log('[LLM Viz] Tabs updated successfully');
  }

  addToHistory(item) {
    this.decisionHistory.unshift(item);
    if (this.decisionHistory.length > this.maxHistoryItems) {
      this.decisionHistory = this.decisionHistory.slice(0, this.maxHistoryItems);
    }
  }

  updateAntDecisionsTab() {
    const container = document.getElementById('ant-decisions-list');
    const countSpan = this.panel.querySelector('.ant-count');

    if (!this.antDecisions || this.antDecisions.length === 0) {
      container.innerHTML = '<div class="empty-state">No ant decisions in this tick.</div>';
      if (countSpan) countSpan.textContent = '0 ants decided';
      return;
    }

    if (countSpan) {
      countSpan.textContent = `${this.antDecisions.length} ants decided`;
    }

    // Group decisions by role
    const scouts = this.antDecisions.filter(d => d.role === 'scout');
    const workers = this.antDecisions.filter(d => d.role === 'worker');

    let html = '';

    if (scouts.length > 0) {
      html += `
        <div class="decision-group">
          <h5>🔭 Scout Ants (${scouts.length})</h5>
          ${scouts.map(decision => this.renderAntDecision(decision)).join('')}
        </div>
      `;
    }

    if (workers.length > 0) {
      html += `
        <div class="decision-group">
          <h5>⚙️ Worker Ants (${workers.length})</h5>
          ${workers.map(decision => this.renderAntDecision(decision)).join('')}
        </div>
      `;
    }

    container.innerHTML = html;
  }

  renderAntDecision(decision) {
    const antId = decision.antId ? decision.antId.substring(0, 8) : 'unknown';
    const energy = decision.energy ? decision.energy.toFixed(1) : 'N/A';
    const role = decision.role || 'unknown';
    const target = decision.targetUrl || 'none';
    const reasoning = decision.reasoning || 'No reasoning provided';
    const roleIcon = role === 'scout' ? '🔭' : '⚙️';

    // Extract just the path from URL for cleaner display
    let displayTarget = target;
    try {
      const url = new URL(target);
      displayTarget = url.pathname + url.search;
    } catch (e) {
      // Use full URL if parsing fails
    }

    return `
      <div class="ant-decision-card">
        <div class="ant-decision-header">
          <span class="ant-id">${roleIcon} Ant ${antId}</span>
          <span class="ant-energy" style="color: ${this.getEnergyColor(decision.energy)}">
            ⚡ ${energy}
          </span>
        </div>
        <div class="ant-decision-body">
          <div class="decision-target">
            <strong>Target:</strong>
            <code class="target-url" title="${target}">${displayTarget}</code>
          </div>
          <div class="decision-reasoning">
            <strong>Reasoning:</strong> ${reasoning}
          </div>
        </div>
      </div>
    `;
  }

  getEnergyColor(energy) {
    if (!energy) return '#999';
    if (energy > 50) return '#4CAF50';
    if (energy > 25) return '#FF9800';
    return '#F44336';
  }

  updateSwarmIntelligenceTab() {
    const container = document.getElementById('swarm-analysis');
    const timeSpan = this.panel.querySelector('.decision-time');

    if (!this.antDecisions || this.antDecisions.length === 0) {
      container.innerHTML = '<div class="empty-state">No swarm data available.</div>';
      return;
    }

    const now = new Date();
    if (timeSpan) {
      timeSpan.textContent = `Last update: ${now.toLocaleTimeString()}`;
    }

    // Analyze swarm behavior
    const analysis = this.analyzeSwarmBehavior();

    const html = `
      <div class="swarm-stats">
        <h5>📊 Collective Decision Summary</h5>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-label">Total Decisions</div>
            <div class="stat-value">${analysis.totalDecisions}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Scouts Exploring</div>
            <div class="stat-value">${analysis.scoutCount}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Workers Exploiting</div>
            <div class="stat-value">${analysis.workerCount}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Unique Targets</div>
            <div class="stat-value">${analysis.uniqueTargets}</div>
          </div>
        </div>
      </div>

      <div class="swarm-insights">
        <h5>💡 Swarm Intelligence Insights</h5>
        <div class="insights-list">
          ${analysis.insights.map(insight => `
            <div class="insight-item">
              <span class="insight-icon">${insight.icon}</span>
              <span class="insight-text">${insight.text}</span>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="target-distribution">
        <h5>🎯 Target Distribution</h5>
        <div class="targets-list">
          ${analysis.targetDistribution.map(target => `
            <div class="target-item">
              <div class="target-bar-container">
                <div class="target-bar" style="width: ${target.percentage}%"></div>
                <span class="target-label">${target.name}</span>
              </div>
              <span class="target-count">${target.count}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    container.innerHTML = html;
  }

  analyzeSwarmBehavior() {
    const scouts = this.antDecisions.filter(d => d.role === 'scout');
    const workers = this.antDecisions.filter(d => d.role === 'worker');

    // Count unique targets
    const targets = new Map();
    this.antDecisions.forEach(d => {
      const url = d.targetUrl || 'unknown';
      targets.set(url, (targets.get(url) || 0) + 1);
    });

    // Calculate target distribution
    const targetDistribution = Array.from(targets.entries())
      .map(([url, count]) => {
        let name = url;
        try {
          const parsed = new URL(url);
          name = parsed.pathname.split('/').filter(Boolean).join('/') || parsed.host;
        } catch (e) {
          // Use full URL
        }
        return {
          name,
          url,
          count,
          percentage: (count / this.antDecisions.length) * 100
        };
      })
      .sort((a, b) => b.count - a.count);

    // Generate insights
    const insights = [];

    const explorationRatio = scouts.length / (this.antDecisions.length || 1);
    if (explorationRatio > 0.3) {
      insights.push({
        icon: '🔍',
        text: 'High exploration activity - colony is searching for new food sources'
      });
    } else if (explorationRatio < 0.1) {
      insights.push({
        icon: '🎯',
        text: 'High exploitation activity - colony is focusing on known food sources'
      });
    } else {
      insights.push({
        icon: '⚖️',
        text: 'Balanced exploration/exploitation strategy'
      });
    }

    // Check for coordination
    if (targetDistribution.length > 0 && targetDistribution[0].count > this.antDecisions.length * 0.5) {
      insights.push({
        icon: '🤝',
        text: `Strong coordination - ${targetDistribution[0].count} ants targeting same resource`
      });
    }

    // Check for diversity
    if (targets.size >= this.antDecisions.length * 0.8) {
      insights.push({
        icon: '🌈',
        text: 'High diversity - ants spreading across many different targets'
      });
    }

    // Average energy consideration
    const avgEnergy = this.antDecisions.reduce((sum, d) => sum + (d.energy || 0), 0) / (this.antDecisions.length || 1);
    if (avgEnergy < 30) {
      insights.push({
        icon: '⚠️',
        text: 'Low average energy - colony prioritizing nearby/fast resources'
      });
    } else if (avgEnergy > 70) {
      insights.push({
        icon: '💪',
        text: 'High average energy - colony can afford long-distance exploration'
      });
    }

    return {
      totalDecisions: this.antDecisions.length,
      scoutCount: scouts.length,
      workerCount: workers.length,
      uniqueTargets: targets.size,
      targetDistribution,
      insights
    };
  }

  updatePromptsTab() {
    const promptCount = this.panel.querySelector('.prompt-count');
    if (promptCount) {
      const total = this.decisionHistory.length;
      promptCount.textContent = `${total} prompt${total !== 1 ? 's' : ''} sent`;
    }

    // System prompt
    const systemPromptEl = document.getElementById('system-prompt');
    if (systemPromptEl && this.currentPrompt?.system) {
      systemPromptEl.innerHTML = `<pre><code>${this.escapeHtml(this.currentPrompt.system)}</code></pre>`;
    }

    // User prompt
    const userPromptEl = document.getElementById('user-prompt');
    if (userPromptEl && this.currentPrompt?.user) {
      // Try to format as JSON for better readability
      let formatted = this.currentPrompt.user;
      try {
        const parsed = JSON.parse(this.currentPrompt.user);
        formatted = JSON.stringify(parsed, null, 2);
      } catch (e) {
        // Not JSON, use as-is
      }
      userPromptEl.innerHTML = `<pre><code>${this.escapeHtml(formatted)}</code></pre>`;
    }

    // LLM response
    const responseEl = document.getElementById('llm-response');
    if (responseEl && this.currentResponse) {
      // Try to format as JSON for better readability
      let formatted = this.currentResponse;
      try {
        const parsed = JSON.parse(this.currentResponse);
        formatted = JSON.stringify(parsed, null, 2);
      } catch (e) {
        // Not JSON, use as-is
      }
      responseEl.innerHTML = `<pre><code>${this.escapeHtml(formatted)}</code></pre>`;
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  clear() {
    this.currentPrompt = null;
    this.currentResponse = null;
    this.antDecisions = [];
    this.decisionHistory = [];

    // Reset UI
    const decisionsContainer = document.getElementById('ant-decisions-list');
    if (decisionsContainer) {
      decisionsContainer.innerHTML = '<div class="empty-state">No LLM decisions yet.</div>';
    }

    const swarmContainer = document.getElementById('swarm-analysis');
    if (swarmContainer) {
      swarmContainer.innerHTML = '<div class="empty-state">No swarm intelligence data yet.</div>';
    }
  }
}
