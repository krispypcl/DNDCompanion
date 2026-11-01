/**
 * The banner's lower edge: a straight slash, falling from left to right, with
 * a long soft fade rather than a cut.
 *
 * It is a plain CSS linear gradient used as the banner's mask. The only work
 * is the angle and where the fade sits: a gradient's angle is in degrees, but
 * the slash is defined by where it meets each side of the box, so the angle
 * depends on the box's proportions and is worked out from its measured size.
 */

export type Slash = {
  /** Fractions of the layer's height where the middle of the fade meets the left and right sides. */
  left: number;
  right: number;
  /** How long the fade is, as a fraction of the layer's height, measured across the slash. */
  feather: number;
};

export const DESKTOP_SLASH: Slash = { left: 0.36, right: 0.62, feather: 0.62 };
/** A phone's box is tall and narrow, so the same fall would read as a cliff. */
export const PHONE_SLASH: Slash = { left: 0.36, right: 0.48, feather: 0.5 };

/** Until the layer has been measured: level, but as soft. */
export const FALLBACK_MASK = 'linear-gradient(to bottom, #000 18%, transparent 82%)';

const round = (n: number, places = 2) => +n.toFixed(places);

export function slashMask(width: number, height: number, slash: Slash): string {
  if (!(width > 0) || !(height > 0)) return FALLBACK_MASK;
  const drop = (slash.right - slash.left) * height;
  const tilt = Math.atan2(drop, width);
  // CSS measures from "to top", clockwise. Straight down is 180deg; the fade
  // points down and a little to the left, square to a slash that falls to
  // the right.
  const angle = 180 + (tilt * 180) / Math.PI;
  const rad = (angle * Math.PI) / 180;
  const ux = Math.sin(rad);
  const uy = -Math.cos(rad);
  // The gradient line runs through the box's centre and is long enough to
  // reach its far corners.
  const length = Math.abs(width * ux) + Math.abs(height * uy);
  // Where the slash's midpoint falls along that line.
  const middle = ((slash.left + slash.right) / 2) * height;
  const at = length / 2 + (middle - height / 2) * uy;
  const half = (slash.feather * height) / 2;
  // Eased at both ends (a smoothstep), so neither the start nor the end of
  // the fade shows as a line: a linear ramp leaves a visible crease where it
  // meets the solid image and where it meets the page.
  const STEPS = 10;
  const stops = Array.from({ length: STEPS + 1 }, (_, i) => {
    const t = i / STEPS;
    const alpha = 1 - t * t * (3 - 2 * t);
    return `rgba(0,0,0,${round(alpha, 3)}) ${round(at - half + t * half * 2)}px`;
  });
  return `linear-gradient(${round(angle, 3)}deg, ${stops.join(', ')})`;
}
