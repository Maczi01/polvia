/**
 * @jest-environment node
 */
import { sendMail } from '@/lib/mailer';
import { PREMIUM_GRACE_DAYS } from '@/lib/premium';
import type { StoredSubscription, SubscriptionRecord } from '@/lib/subscription-store';

import {
    type StripeSubscriptionSnapshot,
    SubscriptionSyncError,
    syncSubscriptionFromStripe,
} from './subscription-sync';

/**
 * Stripe, baza (za adapterem `subscription-store`) i SMTP to zewnetrzne serwisy.
 * Baza to slownik w pamieci: subskrypcje i ranking per `serviceId`.
 */
const mockDb = {
    services: new Set<string>(),
    slugs: new Map<string, string>(),
    subscriptions: new Map<string, SubscriptionRecord>(),
    promotions: new Map<string, Date>(),
};

const mockRetrieve = jest.fn<Promise<StripeSubscriptionSnapshot>, [string]>();

// Getter, bo fabryka `jest.mock` jest hoistowana nad inicjalizacje `mockRetrieve`.
jest.mock('@/lib/stripe', () => ({
    stripe: {
        subscriptions: {
            get retrieve() {
                return mockRetrieve;
            },
        },
    },
}));
jest.mock('@/lib/mailer', () => ({
    sendMail: jest.fn(),
    getOperatorInbox: () => 'founder@polvia.pl',
}));
jest.mock('@/lib/subscription-store', () => ({
    findServiceIdBySubscriptionId: async (id: string) =>
        [...mockDb.subscriptions.values()].find(row => row.stripeSubscriptionId === id)
            ?.serviceId ?? null,
    findServiceIdBySlug: async (slug: string) => mockDb.slugs.get(slug) ?? null,
    runSubscriptionTransaction: async <T>(work: (store: unknown) => Promise<T>): Promise<T> =>
        work({
            lockService: async (serviceId: string) => mockDb.services.has(serviceId),
            findSubscription: async (serviceId: string): Promise<StoredSubscription | null> => {
                const row = mockDb.subscriptions.get(serviceId);
                if (!row) return null;
                const { serviceId: _id, stripeCustomerId: _customer, ...stored } = row;
                return stored;
            },
            saveSubscription: async (record: SubscriptionRecord) => {
                mockDb.subscriptions.set(record.serviceId, record);
            },
            setPromotion: async (serviceId: string, expiresAt: Date | null) => {
                if (expiresAt === null) mockDb.promotions.delete(serviceId);
                else mockDb.promotions.set(serviceId, expiresAt);
            },
        }),
}));

const SERVICE_A = '11111111-1111-4111-8111-111111111111';
const SERVICE_B = '22222222-2222-4222-8222-222222222222';
const DAY_MS = 24 * 60 * 60 * 1000;

/** Koniec okresu za 20 dni, z dokladnoscia do sekundy (Stripe podaje sekundy uniksowe). */
const PERIOD_END = new Date(Math.floor((Date.now() + 20 * DAY_MS) / 1000) * 1000);

function stripeSubscription(overrides: {
    id?: string;
    status?: string;
    periodEnd?: Date;
    metadata?: Record<string, string>;
    hasItems?: boolean;
}): StripeSubscriptionSnapshot {
    const periodEnd = Math.floor((overrides.periodEnd ?? PERIOD_END).getTime() / 1000);
    return {
        id: overrides.id ?? 'sub_A',
        customer: 'cus_A',
        status: overrides.status ?? 'active',
        cancel_at_period_end: false,
        metadata: overrides.metadata ?? {},
        items: {
            data: overrides.hasItems === false ? [] : [{ current_period_end: periodEnd }],
        },
    };
}

function stripeReturns(subscription: StripeSubscriptionSnapshot): void {
    mockRetrieve.mockResolvedValue(subscription);
}

function storedActive(serviceId: string, stripeSubscriptionId: string): SubscriptionRecord {
    return {
        serviceId,
        stripeSubscriptionId,
        stripeCustomerId: 'cus_first',
        status: 'active',
        currentPeriodEnd: PERIOD_END,
        cancelAtPeriodEnd: false,
    };
}

