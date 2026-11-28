import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import worker from '../worker/index.ts';
import type { Database, Statement, Env } from '../worker/types.ts';
function setup() {
    const db = new DatabaseSync(':memory:');
    db.exec(readFileSync(new URL('../migrations/0001_business.sql', import.meta.url), 'utf8'));
    db.exec(readFileSync(new URL('../migrations/0002_funnel.sql', import.meta.url), 'utf8'));
    const adapt = (sql: string, params: unknown[] = []): Statement => ({ bind(...p: unknown[]) { return adapt(sql, p); }, async first<T>() { return (db.prepare(sql).get(...params as never[]) ?? null) as T | null; }, async all<T>() { return { results: db.prepare(sql).all(...params as never[]) as T[] }; }, async run() { return { meta: { changes: Number(db.prepare(sql).run(...params as never[]).changes) } }; } });
    const DB: Database = { prepare: adapt, async batch(statements) {
            db.exec('BEGIN');
            try {
                const r = [];
                for (const s of statements)
                    r.push(await s.run());
                db.exec('COMMIT');
                return r;
            }
            catch (e) {
                db.exec('ROLLBACK');
                throw e;
            }
        } };
    const env: Env = { DB, ASSETS: { async fetch() { return new Response('asset'); } }, SESSION_SECRET: 's'.repeat(40), BOOTSTRAP_SECRET: 'b'.repeat(40) };
    return { db, env };
}
const origin = 'https://planner.example';
async function api(env: Env, path: string, body?: unknown, cookie?: string, method = body ? 'POST' : 'GET') { return worker.fetch(new Request(origin + path, { method, headers: { Origin: origin, 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) }), env); }
async function ownerSession(env: Env) { const r = await api(env, '/api/auth/bootstrap', { email: 'owner@example.com', password: 'a secure password 1234', bootstrapSecret: 'b'.repeat(40) }); assert.equal(r.status, 200); return r.headers.get('set-cookie')!.split(';')[0]; }
test('owner sign-in, secure sessions, CSRF and password change', async () => {
    const { env, db } = setup();
    const cookie = await ownerSession(env);
    assert.match(cookie, /__Host-sp_session=/);
    assert.equal((await api(env, '/api/auth/bootstrap', { email: 'other@example.com', password: 'another secure password', bootstrapSecret: 'b'.repeat(40) })).status, 409);
    assert.equal((await api(env, '/api/auth/me', undefined, cookie)).status, 200);
    assert.equal((await worker.fetch(new Request(origin + '/api/auth/logout', { method: 'POST', headers: { Cookie: cookie } }), env)).status, 403, 'cross-site POST refused');
    // Accounts left over from the removed partner roles cannot sign in.
    db.prepare("INSERT INTO tenants(id,name) VALUES('t1','Old recipient')").run();
    const login = await api(env, '/api/auth/login', { email: 'owner@example.com', password: 'a secure password 1234' });
    db.prepare("INSERT INTO users(id,email,password,role,tenant_id) VALUES('u2','sales@example.com',(SELECT password FROM users WHERE email='owner@example.com'),'sales','t1')").run();
    assert.equal(login.status, 200);
    assert.equal((await api(env, '/api/auth/login', { email: 'sales@example.com', password: 'a secure password 1234' })).status, 401);
    assert.equal((await api(env, '/api/auth/password', { currentPassword: 'a secure password 1234', newPassword: 'a newer password 5678' }, cookie)).status, 200);
    assert.equal((await api(env, '/api/auth/me', undefined, cookie)).status, 401, 'password change ends sessions');
    assert.equal((await api(env, '/api/auth/login', { email: 'owner@example.com', password: 'a newer password 5678' })).status, 200);
});
test('partner, inquiry, lead and assistant routes are gone', async () => {
    const { env } = setup();
    const cookie = await ownerSession(env);
    for (const [path, body] of [['/api/recipients'], ['/api/inquiries', {}], ['/api/tenants'], ['/api/users'], ['/api/leads?tenant=x'], ['/api/report?tenant=x'], ['/api/ai/extract', {}], ['/api/ai/assist', {}]] as [string, unknown?][])
        assert.equal((await api(env, path, body, cookie)).status, 404, path);
});
test('funnel counts are anonymous, bounded and readable only when signed in', async () => {
    const { env, db } = setup();
    assert.equal((await api(env, '/api/funnel', { step: 'visit', source: 'wiosna-2027' })).status, 200);
    assert.equal((await api(env, '/api/funnel', { step: 'visit', source: 'wiosna-2027' })).status, 200);
    assert.equal((await api(env, '/api/funnel', { step: 'parcel', source: '<script>' })).status, 200);
    assert.equal((await api(env, '/api/funnel', { step: 'inquiry', source: 'x' })).status, 400);
    assert.equal((await api(env, '/api/funnel', { step: 'visit', ip: '1.2.3.4' })).status, 400);
    const rows = db.prepare('SELECT step,source,count FROM funnel ORDER BY step').all() as { step: string; source: string; count: number }[];
    assert.deepEqual(rows.map(r => [r.step, r.source, r.count]), [['parcel', 'direct', 1], ['visit', 'wiosna-2027', 2]]);
    assert.equal((await api(env, '/api/funnel?days=30')).status, 401);
    const cookie = await ownerSession(env);
    const report = await (await api(env, '/api/funnel?days=30', undefined, cookie)).json() as { rows: unknown[] };
    assert.equal(report.rows.length, 2);
});
