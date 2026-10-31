/**
 * @jest-environment node
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { premiumBlock } from '../../tests/fixtures/premium/premium-block';
import { type PremiumContentData, premiumContentSchema } from './premium-content-schema';
import {
    type PremiumContentStore,
    preparePremiumUpsert,
    publishPremiumEntries,
    resolveEntryService,
    upsertPremiumContent,
} from './upsert-premium-content';

const CONTENT = premiumContentSchema.parse(premiumBlock());

/**
 * Baza to serwis zewnetrzny. Pamieciowy magazyn trzyma wiersze po `serviceId`, tak jak
 * klucz glowny `service_profiles` — zapis istniejacego klucza nadpisuje wiersz.
 */
function createMemoryStore(services: Record<string, { id: string; locationSlugs: string[] }>) {
    const rows = new Map<string, unknown>();
    const store: PremiumContentStore = {
        findServicesByLocationSlugs: async locationSlugs =>
            Object.entries(services)
                .filter(([, service]) => service.locationSlugs.some(s => locationSlugs.includes(s)))
                .map(([slug, { id }]) => ({ id, slug })),
        findContent: async serviceId => rows.get(serviceId) ?? null,
        saveContent: async (serviceId, content) => {
            rows.set(serviceId, structuredClone(content));
        },
    };
    return { store, rows };
}

const SERVICES = { 'salon-roza': { id: 'svc-1', locationSlugs: ['salon-roza-warszawa'] } };
const SALON = { serviceId: 'svc-1', serviceSlug: 'salon-roza' };

let publicDir: string;

function addImages(serviceSlug: string, files: string[]): void {
    const directory = path.join(publicDir, 'services', serviceSlug);
    mkdirSync(directory, { recursive: true });
    for (const file of files) writeFileSync(path.join(directory, file), 'img');
}

beforeEach(() => {
    publicDir = mkdtempSync(path.join(tmpdir(), 'premium-public-'));
});

afterEach(() => {
    rmSync(publicDir, { recursive: true, force: true });
});

describe('upsertPremiumContent', () => {
    it('zapisuje tresc dla podanej uslugi', async () => {
        addImages('salon-roza', ['cover.jpg', 'salon-1.webp']);
        const { store, rows } = createMemoryStore(SERVICES);

        const plan = await upsertPremiumContent(store, {
            service: SALON,
            content: CONTENT,
            publicDir,
        });

        expect(plan).toEqual({ serviceId: 'svc-1', previous: { kind: 'none' } });
        expect(rows.get('svc-1')).toEqual(CONTENT);
    });

    it('ponowne wywolanie zapisuje te sama tresc', async () => {
        addImages('salon-roza', ['cover.jpg', 'salon-1.webp']);
        const { store, rows } = createMemoryStore(SERVICES);
        const input = { service: SALON, content: CONTENT, publicDir };

        await upsertPremiumContent(store, input);
        const second = await upsertPremiumContent(store, input);

        expect(rows.size).toBe(1);
        expect(rows.get('svc-1')).toEqual(CONTENT);
        expect(second.previous).toEqual({ kind: 'valid', content: CONTENT });
    });

    it('brakujace pliki galerii przerywaja z lista brakujacych, bez zapisu', async () => {
        addImages('salon-roza', ['cover.jpg']);
        const content: PremiumContentData = {
            ...CONTENT,
            gallery: [...CONTENT.gallery, { ...CONTENT.gallery[0], file: 'salon-2.jpg' }],
        };
        const { store, rows } = createMemoryStore(SERVICES);

        const upsert = upsertPremiumContent(store, {
            service: SALON,
            content,
            publicDir,
        });

        await expect(upsert).rejects.toMatchObject({
            code: 'IMAGES_MISSING',
            missingFiles: ['services/salon-roza/salon-1.webp', 'services/salon-roza/salon-2.jpg'],
        });
        expect(rows.size).toBe(0);
    });

    it('nazwa pliku rozni sie od dysku wielkoscia liter: IMAGES_MISSING, bez zapisu', async () => {
        addImages('salon-roza', ['cover.jpg', 'salon-1.webp']);
        const { store, rows } = createMemoryStore(SERVICES);

        const upsert = upsertPremiumContent(store, {
            service: SALON,
            content: { ...CONTENT, coverImage: 'Cover.JPG' },
            publicDir,
        });

        await expect(upsert).rejects.toMatchObject({
            code: 'IMAGES_MISSING',
            missingFiles: ['services/salon-roza/Cover.JPG'],
        });
        expect(rows.size).toBe(0);
    });

    it('zdjecia szuka w katalogu slugu uslugi, nie w samym public/services/', async () => {
        writeFileSync(path.join(publicDir, 'cover.jpg'), 'img');
        mkdirSync(path.join(publicDir, 'services'), { recursive: true });
        writeFileSync(path.join(publicDir, 'services', 'cover.jpg'), 'img');
        const { store } = createMemoryStore(SERVICES);

        const upsert = upsertPremiumContent(store, {
            service: SALON,
            content: { ...CONTENT, gallery: [] },
            publicDir,
        });

        await expect(upsert).rejects.toMatchObject({
            missingFiles: ['services/salon-roza/cover.jpg'],
        });
    });
});

describe('preparePremiumUpsert', () => {
    it('zapisana tresc nieprzechodzaca walidacji jest oznaczona jako nieczytelna', async () => {
        const { store, rows } = createMemoryStore(SERVICES);
        rows.set('svc-1', { template: 'luxury', gallery: 'zepsute' });

        const plan = await preparePremiumUpsert(store, {
            service: SALON,
            content: { ...CONTENT, coverImage: null, gallery: [] },
            publicDir,
        });

        expect(plan.previous).toEqual({ kind: 'invalid' });
        expect(rows.get('svc-1')).toEqual({ template: 'luxury', gallery: 'zepsute' });
    });
});

