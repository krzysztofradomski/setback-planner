import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import worker from '../worker/index.ts';
import { rulesSchema, evidenceSchema, transition, csvCell, validateExtraction } from '../worker/domain.ts';
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
test('bootstrap, secure sessions, tenant isolation, role enforcement and CSRF', async () => {
    const { env, db } = setup();
    const cookie = await ownerSession(env);
    assert.match(cookie, /__Host-sp_session=/);
    assert.equal((await api(env, '/api/auth/bootstrap', { email: 'other@example.com', password: 'another secure password', bootstrapSecret: 'b'.repeat(40) })).status, 409);
    const tenant = await (await api(env, '/api/tenants', { name: 'Independent recipient' }, cookie)).json() as {
        id: string;
    };
    const other = await (await api(env, '/api/tenants', { name: 'Other recipient' }, cookie)).json() as {
        id: string;
    };
    assert.equal((await api(env, '/api/users', { email: 'sales@example.com', password: 'sales password 12345', role: 'sales', tenantId: tenant.id }, cookie)).status, 201);
    const login = await api(env, '/api/auth/login', { email: 'sales@example.com', password: 'sales password 12345' });
    const salesCookie = login.headers.get('set-cookie')!.split(';')[0];
    assert.equal((await api(env, '/api/leads?tenant=' + other.id, undefined, salesCookie)).status, 404);
    assert.equal((await api(env, '/api/tenants', { name: 'Unauthorized' }, salesCookie)).status, 403);
    assert.equal((await worker.fetch(new Request(origin + '/api/auth/logout', { method: 'POST', headers: { Cookie: cookie } }), env)).status, 403);
    assert.throws(() => db.exec("UPDATE audit SET action='tampered'"), /immutable/);
    assert.throws(() => db.exec('DELETE FROM audit'), /immutable/);
    assert.equal((await api(env, '/api/auth/logout', {}, cookie)).status, 200);
    assert.equal((await api(env, '/api/auth/me', undefined, cookie)).status, 401);
});
test('inquiries and AI fail closed before configuration and consent', async () => { const { env } = setup(); assert.deepEqual(await (await api(env, '/api/recipients')).json(), { recipients: [], reason: 'Public inquiries have not been configured' }); assert.equal((await api(env, '/api/inquiries', {})).status, 503); const cookie = await ownerSession(env); assert.equal((await api(env, '/api/ai/extract', {}, cookie)).status, 503); });
test('deterministic eligibility requires agreed attribution and confirmations', () => { const lead = { status: 'paid', duplicate: 0, existing_customer: 0, created: 10000, attributed: 1000, attribution: '{"campaign":"fair"}' }; const rules = rulesSchema.parse({ agreement: 'Agreement 2026', campaign: 'fair', mode: 'basis_points', value: 125 }); const evidence = evidenceSchema.parse({ contractRef: 'C-1', contractCents: 1234567, paymentRef: 'P-1' }); assert.equal(transition(lead, 'commission_eligible', evidence, rules), 15432); assert.throws(() => transition({ ...lead, duplicate: 1 }, 'commission_eligible', evidence, rules), /eligibility/); assert.throws(() => transition(lead, 'commission_eligible', { ...evidence, paymentRef: '' }, rules), /eligibility/); assert.throws(() => transition({ ...lead, status: 'new' }, 'commission_eligible', evidence, rules), /transition/); assert.throws(() => transition({ ...lead, status: 'commission_settled' }, 'reversed', evidence, rules), /explanation/); assert.equal(transition({ ...lead, status: 'commission_settled' }, 'reversed', { ...evidence, resolution: 'Order cancelled' }, rules), 0); });
test('AI extracts only exact verifiable quotes and treats every claim uncertain', () => { const source = 'The maximum height is 9 metres.'; assert.equal(validateExtraction({ claims: [{ parameter: 'height', value: '9 metres', quote: source, uncertain: true }], unknowns: [] }, source).claims.length, 1); assert.throws(() => validateExtraction({ claims: [{ parameter: 'height', value: '12 metres', quote: source, uncertain: true }], unknowns: [] }, source)); assert.throws(() => validateExtraction({ claims: [{ parameter: 'height', value: '9 metres', quote: source, uncertain: false }], unknowns: [] }, source)); assert.equal(csvCell('=cmd()'), '"\'=cmd()"'); });
test('status updates are scoped, audited, reversible and erase personal data', async () => {
    const { env, db } = setup();
    const cookie = await ownerSession(env);
    const t = await (await api(env, '/api/tenants', { name: 'Recipient' }, cookie)).json() as {
        id: string;
    };
    db.prepare('INSERT INTO leads(id,tenant_id,project_id,contact,email_hash,project,attribution,created,attributed,consent) VALUES(?,?,?,?,?,?,?,?,?,?)').run('lead', t.id, 'p', '{"email":"private@example.com"}', 'hash', '{"secret":true}', '{}', Date.now(), Date.now(), '{}');
    const result = await api(env, '/api/leads/lead', { status: 'qualified', evidence: {}, existingCustomer: false, revision: 0 }, cookie, 'PATCH');
    assert.equal(result.status, 200, await result.text());
    assert.equal((await api(env, '/api/leads/lead', { status: 'accepted', evidence: {}, existingCustomer: false, revision: 0 }, cookie, 'PATCH')).status, 409);
    assert.equal(db.prepare("SELECT count(*) AS n FROM audit WHERE action='status_changed'").get()!.n, 1);
    assert.equal((await api(env, '/api/leads/lead', undefined, cookie, 'DELETE')).status, 200);
    assert.equal(db.prepare('SELECT contact FROM leads WHERE id=?').get('lead')!.contact, '{}');
});
test('AI requires opt-in, verifies output, caches privately and enforces global budget', async () => {
    const { env } = setup();
    const cookie = await ownerSession(env);
    const t = await (await api(env, '/api/tenants', { name: 'AI tenant' }, cookie)).json() as {
        id: string;
    };
    const source = 'The maximum building height is 9 metres.';
    let calls = 0;
    env.AI_ENABLED = 'true';
    env.AI_DAILY_LIMIT = '1';
    env.AI = { async run() { calls++; return { response: { claims: [{ parameter: 'height', value: '9 metres', quote: source, uncertain: true }], unknowns: [] }, usage: { input_tokens: 100, output_tokens: 50 } }; } };
    assert.equal((await api(env, '/api/ai/extract', { tenantId: t.id, text: source, source: 'Document 1', consent: false }, cookie)).status, 400);
    const body = { tenantId: t.id, text: source, source: 'Document 1', consent: true };
    assert.equal((await api(env, '/api/ai/extract', body, cookie)).status, 200);
    const cached = await (await api(env, '/api/ai/extract', body, cookie)).json() as {
        cached: boolean;
    };
    assert.equal(cached.cached, true);
    assert.equal(calls, 1);
    assert.equal((await api(env, '/api/ai/extract', { ...body, source: 'Document 2' }, cookie)).status, 429);
});
test('public inquiry validates recipient consent and Turnstile hostname/action, deduplicates and stores privately', async () => {
    const { env, db } = setup();
    const cookie = await ownerSession(env);
    const t = await (await api(env, '/api/tenants', { name: 'Recipient' }, cookie)).json() as {
        id: string;
    };
    const privacy = 'Recipient controller and privacy contact. Purpose: respond to inquiry. Retention: 90 days.';
    await api(env, '/api/tenants/' + t.id, { recipient_enabled: true, privacy_notice: privacy, retention_days: 90, rules: {} }, cookie, 'PATCH');
    env.TURNSTILE_SITEKEY = 'site';
    env.TURNSTILE_SECRET_KEY = 'server-secret';
    const body = { tenantId: t.id, projectId: 'project', contact: { name: 'Visitor', email: 'visitor@example.com' }, project: { schemaVersion: 1 }, attribution: { campaign: 'fair', firstSeenAt: new Date(Date.now() - 1000).toISOString() }, processingConsent: true, privacyNotice: privacy, turnstileToken: 'token' };
    const original = globalThis.fetch;
    let hostname = 'evil.example';
    globalThis.fetch = async () => Response.json({ success: true, hostname, action: 'inquiry' });
    try {
        assert.equal((await api(env, '/api/inquiries', { ...body, processingConsent: false })).status, 400);
        assert.equal((await api(env, '/api/inquiries', body)).status, 403);
        hostname = 'planner.example';
        assert.equal((await api(env, '/api/inquiries', body)).status, 201);
        assert.equal((await api(env, '/api/inquiries', body)).status, 201);
        assert.equal(db.prepare('SELECT sum(duplicate) AS n FROM leads').get()!.n, 1);
        assert.equal((await api(env, '/api/leads?tenant=' + t.id)).status, 401);
        assert.equal((await api(env, '/api/recipients')).status, 200);
    }
    finally {
        globalThis.fetch = original;
    }
});
test('settlement uses snapshotted commission agreement and cannot rewrite confirmed contract', async () => {
    const { env, db } = setup();
    const cookie = await ownerSession(env);
    const t = await (await api(env, '/api/tenants', { name: 'Financial recipient' }, cookie)).json() as {
        id: string;
    };
    const rules = rulesSchema.parse({ agreement: 'A-1', mode: 'fixed', value: 50000 });
    db.prepare('UPDATE tenants SET rules=? WHERE id=?').run(JSON.stringify(rules), t.id);
    db.prepare('INSERT INTO leads(id,tenant_id,project_id,contact,email_hash,project,attribution,created,attributed,consent,status) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run('financial', t.id, 'p', '{}', 'h', '{}', '{}', Date.now(), Date.now(), '{}', 'paid');
    const evidence = { contractRef: 'C-1', contractCents: 1000000, paymentRef: 'P-1' };
    assert.equal((await api(env, '/api/leads/financial', { status: 'commission_eligible', evidence, existingCustomer: false, revision: 0 }, cookie, 'PATCH')).status, 200);
    db.prepare('UPDATE tenants SET rules=? WHERE id=?').run(JSON.stringify({ ...rules, value: 999999 }), t.id);
    assert.equal((await api(env, '/api/leads/financial', { status: 'commission_settled', evidence: { ...evidence, contractRef: 'changed', settlementRef: 'S-1' }, existingCustomer: false, revision: 1 }, cookie, 'PATCH')).status, 422);
    const result = await (await api(env, '/api/leads/financial', { status: 'commission_settled', evidence: { ...evidence, settlementRef: 'S-1' }, existingCustomer: false, revision: 1 }, cookie, 'PATCH')).json() as {
        commission_cents: number;
    };
    assert.equal(result.commission_cents, 50000);
    const report = await (await api(env, '/api/report?tenant=' + t.id, undefined, cookie)).json() as {
        currency: {
            PLN: {
                settledCents: number;
            };
        };
    };
    assert.equal(report.currency.PLN.settledCents, 50000);
});
test('retention clears expired personal data and private cache while preserving financial audit', async () => {
    const { env, db } = setup();
    const cookie = await ownerSession(env);
    const t = await (await api(env, '/api/tenants', { name: 'Retention recipient' }, cookie)).json() as {
        id: string;
    };
    const old = Date.now() - 100 * 86400000;
    db.prepare('INSERT INTO leads(id,tenant_id,project_id,contact,email_hash,project,attribution,created,attributed,consent,status,commission_cents) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run('old', t.id, 'p', '{"email":"private@example.com"}', 'h', '{"private":true}', '{"representative":"rep"}', old, old, '{}', 'commission_settled', 10000);
    db.prepare('INSERT INTO ai_cache(key,tenant_id,result,expires) VALUES(?,?,?,?)').run('cache', t.id, '{"private":"quote"}', old);
    await worker.scheduled({}, env);
    const row = db.prepare('SELECT * FROM leads WHERE id=?').get('old')!;
    assert.equal(row.contact, '{}');
    assert.equal(row.project, '{}');
    assert.equal(row.email_hash, '');
    assert.equal(row.anonymized, 1);
    assert.equal(row.commission_cents, 10000);
    assert.equal(db.prepare('SELECT count(*) AS n FROM ai_cache').get()!.n, 0);
    assert.equal(db.prepare("SELECT count(*) AS n FROM audit WHERE action='personal_data_erased'").get()!.n, 1);
});
test('submission audit uses inserted duplicate flag despite a concurrent prior insertion', async () => {
    const { env, db } = setup();
    const cookie = await ownerSession(env);
    const t = await (await api(env, '/api/tenants', { name: 'Concurrent recipient' }, cookie)).json() as {
        id: string;
    };
    const privacy = 'Independent recipient, inquiry purpose and privacy contact, retention 90 days.';
    await api(env, '/api/tenants/' + t.id, { recipient_enabled: true, privacy_notice: privacy, retention_days: 90, rules: {} }, cookie, 'PATCH');
    env.TURNSTILE_SITEKEY = 'site';
    env.TURNSTILE_SECRET_KEY = 'secret';
    const batch = env.DB.batch.bind(env.DB);
    let inserted = false;
    env.DB.batch = async (statements) => {
        if (!inserted) {
            inserted = true;
            const emailHash = await import('../worker/security.ts').then(m => m.digest('visitor@example.com'));
            db.prepare('INSERT INTO leads(id,tenant_id,project_id,contact,email_hash,project,attribution,created,attributed,consent) VALUES(?,?,?,?,?,?,?,?,?,?)').run('concurrent', t.id, 'p', '{}', emailHash, '{}', '{}', Date.now(), Date.now(), '{}');
        }
        return batch(statements);
    };
    const original = globalThis.fetch;
    globalThis.fetch = async () => Response.json({ success: true, hostname: 'planner.example', action: 'inquiry' });
    try {
        const response = await api(env, '/api/inquiries', { tenantId: t.id, projectId: 'p', contact: { name: 'Visitor', email: 'visitor@example.com' }, project: {}, processingConsent: true, privacyNotice: privacy, turnstileToken: 'token' });
        assert.equal(response.status, 201);
        const body = await response.json() as {
            id: string;
        };
        const row = db.prepare('SELECT duplicate FROM leads WHERE id=?').get(body.id)!;
        const audit = db.prepare("SELECT detail FROM audit WHERE lead_id=? AND action='submitted'").get(body.id)!;
        assert.equal(row.duplicate, 1);
        assert.equal(JSON.parse(audit.detail as string).duplicate, true);
    }
    finally {
        globalThis.fetch = original;
    }
});
test('settlement excludes newly identified existing customers and audits manual classification changes', async () => {
    const { env, db } = setup();
    const cookie = await ownerSession(env);
    const t = await (await api(env, '/api/tenants', { name: 'Existing customer policy' }, cookie)).json() as {
        id: string;
    };
    const rules = rulesSchema.parse({ agreement: 'A-1', mode: 'fixed', value: 50000 });
    const evidence = { contractRef: 'C-1', contractCents: 1000000, paymentRef: 'P-1' };
    db.prepare('INSERT INTO leads(id,tenant_id,project_id,contact,email_hash,project,attribution,created,attributed,consent,status,evidence,commission_rules,commission_cents) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run('existing', t.id, 'p', '{}', 'h', '{}', '{}', Date.now(), Date.now(), '{}', 'commission_eligible', JSON.stringify(evidence), JSON.stringify(rules), 50000);
    assert.equal((await api(env, '/api/leads/existing', { status: 'commission_settled', evidence: { ...evidence, settlementRef: 'S-1' }, existingCustomer: true, revision: 0 }, cookie, 'PATCH')).status, 422);
    assert.equal(db.prepare('SELECT revision FROM leads WHERE id=?').get('existing')!.revision, 0);
    assert.equal((await api(env, '/api/leads/existing', { status: 'reversed', evidence: { ...evidence, resolution: 'Customer identified as existing' }, existingCustomer: true, revision: 0 }, cookie, 'PATCH')).status, 200);
    const audit = db.prepare("SELECT detail FROM audit WHERE lead_id=? AND action='status_changed'").get('existing')!;
    assert.equal(JSON.parse(audit.detail as string).existingCustomerBefore, false);
    assert.equal(JSON.parse(audit.detail as string).existingCustomerAfter, true);
});
test('reports count untrusted campaign/source property names without prototype collisions', async () => {
    const { env, db } = setup();
    const cookie = await ownerSession(env);
    const t = await (await api(env, '/api/tenants', { name: 'Source recipient' }, cookie)).json() as {
        id: string;
    };
    db.prepare('INSERT INTO leads(id,tenant_id,project_id,contact,email_hash,project,attribution,created,attributed,consent) VALUES(?,?,?,?,?,?,?,?,?,?)').run('source', t.id, 'p', '{}', 'h', '{}', '{"utm_source":"__proto__"}', Date.now(), Date.now(), '{}');
    const report = await (await api(env, '/api/report?tenant=' + t.id, undefined, cookie)).json() as {
        sources: Record<string, number>;
    };
    assert.equal(Object.hasOwn(report.sources, '__proto__'), true);
    assert.equal(report.sources.__proto__, 1);
});
test('campaign-qualified commission remains settleable after personal erasure without restoring attribution', async () => { const { env, db } = setup(); const cookie = await ownerSession(env); const t = await (await api(env, '/api/tenants', { name: 'Campaign recipient' }, cookie)).json() as {
    id: string;
}; const rules = rulesSchema.parse({ agreement: 'A-1', campaign: 'nonpersonal-event', value: 50000 }); db.prepare('UPDATE tenants SET rules=? WHERE id=?').run(JSON.stringify(rules), t.id); db.prepare('INSERT INTO leads(id,tenant_id,project_id,contact,email_hash,project,attribution,created,attributed,consent,status) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run('erase-finance', t.id, 'p', '{"email":"private@example.com"}', 'h', '{}', '{"campaign":"nonpersonal-event","representative":"private name"}', Date.now(), Date.now(), '{}', 'paid'); const evidence = { contractRef: 'C-1', contractCents: 1000000, paymentRef: 'P-1' }; assert.equal((await api(env, '/api/leads/erase-finance', { status: 'commission_eligible', evidence, existingCustomer: false, revision: 0 }, cookie, 'PATCH')).status, 200); assert.equal((await api(env, '/api/leads/erase-finance', undefined, cookie, 'DELETE')).status, 200); const before = db.prepare('SELECT * FROM leads WHERE id=?').get('erase-finance')!; assert.equal(before.attribution, '{}'); assert.equal(before.contact, '{}'); const snapshot = JSON.parse(before.commission_rules as string); assert.deepEqual(snapshot.eligibility, { campaignMatched: true }); assert.equal(JSON.stringify(snapshot).includes('private name'), false); assert.equal((await api(env, '/api/leads/erase-finance', { status: 'commission_settled', evidence: { ...evidence, settlementRef: 'S-1' }, existingCustomer: true, revision: 2 }, cookie, 'PATCH')).status, 422); assert.equal((await api(env, '/api/leads/erase-finance', { status: 'commission_settled', evidence: { ...evidence, contractRef: 'changed', settlementRef: 'S-1' }, existingCustomer: false, revision: 2 }, cookie, 'PATCH')).status, 422); const settled = await api(env, '/api/leads/erase-finance', { status: 'commission_settled', evidence: { ...evidence, settlementRef: 'S-1' }, existingCustomer: false, revision: 2 }, cookie, 'PATCH'); assert.equal(settled.status, 200); const after = db.prepare('SELECT * FROM leads WHERE id=?').get('erase-finance')!; assert.equal(after.status, 'commission_settled'); assert.equal(after.commission_cents, 50000); assert.equal(after.attribution, '{}'); assert.equal(after.contact, '{}'); });
test('over-user-limit AI requests cannot consume remaining shared processing budget', async () => { const { env, db } = setup(); const cookie = await ownerSession(env); const t = await (await api(env, '/api/tenants', { name: 'Quota recipient' }, cookie)).json() as {
    id: string;
}; env.AI_ENABLED = 'true'; env.AI_DAILY_LIMIT = '20'; let calls = 0; env.AI = { async run() { calls++; return { response: { claims: [], unknowns: [] } }; } }; for (let i = 0; i < 12; i++) {
    const result = await api(env, '/api/ai/extract', { tenantId: t.id, text: 'A document with no explicit planning dimensions.', source: 'Source ' + i, consent: true }, cookie);
    assert.equal(result.status, i < 10 ? 200 : 429);
} assert.equal(calls, 10); const { digest } = await import('../worker/security.ts'); const key = await digest('ai:global:' + Math.floor(Date.now() / 86400000)); assert.equal(db.prepare('SELECT count FROM rate_limits WHERE key=?').get(key)!.count, 10); });
test('assistant modes validate exact citations, scene references, locks and shared budgets',async()=>{
 const {env}=setup(),cookie=await ownerSession(env);
 const t=await (await api(env,'/api/tenants',{name:'Assistant'},cookie)).json() as {id:string};
 env.AI_ENABLED='true';let answer:unknown={points:[{sourceId:'doc',quote:'The height limit is nine metres.'}],questionsToVerify:[]};
 env.AI={async run(){return {response:answer}}};
 const body={tenantId:t.id,mode:'summary',question:'Summarize the height limit',sources:[{id:'doc',title:'Source',text:'The height limit is nine metres.'}],consent:true};
 assert.equal((await api(env,'/api/ai/assist',body,cookie)).status,200);
 answer={points:[{sourceId:'doc',quote:'Invented height'}],questionsToVerify:[]};
 assert.equal((await api(env,'/api/ai/assist',{...body,question:'Another summary please'},cookie)).status,502);
 const scene={units:'m',items:[{id:'house',name:'House',type:'house',x:0,y:0,w:10,d:8,rot:0,locked:true}]};
 answer={operations:[{type:'rotate',id:'house',degrees:90,quote:'Rotate House 90 degrees'}],questionsToVerify:[]};
 assert.equal((await api(env,'/api/ai/assist',{tenantId:t.id,mode:'layout',question:'Rotate House 90 degrees',scene,consent:true},cookie)).status,502);
 scene.items[0].locked=false;
 const r=await api(env,'/api/ai/assist',{tenantId:t.id,mode:'layout',question:'Rotate House 90 degrees',scene,consent:true},cookie);
 assert.equal(r.status,200);assert.equal((await r.json() as {applied:boolean}).applied,false);
});
test('retention erases more than one hundred expired leads atomically',async()=>{
 const {env,db}=setup(),cookie=await ownerSession(env);
 const t=await (await api(env,'/api/tenants',{name:'Retention volume'},cookie)).json() as {id:string};
 const insert=db.prepare('INSERT INTO leads(id,tenant_id,project_id,contact,email_hash,project,attribution,created,attributed,consent) VALUES(?,?,?,?,?,?,?,?,?,?)');
 for(let n=0;n<150;n++)insert.run('expired'+n,t.id,'p','{"email":"private@example.com"}','hash','{}','{}',1,1,'{}');
 await worker.scheduled({},env);
 assert.equal(db.prepare('SELECT count(*) n FROM leads WHERE anonymized=0').get()!.n,0);
 assert.equal(db.prepare("SELECT count(*) n FROM audit WHERE action='personal_data_erased'").get()!.n,150);
});

test('funnel counts are anonymous, bounded and readable only when signed in', async () => {
    const { env, db } = setup();
    assert.equal((await api(env, '/api/funnel', { step: 'visit', source: 'wiosna-2027' })).status, 200);
    assert.equal((await api(env, '/api/funnel', { step: 'visit', source: 'wiosna-2027' })).status, 200);
    assert.equal((await api(env, '/api/funnel', { step: 'parcel', source: '<script>' })).status, 200);
    assert.equal((await api(env, '/api/funnel', { step: 'hack', source: 'x' })).status, 400);
    assert.equal((await api(env, '/api/funnel', { step: 'visit', ip: '1.2.3.4' })).status, 400);
    const rows = db.prepare('SELECT step,source,count FROM funnel ORDER BY step').all() as { step: string; source: string; count: number }[];
    assert.deepEqual(rows.map(r => [r.step, r.source, r.count]), [['parcel', 'direct', 1], ['visit', 'wiosna-2027', 2]]);
    assert.equal((await api(env, '/api/funnel?days=30')).status, 401);
    const cookie = await ownerSession(env);
    const report = await (await api(env, '/api/funnel?days=30', undefined, cookie)).json() as { rows: unknown[] };
    assert.equal(report.rows.length, 2);
    const tenant = await (await api(env, '/api/tenants', { name: 'Recipient' }, cookie)).json() as { id: string };
    await api(env, '/api/users', { email: 'maker@example.com', password: 'a secure password 5678', role: 'manufacturer', tenantId: tenant.id }, cookie);
    const maker = (await api(env, '/api/auth/login', { email: 'maker@example.com', password: 'a secure password 5678' })).headers.get('set-cookie')!.split(';')[0];
    assert.equal((await api(env, '/api/funnel?days=30', undefined, maker)).status, 403, 'other recipients cannot read campaign labels');
});
