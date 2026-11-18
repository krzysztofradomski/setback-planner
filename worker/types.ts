export interface Statement {
    bind(...values: unknown[]): Statement;
    first<T = Record<string, unknown>>(): Promise<T | null>;
    all<T = Record<string, unknown>>(): Promise<{
        results: T[];
    }>;
    run(): Promise<{
        meta: {
            changes: number;
        };
    }>;
}
export interface Database {
    prepare(sql: string): Statement;
    batch(statements: Statement[]): Promise<unknown[]>;
}
export interface Env {
    DB: Database;
    ASSETS: {
        fetch(request: Request): Promise<Response>;
    };
    AI?: {
        run(model: string, input: Record<string, unknown>): Promise<unknown>;
        toMarkdown?(documents: { name: string; blob: Blob }[]): Promise<{ data?: string; format?: string }[]>;
    };
    SESSION_SECRET?: string;
    BOOTSTRAP_SECRET?: string;
    TURNSTILE_SECRET_KEY?: string;
    TURNSTILE_SITEKEY?: string;
    AI_ENABLED?: string;
    AI_DAILY_LIMIT?: string;
}
export interface User {
    id: string;
    email: string;
    role: 'owner' | 'manufacturer' | 'sales';
    tenant_id: string | null;
    password?: string;
}
export interface Lead {
    id: string;
    tenant_id: string;
    project_id: string;
    contact: string;
    email_hash: string;
    project: string;
    attribution: string;
    created: number;
    attributed: number;
    consent: string;
    status: string;
    duplicate: number;
    existing_customer: number;
    crm_status: string;
    evidence: string;
    commission_cents: number;
    currency: string;
    commission_rules: string;
    revision: number;
    anonymized: number;
}
export interface Tenant {
    id: string;
    name: string;
    recipient_enabled: number;
    privacy_notice: string;
    retention_days: number;
    rules: string;
}
