// Generate apple-touch-icon + favicon từ logo.png — chỉ phần hexagon (bỏ chữ HANSUNGBOLT VINA)
// Chạy: node scripts/generate-icons.js
const sharp = require('sharp');
const path = require('path');

const SRC = path.join(__dirname, '..', 'public', 'logo.png');
const APPLE_OUT = path.join(__dirname, '..', 'app', 'apple-icon.png');
const ICON_OUT = path.join(__dirname, '..', 'app', 'icon.png');

// Logo gốc 1777x615. Hexagon nằm ở trung tâm phía trên.
// Crop hexagon area (rough bbox): x≈640, y≈0, w=500, h=500
const CROP = { left: 640, top: 0, width: 500, height: 500 };

async function generate() {
  // 1. Crop hexagon area, ép lên nền trắng (iOS không hỗ trợ alpha rounded corner đẹp)
  const cropped = await sharp(SRC)
    .extract(CROP)
    .resize(160, 160, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .extend({
      top: 10, bottom: 10, left: 10, right: 10,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    })
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .toBuffer();

  // 2. Apple touch icon — 180x180
  await sharp(cropped).resize(180, 180).png().toFile(APPLE_OUT);
  console.log('✓', APPLE_OUT);

  // 3. Favicon — 32x32
  await sharp(cropped).resize(32, 32).png().toFile(ICON_OUT);
  console.log('✓', ICON_OUT);
}

generate().catch((e) => {
  console.error(e);
  process.exit(1);
});
