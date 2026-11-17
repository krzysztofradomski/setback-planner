import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readAttribution,validateAttribution,campaignLabel } from '../public/core/attribution.ts';
test('campaign attribution accepts only bounded labels and keeps timestamps',()=>{
  const first=readAttribution('?utm_source=fair&event=Warsaw%202026&email=person@example.com',null,new Date('2026-11-16T10:00:00Z'))!;
  assert.equal(first.event,'Warsaw 2026');assert.equal('email' in first,false);
  const next=readAttribution('?utm_campaign=winter',first,new Date('2026-11-16T11:00:00Z'))!;
  assert.equal(next.firstSeenAt,first.firstSeenAt);assert.equal(next.lastSeenAt,'2026-11-16T11:00:00.000Z');assert.equal(next.utm_source,'fair');
  for(const value of ['x'.repeat(81),'person@example.com','https://example.com','<script>','a\n b'])assert.equal(campaignLabel(value),undefined);
  assert.equal(validateAttribution({utm_source:'x',firstSeenAt:'bad',lastSeenAt:'bad'}),null);
  assert.equal(readAttribution('?utm_source=person@example.com'),null);
});
