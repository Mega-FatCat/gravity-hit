import {describe,it} from 'node:test';
import assert from 'node:assert/strict';
import {LoadingProgress} from '../src/loading-progress.js';

describe('LoadingProgress',()=>{
 it('aggregates weighted real task progress',()=>{
  const events=[],progress=new LoadingProgress(event=>events.push(event));
  progress.register('assets',.75,'Loading assets').register('scene',.25,'Preparing scene');
  progress.update('assets',.5,{completed:5,total:10});
  progress.update('scene',.4,{completed:2,total:5,detail:'Planting ferns'});
  assert.equal(events.at(-1).progress,.475);
  assert.equal(events.at(-1).stage,'Preparing scene');
  assert.equal(events.at(-1).percent,48);
  assert.equal(events.at(-1).completed,2);
  assert.equal(events.at(-1).total,5);
  assert.equal(events.at(-1).detail,'Planting ferns');
  assert.equal(events.at(-1).activeTask,'scene');
  assert.deepEqual(events.at(-1).tasks.map(task=>task.id),['assets','scene']);
 });
 it('never moves the visible bar backwards',()=>{
  const events=[],progress=new LoadingProgress(event=>events.push(event));
  progress.register('assets',1,'Loading');
  progress.update('assets',.8);progress.update('assets',.4);
  assert.equal(events.at(-1).progress,.8);
 });
});
