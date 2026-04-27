// Run this once: node generate-icons.js
// Requires: npm install sharp
// Then place all output files in src/icons/

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const inputSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="100" fill="#1D9E75"/>
  <text x="256" y="180" text-anchor="middle" font-size="80" font-family="Arial Black,sans-serif" fill="white" font-weight="900">COED</text>
  <text x="256" y="310" text-anchor="middle" font-size="130" font-family="Arial,sans-serif">⚽</text>
  <text x="256" y="400" text-anchor="middle" font-size="58" font-family="Arial Black,sans-serif" fill="white" font-weight="900">2026</text>
</svg>`;

const outDir = path.join(__dirname, 'src', 'icons');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const input = Buffer.from(inputSvg);

Promise.all(
  sizes.map(size =>
    sharp(input)
      .resize(size, size)
      .png()
      .toFile(path.join(outDir, `icon-${size}.png`))
      .then(() => console.log(`✅ icon-${size}.png`))
  )
).then(() => console.log('\n✅ All icons generated in src/icons/'));
