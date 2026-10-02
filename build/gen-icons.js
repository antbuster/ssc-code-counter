/**
 * 应用图标生成脚本（无第三方依赖）
 * 生成：build/icons/icon.png(512)、icon.ico、icon.icns 说明见 README、public/images/logo-32.png
 * 运行：node build/gen-icons.js
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// ---------- PNG 编码 ----------
function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = [];
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePng(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// ---------- 图标绘制 ----------
/**
 * 绘制图标：圆角方形蓝色渐变背景 + 白色柱状图（代码统计隐喻）
 */
function drawIcon(size) {
  const px = Buffer.alloc(size * size * 4);
  const r = size * 0.22;            // 圆角半径
  const pad = size * 0.06;          // 内边距
  // 三根柱子（比例、位置）
  const bars = [
    { x0: 0.24, x1: 0.38, y0: 0.55, y1: 0.80 },
    { x0: 0.43, x1: 0.57, y0: 0.38, y1: 0.80 },
    { x0: 0.62, x1: 0.76, y0: 0.20, y1: 0.80 }
  ];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const u = x / size, v = y / size;

      // 圆角方形遮罩（带 1px 抗锯齿）
      const qx = Math.max(r + pad - (x + 0.5), x + 0.5 - (size - r - pad));
      const qy = Math.max(r + pad - (y + 0.5), y + 0.5 - (size - r - pad));
      const d = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) - r;
      let bgA = Math.min(1, Math.max(0, 0.5 - d)); // 1px feather

      if (bgA <= 0) { px[idx] = px[idx + 1] = px[idx + 2] = px[idx + 3] = 0; continue; }

      // 背景渐变（左上 #3b82f6 → 右下 #1e40af）
      const t = (u + v) / 2;
      const br = Math.round(59 + (30 - 59) * t);
      const bg = Math.round(130 + (67 - 130) * t);
      const bb = Math.round(246 + (175 - 246) * t);

      // 柱状图（白色）
      let inBar = false;
      for (const b of bars) {
        if (x + 0.5 >= b.x0 * size && x + 0.5 < b.x1 * size && y + 0.5 >= b.y0 * size && y + 0.5 < b.y1 * size) {
          inBar = true;
          break;
        }
      }
      // 柱子底部基线
      const baseY = 0.80 * size;
      const baseTop = baseY - 1.5;
      if (!inBar && Math.abs(y + 0.5 - baseY) < 1.5 && x + 0.5 >= bars[0].x0 * size && x + 0.5 < bars[2].x1 * size) {
        inBar = true;
      }

      let cr, cg, cb, ca;
      if (inBar) { cr = 255; cg = 255; cb = 255; ca = 255; }
      else { cr = br; cg = bg; cb = bb; ca = 255; }

      // 与背景透明度混合（图标外区域保持透明）
      const outA = Math.round(ca * bgA);
      px[idx] = cr; px[idx + 1] = cg; px[idx + 2] = cb; px[idx + 3] = outA;
    }
  }
  return px;
}

function inSquare(size, x, y) {
  const pad = size * 0.06;
  const r = size * 0.22;
  const cx = Math.min(Math.max(x, pad + r), size - pad - r);
  const cy = Math.min(Math.max(y, pad + r), size - pad - r);
  return Math.hypot(x - cx, y - cy) <= r || (x >= pad && x <= size - pad && y >= pad && y <= size - pad);
}

// ---------- ICO 封装（内嵌 PNG） ----------
function buildIco(png256) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);   // reserved
  header.writeUInt16LE(1, 2);   // type icon
  header.writeUInt16LE(1, 4);   // count
  const entry = Buffer.alloc(16);
  entry[0] = 0;                  // 256 → 0
  entry[1] = 0;
  entry[2] = 0;                  // palette
  entry[3] = 0;
  entry.writeUInt16LE(1, 4);     // planes
  entry.writeUInt16LE(32, 6);    // bpp
  entry.writeUInt32LE(png256.length, 8);
  entry.writeUInt32LE(22, 12);   // offset
  return Buffer.concat([header, entry, png256]);
}

// ---------- 输出 ----------
const root = path.join(__dirname, '..');
const iconsDir = path.join(root, 'build', 'icons');
const imagesDir = path.join(root, 'public', 'images');
fs.mkdirSync(iconsDir, { recursive: true });
fs.mkdirSync(imagesDir, { recursive: true });

const png512 = encodePng(512, 512, drawIcon(512));
fs.writeFileSync(path.join(iconsDir, 'icon.png'), png512);

const png256 = encodePng(256, 256, drawIcon(256));
fs.writeFileSync(path.join(iconsDir, 'icon.ico'), buildIco(png256));

fs.writeFileSync(path.join(imagesDir, 'logo-32.png'), encodePng(32, 32, drawIcon(32)));

// mac 用 png（electron-builder 支持 png 自动转 icns，同时输出 1024 图）
const png1024 = encodePng(1024, 1024, drawIcon(1024));
fs.writeFileSync(path.join(iconsDir, 'icon-mac.png'), png1024);

console.log('icons generated:');
console.log(' -', path.join(iconsDir, 'icon.png'));
console.log(' -', path.join(iconsDir, 'icon.ico'));
console.log(' -', path.join(iconsDir, 'icon-mac.png'));
console.log(' -', path.join(imagesDir, 'logo-32.png'));
