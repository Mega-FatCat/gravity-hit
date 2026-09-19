import test from 'node:test';
import assert from 'node:assert/strict';
import {DownloadProgress,formatBytes} from '../src/download-progress.js';

test('download progress reports byte totals and never double-counts completion',()=>{
 globalThis.location={href:'https://example.test/game/'};
 const tracker=new DownloadProgress({'forest/tree.glb':1000},()=>{});
 try{
  tracker.plan('./assets/forest/tree.glb');
  tracker.add('./assets/forest/tree.glb',240);
  const partial=tracker.snapshot();
  assert.equal(partial.loaded,240);
  assert.equal(partial.total,1000);
  assert.ok(partial.rate>0);
  assert.equal(partial.complete,0);
  assert.equal(partial.done,false);
  tracker.complete('./assets/forest/tree.glb');
  tracker.complete('./assets/forest/tree.glb');
  const result=tracker.snapshot();
  assert.equal(result.loaded,1000);
  assert.equal(result.total,1000);
  assert.equal(result.complete,1);
  assert.equal(result.done,true);
 }finally{tracker.dispose();delete globalThis.location;}
});

test('an authoritative response size replaces a larger manifest estimate',()=>{
 globalThis.location={href:'https://example.test/game/'};
 const tracker=new DownloadProgress({'forest/tree.glb':1500},()=>{});
 try{
  tracker.plan('./assets/forest/tree.glb');
  tracker.setTotal('./assets/forest/tree.glb',900);
  tracker.add('./assets/forest/tree.glb',900);
  tracker.complete('./assets/forest/tree.glb');
  assert.equal(tracker.snapshot().total,900);
  assert.equal(tracker.snapshot().loaded,900);
 }finally{tracker.dispose();delete globalThis.location;}
});

test('byte formatter uses readable binary units',()=>{
 assert.equal(formatBytes(1536),'1.5 KB');
 assert.equal(formatBytes(5*1024*1024),'5.0 MB');
});
