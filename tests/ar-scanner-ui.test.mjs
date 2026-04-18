import test from 'node:test';
import assert from 'node:assert/strict';

import { getTrackedScannerUi } from '../src/lib/ar-scanner-ui.js';

test('tracked scanner hides hud text and diagnostics but keeps the red box', () => {
  assert.deepEqual(getTrackedScannerUi(), {
    showHud: false,
    showDiagnostics: false,
    showRedBox: true,
  });
});
