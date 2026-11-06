/**
 * @jest-environment node
 */
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
    findServicesWithSameName,
    insertService,
    planServiceSlugs,
    type Transaction,
} from '@/db/insert-service';
import { embedServiceLocations } from '@/db/service-embedding';
import { getServiceSubmission, getServiceSubmissionLogo } from '@/lib/service-submissions';

import { publishServiceSubmission } from './publish-submission';

const ID = '5f0c3c2e-8d7b-4a52-9d55-3f1a2b3c4d5e';
const SERVICE_ID = '7a1c3c2e-8d7b-4a52-9d55-3f1a2b3c4d5e';
const LOGO = Buffer.from('png-bytes');
const JSON_PATH = 'data/services/kancelaria-nowak.json';
const LOGO_PATH = 'public/services/kancelaria-nowak.png';

jest.mock('@/db/insert-service', () => ({
    findServicesWithSameName: jest.fn(),
    insertService: jest.fn(),
    planServiceSlugs: jest.fn(),
}));
jest.mock('@/db/service-embedding', () => ({ embedServiceLocations: jest.fn() }));
jest.mock('@/lib/service-submissions', () => ({
    getServiceSubmission: jest.fn(),
    getServiceSubmissionLogo: jest.fn(),
}));

const mockSubmission = jest.mocked(getServiceSubmission);
const mockLogo = jest.mocked(getServiceSubmissionLogo);
const mockSameName = jest.mocked(findServicesWithSameName);
const mockPlan = jest.mocked(planServiceSlugs);
const mockInsert = jest.mocked(insertService);
const mockEmbed = jest.mocked(embedServiceLocations);

const ENTRY = {
    name: 'Kancelaria Nowak',
    category: 'law',
    coverage: 'online',
    status: 'active',
    verified: false,
    image: 'kancelaria-nowak.png',
    languages: ['pl'],
    translations: {
        pl: { description: 'Opis po polsku wystarczajaco dlugi do walidacji wpisu.' },
        uk: { description: 'Opis po ukrainsku wystarczajaco dlugi do walidacji wpisu.' },
        en: { description: 'A description in English long enough to pass validation.' },
        ru: { description: 'Opis po rosyjsku wystarczajaco dlugi do walidacji wpisu.' },
    },
    tags: [],
    locations: [{ city: 'Warszawa', isMainLocation: true }],
};

type Submission = NonNullable<Awaited<ReturnType<typeof getServiceSubmission>>>;

function submission(overrides: Partial<Submission> = {}): Submission {
    return {
        id: ID,
        status: 'new',
        name: ENTRY.name,
        slug: 'kancelaria-nowak',
        entry: ENTRY,
        unconfirmed: [],
        changedByOwner: [],
        missingCoordinates: false,
        manualPin: false,
        submitterEmail: 'wlasciciel@nowak.pl',
        notes: null,
        locale: 'pl',
        source: 'page',
        sourceUrl: null,
        createdAt: new Date(),
        hasLogo: true,
        ...overrides,
    } as Submission;
}

let rootDir: string;

const repoPath = (relativePath: string): string => path.join(rootDir, ...relativePath.split('/'));

beforeEach(async () => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    rootDir = await mkdtemp(path.join(tmpdir(), 'polvia-publish-'));
    await mkdir(repoPath('data/services'), { recursive: true });
    await mkdir(repoPath('public/services'), { recursive: true });

    mockSubmission.mockResolvedValue(submission());
    mockLogo.mockResolvedValue({ slug: 'kancelaria-nowak', logo: LOGO });
    mockSameName.mockResolvedValue(0);
    mockPlan.mockResolvedValue({
        ok: true,
        slugs: { serviceSlug: 'kancelaria-nowak', locationSlugs: ['kancelaria-nowak-warszawa'] },
    });
    mockInsert.mockResolvedValue(SERVICE_ID);
    mockEmbed.mockResolvedValue();
});

afterEach(async () => {
    jest.restoreAllMocks();
    await rm(rootDir, { recursive: true, force: true });
});

