import { CONFIG } from './config.js';
import { Colony } from './colony.js';
import { Renderer } from './renderer.js';
import { LLMManager } from './llm/llm-manager.js';
import { SettingsPanel } from './ui/settings-panel.js';
import { LLMVisualizationPanel } from './ui/llm-visualization-panel.js';

/**
 * Application entry point for the stigmergic network topology simulation.
 *
 * Initialises the colony, starts the simulation loop (network-paced)
 * and the render loop (force-directed graph visualization).
 */
async function main() {
  const canvas = document.getElementById('simulation');
  if (!canvas) {
    console.error('Canvas element #simulation not found');
    return;
  }

  const colony = new Colony();
  const renderer = new Renderer(canvas);
  const llmManager = new LLMManager();
  const settingsPanel = new SettingsPanel(llmManager);
  const llmVizPanel = new LLMVisualizationPanel();

  // Expose to console for debugging
  window.__colony = colony;
  window.__llmManager = llmManager;
  window.__llmVizPanel = llmVizPanel;

  const statusEl = document.getElementById('status');
  const setStatus = (msg) => {
    if (statusEl) statusEl.textContent = msg;
  };

  setStatus('Initialising colony...');
  await colony.init();

  // Try to restore last LLM provider
  const restored = await llmManager.restoreLastProvider();
  if (restored) {
    colony.setLLMManager(llmManager);
    // Set up visualization callback
    if (colony.llmOrchestrator) {
      colony.llmOrchestrator.setVisualizationCallback((data) => {
        llmVizPanel.updateVisualization(data);
      });
    }
    console.log('LLM provider restored:', llmManager.getActiveProvider().getName());
    setStatus(`Colony ready — ${colony.aliveCount} ants (LLM Mode: ${llmManager.getActiveProvider().getName()})`);
  } else {
    setStatus(`Colony ready — ${colony.aliveCount} ants (Traditional Mode)`);
  }

  // ─── Simulation loop (network-paced) ───────────────────────

  let running = true;

  async function simLoop() {
    if (!running) return;
    try {
      await colony.tick();
    } catch (err) {
      console.error('Simulation error:', err);
    }
    setTimeout(simLoop, CONFIG.TICK_INTERVAL_MS);
  }

  // ─── Render loop (requestAnimationFrame) ───────────────────

  function renderLoop() {
    if (!running) return;
    renderer.draw(colony);
    requestAnimationFrame(renderLoop);
  }

  // ─── Controls ─────────────────────────────────────────────

  const pauseBtn = document.getElementById('btn-pause');
  if (pauseBtn) {
    pauseBtn.addEventListener('click', () => {
      running = !running;
      pauseBtn.textContent = running ? 'Pause' : 'Resume';
      if (running) {
        simLoop();
        renderLoop();
      }
      setStatus(running ? 'Running' : 'Paused');
    });
  }

  const resetBtn = document.getElementById('btn-reset');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      colony.reset();
      colony.init().then(() => {
        const mode = colony.isLLMEnabled()
          ? `LLM Mode: ${llmManager.getActiveProvider().getName()}`
          : 'Traditional Mode';
        setStatus(`Colony reset — ${colony.aliveCount} ants (${mode})`);
      });
    });
  }

  const settingsBtn = document.getElementById('btn-settings');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
      settingsPanel.open();
    });
  }

  const llmVizBtn = document.getElementById('btn-llm-viz');
  if (llmVizBtn) {
    llmVizBtn.addEventListener('click', () => {
      if (!colony.isLLMEnabled()) {
        alert('Please enable LLM mode in settings first to see LLM visualization.');
        return;
      }
      llmVizPanel.toggle();
    });
  }

  // Handle mode changes from settings panel
  settingsPanel.onModeChangeCallback = (mode, providerId) => {
    if (mode === 'llm') {
      if (llmManager.hasActiveProvider()) {
        colony.setLLMManager(llmManager);
        // Set up visualization callback
        if (colony.llmOrchestrator) {
          colony.llmOrchestrator.setVisualizationCallback((data) => {
            llmVizPanel.updateVisualization(data);
          });
        }
        const providerName = llmManager.getActiveProvider().getName();
        setStatus(`LLM Mode activated: ${providerName}`);
        console.log('LLM mode activated with provider:', providerName);
      } else {
        console.log('LLM mode selected but no provider configured yet');
      }
    } else {
      colony.llmMode = false;
      llmVizPanel.clear(); // Clear visualization when switching to traditional mode
      setStatus('Traditional mode activated');
      console.log('Traditional mode activated');
    }
  };

  // ─── Start ─────────────────────────────────────────────────

  simLoop();
  renderLoop();
}

main().catch(console.error);
