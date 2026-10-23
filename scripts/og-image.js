'use strict';

/**
 * Генератор социальной картинки `og-image.png` (1200×630) без зависимостей.
 *
 * Рисуем в буфер пикселей и кодируем PNG вручную: zlib.deflateSync + CRC32.
 * Картинка детерминированная — при повторной сборке байты совпадают, поэтому
 * `public/og-image.png` можно хранить в репозитории.
 *
 * Рисование идёт в 2× (2400×1260) и уменьшается усреднением: так края текста
 * и щита получают сглаживание без сторонних библиотек.
 */

const zlib = require('node:zlib');

const WIDTH = 1200;
const HEIGHT = 630;
const SS = 2;
const W = WIDTH * SS;
const H = HEIGHT * SS;

const COLORS = {
  bgTop: [12, 20, 38],
  bgBottom: [27, 51, 122],
  glow: [37, 99, 235],
  white: [255, 255, 255],
  muted: [147, 197, 253],
  accent: [96, 165, 250],
  check: [125, 211, 252],
};

/* ---------- PNG ---------- */

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    crc = CRC_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const name = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([name, data])), 0);
  return Buffer.concat([length, name, data, crc]);
}

function encodePng(width, height, rgb) {
  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgb.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: truecolor
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ---------- холст ---------- */

class Canvas {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.pixels = Buffer.alloc(width * height * 3);
  }

  blend(x, y, color, alpha) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const i = (y * this.width + x) * 3;
    const a = Math.max(0, Math.min(1, alpha));
    this.pixels[i] = Math.round(this.pixels[i] * (1 - a) + color[0] * a);
    this.pixels[i + 1] = Math.round(this.pixels[i + 1] * (1 - a) + color[1] * a);
    this.pixels[i + 2] = Math.round(this.pixels[i + 2] * (1 - a) + color[2] * a);
  }

  rect(x, y, width, height, color, alpha = 1) {
    const x0 = Math.max(0, Math.round(x));
    const y0 = Math.max(0, Math.round(y));
    const x1 = Math.min(this.width, Math.round(x + width));
    const y1 = Math.min(this.height, Math.round(y + height));
    for (let py = y0; py < y1; py += 1) {
      for (let px = x0; px < x1; px += 1) this.blend(px, py, color, alpha);
    }
  }

  disc(cx, cy, radius, color, alpha = 1) {
    const r2 = radius * radius;
    for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y += 1) {
      for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x += 1) {
        const dx = x - cx;
        const dy = y - cy;
        if (dx * dx + dy * dy <= r2) this.blend(x, y, color, alpha);
      }
    }
  }

  line(x1, y1, x2, y2, width, color, alpha = 1) {
    const distance = Math.hypot(x2 - x1, y2 - y1);
    const steps = Math.max(1, Math.ceil(distance));
    const radius = width / 2;
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      this.disc(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, radius, color, alpha);
    }
  }

  polygon(points, color, alpha = 1) {
    let minY = Infinity;
    let maxY = -Infinity;
    for (const [, y] of points) {
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    for (let y = Math.max(0, Math.floor(minY)); y <= Math.min(this.height - 1, Math.ceil(maxY)); y += 1) {
      const crossings = [];
      for (let i = 0; i < points.length; i += 1) {
        const [x1, y1] = points[i];
        const [x2, y2] = points[(i + 1) % points.length];
        if (y1 === y2) continue;
        if ((y >= y1 && y < y2) || (y >= y2 && y < y1)) {
          crossings.push(x1 + ((y - y1) / (y2 - y1)) * (x2 - x1));
        }
      }
      crossings.sort((a, b) => a - b);
      for (let i = 0; i + 1 < crossings.length; i += 2) {
        this.rect(crossings[i], y, crossings[i + 1] - crossings[i], 1, color, alpha);
      }
    }
  }
}

/* ---------- шрифт 5×7 ---------- */

