/**
 * @jest-environment node
 */
import { type SubscriptionSyncResult, syncSubscriptionSnapshot } from '@/lib/subscription-sync';

import { keyModeRefusal, runSubscriptionResync } from './subscription-resync';

/** Stripe (lista subskrypcji) i synchronizacja (baza) to granice zewnetrzne skryptu. */
const mockListed: Array<{ id: string; created: number }> = [];

jest.mock('@/lib/stripe', () => ({
    stripe: {
        subscriptions: {
            // Lista Stripe jest asynchronicznie iterowalna (auto-paginacja).
            list: () => ({
                async *[Symbol.asyncIterator]() {
                    yield* mockListed;
                },
            }),
        },
    },
}));
jest.mock('@/lib/subscription-sync', () => ({ syncSubscriptionSnapshot: jest.fn() }));

const LOCAL = { hostname: 'localhost', isLocal: true };
const REMOTE = { hostname: 'db.prod.example.com', isLocal: false };
const SERVICE_ID = '11111111-1111-4111-8111-111111111111';

function syncedIds(): string[] {
    return jest
        .mocked(syncSubscriptionSnapshot)
        .mock.calls.map(([subscription]) => subscription.id);
}

function logged(): string {
    return jest
        .mocked(console.log)
        .mock.calls.map(args => args.map(String).join(' '))
        .join('\n');
}

beforeEach(() => {
    mockListed.length = 0;
    jest.mocked(syncSubscriptionSnapshot)
        .mockReset()
        .mockResolvedValue({ outcome: 'synced', serviceId: SERVICE_ID, isPremiumActive: true });
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe('keyModeRefusal', () => {
    it('klucz testowy + baza zdalna: odmowa z samym hostem', () => {
        const refusal = keyModeRefusal(REMOTE, false);

        expect(refusal).toContain('ODMOWA');
        expect(refusal).toContain('db.prod.example.com');
    });

    it.each([
        ['klucz produkcyjny + baza zdalna', REMOTE, true],
        ['klucz testowy + baza lokalna', LOCAL, false],
    ])('%s: start dozwolony', (_case, database, isLiveKey) => {
        expect(keyModeRefusal(database, isLiveKey)).toBeNull();
    });
});

describe('runSubscriptionResync', () => {
    it('odmowa trybu: kod 1, zadnej synchronizacji', async () => {
        mockListed.push({ id: 'sub_1', created: 1 });

        expect(await runSubscriptionResync(REMOTE, false)).toBe(1);
        expect(syncSubscriptionSnapshot).not.toHaveBeenCalled();
        expect(console.error).toHaveBeenCalledWith(expect.stringContaining('ODMOWA'));
    });

    it('synchronizuje obiekty z listy od najstarszego, bez wskazowki wpisu; kod 0', async () => {
        mockListed.push({ id: 'sub_new', created: 300 }, { id: 'sub_old', created: 100 });

        expect(await runSubscriptionResync(LOCAL, false)).toBe(0);
        expect(syncedIds()).toEqual(['sub_old', 'sub_new']);
        expect(syncSubscriptionSnapshot).toHaveBeenCalledWith(mockListed[1]);
    });

    it('konflikt loguje subskrypcje, ktora wpis zachowal, i oznacza oplacona do zwrotu', async () => {
        mockListed.push({ id: 'sub_second', created: 2 });
        const conflict: SubscriptionSyncResult = {
            outcome: 'conflict',
            serviceId: SERVICE_ID,
            activeSubscriptionId: 'sub_first',
            conflictingSubscriptionId: 'sub_second',
            isIncomingActive: true,
        };
        jest.mocked(syncSubscriptionSnapshot).mockResolvedValue(conflict);

        await runSubscriptionResync(LOCAL, true);

        expect(logged()).toContain(
            'sub_second: conflict (wpis ma sub_first, oplacona — do zwrotu)',
        );
    });

    it('blad jednej subskrypcji nie przerywa reszty; podsumowanie i kod 1', async () => {
        mockListed.push({ id: 'sub_bad', created: 1 }, { id: 'sub_ok', created: 2 });
        jest.mocked(syncSubscriptionSnapshot)
            .mockRejectedValueOnce(new Error('timeout'))
            .mockResolvedValueOnce({ outcome: 'stale_ignored', serviceId: SERVICE_ID });

        expect(await runSubscriptionResync(LOCAL, false)).toBe(1);
        expect(syncedIds()).toEqual(['sub_bad', 'sub_ok']);
        expect(console.log).toHaveBeenCalledWith('Podsumowanie:', {
            synced: 0,
            stale_ignored: 1,
            conflict: 0,
            unlinked: 0,
            service_missing: 0,
            failed: 1,
        });
    });
});
