import type { Env, User } from './types.ts';
export class HttpError extends Error {
    status: number;
    constructor(status: number, message: string) { super(message); this.status = status; }
}
export const fail = (status: number, message: string): never => { throw new HttpError(status, message); };
const enc = new TextEncoder();
export function randomToken() { return [...crypto.getRandomValues(new Uint8Array(32))].map(x => x.toString(16).padStart(2, '0')).join(''); }
export async function digest(value: string) { return [...new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(value)))].map(x => x.toString(16).padStart(2, '0')).join(''); }
export async function tokenHash(token: string, env: Env) { if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 32)
    fail(503, 'Authentication unavailable'); return digest(env.SESSION_SECRET + ':' + token); }
export async function passwordHash(password: string, salt = randomToken()) { const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']); const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: enc.encode(salt), iterations: 100000, hash: 'SHA-256' }, key, 256); return salt + ':' + [...new Uint8Array(bits)].map(x => x.toString(16).padStart(2, '0')).join(''); }
export function equal(a: string, b: string) { let result = a.length ^ b.length; for (let i = 0; i < Math.max(a.length, b.length); i++)
    result |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0); return result === 0; }
export async function authenticate(req: Request, env: Env): Promise<User> { const token = req.headers.get('Cookie')?.match(/(?:^|;\s*)__Host-sp_session=([a-f0-9]{64})(?:;|$)/)?.[1]; if (!token)
    return fail(401, 'Sign in required'); const user = await env.DB.prepare('SELECT u.id,u.email,u.role,u.tenant_id FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires>? AND u.active=1').bind(await tokenHash(token, env), Date.now()).first<User>(); return user ?? fail(401, 'Session expired'); }
export function owner(user: User) { if (user.role !== 'owner')
    fail(403, 'Owner role required'); }
export function tenantScope(user: User, tenant: string) { if (user.role !== 'owner' && user.tenant_id !== tenant)
    fail(404, 'Not found'); }
export async function rate(env: Env, key: string, limit: number, windowMs: number) { const now = Date.now(); const bucket = Math.floor(now / windowMs); const hash = await digest(key + ':' + bucket); const row = await env.DB.prepare('INSERT INTO rate_limits(key,count,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').bind(hash, now + windowMs).first<{
    count: number;
}>(); if (!row || row.count > limit)
    fail(429, 'Request limit reached; try later'); }
export async function jsonBody(req: Request) { if (!req.headers.get('Content-Type')?.startsWith('application/json'))
    fail(415, 'JSON required'); if (Number(req.headers.get('Content-Length')) > 131072)
    fail(413, 'Request too large'); const reader = req.body?.getReader(); if (!reader)
    fail(400, 'Body required'); let total = 0; const chunks: Uint8Array[] = []; for (;;) {
    const { done, value } = await reader!.read();
    if (done)
        break;
    total += value.length;
    if (total > 131072) {
        await reader!.cancel();
        fail(413, 'Request too large');
    }
    chunks.push(value);
} const bytes = new Uint8Array(total); let offset = 0; for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
} try {
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
}
catch {
    return fail(400, 'Invalid JSON');
} }
