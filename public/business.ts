/** Owner-only usage statistics for ub.radomski.dev: funnel by campaign and a campaign link + QR builder.
 *  Sessions are HttpOnly server cookies; nothing here enters the visitor's plan or share links. */
export function mountBusiness({ container }: { container: HTMLElement }) {
    let session: { email: string } | null = null;
    const root = document.createElement('details');
    const title = document.createElement('summary');
    title.textContent = 'Statystyki i linki kampanii';
    root.append(title);
    container.append(root);
    const content = document.createElement('div');
    root.append(content);
    const notice = document.createElement('p');
    root.append(notice);
    const text = (tag: string, value: string, parent: HTMLElement = content) => { const el = document.createElement(tag); el.textContent = value; parent.append(el); return el; };
    const input = (label: string, type = 'text', value = '', parent: HTMLElement = content) => { const el = document.createElement('input'); el.type = type; el.value = value; const wrap = document.createElement('label'); wrap.textContent = label + ' '; wrap.append(el); parent.append(wrap); return el; };
    const button = (label: string, run: () => unknown, parent: HTMLElement = content) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = label;
        b.addEventListener('click', async () => {
            b.disabled = true;
            notice.textContent = '';
            try {
                await run();
            }
            catch (e) {
                notice.textContent = (e as Error).message;
            }
            finally {
                b.disabled = false;
            }
        });
        parent.append(b);
        return b;
    };
    const api = async (path: string, body?: unknown, method = body ? 'POST' : 'GET') => {
        const r = await fetch(path, { method, headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', ...(body ? { body: JSON.stringify(body) } : {}) });
        const data = await r.json().catch(() => null);
        // Server messages are English API text; the interface shows Polish.
        if (!r.ok || !data)
            throw Error(({ 400: 'Sprawdź wpisane dane.', 401: 'Nieprawidłowy e-mail lub hasło.', 403: 'Brak uprawnień.', 404: 'Nie znaleziono.', 409: 'Dane się zmieniły. Odśwież formularz.', 413: 'Za dużo danych.', 429: 'Za dużo prób. Spróbuj później.' } as Record<number, string>)[r.status] ?? 'Usługa jest chwilowo niedostępna.');
        return data;
    };
    async function render() {
        content.replaceChildren();
        if (!session) {
            const email = input('E-mail', 'email'), password = input('Hasło', 'password');
            button('Zaloguj', async () => { session = await api('/api/auth/login', { email: email.value, password: password.value }); password.value = ''; document.body.classList.add('admin'); await render(); });
            // First owner only: needs the BOOTSTRAP_SECRET set on the worker; refused once an owner exists.
            const first = document.createElement('details');
            content.append(first);
            text('summary', 'Pierwsze konto właściciela', first);
            const newEmail = input('E-mail', 'email', '', first), newPassword = input('Hasło (min. 12 znaków)', 'password', '', first), secret = input('Sekret inicjalizacji', 'password', '', first);
            button('Utwórz konto', async () => {
                try { session = await api('/api/auth/bootstrap', { email: newEmail.value, password: newPassword.value, bootstrapSecret: secret.value }); }
                catch (e) { throw Error((e as Error).message === 'Sprawdź wpisane dane.' ? 'Sprawdź e-mail i hasło (min. 12 znaków).' : 'Nie można utworzyć konta: konto już istnieje albo sekret jest nieprawidłowy.', { cause: e }); }
                newPassword.value = secret.value = ''; document.body.classList.add('admin'); await render();
            }, first);
            return;
        }
        text('p', `Zalogowano: ${session.email}.`);
        button('Wyloguj', async () => { await api('/api/auth/logout', {}); session = null; await render(); });
        const passwordPanel = document.createElement('details');
        content.append(passwordPanel);
        text('summary', 'Zmień hasło', passwordPanel);
        const currentPassword = input('Obecne hasło', 'password', '', passwordPanel), newPassword = input('Nowe hasło (min. 12 znaków)', 'password', '', passwordPanel);
        button('Zmień hasło i wyloguj wszystkie sesje', async () => { await api('/api/auth/password', { currentPassword: currentPassword.value, newPassword: newPassword.value }); session = null; await render(); }, passwordPanel);
        await marketing();
    }
    /** Funnel by campaign and a campaign link + QR builder for flyers, stands and ads. Aggregates only, no personal data. */
    async function marketing() {
        const box = document.createElement('section');
        content.append(box);
        text('h3', 'Lejek według kampanii', box);
        const days = document.createElement('select');
        for (const d of [7, 30, 90, 365]) { const o = document.createElement('option'); o.value = String(d); o.textContent = `Ostatnie ${d} dni`; days.append(o); }
        days.value = '30';
        const table = document.createElement('div');
        table.className = 'funnel-table';
        box.append(days, table);
        const labels: Record<string, string> = { visit: 'Wejścia', parcel: 'Działka', house: 'Wybrany dom', view3d: '3D', report: 'Raport', share: 'Udostępnienie', video: 'Film' };
        const load = async () => {
            const data = await api('/api/funnel?days=' + days.value) as { steps: string[]; rows: { source: string; step: string; count: number }[] };
            const by = new Map<string, Record<string, number>>();
            for (const r of data.rows) (by.get(r.source) ?? by.set(r.source, {}).get(r.source)!)[r.step] = r.count;
            const t = document.createElement('table'), head = t.createTHead().insertRow();
            for (const h of ['Kampania', ...data.steps.map(s => labels[s] ?? s), 'Działka / wejścia']) { const th = document.createElement('th'); th.textContent = h; head.append(th); }
            const body = t.createTBody();
            for (const [source, c] of [...by].sort((a, b) => (b[1].visit ?? 0) - (a[1].visit ?? 0))) {
                const row = body.insertRow();
                row.insertCell().textContent = source;
                for (const s of data.steps) row.insertCell().textContent = String(c[s] ?? 0);
                row.insertCell().textContent = c.visit ? Math.round(100 * (c.parcel ?? 0) / c.visit) + '%' : '–';
            }
            table.replaceChildren(by.size ? t : Object.assign(document.createElement('p'), { textContent: 'Brak danych w tym okresie.' }));
            text('p', 'Liczby na wczytanie strony, bez identyfikacji osób. Kampania = utm_campaign, potem campaign, showroom, event lub utm_source.', table);
        };
        days.onchange = () => void load().catch(e => notice.textContent = e.message);
        await load();
        text('h4', 'Link kampanii z kodem QR', box);
        const fields = ['utm_source', 'utm_medium', 'utm_campaign', 'showroom', 'event', 'representative'] as const;
        const hints: Record<string, string> = { utm_source: 'Źródło (np. ulotka, facebook)', utm_medium: 'Medium (np. print, social)', utm_campaign: 'Kampania (np. wiosna-2027)', showroom: 'Salon', event: 'Wydarzenie (np. targi-warszawa)', representative: 'Przedstawiciel' };
        const inputs = fields.map(f => [f, input(hints[f], 'text', '', box)] as const);
        const house = document.createElement('select');
        for (const [v, l] of [['', 'Dom: najlepiej dopasowany'], ['de-75', 'DE 75'], ['de-105', 'DE 105'], ['de-135', 'DE 135'], ['de-165', 'DE 165']]) { const o = document.createElement('option'); o.value = v; o.textContent = l; house.append(o); }
        box.append(house);
        const out = document.createElement('input'); out.readOnly = true; out.className = 'campaign-link'; out.setAttribute('aria-label', 'Link kampanii');
        const qr = document.createElement('canvas');
        box.append(out, qr);
        const build = async () => {
            const params = new URLSearchParams();
            for (const [f, el] of inputs) { const v = el.value.trim(); if (v) { if (!/^[\p{L}\p{N} _.-]{1,80}$/u.test(v)) throw Error(`Pole ${f}: tylko litery, cyfry, spacja, _ . -`); params.set(f, v); } }
            if (house.value) params.set('dom', house.value);
            out.value = location.origin + '/' + (params.size ? '?' + params : '');
            const { toCanvas } = await import('qrcode');
            await toCanvas(qr, out.value, { width: 320, margin: 2, color: { dark: '#141413', light: '#ffffff' } });
        };
        button('Utwórz link i QR', build, box);
        button('Kopiuj link', async () => { if (!out.value) await build(); await navigator.clipboard.writeText(out.value); notice.textContent = 'Skopiowano link.'; }, box);
        button('Pobierz QR (PNG)', async () => { if (!out.value) await build(); const a = document.createElement('a'); a.download = 'qr-' + (inputs[2][1].value.trim() || 'kampania') + '.png'; a.href = qr.toDataURL('image/png'); a.click(); }, box);
    }
    root.addEventListener('toggle', () => {
        if (root.open && !content.childElementCount)
            void api('/api/auth/me').then(u => { session = u; }).catch(() => { }).then(render).catch(e => notice.textContent = e.message);
    });
    return { async logout() { await api('/api/auth/logout', {}).catch(() => { }); session = null; content.replaceChildren(); notice.textContent = ''; root.open = false; } };
}
