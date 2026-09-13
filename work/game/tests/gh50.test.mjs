import test from 'node:test';
import assert from 'node:assert/strict';
import {ritualSlabCoverage,ritualSlabMarkedBush} from '../src/environment.js';

test('GH-50 ritual slab exclusion follows the central rock footprint only', () => {
  assert.equal(ritualSlabCoverage(0, 0.83), true, 'stone center is protected');
  assert.equal(ritualSlabCoverage(0.70, 0.83), true, 'plant base on the slab edge is protected');
  assert.equal(ritualSlabCoverage(0, 0.83 + 0.52), true, 'plant base on the slab back/front edge is protected');

  // These points are close to the rock but are on soil outside its footprint.
  // They must remain available for normal forest-floor vegetation.
  assert.equal(ritualSlabCoverage(0.84, 0.83), false);
  assert.equal(ritualSlabCoverage(0, 0.83 - 0.66), false);
  assert.equal(ritualSlabCoverage(0.84, 0.83 + 0.64), false);

  assert.equal(ritualSlabCoverage(0.70, 0.83, 0.08), true, 'wide plant base remains off the stone');
  assert.equal(ritualSlabCoverage(0.91, 0.83, 0.08), false, 'soil beside the stone remains available');
});

test('GH-50 screenshot-marked slab bushes are narrowly excluded', () => {
  assert.equal(ritualSlabMarkedBush(1.6269, 1.5113), true, 'marked bush root one is excluded');
  assert.equal(ritualSlabMarkedBush(0.4548, -0.5828), true, 'marked bush root two is excluded');
  assert.equal(ritualSlabMarkedBush(0.7806, -0.2388), true, 'marked bush root three is excluded');
  assert.equal(ritualSlabMarkedBush(1.72, 1.56), false, 'nearby background soil remains available');
});
