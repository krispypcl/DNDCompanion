/**
 * Owlbear draws shapes in plain sRGB colours; the sheet's condition colours
 * are written in oklch. This turns one into the other (#rrggbb), and passes
 * hex colours through.
 */
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const hex2 = (n: number) => Math.round(clamp01(n) * 255).toString(16).padStart(2, '0');
const gamma = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);

export function toHex(colour: string | null | undefined, fallback = '#888888'): string {
  const text = String(colour ?? '').trim();
  const h = text.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (h) return h[1].length === 3 ? `#${[...h[1]].map((c) => c + c).join('')}`.toLowerCase() : `#${h[1].toLowerCase()}`;
  const m = text.match(/^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)(?:deg)?\s*(?:\/\s*[\d.]+%?\s*)?\)$/i);
  if (!m) return fallback;
  const L = Number(m[1]) / (m[2] ? 100 : 1);
  const C = Number(m[3]);
  const H = (Number(m[4]) * Math.PI) / 180;
  const a = C * Math.cos(H);
  const b = C * Math.sin(H);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3;
  const mm = m_ ** 3;
  const s = s_ ** 3;
  const r = 4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * s;
  const g = -1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * s;
  const bl = -0.0041960863 * l - 0.7034186147 * mm + 1.707614701 * s;
  return `#${hex2(gamma(r))}${hex2(gamma(g))}${hex2(gamma(bl))}`;
}
