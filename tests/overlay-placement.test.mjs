import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calculateDefaultOverlayPlacement,
  computeOverlayMetrics,
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

test('computes cover metrics in photo space with inset applied', () => {
  const metrics = computeOverlayMetrics({
    photoWidth: 1200,
    photoHeight: 1600,
    videoWidth: 1024,
    videoHeight: 576,
    fit: 'cover',
  });

  assert.deepEqual(metrics, {
    width: 2.2518518518518515,
    height: 1.2666666666666666,
    photoWidth: 1,
    photoHeight: 1.3333333333333333,
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
    width: 1.1259259259259258,
    height: 0.6333333333333333,
    x: 0.1,
    y: -0.2,
    photoWidth: 1,
    photoHeight: 1.3333333333333333,
  });
});
