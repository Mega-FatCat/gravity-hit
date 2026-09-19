import {describe,it} from 'node:test';
import assert from 'node:assert/strict';
import {chooseAutomaticQuality} from '../src/quality-selection.js';

describe('automatic quality selection',()=>{
 it('selects high only when the current forest is expected to stay near 30 FPS',()=>{
  const result=chooseAutomaticQuality({gpu:'NVIDIA GeForce RTX 4090',deviceMemory:16,hardwareConcurrency:16,maxTextureSize:16384,maxRenderbufferSize:16384,displayPixels:1920*1080});
  assert.equal(result.quality,'high');assert.ok(result.expectedHighFps>=28);
 });
 it('selects High on a measured RTX 3070 when the 1080p profile stays near 30 FPS',()=>{
  const result=chooseAutomaticQuality({gpu:'NVIDIA GeForce RTX 3070',deviceMemory:8,hardwareConcurrency:16,maxTextureSize:16384,maxRenderbufferSize:16384,displayPixels:1920*1080});
  assert.equal(result.quality,'high');assert.ok(result.expectedHighFps>=28);
 });
 it('does not overestimate an integrated UHD adapter',()=>{
  assert.equal(chooseAutomaticQuality({gpu:'Intel(R) UHD Graphics 630',deviceMemory:4,hardwareConcurrency:8,maxTextureSize:16384,maxRenderbufferSize:16384}).quality,'low');
 });
 it('falls back to medium when privacy settings hide the GPU name',()=>{
  assert.equal(chooseAutomaticQuality({gpu:'Unknown GPU',hardwareConcurrency:8,maxTextureSize:16384,maxRenderbufferSize:16384,displayPixels:1920*1080}).quality,'medium');
 });
 it('accounts for the real render pixel count before selecting the tier',()=>{
  assert.equal(chooseAutomaticQuality({gpu:'NVIDIA GeForce RTX 4080',deviceMemory:16,hardwareConcurrency:16,maxRenderbufferSize:16384,displayPixels:3840*2160}).quality,'medium');
 });
});
