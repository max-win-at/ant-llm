/**
 * LLM Orchestrator
 * Manages the prompt construction and decision parsing for ant colony simulation
 * Makes a single LLM call to control all ants simultaneously
 */

export class LLMOrchestrator {
  constructor(llmManager, colony) {
    this.llmManager = llmManager;
    this.colony = colony;
    this.decisionHistory = [];
    this.maxHistoryLength = 5; // Keep last 5 decisions for context
    this.visualizationCallback = null; // Callback for visualization updates
  }

  /**
   * Set callback for visualization updates
   * @param {Function} callback - Called with visualization data on each LLM call
   */
  setVisualizationCallback(callback) {
    this.visualizationCallback = callback;
  }

  /**
   * Generate the system prompt that instructs the LLM how to behave
   * @returns {string}
   */
  _generateSystemPrompt() {
    return `You are the collective intelligence of an ant colony navigating a network of REST API endpoints. Your role is to make foraging decisions for all ants simultaneously.

SIMULATION CONTEXT:
- Ants exist in a network topology where URLs are locations, not physical 2D space
- Movement = HTTP fetch request (costs energy based on RTT)
- Food = JSON data from successful API calls
- Pheromones = stigmergic signals (positive attracts, negative repels)
- Energy = survival metric (gains on food, decays over time)

ANT ROLES:
1. SCOUT ants (20%): Explore novel/low-pheromone URLs to discover new resources
2. WORKER ants (80%): Exploit high-pheromone trails to known food sources

DECISION RULES:
- Scouts should prefer unexplored or low-pheromone targets (novelty-seeking)
- Workers should prefer high-pheromone targets (exploitation)
- Both should avoid negative pheromone trails (danger signals from HTTP errors)
- Low energy ants should prioritize nearby/fast endpoints
- High energy ants can explore distant/slow endpoints

PHEROMONE INTERPRETATION:
- Positive (0 to +10): Successful foraging trail, stronger = more proven
- Negative (-10 to 0): Danger signal (HTTP errors, timeouts)
- Zero/Absent: Unexplored territory

ENERGY CONSIDERATIONS:
- Each fetch costs energy proportional to RTT
- Ants die at energy ≤ 0
- Food restores +30 energy
- Energy decays by 0.15 per tick

YOUR TASK:
For each ant provided, select a target food URL that aligns with its role, energy level, and the colony's pheromone memory. Return decisions as JSON.

OUTPUT FORMAT (strict JSON only, no markdown):
{
  "decisions": [
    {
      "antId": "ant-uuid",
      "targetUrl": "https://api.example.com/food",
      "reasoning": "Brief explanation (1 sentence)"
    }
  ]
}

IMPORTANT:
- Return ONLY valid JSON, no additional text or markdown
- Include a decision for EVERY ant provided
- Reasoning should be concise (max 100 chars)
- Think like an ant colony: balance exploration and exploitation`;
  }

  /**
   * Build the state snapshot for the user prompt
   * @param {Array} idleAnts - Ants ready for target selection
   * @returns {Object}
   */
  _buildStateSnapshot(idleAnts) {
    const snapshot = {
      colonyStats: {
        totalAnts: this.colony.ants.length,
        foodStored: this.colony.food.length,
        tickCount: this.colony.tick || 0
      },
      ants: [],
      foodSources: [],
      topPheromoneTrails: []
    };

    // Compile ant states
    for (const ant of idleAnts) {
      snapshot.ants.push({
        id: ant.id,
        role: ant.role,
        energy: Math.round(ant.energy),
        ticksAlive: ant.ticksAlive || 0,
        recentlyVisited: ant.visitedUrls ? ant.visitedUrls.slice(-3) : []
      });
    }

    // Compile food source information with pheromone data
    for (const node of this.colony.topology.nodes) {
      if (node.kind !== 'food') continue;

      const pheromone = this.colony.pheromones.get(node.url);
      const intensity = pheromone ? pheromone.effectiveIntensity() : 0;
      const avgRTT = pheromone ? pheromone.avgRTT : null;

      snapshot.foodSources.push({
        url: node.url,
        name: node.name,
        type: node.type, // sugar or protein
        pheromoneIntensity: Math.round(intensity * 100) / 100,
        averageRTT: avgRTT ? Math.round(avgRTT) : null,
        visits: pheromone ? pheromone.visits : 0
      });
    }

    // Sort food sources by pheromone intensity for quick reference
    snapshot.foodSources.sort((a, b) => b.pheromoneIntensity - a.pheromoneIntensity);

    // Get top pheromone trails (for context)
    snapshot.topPheromoneTrails = snapshot.foodSources
      .slice(0, 5)
      .map(fs => ({
        url: fs.url,
        intensity: fs.pheromoneIntensity
      }));

    return snapshot;
  }