describe('resolveEntryService', () => {
    const entry = { slug: 'salon-roza', locations: [{ city: 'Warszawa' }] };

    it('znajduje id i slug uslugi po slugach lokalizacji wpisu', async () => {
        const { store } = createMemoryStore({
            'salon-roza-2': { id: 'svc-2', locationSlugs: ['salon-roza-warszawa'] },
        });

        expect(await resolveEntryService(store, entry)).toEqual({
            serviceId: 'svc-2',
            serviceSlug: 'salon-roza-2',
        });
    });

    it('wpis nieobecny w bazie konczy sie bledem SERVICE_NOT_FOUND', async () => {
        const { store } = createMemoryStore({});

        await expect(resolveEntryService(store, entry)).rejects.toMatchObject({
            code: 'SERVICE_NOT_FOUND',
        });
    });

    it('lokalizacje kilku uslug koncza sie bledem ENTRY_AMBIGUOUS', async () => {
        const { store } = createMemoryStore({
            a: { id: 'svc-a', locationSlugs: ['salon-roza-warszawa'] },
            b: { id: 'svc-b', locationSlugs: ['salon-roza-warszawa'] },
        });

        await expect(resolveEntryService(store, entry)).rejects.toMatchObject({
            code: 'ENTRY_AMBIGUOUS',
        });
    });
});

describe('publishPremiumEntries', () => {
    let dataDir: string;

    const ENTRY = {
        name: 'Salon Roza',
        category: 'beauty',
        translations: {
            pl: { description: 'Salon.' },
            uk: { description: 'Салон.' },
            en: { description: 'Salon.' },
            ru: { description: 'Салон.' },
        },
        locations: [{ city: 'Warszawa', latitude: 52.23, longitude: 21.01 }],
    };

    function writeEntry(file: string, entry: unknown): void {
        writeFileSync(path.join(dataDir, file), JSON.stringify(entry));
    }

    beforeEach(() => {
        dataDir = mkdtempSync(path.join(tmpdir(), 'premium-data-'));
    });

    afterEach(() => {
        rmSync(dataDir, { recursive: true, force: true });
    });

    it('publikuje pliki z blokiem premium, pomija pliki bez bloku i wpisy spoza bazy', async () => {
        addImages('salon-roza', ['cover.jpg', 'salon-1.webp']);
        writeEntry('salon-roza.json', { ...ENTRY, premium: premiumBlock() });
        writeEntry('bez-premium.json', { name: 'Niepoprawny wpis bez premium' });
        writeEntry('obcy.json', { ...ENTRY, slug: 'obcy', premium: premiumBlock() });
        const { store, rows } = createMemoryStore(SERVICES);

        const report = await publishPremiumEntries(store, { dataDir, publicDir });

        expect(report.published).toEqual(['salon-roza']);
        expect(report.skipped).toEqual([
            { file: 'obcy.json', reason: expect.stringContaining('obcy-warszawa') },
        ]);
        expect(rows.get('svc-1')).toEqual(CONTENT);
    });

    it('nieparsowalny plik trafia do skipped, pozostale wpisy sa publikowane', async () => {
        addImages('salon-roza', ['cover.jpg', 'salon-1.webp']);
        writeFileSync(path.join(dataDir, 'roboczy.json'), '{');
        writeEntry('salon-roza.json', { ...ENTRY, premium: premiumBlock() });
        const { store, rows } = createMemoryStore(SERVICES);

        const report = await publishPremiumEntries(store, { dataDir, publicDir });

        expect(report.skipped).toEqual([{ file: 'roboczy.json', reason: 'niepoprawny JSON' }]);
        expect(report.published).toEqual(['salon-roza']);
        expect(rows.get('svc-1')).toEqual(CONTENT);
    });

    it('brak zdjecia przerywa seed (IMAGES_MISSING) zamiast pominac plik, nic nie zapisane', async () => {
        addImages('salon-roza', ['cover.jpg']);
        writeEntry('salon-roza.json', { ...ENTRY, premium: premiumBlock() });
        const { store, rows } = createMemoryStore(SERVICES);

        await expect(publishPremiumEntries(store, { dataDir, publicDir })).rejects.toMatchObject({
            code: 'IMAGES_MISSING',
            missingFiles: ['services/salon-roza/salon-1.webp'],
        });
        expect(rows.size).toBe(0);
    });

    it('wpis wskazujacy kilka uslug przerywa seed (ENTRY_AMBIGUOUS), nic nie zapisane', async () => {
        addImages('a', ['cover.jpg', 'salon-1.webp']);
        writeEntry('salon-roza.json', { ...ENTRY, premium: premiumBlock() });
        const { store, rows } = createMemoryStore({
            a: { id: 'svc-a', locationSlugs: ['salon-roza-warszawa'] },
            b: { id: 'svc-b', locationSlugs: ['salon-roza-warszawa'] },
        });

        await expect(publishPremiumEntries(store, { dataDir, publicDir })).rejects.toMatchObject({
            code: 'ENTRY_AMBIGUOUS',
        });
        expect(rows.size).toBe(0);
    });

    it('bledny blok premium przerywa seed z nazwa pliku', async () => {
        writeEntry('salon-roza.json', { ...ENTRY, premium: premiumBlock({ template: 'x' }) });
        const { store } = createMemoryStore(SERVICES);

        await expect(publishPremiumEntries(store, { dataDir, publicDir })).rejects.toMatchObject({
            code: 'INVALID_ENTRY',
            message: expect.stringContaining('salon-roza.json: premium.template'),
        });
    });
});
