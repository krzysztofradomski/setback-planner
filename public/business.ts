import {projectAssistantScene} from './core/assistant.ts';
/** Private business data uses HttpOnly server sessions and never enters scene/share state. */
type Recipient = {
    id: string;
    name: string;
    privacy_notice: string;
};
type Tenant = Recipient & {
    recipient_enabled: number;
    retention_days: number;
    rules: Record<string, unknown>;
};
type Lead = {
    id: string;
    status: string;
    revision: number;
    contact: Record<string, string>;
    evidence: Record<string, unknown>;
    existing_customer: number;
    commission_cents: number;
    currency: string;
    attribution: Record<string, unknown>;
};
export function mountBusiness({ container, getScene, getAttribution = () => null }: {
    container: HTMLElement;
    getScene: () => unknown;
    shareUrl?: () => string;
    getAttribution?: () => unknown;
}) {
    let tenants: Tenant[] = [], selected = '', session: {
        role: string;
        email: string;
    } | null = null;
    const root = document.createElement('details');
    const title = document.createElement('summary');
    title.textContent = 'Zapytania i prywatny panel partnerów';
    root.append(title);
    container.append(root);
    const content = document.createElement('div');
    root.append(content);
    const notice = document.createElement('p');
    root.append(notice);
    const text = (tag: string, value: string, parent: HTMLElement = content) => { const el = document.createElement(tag); el.textContent = value; parent.append(el); return el; };
    const input = (label: string, type = 'text', value = '', parent: HTMLElement = content) => { const el = document.createElement('input'); el.type = type; el.value = value; const wrap = document.createElement('label'); wrap.textContent = label + ' '; wrap.append(el); parent.append(wrap); return el; };
    const area = (label: string, value = '', parent: HTMLElement = content) => { const el = document.createElement('textarea'); el.value = value; el.rows = 4; const wrap = document.createElement('label'); wrap.textContent = label + ' '; wrap.append(el); parent.append(wrap); return el; };
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
    async function publicForm() {
        const block = document.createElement('section');
        content.append(block);
        text('h3', 'Dobrowolne zapytanie do odbiorcy', block);
        text('p', 'Kontakt zbieramy dopiero przy wysłaniu zapytania. Projekt i dane kontaktowe zostaną zapisane w prywatnym panelu wybranego odbiorcy. Nie oznacza to partnerstwa z producentem.', block);
        const data = await api('/api/recipients');
        if (!data.recipients.length) {
            text('p', 'Brak aktywnych odbiorców. Planowanie działa bez wysyłania danych kontaktowych.', block);
            return;
        }
        const select = document.createElement('select');
        select.setAttribute('aria-label', 'Odbiorca zapytania');
        for (const r of data.recipients as Recipient[]) {
            const o = document.createElement('option');
            o.value = r.id;
            o.textContent = r.name;
            select.append(o);
        }
        block.append(select);
        const disclosure = text('p', '', block);
        const show = () => { disclosure.textContent = (data.recipients as Recipient[]).find(r => r.id === select.value)!.privacy_notice; };
        select.onchange = show;
        show();
        const name = input('Imię', 'text', '', block), email = input('E-mail', 'email', '', block), phone = input('Telefon (opcjonalnie)', 'tel', '', block), message = area('Wiadomość', '', block), consent = input('Zgadzam się na przekazanie projektu i kontaktu opisanemu odbiorcy', 'checkbox', '', block), marketing = input('Opcjonalnie: zgoda na marketing odbiorcy', 'checkbox', '', block);
        let token = '';
        const challenge = document.createElement('div');
        block.append(challenge);
        const load = () => {
            const ts = (window as unknown as {
                turnstile?: {
                    render: (e: HTMLElement, o: unknown) => void;
                };
            }).turnstile;
            if (ts)
                ts.render(challenge, { sitekey: data.sitekey, action: 'inquiry', callback: (t: string) => { token = t; }, 'expired-callback': () => { token = ''; } });
        };
        if (document.querySelector('script[data-business-turnstile]'))
            load();
        else {
            const script = document.createElement('script');
            script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
            script.dataset.businessTurnstile = 'true';
            script.onload = load;
            document.head.append(script);
        }
        button('Wyślij zapytanie', async () => {
            if (!consent.checked || !email.validity.valid || !email.value || !name.value || !token)
                throw Error('Uzupełnij kontakt, zgodę i weryfikację.');
            const project = getScene() as Record<string, unknown>;
            const result = await api('/api/inquiries', { tenantId: select.value, projectId: typeof project.id === 'string' ? project.id : crypto.randomUUID(), contact: { name: name.value, email: email.value, phone: phone.value, message: message.value }, project, attribution: getAttribution() ?? {}, processingConsent: true, marketingConsent: marketing.checked, privacyNotice: disclosure.textContent, turnstileToken: token });
            name.value = email.value = phone.value = message.value = '';
            token = '';
            consent.checked = marketing.checked = false;
            notice.textContent = 'Zapisano zapytanie ' + result.id + '. Odbiorca odczyta je w prywatnym panelu.';
        }, block);
    }
    async function render() {
        content.replaceChildren();
        if (!session) {
            await publicForm();
            text('h3', 'Prywatny panel');
            const email = input('E-mail', 'email'), password = input('Hasło', 'password'), bootstrap = input('Sekret inicjalizacji (tylko pierwszy właściciel)', 'password');
            button('Zaloguj', async () => { session = await api('/api/auth/login', { email: email.value, password: password.value }); password.value = bootstrap.value = ''; await render(); });
            button('Utwórz pierwsze konto właściciela', async () => { session = await api('/api/auth/bootstrap', { email: email.value, password: password.value, bootstrapSecret: bootstrap.value }); password.value = bootstrap.value = ''; await render(); });
            return;
        }
        text('p', `Zalogowano: ${session.email} (${session.role}). Dane tego panelu są prywatne.`);
        button('Wyloguj', async () => { await api('/api/auth/logout', {}); session = null; await render(); });
        const passwordPanel = document.createElement('details');
        content.append(passwordPanel);
        text('summary', 'Zmień hasło', passwordPanel);
        const currentPassword = input('Obecne hasło', 'password', '', passwordPanel), newPassword = input('Nowe hasło', 'password', '', passwordPanel);
        button('Zmień hasło i wyloguj wszystkie sesje', async () => { await api('/api/auth/password', { currentPassword: currentPassword.value, newPassword: newPassword.value }); session = null; await render(); }, passwordPanel);
        tenants = await api('/api/tenants');
        if (session.role === 'owner') {
            const name = input('Nazwa nowego odbiorcy');
            button('Dodaj odbiorcę', async () => { await api('/api/tenants', { name: name.value }); await render(); });
        }
        if (!tenants.length) {
            text('p', 'Dodaj niezależnego odbiorcę, aby zarządzać zapytaniami i asystentem.');
            return;
        }
        if (!tenants.some(t => t.id === selected))
            selected = tenants[0].id;
        const select = document.createElement('select');
        select.setAttribute('aria-label', 'Prywatny odbiorca');
        for (const t of tenants) {
            const o = document.createElement('option');
            o.value = t.id;
            o.textContent = t.name;
            select.append(o);
        }
        select.value = selected;
        select.onchange = () => { selected = select.value; void render().catch(e => notice.textContent = e.message); };
        content.append(select);
        const t = tenants.find(x => x.id === selected)!;
        if (session.role === 'owner') {
            const config = document.createElement('details');
            content.append(config);
            text('summary', 'Konfiguracja odbiorcy, zasad i użytkowników', config);
            const enabled = input('Aktywuj publiczne zapytania (wymaga Turnstile)', 'checkbox', '', config);
            enabled.checked = !!t.recipient_enabled;
            const privacy = area('Informacja: tożsamość administratora, cel, kontakt, czas przechowywania', t.privacy_notice, config);
            const retention = input('Dni przechowywania danych kontaktowych', 'number', String(t.retention_days), config);
            const defaults = { agreement: '', attributionDays: 90, excludeExisting: true, excludeDuplicates: true, requirePayment: true, campaign: '', mode: 'fixed', value: 0, currency: 'PLN', ...t.rules };
            const rules = area('Zasady prowizji (JSON; kwoty w groszach, basis_points = 1/100 procenta)', JSON.stringify(defaults, null, 2), config);
            button('Zapisz konfigurację', async () => { await api('/api/tenants/' + t.id, { recipient_enabled: enabled.checked, privacy_notice: privacy.value, retention_days: Number(retention.value), rules: JSON.parse(rules.value) }, 'PATCH'); notice.textContent = 'Zapisano konfigurację.'; }, config);
            const email = input('E-mail nowego użytkownika', 'email', '', config), pass = input('Hasło początkowe (min. 12 znaków)', 'password', '', config), role = document.createElement('select');
            for (const value of ['manufacturer', 'sales']) {
                const o = document.createElement('option');
                o.value = value;
                o.textContent = value;
                role.append(o);
            }
            config.append(role);
            button('Dodaj użytkownika do tego odbiorcy', async () => { await api('/api/users', { email: email.value, password: pass.value, role: role.value, tenantId: t.id }); pass.value = ''; notice.textContent = 'Dodano użytkownika.'; }, config);
            button('Lista i blokowanie użytkowników', async () => {
                const users = await api('/api/users');
                const list = document.createElement('div');
                config.append(list);
                for (const u of users) {
                    if (u.role === 'owner')
                        continue;
                    text('p', `${u.email}: ${u.role}; aktywny=${u.active}`, list);
                    button(u.active ? 'Zablokuj' : 'Odblokuj', async () => { await api('/api/users/' + u.id, { active: !u.active }, 'PATCH'); await render(); }, list);
                }
            }, config);
        }
        const report = await api('/api/report?tenant=' + encodeURIComponent(t.id));
        text('pre', JSON.stringify(report, null, 2));
        const leads = await api('/api/leads?tenant=' + encodeURIComponent(t.id)) as Lead[];
        text('h3', `Zapytania (${leads.length}; maks. 1000 najnowszych)`);
        const counts: Record<string, number> = {};
        for (const l of leads)
            counts[l.status] = (counts[l.status] ?? 0) + 1;
        text('p', Object.entries(counts).map(([s, n]) => s + ': ' + n).join(' · ') || 'Brak zapytań');
        const exportLink = document.createElement('a');
        exportLink.href = '/api/leads.csv?tenant=' + encodeURIComponent(t.id);
        exportLink.textContent = 'Pobierz CSV';
        content.append(exportLink);
        for (const l of leads) {
            const d = document.createElement('details');
            content.append(d);
            text('summary', `${l.id}: ${l.status} · ${l.contact.name ?? 'Dane usunięte'}`, d);
            text('pre', JSON.stringify({ contact: l.contact, attribution: l.attribution, commissionCents: l.commission_cents, currency: l.currency }, null, 2), d);
            const state = input('Nowy status', 'text', l.status, d);
            const evidence = area('Potwierdzenia (JSON; bez danych osobowych)', JSON.stringify({ contractRef: '', contractCents: 0, paymentRef: '', settlementRef: '', dispute: false, resolution: '', ...l.evidence }, null, 2), d);
            const existing = input('Istniejący klient', 'checkbox', '', d);
            existing.checked = !!l.existing_customer;
            if (session.role !== 'sales') {
                button('Zapisz zmianę statusu', async () => { await api('/api/leads/' + l.id, { status: state.value, evidence: JSON.parse(evidence.value), existingCustomer: existing.checked, revision: l.revision }, 'PATCH'); await render(); }, d);
                button('Usuń dane osobowe projektu i kontaktu', async () => { await api('/api/leads/' + l.id, undefined, 'DELETE'); await render(); }, d);
            }
        }
        button('Pokaż historię audytu', async () => { text('pre', JSON.stringify(await api('/api/audit?tenant=' + t.id), null, 2)); });
        const ai = document.createElement('details');
        content.append(ai);
        text('summary', 'Asystent dokumentów (Workers AI)', ai);
        text('p', 'Tekst zostanie przesłany do Cloudflare Workers AI. Nie wklejaj danych poufnych bez uprawnienia. Wynik wymaga samodzielnej weryfikacji; nie stanowi oceny zgodności prawnej ani obliczeń geometrii. Limit: 24 000 znaków, 10 żądań użytkownika dziennie; cache prywatny do 24 godzin.', ai);
        const source = input('Źródło dokumentu', 'text', '', ai), documentText = area('Tekst dokumentu', '', ai), consent = input('Zgadzam się na opisane przetwarzanie AI', 'checkbox', '', ai);
        button('Wyodrębnij cytowane parametry', async () => {
            if (!consent.checked)
                throw Error('Wymagana zgoda na przetwarzanie AI.');
            const result = await api('/api/ai/extract', { tenantId: t.id, text: documentText.value, source: source.value, consent: true });
            text('pre', JSON.stringify(result, null, 2), ai);
        }, ai);
        const question = area('Pytanie / jawne instrukcje układu', '', ai);
        for (const [mode,label] of [['summary','Podsumuj cytowane źródło'],['report','Przygotuj cytowany opis raportu'],['catalog','Zapytaj o zweryfikowane metadane katalogu'],['layout','Pokaż propozycje zmian (bez zastosowania)']]) {
            button(label, async () => {
                if (!consent.checked) throw Error('Wymagana zgoda na przetwarzanie AI.');
                const result=await api('/api/ai/assist',{tenantId:t.id,mode,question:question.value,consent:true,...(mode==='layout'?{scene:projectAssistantScene(getScene())}:mode==='catalog'?{catalogIds:['udana-budowa']}:{sources:[{id:'document',title:source.value,text:documentText.value}]})});
                text('pre',JSON.stringify(result,null,2),ai);
            },ai);
        }
    }
    root.addEventListener('toggle', () => {
        if (root.open && !content.childElementCount)
            void api('/api/auth/me').then(u => { session = u; }).catch(() => { }).then(render).catch(e => notice.textContent = e.message);
    });
    /** Open the visitor's inquiry form (the "talk to an advisor" call to action) and put the cursor in it. */
    async function openInquiry() {
        root.open = true;
        for (let i = 0; i < 40 && !content.querySelector('input'); i++) await new Promise(r => setTimeout(r, 100));
        root.scrollIntoView({ block: 'start', behavior: 'smooth' });
        content.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true });
    }
    return { openInquiry, async logout() { await api('/api/auth/logout', {}); session = null; content.replaceChildren(); notice.textContent = ''; root.open = false; }, clearPersonalData() { content.replaceChildren(); notice.textContent = ''; session = null; root.open = false; } };
}