  /**
   * Format the user prompt with current state
   * @param {Object} snapshot - State snapshot
   * @returns {string}
   */
  _formatUserPrompt(snapshot) {
    let prompt = `COLONY STATE (Tick ${snapshot.colonyStats.tickCount}):\n`;
    prompt += `- Total Ants: ${snapshot.colonyStats.totalAnts}\n`;
    prompt += `- Food Stored: ${snapshot.colonyStats.foodStored}\n\n`;

    prompt += `ANTS AWAITING ORDERS (${snapshot.ants.length}):\n`;
    for (const ant of snapshot.ants) {
      prompt += `- ${ant.id}: ${ant.role.toUpperCase()}, Energy=${ant.energy}, Age=${ant.ticksAlive}\n`;
      if (ant.recentlyVisited.length > 0) {
        prompt += `  Recently visited: ${ant.recentlyVisited.join(', ')}\n`;
      }
    }

    prompt += `\nFOOD SOURCES:\n`;
    for (const fs of snapshot.foodSources) {
      const pheromoneDesc = fs.pheromoneIntensity > 0.5
        ? `STRONG trail (+${fs.pheromoneIntensity})`
        : fs.pheromoneIntensity < -0.5
        ? `DANGER (${fs.pheromoneIntensity})`
        : fs.pheromoneIntensity > 0
        ? `weak trail (+${fs.pheromoneIntensity})`
        : 'UNEXPLORED';

      const rttDesc = fs.averageRTT ? `~${fs.averageRTT}ms RTT` : 'unknown RTT';

      prompt += `- ${fs.name} (${fs.type})\n`;
      prompt += `  URL: ${fs.url}\n`;
      prompt += `  Pheromone: ${pheromoneDesc}, ${rttDesc}, ${fs.visits} visits\n`;
    }

    if (this.decisionHistory.length > 0) {
      prompt += `\nRECENT DECISIONS (for learning):\n`;
      const recentHistory = this.decisionHistory.slice(-3);
      for (const decision of recentHistory) {
        prompt += `- ${decision.antRole} ant → ${decision.targetName}: ${decision.outcome}\n`;
      }
    }

    prompt += `\nProvide target URL selections for all ${snapshot.ants.length} ants in JSON format.`;

    return prompt;
  }

