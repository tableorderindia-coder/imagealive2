import test from 'node:test';
import assert from 'node:assert/strict';

import { getViewerMode } from '../src/lib/ar-viewer.js';

test('uses tracked mode when a tracking file URL exists', () => {
  assert.equal(
    getViewerMode({ tracking_url: 'https://example.com/targets.mind' }),
    'tracked'
  );
});

test('falls back to manual mode when tracking is missing or blank', () => {
  assert.equal(getViewerMode({ tracking_url: '' }), 'manual');
  assert.equal(getViewerMode({ tracking_url: '   ' }), 'manual');
  assert.equal(getViewerMode({ tracking_url: null }), 'manual');
});
