import { CONFIG } from './config.js';
import { Colony } from './colony.js';
import { Renderer } from './renderer.js';

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

  // Expose colony to console for debugging
  window.__colony = colony;

  const statusEl = document.getElementById('status');
  const setStatus = (msg) => {
    if (statusEl) statusEl.textContent = msg;
  };

  setStatus('Initialising colony...');
  await colony.init();
  setStatus(`Colony ready — ${colony.aliveCount} ants`);

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
        setStatus(`Colony reset — ${colony.aliveCount} ants`);
      });
    });
  }

  // ─── Start ─────────────────────────────────────────────────

  simLoop();
  renderLoop();
}

main().catch(console.error);
