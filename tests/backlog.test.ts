import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
test('backlog dependencies reference earlier unique features and completed features have evidence', () => {
  const {features} = JSON.parse(readFileSync('docs/features.json','utf8'));
  const seen = new Set<string>();
  for (const f of features) {
    assert.ok(!seen.has(f.id));
    for (const d of f.dependencies) assert.ok(seen.has(d), `Unknown or unordered dependency ${d}`);
    assert.ok(['queued','in_progress','blocked','completed'].includes(f.status));
    assert.ok(f.acceptanceCriteria.length > 0);
    if (f.status === 'completed') assert.ok(f.tests.length > 0);
    seen.add(f.id);
  }
});
