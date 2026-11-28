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
