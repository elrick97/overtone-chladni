import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const ROOT_DIR = import.meta.dirname
  ? path.resolve(import.meta.dirname, '..')
  : process.cwd();
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');

// ---------------------------------------------------------------------------
// Minimal Zero-Dependency RGBA PNG Encoder (Signature + IHDR + IDAT + IEND)
// ---------------------------------------------------------------------------
const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[n] = c >>> 0;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.allocUnsafe(4);
  lenBuf.writeUInt32BE(data.length, 0);

  const crcInput = Buffer.concat([typeBytes, data]);
  const crcBuf = Buffer.allocUnsafe(4);
  crcBuf.writeUInt32BE(crc32(crcInput), 0);

  return Buffer.concat([lenBuf, crcInput, crcBuf]);
}

function encodePNG(width, height, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.allocUnsafe(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const stride = width * 4;
  const raw = Buffer.allocUnsafe(height * (1 + stride));
  for (let y = 0; y < height; y++) {
    const rowStart = y * (1 + stride);
    raw[rowStart] = 0; // filter type 0 (None)
    rgba.copy(raw, rowStart + 1, y * stride, (y + 1) * stride);
  }

  const compressed = zlib.deflateSync(raw, { level: 9 });

  return Buffer.concat([
    signature,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
// Math & Color Helpers
// ---------------------------------------------------------------------------
function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function smoothstep(edge0, edge1, x) {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

// Signed distance to axis-aligned rounded box centered at origin
function sdRoundedBox(px, py, halfW, halfH, radius) {
  const qx = Math.abs(px) - halfW + radius;
  const qy = Math.abs(py) - halfH + radius;
  return (
    Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) +
    Math.min(Math.max(qx, qy), 0) -
    radius
  );
}

// Signed distance to a diamond (L1 rhombus) with semi-axes rx, ry
function sdDiamond(px, py, rx, ry) {
  const ax = Math.abs(px);
  const ay = Math.abs(py);
  // Exact Euclidean distance to segment from (0, ry) to (rx, 0)
  const vx = rx;
  const vy = -ry;
  const wx = ax;
  const wy = ay - ry;
  const t = clamp01((wx * vx + wy * vy) / (vx * vx + vy * vy));
  const dx = wx - t * vx;
  const dy = wy - t * vy;
  const dist = Math.hypot(dx, dy);
  return ax / rx + ay / ry <= 1 ? -dist : dist;
}

// ---------------------------------------------------------------------------
// Procedural OVERTONE Chladni Mandala Renderer
// ---------------------------------------------------------------------------
function renderChladniIcon(size, maskable) {
  const rgba = Buffer.allocUnsafe(size * size * 4);
  const half = size * 0.5;

  // Maskable keeps main emblem strictly inside central 76% safe zone (r <= 0.38 * size)
  const emblemR = maskable ? size * 0.37 : size * 0.425;
  const plateR = emblemR * 0.87;
  const chladniDomain = 0.82;

  const cyanRingR = emblemR * 0.90;
  const innerRingR = emblemR * 0.48;
  const outerBrassRingR = emblemR * 0.97;

  // Stylus dimensions
  const stylusRx = emblemR * 0.125;
  const stylusRy = emblemR * 0.185;

  // Rounded dark-brass border frame for regular icons
  const frameHalf = size * 0.468;
  const frameRadius = size * 0.19;
  const frameStroke = Math.max(1.2, size * 0.0085);

  const pxScale = size / 512;

  // 2x2 subpixel supersampling offsets
  const subOffsets = [-0.25, 0.25];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let accR = 0;
      let accG = 0;
      let accB = 0;

      for (let sy = 0; sy < 2; sy++) {
        for (let sx = 0; sx < 2; sx++) {
          const dx = x + 0.5 + subOffsets[sx] - half;
          const dy = y + 0.5 + subOffsets[sy] - half;
          const r = Math.hypot(dx, dy);

          // 1. Dark obsidian background (#090A10) with subtle acoustic vignette
          let cr = 9;
          let cg = 10;
          let cb = 16;

          const radialGlow = Math.exp(-(r * r) / (2 * (emblemR * 0.62) ** 2));
          cr += 10 * radialGlow;
          cg += 14 * radialGlow;
          cb += 32 * radialGlow;

          // Subtle concentric resonance plate field
          const plateTint = smoothstep(plateR * 1.03, plateR * 0.88, r);
          cr += 4 * plateTint;
          cg += 5 * plateTint;
          cb += 10 * plateTint;

          // 2. Chladni standing-wave sand curves:
          // f(x,y) = cos(3*pi*x)*cos(2*pi*y) - cos(2*pi*x)*cos(3*pi*y)
          if (r < plateR * 1.12) {
            const u = (dx / plateR) * chladniDomain;
            const v = (dy / plateR) * chladniDomain;
            const pi = Math.PI;

            const c3u = Math.cos(3 * pi * u);
            const s3u = Math.sin(3 * pi * u);
            const c2u = Math.cos(2 * pi * u);
            const s2u = Math.sin(2 * pi * u);

            const c3v = Math.cos(3 * pi * v);
            const s3v = Math.sin(3 * pi * v);
            const c2v = Math.cos(2 * pi * v);
            const s2v = Math.sin(2 * pi * v);

            const f = c3u * c2v - c2u * c3v;
            const dfdu = -3 * pi * s3u * c2v + 2 * pi * s2u * c3v;
            const dfdv = -2 * pi * c3u * s2v + 3 * pi * c2u * s3v;
            const gradMag = Math.max(Math.hypot(dfdu, dfdv), 0.75);

            // Distance in pixels to the zero-nodal curve
            const distPx = (Math.abs(f) / gradMag) * (plateR / chladniDomain);
            const plateMask = smoothstep(plateR * 1.01, plateR * 0.88, r);

            // Outer warm brass bloom + crisp #F5C451 nodal sand curve + bright specular core
            const bloom = Math.exp(-(distPx * distPx) / (2 * (5.8 * pxScale) ** 2)) * 0.55;
            const core = smoothstep(3.4 * pxScale, 0.9 * pxScale, distPx);
            const hotCore = smoothstep(1.55 * pxScale, 0.25 * pxScale, distPx);

            // Apply bloom (#D99B26)
            const bAmt = bloom * plateMask;
            cr = cr * (1 - bAmt) + 217 * bAmt;
            cg = cg * (1 - bAmt) + 155 * bAmt;
            cb = cb * (1 - bAmt) + 38 * bAmt;

            // Apply main brass-gold curve (#F5C451)
            const cAmt = core * plateMask;
            cr = cr * (1 - cAmt) + 245 * cAmt;
            cg = cg * (1 - cAmt) + 196 * cAmt;
            cb = cb * (1 - cAmt) + 81 * cAmt;

            // Apply bright gold-white core (#FFF3C4)
            const hAmt = hotCore * 0.65 * plateMask;
            cr = cr * (1 - hAmt) + 255 * hAmt;
            cg = cg * (1 - hAmt) + 243 * hAmt;
            cb = cb * (1 - hAmt) + 196 * hAmt;
          }

          // 3. Concentric cyan harmonic rings (#38BDF8)
          // Primary outer harmonic ring
          const distCyan = Math.abs(r - cyanRingR);
          const cyanBloom = Math.exp(-(distCyan * distCyan) / (2 * (5.2 * pxScale) ** 2)) * 0.52;
          const cyanCore = smoothstep(3.1 * pxScale, 0.9 * pxScale, distCyan);
          const cyanHot = smoothstep(1.3 * pxScale, 0.2 * pxScale, distCyan) * 0.55;

          cr = cr * (1 - cyanBloom) + 56 * cyanBloom;
          cg = cg * (1 - cyanBloom) + 189 * cyanBloom;
          cb = cb * (1 - cyanBloom) + 248 * cyanBloom;

          cr = cr * (1 - cyanCore) + 56 * cyanCore;
          cg = cg * (1 - cyanCore) + 189 * cyanCore;
          cb = cb * (1 - cyanCore) + 248 * cyanCore;

          cr = cr * (1 - cyanHot) + 210 * cyanHot;
          cg = cg * (1 - cyanHot) + 244 * cyanHot;
          cb = cb * (1 - cyanHot) + 255 * cyanHot;

          // Secondary inner harmonic ring (subtle #38BDF8)
          const distInner = Math.abs(r - innerRingR);
          const innerCore = smoothstep(1.85 * pxScale, 0.55 * pxScale, distInner) * 0.55;
          const innerBloom = Math.exp(-(distInner * distInner) / (2 * (3.0 * pxScale) ** 2)) * 0.22;
          const innerAmt = clamp01(innerCore + innerBloom);
          cr = cr * (1 - innerAmt) + 56 * innerAmt;
          cg = cg * (1 - innerAmt) + 189 * innerAmt;
          cb = cb * (1 - innerAmt) + 248 * innerAmt;

          // Subtle outer brass plate ring
          const distOuterBrass = Math.abs(r - outerBrassRingR);
          const brassRim = smoothstep(1.8 * pxScale, 0.45 * pxScale, distOuterBrass) * 0.55;
          cr = cr * (1 - brassRim) + 148 * brassRim;
          cg = cg * (1 - brassRim) + 116 * brassRim;
          cb = cb * (1 - brassRim) + 46 * brassRim;

          // 4. Central bright diamond-nib Tuning Stylus
          const dStylus = sdDiamond(dx, dy, stylusRx, stylusRy);
          // Soft halo around stylus
          if (dStylus > 0) {
            const stylusHalo = Math.exp(-(dStylus * dStylus) / (2 * (7.5 * pxScale) ** 2)) * 0.48;
            cr = cr * (1 - stylusHalo) + 56 * stylusHalo;
            cg = cg * (1 - stylusHalo) + 189 * stylusHalo;
            cb = cb * (1 - stylusHalo) + 248 * stylusHalo;
          }

          // Dark obsidian collar around stylus so it separates crisply from nodal lines
          const collarMask = smoothstep(3.6 * pxScale, 1.4 * pxScale, dStylus);
          cr = cr * (1 - collarMask) + 12 * collarMask;
          cg = cg * (1 - collarMask) + 14 * collarMask;
          cb = cb * (1 - collarMask) + 22 * collarMask;

          // Luminous faceted diamond-nib body
          const bodyMask = smoothstep(1.1 * pxScale, -0.4 * pxScale, dStylus);
          if (bodyMask > 0) {
            // Facet shading: left/top brighter, bottom-right warm brass-cyan tint
            const facetLight = dx <= 0 ? 1.0 : 0.84;
            const facetTint = dy <= 0 ? 1.0 : 0.88;
            const bR = (232 * facetLight * facetTint) + (1 - facetTint) * 45;
            const bG = (246 * facetLight * facetTint) + (1 - facetTint) * 35;
            const bB = 255 * facetLight;

            cr = cr * (1 - bodyMask) + bR * bodyMask;
            cg = cg * (1 - bodyMask) + bG * bodyMask;
            cb = cb * (1 - bodyMask) + bB * bodyMask;

            // Golden brass nib rim inside diamond edge
            const rimBand = smoothstep(4.2 * pxScale, 1.6 * pxScale, Math.abs(dStylus + 1.5 * pxScale)) * bodyMask;
            cr = cr * (1 - rimBand * 0.72) + 245 * (rimBand * 0.72);
            cg = cg * (1 - rimBand * 0.72) + 196 * (rimBand * 0.72);
            cb = cb * (1 - rimBand * 0.72) + 81 * (rimBand * 0.72);

            // Inner bright white-cyan core jewel
            const dInnerDiamond = sdDiamond(dx, dy, stylusRx * 0.48, stylusRy * 0.50);
            const jewelMask = smoothstep(1.0 * pxScale, -0.5 * pxScale, dInnerDiamond);
            cr = cr * (1 - jewelMask) + 255 * jewelMask;
            cg = cg * (1 - jewelMask) + 253 * jewelMask;
            cb = cb * (1 - jewelMask) + 240 * jewelMask;
          }

          // 5. Regular icons: subtle rounded dark-brass border frame
          if (!maskable) {
            const dBox = sdRoundedBox(dx, dy, frameHalf, frameHalf, frameRadius);
            const borderMask = smoothstep(frameStroke + 0.9 * pxScale, frameStroke * 0.35, Math.abs(dBox));
            if (borderMask > 0) {
              // Subtle metallic top-to-bottom brass sheen
              const sheen = 0.72 + 0.28 * clamp01(0.5 - dy / size);
              const fR = 138 * sheen;
              const fG = 107 * sheen;
              const fB = 42 * sheen;
              cr = cr * (1 - borderMask * 0.85) + fR * (borderMask * 0.85);
              cg = cg * (1 - borderMask * 0.85) + fG * (borderMask * 0.85);
              cb = cb * (1 - borderMask * 0.85) + fB * (borderMask * 0.85);
            }
          }

          accR += cr;
          accG += cg;
          accB += cb;
        }
      }

      const idx = (y * size + x) * 4;
      rgba[idx] = Math.min(255, Math.max(0, Math.round(accR * 0.25)));
      rgba[idx + 1] = Math.min(255, Math.max(0, Math.round(accG * 0.25)));
      rgba[idx + 2] = Math.min(255, Math.max(0, Math.round(accB * 0.25)));
      rgba[idx + 3] = 255;
    }
  }

  return encodePNG(size, size, rgba);
}

// ---------------------------------------------------------------------------
// Crisp Vector SVG Generator (matches mathematical Chladni curves exactly)
// ---------------------------------------------------------------------------
function buildChladniSvgPaths(plateR, chladniDomain) {
  const cx = 256;
  const cy = 256;
  const paths = [];

  // 1. Diagonal nodal lines x = ±y clipped inside plate circle
  const diagEnd = (plateR * 0.94) / Math.SQRT2;
  paths.push(
    `M ${(cx - diagEnd).toFixed(2)} ${(cy - diagEnd).toFixed(2)} L ${(cx + diagEnd).toFixed(2)} ${(cy + diagEnd).toFixed(2)}`,
    `M ${(cx - diagEnd).toFixed(2)} ${(cy + diagEnd).toFixed(2)} L ${(cx + diagEnd).toFixed(2)} ${(cy - diagEnd).toFixed(2)}`
  );

  // 2. Curved nodal branches: 8u^2 v^2 - 4u^2 + 2uv - 4v^2 + 3 = 0
  // Trace top & bottom U-lobes cleanly as y(x), then mirror (x, y) -> (y, x)
  // for seamless left & right U-lobes (exact 4-fold symmetry).
  const steps = 160;
  const xMax = chladniDomain * 0.96;

  function traceLobes(signRoot, ySign) {
    let current = [];
    const segments = [];
    for (let i = 0; i <= steps; i++) {
      const x = -xMax + (2 * xMax * i) / steps;
      const u = Math.cos(Math.PI * x);
      const A = 8 * u * u - 4;
      const B = 2 * u;
      const C = 3 - 4 * u * u;
      let v;
      if (Math.abs(A) < 1e-6) {
        v = -C / B;
      } else {
        const disc = B * B - 4 * A * C;
        if (disc < 0) {
          if (current.length > 1) segments.push(current);
          current = [];
          continue;
        }
        v = (-B + signRoot * Math.sqrt(disc)) / (2 * A);
      }
      if (v < -1 || v > 1) {
        if (current.length > 1) segments.push(current);
        current = [];
        continue;
      }
      const y = (ySign * Math.acos(v)) / Math.PI;
      const rNorm = Math.hypot(x, y) / chladniDomain;
      if (rNorm > 0.95) {
        if (current.length > 1) segments.push(current);
        current = [];
        continue;
      }
      current.push([x, y]);
    }
    if (current.length > 1) segments.push(current);

    for (const seg of segments) {
      const pts = seg.map(
        ([x, y]) =>
          `${(cx + (x / chladniDomain) * plateR).toFixed(2)} ${(cy + (y / chladniDomain) * plateR).toFixed(2)}`
      );
      paths.push(`M ${pts[0]} L ${pts.slice(1).join(' L ')}`);

      // 90-degree symmetric partner (x, y) -> (y, x)
      const ptsRot = seg.map(
        ([x, y]) =>
          `${(cx + (y / chladniDomain) * plateR).toFixed(2)} ${(cy + (x / chladniDomain) * plateR).toFixed(2)}`
      );
      paths.push(`M ${ptsRot[0]} L ${ptsRot.slice(1).join(' L ')}`);
    }
  }

  traceLobes(1, 1);
  traceLobes(1, -1);

  return paths.join(' ');
}

function generateFaviconSVG() {
  const emblemR = 512 * 0.425; // 217.6
  const plateR = emblemR * 0.87; // 189.312
  const cyanRingR = emblemR * 0.90; // 195.84
  const innerRingR = emblemR * 0.48; // 104.448
  const outerBrassRingR = emblemR * 0.97; // 211.072
  const stylusRx = emblemR * 0.125; // 27.2
  const stylusRy = emblemR * 0.185; // 40.256
  const chladniD = buildChladniSvgPaths(plateR, 0.82);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <radialGradient id="bg-glow" cx="50%" cy="50%" r="52%">
      <stop offset="0%" stop-color="#18213D" />
      <stop offset="58%" stop-color="#0D101D" />
      <stop offset="100%" stop-color="#090A10" />
    </radialGradient>
    <linearGradient id="brass-frame" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#9A782D" />
      <stop offset="100%" stop-color="#584319" />
    </linearGradient>
    <linearGradient id="stylus-fill" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" />
      <stop offset="52%" stop-color="#BAE6FD" />
      <stop offset="100%" stop-color="#F5C451" />
    </linearGradient>
    <filter id="gold-glow" x="-15%" y="-15%" width="130%" height="130%">
      <feGaussianBlur stdDeviation="4" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
    <filter id="cyan-glow" x="-15%" y="-15%" width="130%" height="130%">
      <feGaussianBlur stdDeviation="4.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
    <clipPath id="plate-clip">
      <circle cx="256" cy="256" r="${plateR.toFixed(2)}" />
    </clipPath>
    <path id="chladni-nodes" d="${chladniD}" />
  </defs>

  <rect width="512" height="512" fill="#090A10" />
  <rect x="16" y="16" width="480" height="480" rx="97" ry="97" fill="url(#bg-glow)" stroke="url(#brass-frame)" stroke-width="4" />

  <circle cx="256" cy="256" r="${outerBrassRingR.toFixed(2)}" fill="none" stroke="#6E5623" stroke-width="2" opacity="0.7" />
  <circle cx="256" cy="256" r="${innerRingR.toFixed(2)}" fill="none" stroke="#38BDF8" stroke-width="2.2" opacity="0.52" />

  <g clip-path="url(#plate-clip)" filter="url(#gold-glow)">
    <use href="#chladni-nodes" fill="none" stroke="#F5C451" stroke-width="5.2" stroke-linecap="round" stroke-linejoin="round" />
    <use href="#chladni-nodes" fill="none" stroke="#FFF3C4" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" opacity="0.75" />
  </g>

  <circle cx="256" cy="256" r="${cyanRingR.toFixed(2)}" fill="none" stroke="#38BDF8" stroke-width="4.5" filter="url(#cyan-glow)" />
  <circle cx="256" cy="256" r="${cyanRingR.toFixed(2)}" fill="none" stroke="#D2F4FF" stroke-width="1.4" opacity="0.7" />

  <polygon points="256,${(256 - stylusRy - 4).toFixed(2)} ${(256 + stylusRx + 4).toFixed(2)},256 256,${(256 + stylusRy + 4).toFixed(2)} ${(256 - stylusRx - 4).toFixed(2)},256" fill="#0C0E16" />
  <polygon points="256,${(256 - stylusRy).toFixed(2)} ${(256 + stylusRx).toFixed(2)},256 256,${(256 + stylusRy).toFixed(2)} ${(256 - stylusRx).toFixed(2)},256" fill="url(#stylus-fill)" stroke="#F5C451" stroke-width="3" />
  <polygon points="256,${(256 - stylusRy * 0.5).toFixed(2)} ${(256 + stylusRx * 0.48).toFixed(2)},256 256,${(256 + stylusRy * 0.5).toFixed(2)} ${(256 - stylusRx * 0.48).toFixed(2)},256" fill="#FFFDF0" />
</svg>
`;
}

// ---------------------------------------------------------------------------
// Main Execution
// ---------------------------------------------------------------------------
function main() {
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });

  const targets = [
    { file: 'apple-touch-icon.png', size: 180, maskable: false },
    { file: 'icon-192.png', size: 192, maskable: false },
    { file: 'icon-512.png', size: 512, maskable: false },
    { file: 'icon-maskable-512.png', size: 512, maskable: true },
  ];

  for (const t of targets) {
    const png = renderChladniIcon(t.size, t.maskable);
    const outPath = path.join(PUBLIC_DIR, t.file);
    fs.writeFileSync(outPath, png);
    console.log(`[icons] Wrote ${t.file} (${t.size}x${t.size}, ${png.length} bytes)`);
  }

  const svg = generateFaviconSVG();
  const svgPath = path.join(PUBLIC_DIR, 'favicon.svg');
  fs.writeFileSync(svgPath, svg, 'utf8');
  console.log(`[icons] Wrote favicon.svg (${Buffer.byteLength(svg, 'utf8')} bytes)`);
}

main();
