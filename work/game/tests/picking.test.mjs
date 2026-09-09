import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveLogicalHit,visibleSurface} from '../src/picking.js';
const item=(id,extra={})=>({visible:true,material:{visible:true,opacity:1},userData:{item:id},...extra});
const map=o=>o.userData.item;
test('nearest of overlapping nested surfaces resolves to one logical item',()=>{
 const bottle=item('bottle'),pipe=item('pipe');
 assert.equal(resolveLogicalHit([{distance:2,object:pipe},{distance:1.1,object:bottle},{distance:1,object:bottle}],map),'bottle');
});
test('hidden ancestors and visual-only volumes cannot intercept input',()=>{
 const hidden=item('bag',{parent:{visible:true,parent:{visible:false}}}),smoke=item('bottle',{userData:{item:'bottle',noPick:true}}),pipe=item('pipe');
 assert.equal(visibleSurface(hidden),false);
 assert.equal(resolveLogicalHit([{distance:.1,object:hidden},{distance:.2,object:smoke},{distance:.3,object:pipe}],map),'pipe');
});
test('solid environment blocks props behind it and invisible surfaces do not pick',()=>{
 const pipe=item('pipe');assert.equal(resolveLogicalHit([{distance:2,object:pipe}],map,1),null);
 assert.equal(visibleSurface(item('lighter',{material:{transparent:true,opacity:0}})),false);
});
