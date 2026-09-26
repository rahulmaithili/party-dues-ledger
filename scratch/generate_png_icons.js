const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// CRC32 table
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    if (c & 1) c = 0xedb88320 ^ (c >>> 1);
    else c = c >>> 1;
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(12 + len);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);
  const crcBuf = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  chunk.writeUInt32BE(crc32(crcBuf), 8 + len);
  return chunk;
}

function createPng(width, height, pixelFn) {
  // Signature
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData.writeUInt8(8, 8); // 8 bits per channel
  ihdrData.writeUInt8(6, 9); // RGBA
  ihdrData.writeUInt8(0, 10); // Compression
  ihdrData.writeUInt8(0, 11); // Filter
  ihdrData.writeUInt8(0, 12); // Interlace
  const ihdrChunk = makeChunk('IHDR', ihdrData);

  // Raw scanlines
  const rowSize = 1 + width * 4;
  const raw = Buffer.alloc(rowSize * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    raw[rowOffset] = 0; // Filter 0 (None)
    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      const [r, g, b, a] = pixelFn(x, y, width, height);
      raw[pxOffset] = r;
      raw[pxOffset + 1] = g;
      raw[pxOffset + 2] = b;
      raw[pxOffset + 3] = a;
    }
  }

  const compressed = zlib.deflateSync(raw, { level: 9 });
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// Icon design: Gradient background, flame/cylinder motif and Rupee golden badge
function renderIconPixel(x, y, size, maskable = false) {
  const nx = x / size;
  const ny = y / size;

  // Maskable safe zone check or rounded rect
  if (!maskable) {
    const cornerR = size * 0.22;
    // Check if outside rounded rect
    let out = false;
    if (x < cornerR && y < cornerR) {
      if (Math.hypot(x - cornerR, y - cornerR) > cornerR) out = true;
    } else if (x > size - cornerR && y < cornerR) {
      if (Math.hypot(x - (size - cornerR), y - cornerR) > cornerR) out = true;
    } else if (x < cornerR && y > size - cornerR) {
      if (Math.hypot(x - cornerR, y - (size - cornerR)) > cornerR) out = true;
    } else if (x > size - cornerR && y > size - cornerR) {
      if (Math.hypot(x - (size - cornerR), y - (size - cornerR)) > cornerR) out = true;
    }
    if (out) return [0, 0, 0, 0];
  }

  // Deep Royal Blue to Midnight Slate gradient
  const grad = (nx * 0.4 + ny * 0.6);
  let r = Math.round(30 * (1 - grad) + 15 * grad);
  let g = Math.round(58 * (1 - grad) + 23 * grad);
  let b = Math.round(138 * (1 - grad) + 42 * grad);
  let a = 255;

  // Rupee golden coin at top right (cx: 0.72, cy: 0.28, r: 0.15)
  const coinDx = (nx - 0.72);
  const coinDy = (ny - 0.28);
  const coinDist = Math.hypot(coinDx, coinDy);
  if (coinDist <= 0.13) {
    // Gold gradient
    const coinGrad = (coinDx + coinDy) / 0.26;
    r = Math.round(253 * (1 - coinGrad) + 217 * coinGrad);
    g = Math.round(224 * (1 - coinGrad) + 119 * coinGrad);
    b = Math.round(71 * (1 - coinGrad) + 6 * coinGrad);
    // Outer border ring on coin
    if (coinDist > 0.115) {
      r = 255; g = 255; b = 255;
    }
    return [r, g, b, 255];
  }

  // Red LPG Cylinder body (cx: 0.42, cy: 0.50)
  const cylX = nx - 0.42;
  const cylY = ny - 0.50;

  // Cylinder main body trunk (-0.14 <= cylX <= 0.14 and -0.16 <= cylY <= 0.18)
  const inCylTrunk = (Math.abs(cylX) <= 0.14 && Math.abs(cylY) <= 0.18);
  // Cylinder top dome
  const inTopDome = (Math.abs(cylX) <= 0.14 && cylY < -0.18 && Math.hypot(cylX / 0.14, (cylY + 0.18) / 0.10) <= 1.0);
  // Cylinder bottom dome
  const inBotDome = (Math.abs(cylX) <= 0.14 && cylY > 0.18 && Math.hypot(cylX / 0.14, (cylY - 0.18) / 0.08) <= 1.0);

  // Top collar handle
  const inCollar = (Math.abs(cylX) <= 0.12 && cylY >= -0.34 && cylY <= -0.27 && (Math.abs(cylX) >= 0.08 || cylY <= -0.31));

  // Foot ring
  const inFoot = (Math.abs(cylX) <= 0.10 && cylY >= 0.26 && cylY <= 0.31);

  if (inCollar || inFoot) {
    return [148, 163, 184, 255]; // Slate silver metal
  }

  if (inCylTrunk || inTopDome || inBotDome) {
    // Red cylinder with 3D metallic curvature highlight
    const light = 1.0 - Math.abs(cylX) / 0.14 * 0.45 + (cylX * 0.3);
    let cr = Math.min(255, Math.round(220 * light));
    let cg = Math.min(255, Math.round(38 * light));
    let cb = Math.min(255, Math.round(38 * light));

    // Weld ring bands on cylinder
    if (Math.abs(cylY + 0.08) < 0.008 || Math.abs(cylY - 0.08) < 0.008) {
      cr = Math.round(cr * 0.7);
      cg = Math.round(cg * 0.7);
      cb = Math.round(cb * 0.7);
    }

    // Flame graphic in center of cylinder
    const fDist = Math.hypot(cylX / 0.06, cylY / 0.10);
    if (fDist < 0.85) {
      // Golden yellow / orange flame
      const fLight = 1.0 - fDist;
      cr = 254;
      cg = Math.round(180 + 60 * fLight);
      cb = Math.round(40 * fLight);
    }

    return [cr, cg, cb, 255];
  }

  // Bottom Branding Bar (ny between 0.82 and 0.91, nx between 0.16 and 0.84)
  if (ny >= 0.82 && ny <= 0.91 && nx >= 0.16 && nx <= 0.84) {
    r = Math.min(255, r + 45);
    g = Math.min(255, g + 55);
    b = Math.min(255, b + 75);
    // Border of bar
    if (ny < 0.825 || ny > 0.905 || nx < 0.165 || nx > 0.835) {
      r = 255; g = 255; b = 255;
    }
  }

  return [r, g, b, a];
}

const iconsDir = path.join(__dirname, '..', 'icons');
if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir, { recursive: true });

// Generate 192x192
console.log('Generating icon-192.png...');
const icon192 = createPng(192, 192, (x, y, s) => renderIconPixel(x, y, s, false));
fs.writeFileSync(path.join(iconsDir, 'icon-192.png'), icon192);

// Generate 512x512
console.log('Generating icon-512.png...');
const icon512 = createPng(512, 512, (x, y, s) => renderIconPixel(x, y, s, false));
fs.writeFileSync(path.join(iconsDir, 'icon-512.png'), icon512);

// Generate maskable 512x512
console.log('Generating icon-maskable-512.png...');
const iconMaskable = createPng(512, 512, (x, y, s) => renderIconPixel(x, y, s, true));
fs.writeFileSync(path.join(iconsDir, 'icon-maskable-512.png'), iconMaskable);

// Generate Apple Touch Icon 180x180
console.log('Generating apple-touch-icon.png...');
const iconApple = createPng(180, 180, (x, y, s) => renderIconPixel(x, y, s, true));
fs.writeFileSync(path.join(iconsDir, 'apple-touch-icon.png'), iconApple);

console.log('All PNG icons generated successfully!');
