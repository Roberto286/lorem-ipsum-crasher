import { describe, expect, it } from 'vitest';
import { config } from '../src/config';
import { type Bounds, type LabelBox, layoutLabels } from '../src/utils/labelLayout';

const gap = config.enemy.labelSpacing;
const screen: Bounds = {
  left: 0,
  right: config.screen.width,
  top: 0,
  bottom: config.screen.height,
};

function boundsOf(box: LabelBox): Bounds {
  return {
    left: box.x - box.width / 2,
    right: box.x + box.width / 2,
    top: box.bottom - box.height,
    bottom: box.bottom,
  };
}

/** True when the two boxes are at least `gap` px apart horizontally or vertically. */
function apart(a: Bounds, b: Bounds): boolean {
  return (
    a.right + gap <= b.left ||
    b.right + gap <= a.left ||
    a.bottom + gap <= b.top ||
    b.bottom + gap <= a.top
  );
}

describe('layoutLabels', () => {
  describe('when a label overlaps nothing', () => {
    it('keeps a label that overlaps nothing where it is', () => {
      const label = { x: 100, bottom: 100, width: 40, height: 10 };
      const far = { left: 300, right: 320, top: 0, bottom: 10 };
      expect(layoutLabels([label], [far], screen, gap)).toEqual([label]);
    });
  });

  describe('when labels overlap each other', () => {
    it('moves a later label above an earlier one it would cover', () => {
      const first = { x: 100, bottom: 100, width: 40, height: 10 };
      const [kept, moved] = layoutLabels([first, { ...first }], [], screen, gap);
      expect(kept).toEqual(first);
      expect(moved.x).toBe(first.x);
      expect(moved.bottom).toBe(first.bottom - first.height - gap);
      expect(apart(boundsOf(kept), boundsOf(moved))).toBe(true);
    });

    it('moves a label below when there is no room above', () => {
      // The first label touches the top of the band, so nothing fits above it.
      const first = { x: 100, bottom: 20, width: 40, height: 20 };
      const second = { ...first };
      const [, moved] = layoutLabels([first, second], [], screen, gap);
      expect(moved.bottom).toBe(first.bottom + gap + second.height);
      expect(apart(boundsOf(first), boundsOf(moved))).toBe(true);
    });

    it('leaves the first label in its natural spot', () => {
      const tall = { x: 100, bottom: 100, width: 40, height: 30 };
      const short = { x: 100, bottom: 100, width: 40, height: 10 };
      expect(layoutLabels([tall, short], [], screen, gap)[0]).toEqual(tall);
      expect(layoutLabels([short, tall], [], screen, gap)[0]).toEqual(short);
    });
  });

  describe('when a label would cover an obstacle', () => {
    it('keeps labels clear of an obstacle such as the hero', () => {
      const hero = { left: 90, right: 110, top: 40, bottom: 60 };
      const label = { x: 100, bottom: 50, width: 20, height: 10 };
      const [moved] = layoutLabels([label], [hero], screen, gap);
      expect(moved.bottom).toBe(hero.top - gap);
      expect(apart(boundsOf(moved), hero)).toBe(true);
    });
  });

  describe('when labels sit near the edge of the band', () => {
    it('keeps every label inside the band', () => {
      const labels = [
        { x: 0, bottom: 0, width: 40, height: 10 },
        { x: 10000, bottom: 10000, width: 40, height: 10 },
      ];
      for (const box of layoutLabels(labels, [], screen, gap).map(boundsOf)) {
        expect(box.left).toBeGreaterThanOrEqual(screen.left);
        expect(box.right).toBeLessThanOrEqual(screen.right);
        expect(box.top).toBeGreaterThanOrEqual(screen.top);
        expect(box.bottom).toBeLessThanOrEqual(screen.bottom);
      }
    });
  });

  describe('when nothing fits', () => {
    it('ends and returns one box per label even when nothing fits', () => {
      const tinyBand: Bounds = { left: 0, right: 50, top: 0, bottom: 20 };
      const labels = Array.from({ length: 12 }, () => ({
        x: 25,
        bottom: 10,
        width: 100,
        height: 30,
      }));
      const boxes = layoutLabels(labels, [], tinyBand, gap);
      expect(boxes).toHaveLength(labels.length);
      expect(boxes.every((box) => Number.isFinite(box.x) && Number.isFinite(box.bottom))).toBe(
        true,
      );
    });
  });

  describe('when the caller keeps its input', () => {
    it('does not change the boxes it was given', () => {
      const labels = [
        { x: 100, bottom: 100, width: 40, height: 10 },
        { x: 100, bottom: 100, width: 40, height: 10 },
      ];
      const obstacles = [{ left: 90, right: 110, top: 40, bottom: 60 }];
      const labelsBefore = structuredClone(labels);
      const obstaclesBefore = structuredClone(obstacles);
      layoutLabels(labels, obstacles, screen, gap);
      expect(labels).toEqual(labelsBefore);
      expect(obstacles).toEqual(obstaclesBefore);
    });
  });
});
