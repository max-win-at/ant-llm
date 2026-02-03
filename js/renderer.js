import { CONFIG } from './config.js';

/**
 * Canvas-based renderer for the ant colony simulation.
 *
 * Draws:
 *  - The nest
 *  - Food and danger sources
 *  - Pheromone trails (heat map)
 *  - Individual ants (colour-coded by role/state)
 *  - HUD with colony statistics
 */
export class Renderer {
  /**
   * @param {HTMLCanvasElement} canvas
   */
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    canvas.width = CONFIG.CANVAS_WIDTH;
    canvas.height = CONFIG.CANVAS_HEIGHT;
  }

  /**
   * Render one frame.
   * @param {import('./colony.js').Colony} colony
   */
  draw(colony) {
    const ctx = this.ctx;
    const w = CONFIG.CANVAS_WIDTH;
    const h = CONFIG.CANVAS_HEIGHT;

    // Clear
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, w, h);

    // Pheromone heat map
    this._drawPheromones(colony.pheromones);

    // Environment sources
    this._drawSources(colony.environment.sources);

    // Nest
    this._drawNest();

    // Ants
    for (const ant of colony.ants) {
      if (ant.state === 'dead') continue;
      this._drawAnt(ant);
    }

    // HUD
    this._drawHUD(colony);
  }

  _drawPheromones(pheromoneMap) {
    const ctx = this.ctx;
    const size = CONFIG.PHEROMONE_GRID_CELL_SIZE;

    for (const [key, value] of pheromoneMap.gridCache) {
      const [col, row] = key.split('_').map(Number);
      const alpha = Math.min(value / CONFIG.PHEROMONE_MAX, 1) * 0.5;
      if (alpha < 0.02) continue;
      ctx.fillStyle = `rgba(0, 255, 100, ${alpha})`;
      ctx.fillRect(col * size, row * size, size, size);
    }
  }

  _drawSources(sources) {
    const ctx = this.ctx;
    for (const src of sources) {
      if (src.kind === 'food') {
        ctx.fillStyle = '#4ade80';
        ctx.strokeStyle = '#22c55e';
      } else {
        ctx.fillStyle = '#f87171';
        ctx.strokeStyle = '#ef4444';
      }

      ctx.beginPath();
      ctx.arc(src.x, src.y, src.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.stroke();

      // Label
      ctx.fillStyle = '#fff';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(src.name, src.x, src.y + src.radius + 12);
    }
  }

  _drawNest() {
    const ctx = this.ctx;
    ctx.fillStyle = '#c084fc';
    ctx.strokeStyle = '#a855f7';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(CONFIG.NEST_X, CONFIG.NEST_Y, CONFIG.NEST_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('NEST', CONFIG.NEST_X, CONFIG.NEST_Y);
  }

  _drawAnt(ant) {
    const ctx = this.ctx;
    const size = 4;

    // Colour by state
    switch (ant.state) {
      case 'returning':
        ctx.fillStyle = '#facc15'; // yellow — carrying food
        break;
      case 'foraging':
        ctx.fillStyle = '#60a5fa'; // blue — at a source
        break;
      default:
        ctx.fillStyle = ant.role === 'scout' ? '#f472b6' : '#e2e8f0'; // pink scouts, white workers
    }

    ctx.save();
    ctx.translate(ant.x, ant.y);
    ctx.rotate(ant.heading);

    // Simple triangle shape
    ctx.beginPath();
    ctx.moveTo(size, 0);
    ctx.lineTo(-size, -size * 0.6);
    ctx.lineTo(-size, size * 0.6);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  _drawHUD(colony) {
    const ctx = this.ctx;
    const lines = [
      `Ants: ${colony.aliveCount}`,
      `Food: ${colony.foodCount}`,
      `Tick: ${colony.tickCount}`,
      `Births: ${colony.stats.totalBirths}`,
      `Deaths: ${colony.stats.totalDeaths}`,
      `Delivered: ${colony.stats.totalFood}`,
    ];

    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(5, 5, 150, lines.length * 18 + 10);

    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    lines.forEach((line, i) => {
      ctx.fillText(line, 12, 12 + i * 18);
    });
  }
}