beforeEach(() => {
    mockDb.services = new Set([SERVICE_A, SERVICE_B]);
    mockDb.slugs = new Map([['kancelaria-a', SERVICE_A]]);
    mockDb.subscriptions = new Map();
    mockDb.promotions = new Map();
    mockRetrieve.mockReset();
    jest.mocked(sendMail).mockReset().mockResolvedValue({ ok: true });
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe('syncSubscriptionFromStripe', () => {
    it('active: zapisuje stan i ustawia ranking do currentPeriodEnd + karencja', async () => {
        stripeReturns(stripeSubscription({ status: 'active' }));

        const result = await syncSubscriptionFromStripe('sub_A', { serviceId: SERVICE_A });

        expect(result).toEqual({ outcome: 'synced', serviceId: SERVICE_A, isPremiumActive: true });
        expect(mockDb.subscriptions.get(SERVICE_A)).toEqual({
            serviceId: SERVICE_A,
            stripeSubscriptionId: 'sub_A',
            stripeCustomerId: 'cus_A',
            status: 'active',
            currentPeriodEnd: PERIOD_END,
            cancelAtPeriodEnd: false,
        });
        expect(mockDb.promotions.get(SERVICE_A)).toEqual(
            new Date(PERIOD_END.getTime() + PREMIUM_GRACE_DAYS * DAY_MS),
        );
    });

    it('canceled: usuwa wpis z promoted_services, stan zapisany jako canceled', async () => {
        mockDb.subscriptions.set(SERVICE_A, storedActive(SERVICE_A, 'sub_A'));
        mockDb.promotions.set(SERVICE_A, PERIOD_END);
        stripeReturns(stripeSubscription({ status: 'canceled' }));

        const result = await syncSubscriptionFromStripe('sub_A');

        expect(result).toEqual({ outcome: 'synced', serviceId: SERVICE_A, isPremiumActive: false });
        expect(mockDb.promotions.has(SERVICE_A)).toBe(false);
        expect(mockDb.subscriptions.get(SERVICE_A)?.status).toBe('canceled');
    });

    it('past_due po karencji zdejmuje z rankingu', async () => {
        const longAgo = new Date(Date.now() - (PREMIUM_GRACE_DAYS + 1) * DAY_MS);
        stripeReturns(stripeSubscription({ status: 'past_due', periodEnd: longAgo }));

        await syncSubscriptionFromStripe('sub_A', { serviceId: SERVICE_A });

        expect(mockDb.promotions.has(SERVICE_A)).toBe(false);
    });

    it('stan zawsze ze swiezo pobranej subskrypcji (pobiera ja po id)', async () => {
        stripeReturns(stripeSubscription({}));

        await syncSubscriptionFromStripe('sub_A', { serviceId: SERVICE_A });

        expect(mockRetrieve).toHaveBeenCalledWith('sub_A');
    });

    describe('powiazanie z usluga', () => {
        it('bez wskazowki bierze usluge z istniejacego wiersza subskrypcji', async () => {
            mockDb.subscriptions.set(SERVICE_B, storedActive(SERVICE_B, 'sub_A'));
            stripeReturns(stripeSubscription({ metadata: { serviceSlug: 'kancelaria-a' } }));

            const result = await syncSubscriptionFromStripe('sub_A');

            expect(result).toMatchObject({ outcome: 'synced', serviceId: SERVICE_B });
        });

        it('po db:reset (nowe id uslug) wiaze po metadata.serviceSlug, nie po starym serviceId', async () => {
            const staleId = '99999999-9999-4999-8999-999999999999';
            stripeReturns(
                stripeSubscription({
                    metadata: { serviceId: staleId, serviceSlug: 'kancelaria-a' },
                }),
            );

            const result = await syncSubscriptionFromStripe('sub_A');

            expect(result).toMatchObject({ outcome: 'synced', serviceId: SERVICE_A });
        });

        it('fallback: metadata.serviceId, gdy brak slugu', async () => {
            stripeReturns(stripeSubscription({ metadata: { serviceId: SERVICE_B } }));

            const result = await syncSubscriptionFromStripe('sub_A');

            expect(result).toMatchObject({ outcome: 'synced', serviceId: SERVICE_B });
        });

        it('subskrypcja bez zadnego powiazania nie zapisuje niczego', async () => {
            stripeReturns(stripeSubscription({ metadata: { serviceId: 'nie-uuid' } }));

            const result = await syncSubscriptionFromStripe('sub_A');

            expect(result).toEqual({ outcome: 'unlinked' });
            expect(mockDb.subscriptions.size).toBe(0);
        });

        it('usluga, ktorej nie ma w bazie, nie jest zapisywana', async () => {
            const missing = '33333333-3333-4333-8333-333333333333';
            stripeReturns(stripeSubscription({}));

            const result = await syncSubscriptionFromStripe('sub_A', { serviceId: missing });

            expect(result).toEqual({ outcome: 'service_missing', serviceId: missing });
            expect(mockDb.subscriptions.size).toBe(0);
            expect(mockDb.promotions.size).toBe(0);
        });
    });

    describe('druga subskrypcja dla jednego wpisu', () => {
        it('aktywna druga subskrypcja nie nadpisuje aktywnej pierwszej i powiadamia foundera', async () => {
            const first = storedActive(SERVICE_A, 'sub_first');
            mockDb.subscriptions.set(SERVICE_A, first);
            mockDb.promotions.set(SERVICE_A, PERIOD_END);
            stripeReturns(stripeSubscription({ id: 'sub_second', status: 'active' }));

            const result = await syncSubscriptionFromStripe('sub_second', {
                serviceId: SERVICE_A,
            });

            expect(result).toEqual({ outcome: 'conflict', serviceId: SERVICE_A });
            expect(mockDb.subscriptions.get(SERVICE_A)).toEqual(first);
            expect(mockDb.promotions.get(SERVICE_A)).toEqual(PERIOD_END);
            expect(sendMail).toHaveBeenCalledTimes(1);
            const [message] = jest.mocked(sendMail).mock.calls[0] ?? [];
            expect(message?.to).toBe('founder@polvia.pl');
            expect(message?.text).toContain('sub_second');
            expect(message?.text).toContain('sub_first');
        });

        it('nieaktywna druga subskrypcja nie nadpisuje stanu i nie powiadamia', async () => {
            const first = storedActive(SERVICE_A, 'sub_first');
            mockDb.subscriptions.set(SERVICE_A, first);
            stripeReturns(stripeSubscription({ id: 'sub_second', status: 'canceled' }));

            const result = await syncSubscriptionFromStripe('sub_second', {
                serviceId: SERVICE_A,
            });

            expect(result).toEqual({ outcome: 'conflict', serviceId: SERVICE_A });
            expect(mockDb.subscriptions.get(SERVICE_A)).toEqual(first);
            expect(sendMail).not.toHaveBeenCalled();
        });

        it('nowa subskrypcja po wygasnieciu poprzedniej zastepuje ja', async () => {
            mockDb.subscriptions.set(SERVICE_A, {
                ...storedActive(SERVICE_A, 'sub_old'),
                status: 'canceled',
            });
            stripeReturns(stripeSubscription({ id: 'sub_new', status: 'active' }));

            const result = await syncSubscriptionFromStripe('sub_new', { serviceId: SERVICE_A });

            expect(result).toMatchObject({ outcome: 'synced', isPremiumActive: true });
            expect(mockDb.subscriptions.get(SERVICE_A)?.stripeSubscriptionId).toBe('sub_new');
            expect(sendMail).not.toHaveBeenCalled();
        });
    });

    describe('bledy', () => {
        it('blad Stripe przechodzi wyzej i niczego nie zapisuje', async () => {
            mockRetrieve.mockRejectedValue(new Error('timeout'));

            await expect(
                syncSubscriptionFromStripe('sub_A', { serviceId: SERVICE_A }),
            ).rejects.toThrow('timeout');
            expect(mockDb.subscriptions.size).toBe(0);
        });

        it('nieznany status Stripe to typowany blad UNSUPPORTED_STATUS', async () => {
            stripeReturns(stripeSubscription({ status: 'frozen' }));

            await expect(
                syncSubscriptionFromStripe('sub_A', { serviceId: SERVICE_A }),
            ).rejects.toEqual(new SubscriptionSyncError('UNSUPPORTED_STATUS', 'sub_A'));
            expect(mockDb.subscriptions.size).toBe(0);
        });

        it('subskrypcja bez pozycji (brak konca okresu) to blad MISSING_PERIOD', async () => {
            stripeReturns(stripeSubscription({ hasItems: false }));

            await expect(
                syncSubscriptionFromStripe('sub_A', { serviceId: SERVICE_A }),
            ).rejects.toMatchObject({ code: 'MISSING_PERIOD' });
        });
    });
});
