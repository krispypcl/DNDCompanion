/**
 * The banner's lower edge, as a soft mask rather than a hard cut.
 *
 * `clip-path` can only cut. To feather the curve the edge has to be a shape
 * that is blurred, and CSS has no way to blur a clip, so the shape is drawn
 * as an SVG with a Gaussian blur and used as the banner's `mask-image`: where
 * the mask is solid the photograph shows, where it fades the photograph fades.
 *
 * The SVG is built at the banner's own pixel size. A blur drawn in a unit
 * box and stretched to a wide, shallow layer would smear sideways far more
 * than it does up and down; in pixels it is the same softness in every
 * direction.
 */

export type Curve = {
  /** Fractions of the layer's height where the edge meets the right and left sides. */
  right: number;
  left: number;
  /** The two control points of the cubic between them, as [x, y] fractions. */
  c1: [number, number];
  c2: [number, number];
};

/** Mirrors the clip paths the banner falls back to without mask support. */
export const DESKTOP_CURVE: Curve = { right: 0.7, left: 0.3, c1: [0.74, 0.78], c2: [0.4, 0.46] };
export const PHONE_CURVE: Curve = { right: 0.46, left: 0.26, c1: [0.7, 0.56], c2: [0.34, 0.34] };

/** Blur in pixels. The curve is one long edge, so it takes a wide softening. */
export const DESKTOP_BLUR = 16;
export const PHONE_BLUR = 11;

/** Sizes are rounded so that a window being dragged does not re-draw the
    mask on every pixel; the mask is stretched to fit, and a few percent of
    stretch on a blur is invisible. */
export const STEP = 32;
export const snap = (n: number) => Math.max(STEP, Math.round(n / STEP) * STEP);

export function maskSvg(width: number, height: number, curve: Curve, blur: number): string {
  const w = snap(width);
  const h = snap(height);
  // The shape runs past the box on three sides so the blur has solid shape
  // to draw from there, and does not fade the banner at its own top and edges.
  const pad = Math.ceil(blur * 4);
  const x = (f: number) => +(f * w).toFixed(1);
  const y = (f: number) => +(f * h).toFixed(1);
  const d = [
    `M${-pad},${-pad}`,
    `H${w + pad}`,
    `V${y(curve.right)}`,
    `H${w}`,
    `C${x(curve.c1[0])},${y(curve.c1[1])} ${x(curve.c2[0])},${y(curve.c2[1])} 0,${y(curve.left)}`,
    `H${-pad}`,
    'Z'
  ].join(' ');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    `<defs><filter id="f" x="-30%" y="-30%" width="160%" height="160%">` +
    `<feGaussianBlur stdDeviation="${blur}"/></filter></defs>` +
    `<path d="${d}" fill="#fff" filter="url(#f)"/></svg>`
  );
}

export function maskUrl(width: number, height: number, curve: Curve, blur: number): string {
  return `url("data:image/svg+xml,${encodeURIComponent(maskSvg(width, height, curve, blur))}")`;
}