describe('publishServiceSubmission', () => {
    it('zapisuje plik, logo i wpis, indeksuje go i zwraca pliki do commita', async () => {
        const result = await publishServiceSubmission(ID, rootDir);

        expect(result).toEqual({
            ok: true,
            data: {
                serviceSlug: 'kancelaria-nowak',
                files: [JSON_PATH, LOGO_PATH],
                isSearchIndexed: true,
            },
        });
        expect(JSON.parse(await readFile(repoPath(JSON_PATH), 'utf8')).name).toBe(ENTRY.name);
        await expect(readFile(repoPath(LOGO_PATH))).resolves.toEqual(LOGO);
        expect(mockInsert).toHaveBeenCalledWith(
            expect.objectContaining({ name: ENTRY.name }),
            expect.objectContaining({ serviceSlug: 'kancelaria-nowak' }),
            'kancelaria-nowak.png',
            expect.any(Function),
        );
        expect(mockEmbed).toHaveBeenCalledWith(SERVICE_ID);
    });

    it('zgloszenie bez logo nie wskazuje obrazka ani nie tworzy pliku', async () => {
        mockSubmission.mockResolvedValue(submission({ hasLogo: false }));

        const result = await publishServiceSubmission(ID, rootDir);

        expect(result.ok && result.data.files).toEqual([JSON_PATH]);
        expect(JSON.parse(await readFile(repoPath(JSON_PATH), 'utf8')).image).toBeUndefined();
        expect(mockInsert.mock.calls[0][2]).toBeNull();
        expect(existsSync(repoPath(LOGO_PATH))).toBe(false);
    });

    it('nieistniejace zgloszenie daje NOT_FOUND', async () => {
        mockSubmission.mockResolvedValue(null);

        const result = await publishServiceSubmission(ID, rootDir);

        expect(!result.ok && result.code).toBe('NOT_FOUND');
    });

    it('opublikowane zgloszenie nie zapisuje niczego drugi raz', async () => {
        mockSubmission.mockResolvedValue(submission({ status: 'added' }));

        const result = await publishServiceSubmission(ID, rootDir);

        expect(!result.ok && result.code).toBe('ALREADY_PUBLISHED');
        expect(mockInsert).not.toHaveBeenCalled();
        expect(existsSync(repoPath(JSON_PATH))).toBe(false);
    });

    it.each(['../../evil', 'a/b', 'A B', ''])('slug %p nie trafia do sciezki pliku', async slug => {
        mockSubmission.mockResolvedValue(submission({ slug }));

        const result = await publishServiceSubmission(ID, rootDir);

        expect(!result.ok && result.code).toBe('INVALID_ENTRY');
        expect(mockInsert).not.toHaveBeenCalled();
    });

    it('wpis bez wspolrzednych podaje pole i zostawia dysk i baze bez zmian', async () => {
        const entry = { ...ENTRY, coverage: 'local' };
        mockSubmission.mockResolvedValue(submission({ entry } as Partial<Submission>));

        const result = await publishServiceSubmission(ID, rootDir);

        expect(!result.ok && result.code).toBe('INVALID_ENTRY');
        expect(!result.ok && result.message).toContain('locations.0.latitude');
        expect(mockInsert).not.toHaveBeenCalled();
        expect(existsSync(repoPath(JSON_PATH))).toBe(false);
    });

    it('ta sama nazwa w katalogu blokuje publikacje', async () => {
        mockSameName.mockResolvedValue(1);

        const result = await publishServiceSubmission(ID, rootDir);

        expect(!result.ok && result.code).toBe('DUPLICATE_NAME');
        expect(mockInsert).not.toHaveBeenCalled();
    });

    it('kolizja slugow daje SLUG_CONFLICT z powodem', async () => {
        mockPlan.mockResolvedValue({ ok: false, message: 'slug zajety' });

        const result = await publishServiceSubmission(ID, rootDir);

        expect(result).toEqual({ ok: false, code: 'SLUG_CONFLICT', message: 'slug zajety' });
        expect(existsSync(repoPath(JSON_PATH))).toBe(false);
    });

    it('istniejacy plik wpisu nie jest nadpisywany', async () => {
        await writeFile(repoPath(JSON_PATH), 'moj plik');

        const result = await publishServiceSubmission(ID, rootDir);

        expect(!result.ok && result.code).toBe('FILE_EXISTS');
        await expect(readFile(repoPath(JSON_PATH), 'utf8')).resolves.toBe('moj plik');
        expect(mockInsert).not.toHaveBeenCalled();
    });

    it('istniejace logo zostaje, a utworzony plik wpisu znika', async () => {
        await writeFile(repoPath(LOGO_PATH), 'moje logo');

        const result = await publishServiceSubmission(ID, rootDir);

        expect(!result.ok && result.code).toBe('FILE_EXISTS');
        await expect(readFile(repoPath(LOGO_PATH), 'utf8')).resolves.toBe('moje logo');
        expect(existsSync(repoPath(JSON_PATH))).toBe(false);
    });

    it('blad zapisu usuwa utworzone pliki i nie ujawnia komunikatu bazy', async () => {
        mockInsert.mockRejectedValue(new Error('insert failed, params: wlasciciel@nowak.pl'));

        const result = await publishServiceSubmission(ID, rootDir);

        expect(!result.ok && result.code).toBe('SAVE_FAILED');
        expect(!result.ok && result.message).not.toContain('wlasciciel@nowak.pl');
        expect(JSON.stringify(jest.mocked(console.error).mock.calls)).not.toContain(
            'wlasciciel@nowak.pl',
        );
        expect(existsSync(repoPath(JSON_PATH))).toBe(false);
        expect(existsSync(repoPath(LOGO_PATH))).toBe(false);
        expect(mockEmbed).not.toHaveBeenCalled();
    });

    it('rownolegla publikacja cofa wpis i usuwa pliki', async () => {
        const returning = jest.fn().mockResolvedValue([]);
        const tx = {
            update: () => ({ set: () => ({ where: () => ({ returning }) }) }),
        } as unknown as Transaction;
        mockInsert.mockImplementation(async (_input, _slugs, _image, afterInsert) => {
            await afterInsert?.(tx);
            return SERVICE_ID;
        });

        const result = await publishServiceSubmission(ID, rootDir);

        expect(!result.ok && result.code).toBe('ALREADY_PUBLISHED');
        expect(existsSync(repoPath(JSON_PATH))).toBe(false);
    });

    it('blad embeddingu nie cofa publikacji', async () => {
        mockEmbed.mockRejectedValue(new Error('openai down'));

        const result = await publishServiceSubmission(ID, rootDir);

        expect(result.ok && result.data.isSearchIndexed).toBe(false);
        expect(existsSync(repoPath(JSON_PATH))).toBe(true);
    });
});
