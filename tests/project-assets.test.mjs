import test from 'node:test';
import assert from 'node:assert/strict';

import { getTargetImageHref } from '../src/lib/project-assets.js';

test('returns the uploaded image url for opening the target image directly', () => {
  assert.equal(
    getTargetImageHref({
      image_url: 'https://example.com/storage/v1/object/public/images/sample-photo.jpg',
    }),
    'https://example.com/storage/v1/object/public/images/sample-photo.jpg'
  );
});

test('falls back to an empty string when no image url exists', () => {
  assert.equal(getTargetImageHref(null), '');
  assert.equal(getTargetImageHref({ image_url: '' }), '');
});
