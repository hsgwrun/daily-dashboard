/* アプリアイコンをPNG生成するスクリプト（依存ライブラリなし）
   朱色の角丸四角に、白い円を載せたシンプルなマーク。
   使い方: node gen-icons.js */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

/* --- PNGエンコーダ --- */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function writePNG(file, size) {
  const rgba = renderIcon(size);
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * 4 + 1);
    raw[rowStart] = 0; // filter: none
    rgba.copy(raw, rowStart + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  fs.writeFileSync(file, png);
  console.log(`${file} (${size}x${size})`);
}

/* --- 描画 --- */
const BG = [184, 64, 44]; // 朱色
const FG = [250, 248, 243]; // 白

// 角丸四角の内部判定（スーパーサンプリング用のSDF）
function inRoundedRect(px, py, size) {
  const r = size * 0.22;
  const half = size / 2;
  const qx = Math.abs(px - half) - (half - r);
  const qy = Math.abs(py - half) - (half - r);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) <= r;
}

function renderIcon(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const SS = 4; // 4x4 supersampling
  const circleR = size * 0.28;
  const cx = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let bgAcc = 0;
      let fgAcc = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = x + (sx + 0.5) / SS;
          const py = y + (sy + 0.5) / SS;
          if (inRoundedRect(px, py, size)) {
            bgAcc++;
            if (Math.hypot(px - cx, py - cx) <= circleR) fgAcc++;
          }
        }
      }
      const total = SS * SS;
      const a = bgAcc / total;
      const fgMix = fgAcc / total;
      const i = (y * size + x) * 4;
      rgba[i] = Math.round(BG[0] * (1 - fgMix) + FG[0] * fgMix);
      rgba[i + 1] = Math.round(BG[1] * (1 - fgMix) + FG[1] * fgMix);
      rgba[i + 2] = Math.round(BG[2] * (1 - fgMix) + FG[2] * fgMix);
      rgba[i + 3] = Math.round(a * 255);
    }
  }
  return rgba;
}

const dir = path.join(__dirname, 'icons');
fs.mkdirSync(dir, { recursive: true });
writePNG(path.join(dir, 'icon-192.png'), 192);
writePNG(path.join(dir, 'icon-512.png'), 512);
writePNG(path.join(dir, 'icon-180.png'), 180);
console.log('完了');
