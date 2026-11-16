/** A label's box: x is its centre, bottom its lower edge, in screen pixels (y grows downward). */
export interface LabelBox {
  x: number;
  bottom: number;
  width: number;
  height: number;
}

/** A rectangle in screen pixels: top is above bottom. */
export interface Bounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

function boundsOf(box: LabelBox): Bounds {
  return {
    left: box.x - box.width / 2,
    right: box.x + box.width / 2,
    top: box.bottom - box.height,
    bottom: box.bottom,
  };
}

/** Strict overlap, grown by `gap` on every side: boxes exactly `gap` apart do not overlap. */
function overlaps(a: Bounds, b: Bounds, gap: number): boolean {
  return (
    a.left < b.right + gap &&
    b.left < a.right + gap &&
    a.top < b.bottom + gap &&
    b.top < a.bottom + gap
  );
}

/** Slides the box up or down past each box it hits; undefined when the band stops it first. */
function slide(
  start: LabelBox,
  placed: Bounds[],
  band: Bounds,
  gap: number,
  direction: 'up' | 'down',
): LabelBox | undefined {
  let box = start;
  // Each move clears one more placed box for good, so the loop ends after at most placed.length moves.
  for (let step = 0; step <= placed.length; step++) {
    const hit = placed.find((other) => overlaps(boundsOf(box), other, gap));
    if (!hit) return box;
    const bottom = direction === 'up' ? hit.top - gap : hit.bottom + gap + box.height;
    if (bottom > band.bottom || bottom - box.height < band.top) return undefined;
    box = { ...box, bottom };
  }
  return undefined;
}

/**
 * Moves each label up or down, in the given order, until it overlaps no earlier label and no
 * obstacle. When no spot in the band is clear, the label keeps its clamped spot: every label is
 * still returned.
 */
// ponytail: greedy O(n²) per frame, fine for the ~20 demons on screen; a sweep line if that ever grows.
export function layoutLabels(
  labels: LabelBox[],
  obstacles: Bounds[],
  band: Bounds,
  gap: number,
): LabelBox[] {
  const placed = [...obstacles];
  return labels.map((label) => {
    const start: LabelBox = {
      ...label,
      x: Math.max(band.left + label.width / 2, Math.min(band.right - label.width / 2, label.x)),
      bottom: Math.max(band.top + label.height, Math.min(band.bottom, label.bottom)),
    };
    const box =
      slide(start, placed, band, gap, 'up') ?? slide(start, placed, band, gap, 'down') ?? start;
    placed.push(boundsOf(box));
    return box;
  });
}
