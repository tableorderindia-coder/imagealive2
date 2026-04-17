import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calculateDefaultOverlayPlacement,
  getOverlayRenderMetrics,
} from '../src/lib/overlay-placement.js';

test('defaults to centered placement with contained scale for mismatched media', () => {
  const placement = calculateDefaultOverlayPlacement({
    photoWidth: 1200,
    photoHeight: 1600,
    videoWidth: 1024,
    videoHeight: 576,
  });

  assert.deepEqual(placement, {
    x: 0,
    y: 0,
    scale: 1,
  });
});

test('converts saved placement into render metrics inside the tracked photo', () => {
  const metrics = getOverlayRenderMetrics({
    photoWidth: 1200,
    photoHeight: 1600,
    videoWidth: 1024,
    videoHeight: 576,
    placement: {
      x: 0.1,
      y: -0.2,
      scale: 0.5,
    },
  });

  assert.deepEqual(metrics, {
    width: 0.5,
    height: 0.2109375,
    x: 0.1,
    y: -0.2,
  });
});
