import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appearanceSchema, resolveAppearance, materialPresets, resetAppearance } from '../public/core/materials.ts';
test('materials resolve overrides without changing base or unrelated walls',()=>{
  const overrides=appearanceSchema.parse({facade:'brick-red',walls:{'1':'wood'},grout:'#cccccc'});
  const resolved=resolveAppearance(overrides);
  assert.equal(resolved.facade,'brick-red');assert.equal(resolved.walls['1'],'wood');
  assert.equal(resolveAppearance({}).facade,'plaster');
  const reset=resetAppearance(overrides,'facade');
  assert.equal(resolveAppearance(reset).facade,'plaster');assert.equal(reset.walls?.['1'],'wood');
  assert.deepEqual(resetAppearance(overrides),{});
  assert.equal(overrides.facade,'brick-red');
});
test('all presets carry physical tile dimensions, roughness and conceptual provenance',()=>{
  for(const material of Object.values(materialPresets)){
    assert.ok(material.tileWidth>0&&material.tileHeight>0);
    assert.ok(material.roughness>=0&&material.roughness<=1);
    assert.equal(material.confirmation,'conceptual');
  }
  assert.throws(()=>appearanceSchema.parse({facade:'invented'}));
  assert.throws(()=>appearanceSchema.parse({roofColor:'url(javascript:bad)'}));
  assert.throws(()=>appearanceSchema.parse({walls:{'-1':'wood'}}));
});
