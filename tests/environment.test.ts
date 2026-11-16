import {test} from 'node:test';import assert from 'node:assert/strict';import {sunPosition}from '../public/core/environment.ts';
test('solar direction is normalized and Warsaw summer noon is above winter noon',()=>{
 const summer=sunPosition('2026-06-21T10:00:00Z',52.23,21.01),winter=sunPosition('2026-12-21T11:00:00Z',52.23,21.01);
 assert.ok(summer.altitude>winter.altitude);assert.ok(summer.daylight);assert.ok(!sunPosition('2026-06-21T23:00:00Z',52.23,21.01).daylight);assert.ok(Math.abs(Math.hypot(...Object.values(summer.direction))-1)<1e-10);assert.throws(()=>sunPosition('bad',52,21));
});
