import { GamaGameRuntime } from './runtime';

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Renders the exact current visual frame of a GamaGameRuntime into a crisp,
 * zero-dependency SVG string so headless AI agents can inspect layouts,
 * overlaps, trajectories, and HUD clarity visually without a browser.
 */
export function renderRuntimeToSvg(runtime: GamaGameRuntime): string {
  const { width, height, title } = runtime.spec;
  const lines: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">`,
    `<rect width="100%" height="100%" fill="#060911"/>`,
  ];

  // Subtle cyber grid
  for (let x = 50; x < width; x += 50) {
    lines.push(`<line x1="${x}" y1="0" x2="${x}" y2="${height}" stroke="#162033" stroke-width="1"/>`);
  }
  for (let y = 50; y < height; y += 50) {
    lines.push(`<line x1="0" y1="${y}" x2="${width}" y2="${y}" stroke="#162033" stroke-width="1"/>`);
  }

  // Render entities
  for (const ent of runtime.entities.values()) {
    const b = ent.body;
    const fill = ent.alive ? b.color : '#475569';
    const opacity = ent.alive ? '0.92' : '0.35';
    const deg = ((b.angle * 180) / Math.PI).toFixed(1);

    if (b.type === 'circle') {
      lines.push(
        `<circle cx="${b.position.x.toFixed(1)}" cy="${b.position.y.toFixed(1)}" r="${b.radius}" fill="${fill}" fill-opacity="${opacity}" stroke="#ffffff" stroke-opacity="0.35" stroke-width="1.5"/>`
      );
    } else {
      const x = (b.position.x - b.width / 2).toFixed(1);
      const y = (b.position.y - b.height / 2).toFixed(1);
      lines.push(
        `<rect x="${x}" y="${y}" width="${b.width}" height="${b.height}" rx="4" fill="${fill}" fill-opacity="${opacity}" stroke="#ffffff" stroke-opacity="0.3" stroke-width="1.5" transform="rotate(${deg} ${b.position.x.toFixed(1)} ${b.position.y.toFixed(1)})"/>`
      );
    }

    // Label ID for AI visual debugging
    lines.push(
      `<text x="${b.position.x.toFixed(1)}" y="${(b.position.y + 4).toFixed(1)}" fill="#f8fafc" font-family="monospace" font-size="10" text-anchor="middle">${escapeXml(ent.id)}</text>`
    );
  }

  // HUD bar
  lines.push(
    `<rect x="12" y="12" width="${Math.min(460, width - 24)}" height="34" rx="8" fill="#0f1624" fill-opacity="0.88" stroke="#21304a"/>`,
    `<text x="24" y="34" fill="#00e5c4" font-family="monospace" font-size="13" font-weight="bold">${escapeXml(title)} | Frame ${runtime.frame} | Score ${runtime.score} | ${runtime.phase.toUpperCase()}</text>`
  );

  lines.push('</svg>');
  return lines.join('\n');
}
