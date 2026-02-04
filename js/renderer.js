import { CONFIG } from './config.js';

/**
 * Renders the stigmergic network topology as a force-directed graph.
 *
 * Although the simulation operates logically in URL-space, the human
 * observer needs a visual representation. Instead of ants on a meadow
 * we see a dynamic network diagram (Netzwerk-Bau):
 *
 *   - Nodes = URL endpoints, pulsing on each fetch
 *   - Edge thickness = pheromone concentration (collective preference)
 *   - Distance from center (Nest) = average RTT (latency)
 *   - Ants appear as particles traveling along edges
 */
export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    canvas.width = CONFIG.VIS_WIDTH;
    canvas.height = CONFIG.VIS_HEIGHT;
    this.centerX = CONFIG.VIS_WIDTH / 2;
    this.centerY = CONFIG.VIS_HEIGHT / 2;
    this.pulsingNodes = new Map(); // url → timestamp of last pulse
    this.nodePositions = new Map(); // url → { x, y }
  }

  /**
   * Render one frame of the network topology visualization.
   */
  draw(colony) {
    const ctx = this.ctx;
    const w = CONFIG.VIS_WIDTH;
    const h = CONFIG.VIS_HEIGHT;

    // Clear
    ctx.fillStyle = '#0f0f1a';
    ctx.fillRect(0, 0, w, h);

    // Compute node positions based on RTT (distance from nest)
    this._computeNodePositions(colony);

    // Draw edges (network connections from nest to nodes)
    this._drawEdges(colony);

    // Draw nest at center
    this._drawNest();

    // Draw URL nodes
    this._drawNodes(colony);

    // Draw ants as particles on edges
    this._drawAnts(colony);

    // Draw HUD
    this._drawHUD(colony);

    // Draw activity feed
    this._drawActivityFeed(colony);
  }

  /**
   * Compute node positions in a radial layout.
   * Distance from center is proportional to average RTT (latency = terrain distance).
   */
  _computeNodePositions(colony) {
    const allNodes = colony.topology.nodes;
    const angleStep = (Math.PI * 2) / allNodes.length;

    allNodes.forEach((node, i) => {
      const entry = colony.pheromones.getEntry(node.url);
      const avgRTT = entry ? entry.avgRTT : 500;

      // Distance from center proportional to RTT
      const distance = Math.min(
        avgRTT * CONFIG.VIS_RTT_SCALE_FACTOR + 80,
        Math.min(this.centerX, this.centerY) - 60
      );
      const angle = angleStep * i - Math.PI / 2;

      this.nodePositions.set(node.url, {
        x: this.centerX + Math.cos(angle) * distance,
        y: this.centerY + Math.sin(angle) * distance,
      });
    });
  }

  /**
   * Draw edges from nest to each node.
   * Thickness represents pheromone concentration (collective preference).
   * Color: green for positive pheromone, red for repellent.
   */
  _drawEdges(colony) {
    const ctx = this.ctx;

    for (const node of colony.topology.nodes) {
      const pos = this.nodePositions.get(node.url);
      if (!pos) continue;

      const intensity = colony.pheromones.getEffectiveIntensity(node.url);
      const absIntensity = Math.abs(intensity);

      const width = Math.max(
        1,
        Math.min(absIntensity * 2, CONFIG.VIS_EDGE_MAX_WIDTH)
      );
      const alpha = Math.min(0.8, absIntensity * 0.3 + 0.1);

      if (intensity < 0) {
        ctx.strokeStyle = `rgba(248, 113, 113, ${alpha})`;
      } else {
        ctx.strokeStyle = `rgba(74, 222, 128, ${alpha})`;
      }

      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(this.centerX, this.centerY);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    }
  }

  /**
   * Draw the nest node at the center of the graph.
   */
  _drawNest() {
    const ctx = this.ctx;
    const cx = this.centerX;
    const cy = this.centerY;
    const r = CONFIG.VIS_NEST_RADIUS;

    // Glow
    const gradient = ctx.createRadialGradient(cx, cy, r * 0.3, cx, cy, r * 1.5);
    gradient.addColorStop(0, 'rgba(192, 132, 252, 0.4)');
    gradient.addColorStop(1, 'rgba(192, 132, 252, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Core
    ctx.fillStyle = '#c084fc';
    ctx.strokeStyle = '#a855f7';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('NEST', cx, cy);
  }

  /**
   * Draw URL nodes. Each node pulses when a fetch targets it.
   */
  _drawNodes(colony) {
    const ctx = this.ctx;
    const now = Date.now();

    for (const node of colony.topology.nodes) {
      const pos = this.nodePositions.get(node.url);
      if (!pos) continue;

      const entry = colony.pheromones.getEntry(node.url);
      const intensity = colony.pheromones.getEffectiveIntensity(node.url);
      const baseR = CONFIG.VIS_NODE_BASE_RADIUS;

      // Pulse effect when recently fetched
      let pulseScale = 1;
      const lastPulse = this.pulsingNodes.get(node.url);
      if (lastPulse) {
        const elapsed = now - lastPulse;
        if (elapsed < CONFIG.VIS_PULSE_DURATION_MS) {
          pulseScale = 1 + 0.5 * (1 - elapsed / CONFIG.VIS_PULSE_DURATION_MS);
        } else {
          this.pulsingNodes.delete(node.url);
        }
      }

      // Trigger pulse from recent activity
      const recentActivity = colony.activityLog.find(
        (a) => a.url.startsWith(node.url) && now - a.timestamp < 1500
      );
      if (recentActivity && !lastPulse) {
        this.pulsingNodes.set(node.url, now);
        pulseScale = 1.5;
      }

      const r = baseR * pulseScale;

      // Node color based on kind and pheromone state
      let fillColor;
      let strokeColor;
      if (node.kind === 'danger') {
        fillColor = intensity < -1 ? '#991b1b' : '#f87171';
        strokeColor = '#ef4444';
      } else {
        const brightness = Math.min(1, Math.max(0.3, intensity * 0.3 + 0.5));
        fillColor = `rgba(74, 222, 128, ${brightness})`;
        strokeColor = '#22c55e';
      }

      // Glow for high-pheromone nodes
      if (Math.abs(intensity) > 2) {
        const glowColor =
          node.kind === 'danger' ? '248, 113, 113' : '74, 222, 128';
        const glowGradient = ctx.createRadialGradient(
          pos.x, pos.y, r * 0.5,
          pos.x, pos.y, r * 2
        );
        glowGradient.addColorStop(0, `rgba(${glowColor}, 0.3)`);
        glowGradient.addColorStop(1, `rgba(${glowColor}, 0)`);
        ctx.fillStyle = glowGradient;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, r * 2, 0, Math.PI * 2);
        ctx.fill();
      }

      // Node circle
      ctx.fillStyle = fillColor;
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Name label
      ctx.fillStyle = '#e2e8f0';
      ctx.font = '11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(node.name, pos.x, pos.y + r + 14);

      // RTT label
      if (entry && entry.avgRTT < Infinity) {
        ctx.fillStyle = '#94a3b8';
        ctx.font = '9px monospace';
        ctx.fillText(`${Math.round(entry.avgRTT)}ms`, pos.x, pos.y + r + 26);
      }
    }
  }

  /**
   * Draw ants as particles traveling along edges.
   * Fetching ants move outward from nest to target node.
   * Returning ants move inward from node to nest.
   */
  _drawAnts(colony) {
    const ctx = this.ctx;
    const now = Date.now();

    for (const ant of colony.ants) {
      if (ant.state === 'dead') continue;

      if (ant.state === 'fetching' && ant.currentUrl) {
        const pos = this.nodePositions.get(ant.currentUrl);
        if (!pos) continue;

        // Animate outward along edge
        const progress = (now % 2000) / 2000;
        const ax = this.centerX + (pos.x - this.centerX) * progress;
        const ay = this.centerY + (pos.y - this.centerY) * progress;

        ctx.fillStyle = ant.role === 'scout' ? '#f472b6' : '#e2e8f0';
        ctx.beginPath();
        ctx.arc(ax, ay, 3, 0, Math.PI * 2);
        ctx.fill();
      } else if (ant.state === 'returning' && ant.currentUrl) {
        const pos = this.nodePositions.get(ant.currentUrl);
        if (!pos) continue;

        // Animate inward toward nest (carrying food)
        const progress = (now % 1500) / 1500;
        const ax = pos.x + (this.centerX - pos.x) * progress;
        const ay = pos.y + (this.centerY - pos.y) * progress;

        ctx.fillStyle = '#facc15';
        ctx.beginPath();
        ctx.arc(ax, ay, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      // Idle ants reside at the nest — represented by the nest glow
    }
  }

  /**
   * Draw the heads-up display with colony statistics.
   */
  _drawHUD(colony) {
    const ctx = this.ctx;
    const lines = [
      `Ants: ${colony.aliveCount}`,
      `Fetching: ${colony.fetchingCount}`,
      `Food: ${colony.foodCount}`,
      `Tick: ${colony.tickCount}`,
      `Births: ${colony.stats.totalBirths}`,
      `Deaths: ${colony.stats.totalDeaths}`,
      `Delivered: ${colony.stats.totalFood}`,
    ];

    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    const boxW = 170;
    const boxH = lines.length * 20 + 16;
    ctx.fillRect(8, 8, boxW, boxH);

    ctx.fillStyle = '#e2e8f0';
    ctx.font = '13px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    lines.forEach((line, i) => {
      ctx.fillText(line, 16, 16 + i * 20);
    });
  }

  /**
   * Draw the live activity feed showing recent fetch results.
   */
  _drawActivityFeed(colony) {
    const ctx = this.ctx;
    const feed = colony.activityLog.slice(-8).reverse();
    if (feed.length === 0) return;

    const x = CONFIG.VIS_WIDTH - 320;
    const y = 8;
    const lineH = 16;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(x - 8, y, 320, feed.length * lineH + 16);

    ctx.font = '10px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    feed.forEach((entry, i) => {
      let host;
      try {
        host = new URL(entry.url).hostname;
      } catch {
        host = entry.url;
      }
      const status = entry.success ? '200' : String(entry.status || 'ERR');
      const rtt = Math.round(entry.rtt);

      ctx.fillStyle = entry.success ? '#4ade80' : '#f87171';
      ctx.fillText(`${status} ${host} ${rtt}ms`, x, y + 8 + i * lineH);
    });
  }
}
