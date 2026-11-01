/**
 * @jest-environment node
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { premiumBlock } from '../../tests/fixtures/premium/premium-block';
import { premiumContentSchema } from './premium-content-schema';
import {
    activeUntilWarning,
    type PremiumContentStore,
    publishPremiumEntries,
} from './upsert-premium-content';

const NOW = new Date('2026-11-01T12:00:00.000Z');

function contentUntil(activeUntil?: string) {
    return premiumContentSchema.parse(
        premiumBlock(activeUntil === undefined ? {} : { activeUntil }),
    );
}

describe('activeUntilWarning', () => {
    it('blok bez daty i data w zakresie: bez ostrzezenia', () => {
        expect(activeUntilWarning(contentUntil(), NOW)).toBeNull();
        expect(activeUntilWarning(contentUntil('2026-11-30'), NOW)).toBeNull();
    });

    it('data z przeszlosci: ostrzezenie z data', () => {
        expect(activeUntilWarning(contentUntil('2025-12-31'), NOW)).toBe(
            'premium.activeUntil 2025-12-31 jest w przeszlosci — premium reczne juz wygaslo',
        );
    });

    it('literowka roku (2062): ostrzezenie z data', () => {
        expect(activeUntilWarning(contentUntil('2062-11-30'), NOW)).toBe(
            'premium.activeUntil 2062-11-30 wypada ponad 2 lata naprzod — literowka w roku?',
        );
    });
});

describe('publishPremiumEntries — podejrzana data (seed)', () => {
    let dataDir: string;
    let publicDir: string;

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

    /** Baza to serwis zewnetrzny: jedna usluga, zapis do mapy. */
    function createStore(): { store: PremiumContentStore; saved: Map<string, unknown> } {
        const saved = new Map<string, unknown>();
        const store: PremiumContentStore = {
            findServicesByLocationSlugs: async slugs =>
                slugs.includes('salon-roza-warszawa') ? [{ id: 'svc-1', slug: 'salon-roza' }] : [],
            findContent: async () => null,
            saveContent: async (serviceId, content) => {
                saved.set(serviceId, content);
            },
        };
        return { store, saved };
    }

    function writeEntry(activeUntil?: string): void {
        const premium = premiumBlock(activeUntil === undefined ? {} : { activeUntil });
        writeFileSync(path.join(dataDir, 'salon-roza.json'), JSON.stringify({ ...ENTRY, premium }));
    }

    beforeEach(() => {
        dataDir = mkdtempSync(path.join(tmpdir(), 'premium-data-'));
        publicDir = mkdtempSync(path.join(tmpdir(), 'premium-public-'));
        const images = path.join(publicDir, 'services', 'salon-roza');
        mkdirSync(images, { recursive: true });
        for (const file of ['cover.jpg', 'salon-1.webp']) {
            writeFileSync(path.join(images, file), 'img');
        }
    });

    afterEach(() => {
        rmSync(dataDir, { recursive: true, force: true });
        rmSync(publicDir, { recursive: true, force: true });
    });

    it('data z przeszlosci: wpis opublikowany, ostrzezenie w raporcie', async () => {
        writeEntry('2020-01-01');
        const { store, saved } = createStore();

        const report = await publishPremiumEntries(store, { dataDir, publicDir });

        expect(report.published).toEqual(['salon-roza']);
        expect(saved.has('svc-1')).toBe(true);
        expect(report.warnings).toEqual([
            { file: 'salon-roza.json', message: expect.stringContaining('w przeszlosci') },
        ]);
    });

    it('blok bez daty: bez ostrzezen', async () => {
        writeEntry();
        const { store } = createStore();

        const report = await publishPremiumEntries(store, { dataDir, publicDir });

        expect(report.published).toEqual(['salon-roza']);
        expect(report.warnings).toEqual([]);
    });
});
