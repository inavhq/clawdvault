const sharp = require('sharp');
const path = require('path');

// Use Twemoji lobster as source (72x72 but scales well)
const sourceImage = path.join(__dirname, '../public/lobster-emoji.png');

const sizes = [
  { name: 'favicon-16.png', size: 16 },
  { name: 'favicon-32.png', size: 32 },
  { name: 'favicon-48.png', size: 48 },
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'android-chrome-192x192.png', size: 192 },
  { name: 'android-chrome-512x512.png', size: 512 },
];

async function generate() {
  for (const { name, size } of sizes) {
    await sharp(sourceImage)
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(path.join(__dirname, '../public', name));
    console.log(`Generated ${name} (${size}x${size})`);
  }
}

generate().catch(console.error);