  /**
   * Parse LLM response and extract decisions
   * @param {string} response - Raw LLM response
   * @param {Array} idleAnts - Original ants array for validation
   * @returns {Map<string, Object>} Map of antId -> decision
   */
  _parseDecisions(response, idleAnts) {
    const decisions = new Map();

    try {
      // Try to extract JSON from response (handle markdown code blocks)
      let jsonText = response.trim();

      // Remove markdown code blocks if present
      if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
      }

      const parsed = JSON.parse(jsonText);

      if (!parsed.decisions || !Array.isArray(parsed.decisions)) {
        throw new Error('Invalid response format: missing decisions array');
      }

      // Validate and map decisions
      for (const decision of parsed.decisions) {
        if (!decision.antId || !decision.targetUrl) {
          console.warn('Skipping invalid decision:', decision);
          continue;
        }

        // Verify ant exists
        const ant = idleAnts.find(a => a.id === decision.antId);
        if (!ant) {
          console.warn(`Decision for unknown ant ${decision.antId}, skipping`);
          continue;
        }

        // Verify target URL is valid
        const validUrls = this.colony.topology.nodes
          .filter(n => n.kind === 'food')
          .map(n => n.url);

        if (!validUrls.includes(decision.targetUrl)) {
          console.warn(`Invalid target URL ${decision.targetUrl}, skipping`);
          continue;
        }

        decisions.set(decision.antId, {
          targetUrl: decision.targetUrl,
          reasoning: decision.reasoning || 'No reasoning provided'
        });
      }

      return decisions;

    } catch (error) {
      console.error('Failed to parse LLM decisions:', error);
      console.error('Raw response:', response);
      return new Map(); // Return empty decisions on parse failure
    }
  }

  /**
   * Record a decision outcome for learning
   * @param {Object} decision
   */
  recordOutcome(decision) {
    this.decisionHistory.push({
      antRole: decision.antRole,
      targetName: decision.targetName,
      outcome: decision.outcome,
      timestamp: Date.now()
    });

    // Trim history
    if (this.decisionHistory.length > this.maxHistoryLength) {
      this.decisionHistory.shift();
    }
  }

  /**
   * Main method: Get LLM decisions for all idle ants
   * @param {Array} idleAnts - Ants ready for target selection
   * @returns {Promise<Map<string, Object>>} Map of antId -> decision
   */
  async getDecisions(idleAnts) {
    if (idleAnts.length === 0) {
      return new Map();
    }

    if (!this.llmManager.hasActiveProvider()) {
      throw new Error('No active LLM provider configured');
    }

    try {
      // Build state snapshot
      const snapshot = this._buildStateSnapshot(idleAnts);

      // Generate prompts
      const systemPrompt = this._generateSystemPrompt();
      const userPrompt = this._formatUserPrompt(snapshot);

      // Call LLM
      const response = await this.llmManager.complete({
        systemPrompt: systemPrompt,
        userPrompt: userPrompt,
        maxTokens: 2000,
        temperature: 0.7 // Some creativity, but not too random
      });

      // Parse decisions
      const decisions = this._parseDecisions(response, idleAnts);

      console.log(`LLM provided ${decisions.size} decisions for ${idleAnts.length} ants`);

      // Send visualization data if callback is set
      if (this.visualizationCallback) {
        console.log('[LLM Orchestrator] Emitting visualization data to callback');
        this._emitVisualizationData(
          systemPrompt,
          userPrompt,
          response,
          decisions,
          idleAnts,
          snapshot
        );
      } else {
        console.log('[LLM Orchestrator] No visualization callback set');
      }

      return decisions;

    } catch (error) {
      console.error('LLM decision-making failed:', error);
      throw error;
    }
  }

  /**
   * Emit visualization data to registered callback
   * @private
   */
  _emitVisualizationData(systemPrompt, userPrompt, response, decisions, idleAnts, snapshot) {
    try {
      // Build enriched decision data
      const enrichedDecisions = idleAnts.map(ant => {
        const decision = decisions.get(ant.id);
        return {
          antId: ant.id,
          role: ant.role,
          energy: ant.energy,
          ticksAlive: ant.ticksAlive || 0,
          targetUrl: decision ? decision.targetUrl : null,
          reasoning: decision ? decision.reasoning : 'No decision made'
        };
      });

      const visualizationData = {
        systemPrompt,
        userPrompt,
        response,
        decisions: enrichedDecisions,
        colonyState: snapshot.colonyStats,
        foodSources: snapshot.foodSources,
        timestamp: Date.now()
      };

      console.log('[LLM Orchestrator] Calling visualization callback with data:', {
        decisionsCount: enrichedDecisions.length,
        hasPrompts: !!systemPrompt && !!userPrompt,
        hasResponse: !!response
      });

      this.visualizationCallback(visualizationData);
    } catch (error) {
      console.error('Failed to emit visualization data:', error);
    }
  }
}
