/**
 * Icon Generator for Pega Browser Agent
 * Generates PNG icons at 16x16, 32x32, 48x48, and 128x128 sizes
 */

import { PNG } from 'pngjs';
import * as fs from 'fs';
import * as path from 'path';

const sizes = [16, 32, 48, 128];
const outputDir = path.join(process.cwd(), 'public', 'icons');

// Colors
const COLORS = {
  primary: { r: 0, g: 120, b: 212 },      // #0078d4
  secondary: { r: 16, g: 110, b: 190 },   // #106ebe
  white: { r: 255, g: 255, b: 255 },
  yellow: { r: 255, g: 185, b: 0 },       // #ffb900
  green: { r: 16, g: 124, b: 16 },        // #107c10
};

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function drawPixel(png, x, y, r, g, b, a = 255) {
  const idx = (png.width * y + x) << 2;
  png.data[idx] = r;
  png.data[idx + 1] = g;
  png.data[idx + 2] = b;
  png.data[idx + 3] = a;
}

function getPixel(png, x, y) {
  if (x < 0 || x >= png.width || y < 0 || y >= png.height) {
    return { r: 0, g: 0, b: 0, a: 0 };
  }
  const idx = (png.width * y + x) << 2;
  return {
    r: png.data[idx],
    g: png.data[idx + 1],
    b: png.data[idx + 2],
    a: png.data[idx + 3]
  };
}

function drawCircle(png, cx, cy, radius, color) {
  const r2 = radius * radius;
  for (let y = Math.max(0, Math.floor(cy - radius)); y <= Math.min(png.height - 1, Math.ceil(cy + radius)); y++) {
    for (let x = Math.max(0, Math.floor(cx - radius)); x <= Math.min(png.width - 1, Math.ceil(cx + radius)); x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r2) {
        drawPixel(png, x, y, color.r, color.g, color.b);
      }
    }
  }
}

function drawFilledCircle(png, cx, cy, radius, color) {
  drawCircle(png, cx, cy, radius, color);
}

function drawRect(png, x, y, w, h, color, radius = 0) {
  const x1 = Math.max(0, Math.floor(x));
  const y1 = Math.max(0, Math.floor(y));
  const x2 = Math.min(png.width - 1, Math.ceil(x + w - 1));
  const y2 = Math.min(png.height - 1, Math.ceil(y + h - 1));

  for (let py = y1; py <= y2; py++) {
    for (let px = x1; px <= x2; px++) {
      // Simple rounded corners
      if (radius > 0) {
        const corners = [
          { cx: x + radius, cy: y + radius },
          { cx: x + w - radius, cy: y + radius },
          { cx: x + radius, cy: y + h - radius },
          { cx: x + w - radius, cy: y + h - radius }
        ];

        let inCorner = false;
        for (const corner of corners) {
          const dx = px - corner.cx;
          const dy = py - corner.cy;
          if (dx >= 0 && dy >= 0 && dx * dx + dy * dy > radius * radius) {
            // Check if we're in a corner region that should be excluded
            if ((px >= x + w - radius && py >= y + h - radius) ||
                (px < x + radius && py >= y + h - radius) ||
                (px >= x + w - radius && py < y + radius) ||
                (px < x + radius && py < y + radius)) {
              // We might be in a corner, check distance
              const cornerX = px < x + radius ? x + radius : x + w - radius;
              const cornerY = py < y + radius ? y + radius : y + h - radius;
              const dist = Math.sqrt((px - cornerX) ** 2 + (py - cornerY) ** 2);
              if (dist > radius) {
                inCorner = true;
                break;
              }
            }
          }
        }
        if (inCorner) continue;
      }
      drawPixel(png, px, py, color.r, color.g, color.b);
    }
  }
}

function drawGradientCircle(png, cx, cy, radius) {
  for (let y = Math.max(0, Math.floor(cy - radius)); y <= Math.min(png.height - 1, Math.ceil(cy + radius)); y++) {
    for (let x = Math.max(0, Math.floor(cx - radius)); x <= Math.min(png.width - 1, Math.ceil(cx + radius)); x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= radius) {
        // Calculate gradient based on position
        const t = (x + y) / (png.width + png.height);
        const r = Math.round(lerp(COLORS.primary.r, COLORS.secondary.r, t));
        const g = Math.round(lerp(COLORS.primary.g, COLORS.secondary.g, t));
        const b = Math.round(lerp(COLORS.primary.b, COLORS.secondary.b, t));
        drawPixel(png, x, y, r, g, b);
      }
    }
  }
}

function drawIcon(size) {
  const png = new PNG({ width: size, height: size });
  const scale = size / 128;

  // Background gradient circle
  drawGradientCircle(png, size / 2, size / 2, size * 0.47);

  // Robot head (white rounded rect)
  drawRect(png, size * 0.25, size * 0.22, size * 0.5, size * 0.4, COLORS.white, size * 0.06);

  // Eyes (blue circles)
  drawFilledCircle(png, size * 0.375, size * 0.40, size * 0.062, COLORS.primary);
  drawFilledCircle(png, size * 0.625, size * 0.40, size * 0.062, COLORS.primary);

  // Pupils (white dots)
  drawFilledCircle(png, size * 0.375, size * 0.40, size * 0.025, COLORS.white);
  drawFilledCircle(png, size * 0.625, size * 0.40, size * 0.025, COLORS.white);

  // Mouth (blue rect)
  drawRect(png, size * 0.34, size * 0.53, size * 0.32, size * 0.04, COLORS.primary, size * 0.02);

  // Antenna (white rect + yellow circle)
  drawRect(png, size * 0.47, size * 0.12, size * 0.06, size * 0.12, COLORS.white, size * 0.02);
  drawFilledCircle(png, size * 0.5, size * 0.11, size * 0.047, COLORS.yellow);

  // Body indicator (white rect + green circle)
  drawRect(png, size * 0.375, size * 0.66, size * 0.25, size * 0.16, COLORS.white, size * 0.03);
  drawFilledCircle(png, size * 0.5, size * 0.735, size * 0.047, COLORS.green);

  return png;
}

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Generate icons
console.log('Generating Pega Browser Agent icons...\n');

for (const size of sizes) {
  console.log(`  Creating icon${size}.png (${size}x${size})...`);
  const png = drawIcon(size);
  const buffer = PNG.sync.write(png);
  const outputPath = path.join(outputDir, `icon${size}.png`);
  fs.writeFileSync(outputPath, buffer);
  console.log(`  ✓ Saved to ${outputPath}`);
}

console.log('\n✅ All icons generated successfully!');
console.log(`   Output directory: ${outputDir}`);