const GLYPHS = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01110', '10001', '10000', '10000', '10000', '10001', '01110'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01110', '10001', '10000', '10111', '10001', '10001', '01111'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  J: ['00111', '00010', '00010', '00010', '00010', '10010', '01100'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  W: ['10001', '10001', '10001', '10101', '10101', '11011', '10001'],
  X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  0: ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  1: ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  2: ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  3: ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  4: ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  5: ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  6: ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  7: ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  8: ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  9: ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
  '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
  '.': ['00000', '00000', '00000', '00000', '00000', '01100', '01100'],
  ':': ['00000', '01100', '01100', '00000', '01100', '01100', '00000'],
  '/': ['00001', '00010', '00010', '00100', '01000', '01000', '10000'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
};

function textWidth(text, scale) {
  return Math.max(0, text.length * 6 * scale - scale);
}

function drawText(canvas, text, x, y, scale, color, alpha = 1) {
  let cursor = x;
  for (const char of text.toUpperCase()) {
    const glyph = GLYPHS[char] || GLYPHS[' '];
    for (let row = 0; row < 7; row += 1) {
      for (let column = 0; column < 5; column += 1) {
        if (glyph[row][column] === '1') {
          canvas.rect(cursor + column * scale, y + row * scale, scale, scale, color, alpha);
        }
      }
    }
    cursor += 6 * scale;
  }
}

/* ---------- картинка ---------- */

function render() {
  const canvas = new Canvas(W, H);

  // Вертикальный градиент + холодное свечение справа.
  for (let y = 0; y < H; y += 1) {
    const t = y / (H - 1);
    const r = Math.round(COLORS.bgTop[0] + (COLORS.bgBottom[0] - COLORS.bgTop[0]) * t);
    const g = Math.round(COLORS.bgTop[1] + (COLORS.bgBottom[1] - COLORS.bgTop[1]) * t);
    const b = Math.round(COLORS.bgTop[2] + (COLORS.bgBottom[2] - COLORS.bgTop[2]) * t);
    canvas.rect(0, y, W, 1, [r, g, b]);
  }
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const dx = (x - W * 0.78) / (W * 0.5);
      const dy = (y - H * 0.2) / (H * 0.7);
      const glow = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy));
      if (glow > 0) canvas.blend(x, y, COLORS.glow, glow * 0.18);
    }
  }

  // Тонкая сетка.
  for (let x = 0; x < W; x += 80) canvas.rect(x, 0, 1, H, COLORS.white, 0.035);
  for (let y = 0; y < H; y += 80) canvas.rect(0, y, W, 1, COLORS.white, 0.035);

  // Акцентная черта и текст.
  canvas.rect(140, 186, 120, 8, COLORS.accent);
  drawText(canvas, 'PHP2SHELL', 140, 250, 20, COLORS.white);
  drawText(canvas, 'CVE-2026-109618 / CVE-2026-109619', 140, 470, 5, COLORS.muted);
  drawText(canvas, 'HAVEIBEENPHPNED.GITHUB.IO', 140, 552, 4, COLORS.accent);

  // Щит справа.
  const cx = 1860;
  const cy = 300;
  const shield = [
    [cx, cy - 40],
    [cx + 190, cy + 30],
    [cx + 190, cy + 250],
    [cx + 125, cy + 360],
    [cx, cy + 440],
    [cx - 125, cy + 360],
    [cx - 190, cy + 250],
    [cx - 190, cy + 30],
  ];
  canvas.polygon(shield, COLORS.white, 0.08);
  for (let i = 0; i < shield.length; i += 1) {
    const [x1, y1] = shield[i];
    const [x2, y2] = shield[(i + 1) % shield.length];
    canvas.line(x1, y1, x2, y2, 7, COLORS.white, 0.8);
  }
  canvas.line(cx - 78, cy + 148, cx - 20, cy + 208, 16, COLORS.check);
  canvas.line(cx - 20, cy + 208, cx + 86, cy + 88, 16, COLORS.check);

  // Уменьшение 2×2 → 1200×630.
  const out = Buffer.alloc(WIDTH * HEIGHT * 3);
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      const target = (y * WIDTH + x) * 3;
      let r = 0;
      let g = 0;
      let b = 0;
      for (let sy = 0; sy < SS; sy += 1) {
        for (let sx = 0; sx < SS; sx += 1) {
          const i = ((y * SS + sy) * W + (x * SS + sx)) * 3;
          r += canvas.pixels[i];
          g += canvas.pixels[i + 1];
          b += canvas.pixels[i + 2];
        }
      }
      const count = SS * SS;
      out[target] = Math.round(r / count);
      out[target + 1] = Math.round(g / count);
      out[target + 2] = Math.round(b / count);
    }
  }

  return encodePng(WIDTH, HEIGHT, out);
}

module.exports = {
  WIDTH,
  HEIGHT,
  render,
  // Экспортируем для тестов: проверяем структуру PNG без записи на диск.
  encodePng,
  textWidth,
};
