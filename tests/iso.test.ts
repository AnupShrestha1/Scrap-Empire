import { describe, expect, it } from 'vitest';
import { VIEW } from '../src/config';
import { depthAt, isoProjection, screenDirToGrid, toScreen } from '../src/view/iso';

describe('isometric projection', () => {
  const proj = isoProjection(40, 26);

  it('fits the whole grid inside its bounding box', () => {
    expect(toScreen(proj, 0, 26).x).toBe(0);
    expect(toScreen(proj, 40, 0).x).toBe(proj.width);
    expect(toScreen(proj, 0, 0).y).toBe(0);
    expect(toScreen(proj, 40, 26).y).toBe(proj.height);
  });

  it('steps half a diamond per tile', () => {
    const a = toScreen(proj, 3, 3);
    const b = toScreen(proj, 4, 3);
    expect(b.x - a.x).toBe(VIEW.tileW / 2);
    expect(b.y - a.y).toBe(VIEW.tileH / 2);
  });

  it('sorts things lower on screen in front', () => {
    expect(depthAt(5, 5)).toBeGreaterThan(depthAt(5, 4));
    expect(depthAt(4, 5)).toBe(depthAt(5, 4));
  });
});

describe('screenDirToGrid', () => {
  const move = (sx: number, sy: number) => {
    const g = screenDirToGrid(sx, sy, { x: 0, y: 0 });
    const proj = isoProjection(10, 10);
    const from = toScreen(proj, 5, 5);
    const to = toScreen(proj, 5 + g.x, 5 + g.y);
    return { g, screen: { x: to.x - from.x, y: to.y - from.y } };
  };

  it('walks the way the stick points on screen', () => {
    const right = move(1, 0).screen;
    expect(right.x).toBeGreaterThan(0);
    expect(right.y).toBeCloseTo(0);
    const up = move(0, -1).screen;
    expect(up.x).toBeCloseTo(0);
    expect(up.y).toBeLessThan(0);
    const downLeft = move(-1, 1).screen;
    expect(downLeft.x / downLeft.y).toBeCloseTo(-1);
  });

  it('keeps the input strength and handles no input', () => {
    expect(Math.hypot(move(0.3, 0.4).g.x, move(0.3, 0.4).g.y)).toBeCloseTo(0.5);
    expect(screenDirToGrid(0, 0, { x: 9, y: 9 })).toEqual({ x: 0, y: 0 });
  });
});
