import test from 'node:test';
import assert from 'node:assert/strict';
import {plantRootBurial} from '../src/environment.js';

test('bush grounding uses deeper scale-aware burial without moving low ground cover excessively',()=>{
 assert.equal(plantRootBurial(.1,false),.012);
 assert.ok(plantRootBurial(.4,true)>=.02);
 assert.ok(plantRootBurial(2.5,true)>plantRootBurial(.4,true));
 assert.ok(plantRootBurial(10,true)<=.048);
});
