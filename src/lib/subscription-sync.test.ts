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

const PRICE_MONTHLY = 'price_monthly_test';

jest.mock('../../env', () => ({
    env: { STRIPE_PRICE_MONTHLY: 'price_monthly_test', STRIPE_PRICE_YEARLY: 'price_yearly_test' },
}));

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

/** Z dokladnoscia do sekundy (Stripe podaje sekundy uniksowe). */
function wholeSeconds(ms: number): Date {
    return new Date(Math.floor(ms / 1000) * 1000);
}

/** Okres: zaczal sie 10 dni temu, konczy za 20 dni. */
const PERIOD_START = wholeSeconds(Date.now() - 10 * DAY_MS);
const PERIOD_END = wholeSeconds(Date.now() + 20 * DAY_MS);

function toUnix(date: Date): number {
    return Math.floor(date.getTime() / 1000);
}

function stripeSubscription(overrides: {
    id?: string;
    status?: string;
    periodStart?: Date;
    periodEnd?: Date;
    priceId?: string;
    metadata?: Record<string, string>;
    hasItems?: boolean;
}): StripeSubscriptionSnapshot {
    const item = {
        current_period_start: toUnix(overrides.periodStart ?? PERIOD_START),
        current_period_end: toUnix(overrides.periodEnd ?? PERIOD_END),
        price: { id: overrides.priceId ?? PRICE_MONTHLY },
    };
    return {
        id: overrides.id ?? 'sub_A',
        customer: 'cus_A',
        status: overrides.status ?? 'active',
        cancel_at_period_end: false,
        metadata: overrides.metadata ?? {},
        items: { data: overrides.hasItems === false ? [] : [item] },
    };
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
    let resolve: (value: T) => void = () => {};
    const promise = new Promise<T>(settle => {
        resolve = settle;
    });
    return { promise, resolve };
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
        currentPeriodStart: PERIOD_START,
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
            currentPeriodStart: PERIOD_START,
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

    it('past_due po karencji zdejmuje z rankingu, choc przesuniety okres trwa', async () => {
        // Stripe przesuwa okres przed nieudanym odnowieniem: start = nieudane odnowienie.
        stripeReturns(
            stripeSubscription({
                status: 'past_due',
                periodStart: wholeSeconds(Date.now() - (PREMIUM_GRACE_DAYS + 1) * DAY_MS),
                periodEnd: wholeSeconds(Date.now() + 26 * DAY_MS),
            }),
        );

        const result = await syncSubscriptionFromStripe('sub_A', { serviceId: SERVICE_A });

        expect(result).toMatchObject({ outcome: 'synced', isPremiumActive: false });
        expect(mockDb.promotions.has(SERVICE_A)).toBe(false);
    });

    it('past_due w karencji: ranking do poczatku okresu + karencja, nie do nowego konca', async () => {
        const renewalFailedAt = wholeSeconds(Date.now() - DAY_MS);
        stripeReturns(
            stripeSubscription({
                status: 'past_due',
                periodStart: renewalFailedAt,
                periodEnd: wholeSeconds(Date.now() + 29 * DAY_MS),
            }),
        );

        const result = await syncSubscriptionFromStripe('sub_A', { serviceId: SERVICE_A });

        expect(result).toMatchObject({ outcome: 'synced', isPremiumActive: true });
        expect(mockDb.subscriptions.get(SERVICE_A)?.currentPeriodStart).toEqual(renewalFailedAt);
        expect(mockDb.promotions.get(SERVICE_A)).toEqual(
            new Date(renewalFailedAt.getTime() + PREMIUM_GRACE_DAYS * DAY_MS),
        );
    });

    describe('stan koncowy (canceled) a nieswiezy odczyt', () => {
        it('po zapisanym canceled starszy past_due tej samej subskrypcji nie przywraca premium', async () => {
            mockDb.subscriptions.set(SERVICE_A, {
                ...storedActive(SERVICE_A, 'sub_A'),
                status: 'canceled',
            });
            stripeReturns(stripeSubscription({ status: 'past_due' }));

            const result = await syncSubscriptionFromStripe('sub_A');

            expect(result).toEqual({
                outcome: 'synced',
                serviceId: SERVICE_A,
                isPremiumActive: false,
            });
            expect(mockDb.subscriptions.get(SERVICE_A)?.status).toBe('canceled');
            expect(mockDb.promotions.has(SERVICE_A)).toBe(false);
        });

        it('wyscig: retrieve rozwiazany w odwrotnej kolejnosci — wygrywa canceled', async () => {
            mockDb.subscriptions.set(SERVICE_A, storedActive(SERVICE_A, 'sub_A'));
            mockDb.promotions.set(SERVICE_A, PERIOD_END);
            const stale = deferred<StripeSubscriptionSnapshot>();
            const fresh = deferred<StripeSubscriptionSnapshot>();
            mockRetrieve.mockReturnValueOnce(stale.promise).mockReturnValueOnce(fresh.promise);

            // A (invoice.payment_failed) pobiera stan pierwsze, ale konczy ostatnie.
            const staleSync = syncSubscriptionFromStripe('sub_A');
            const freshSync = syncSubscriptionFromStripe('sub_A');
            fresh.resolve(stripeSubscription({ status: 'canceled' }));
            await freshSync;
            stale.resolve(
                stripeSubscription({
                    status: 'past_due',
                    periodStart: wholeSeconds(Date.now() - DAY_MS),
                }),
            );
            await staleSync;

            expect(mockDb.subscriptions.get(SERVICE_A)?.status).toBe('canceled');
            expect(mockDb.promotions.has(SERVICE_A)).toBe(false);
        });
    });

    describe('cena spoza allowlisty premium', () => {
        it('subskrypcja z obca cena nie daje premium, nawet ze wskazanym wpisem', async () => {
            stripeReturns(stripeSubscription({ priceId: 'price_other_product' }));

            const result = await syncSubscriptionFromStripe('sub_A', { serviceId: SERVICE_A });

            expect(result).toEqual({ outcome: 'unlinked' });
            expect(mockDb.subscriptions.size).toBe(0);
            expect(mockDb.promotions.size).toBe(0);
            expect(console.warn).toHaveBeenCalledWith(
                expect.stringContaining('premium price'),
                expect.objectContaining({ priceIds: ['price_other_product'] }),
            );
        });

        it('zmiana planu na obca cene nie przedluza premium powiazanego wpisu', async () => {
            const linked = storedActive(SERVICE_A, 'sub_A');
            mockDb.subscriptions.set(SERVICE_A, linked);
            stripeReturns(
                stripeSubscription({
                    priceId: 'price_other_product',
                    periodEnd: wholeSeconds(Date.now() + 300 * DAY_MS),
                }),
            );

            const result = await syncSubscriptionFromStripe('sub_A');

            expect(result).toEqual({ outcome: 'unlinked' });
            expect(mockDb.subscriptions.get(SERVICE_A)).toEqual(linked);
        });

        it('cena roczna z allowlisty daje premium', async () => {
            stripeReturns(stripeSubscription({ priceId: 'price_yearly_test' }));

            const result = await syncSubscriptionFromStripe('sub_A', { serviceId: SERVICE_A });

            expect(result).toMatchObject({ outcome: 'synced', isPremiumActive: true });
        });
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
        it('aktywna druga subskrypcja nie nadpisuje aktywnej pierwszej; konflikt w wyniku, bez maila', async () => {
            const first = storedActive(SERVICE_A, 'sub_first');
            mockDb.subscriptions.set(SERVICE_A, first);
            mockDb.promotions.set(SERVICE_A, PERIOD_END);
            stripeReturns(stripeSubscription({ id: 'sub_second', status: 'active' }));

            const result = await syncSubscriptionFromStripe('sub_second', {
                serviceId: SERVICE_A,
            });

            expect(result).toEqual({
                outcome: 'conflict',
                serviceId: SERVICE_A,
                activeSubscriptionId: 'sub_first',
                conflictingSubscriptionId: 'sub_second',
                isIncomingActive: true,
            });
            expect(mockDb.subscriptions.get(SERVICE_A)).toEqual(first);
            expect(mockDb.promotions.get(SERVICE_A)).toEqual(PERIOD_END);
            // Mail o konflikcie wysyla webhook raz na checkout (route.test.ts), nie synchronizacja.
            expect(sendMail).not.toHaveBeenCalled();
        });

        it('nieaktywna druga subskrypcja nie nadpisuje stanu; konflikt bez oplaty', async () => {
            const first = storedActive(SERVICE_A, 'sub_first');
            mockDb.subscriptions.set(SERVICE_A, first);
            stripeReturns(stripeSubscription({ id: 'sub_second', status: 'canceled' }));

            const result = await syncSubscriptionFromStripe('sub_second', {
                serviceId: SERVICE_A,
            });

            expect(result).toMatchObject({ outcome: 'conflict', isIncomingActive: false });
            expect(mockDb.subscriptions.get(SERVICE_A)).toEqual(first);
            expect(sendMail).not.toHaveBeenCalled();
        });

        describe('nowy zakup w karencji past_due starej subskrypcji', () => {
            const renewalFailedAt = wholeSeconds(Date.now() - DAY_MS);
            const oldPastDue: SubscriptionRecord = {
                ...storedActive(SERVICE_A, 'sub_old'),
                status: 'past_due',
                currentPeriodStart: renewalFailedAt,
                currentPeriodEnd: wholeSeconds(Date.now() + 29 * DAY_MS),
            };

            it('oplacona nowa wypiera zapisana past_due: zapis, premium, ranking, bez konfliktu', async () => {
                mockDb.subscriptions.set(SERVICE_A, oldPastDue);
                mockDb.promotions.set(
                    SERVICE_A,
                    new Date(renewalFailedAt.getTime() + PREMIUM_GRACE_DAYS * DAY_MS),
                );
                stripeReturns(stripeSubscription({ id: 'sub_new', status: 'active' }));

                const result = await syncSubscriptionFromStripe('sub_new', {
                    serviceId: SERVICE_A,
                });

                expect(result).toEqual({
                    outcome: 'synced',
                    serviceId: SERVICE_A,
                    isPremiumActive: true,
                });
                expect(mockDb.subscriptions.get(SERVICE_A)).toEqual({
                    serviceId: SERVICE_A,
                    stripeSubscriptionId: 'sub_new',
                    stripeCustomerId: 'cus_A',
                    status: 'active',
                    currentPeriodStart: PERIOD_START,
                    currentPeriodEnd: PERIOD_END,
                    cancelAtPeriodEnd: false,
                });
                expect(mockDb.promotions.get(SERVICE_A)).toEqual(
                    new Date(PERIOD_END.getTime() + PREMIUM_GRACE_DAYS * DAY_MS),
                );
                expect(console.warn).toHaveBeenCalledWith(
                    expect.stringContaining('replaces past_due'),
                    {
                        serviceId: SERVICE_A,
                        stripeSubscriptionId: 'sub_new',
                        replacedSubscriptionId: 'sub_old',
                    },
                );
                expect(sendMail).not.toHaveBeenCalled();
            });

            it('pozniejsze anulowanie starej nie zmienia wiersza nowej (konflikt bez oplaty)', async () => {
                mockDb.subscriptions.set(SERVICE_A, oldPastDue);
                stripeReturns(stripeSubscription({ id: 'sub_new', status: 'active' }));
                await syncSubscriptionFromStripe('sub_new', { serviceId: SERVICE_A });
                const newRow = mockDb.subscriptions.get(SERVICE_A);
                const newPromotion = mockDb.promotions.get(SERVICE_A);

                // customer.subscription.deleted starej: bez wskazowki, wiaze po zapisie/metadanych.
                stripeReturns(
                    stripeSubscription({
                        id: 'sub_old',
                        status: 'canceled',
                        metadata: { serviceSlug: 'kancelaria-a' },
                    }),
                );
                const result = await syncSubscriptionFromStripe('sub_old');

                expect(result).toEqual({
                    outcome: 'conflict',
                    serviceId: SERVICE_A,
                    activeSubscriptionId: 'sub_new',
                    conflictingSubscriptionId: 'sub_old',
                    isIncomingActive: false,
                });
                expect(mockDb.subscriptions.get(SERVICE_A)).toEqual(newRow);
                expect(mockDb.promotions.get(SERVICE_A)).toEqual(newPromotion);
                expect(sendMail).not.toHaveBeenCalled();
            });

            it('stara odzyskuje platnosc po wyparciu: konflikt oplacony, wiersz nowej bez zmian, log', async () => {
                mockDb.subscriptions.set(SERVICE_A, oldPastDue);
                stripeReturns(stripeSubscription({ id: 'sub_new', status: 'active' }));
                await syncSubscriptionFromStripe('sub_new', { serviceId: SERVICE_A });
                const newRow = mockDb.subscriptions.get(SERVICE_A);
                const newPromotion = mockDb.promotions.get(SERVICE_A);

                // invoice.paid starej (past_due → active): zdarzenie inne niz checkout.
                stripeReturns(
                    stripeSubscription({
                        id: 'sub_old',
                        status: 'active',
                        metadata: { serviceSlug: 'kancelaria-a' },
                    }),
                );
                const result = await syncSubscriptionFromStripe('sub_old');

                expect(result).toEqual({
                    outcome: 'conflict',
                    serviceId: SERVICE_A,
                    activeSubscriptionId: 'sub_new',
                    conflictingSubscriptionId: 'sub_old',
                    isIncomingActive: true,
                });
                expect(mockDb.subscriptions.get(SERVICE_A)).toEqual(newRow);
                expect(mockDb.promotions.get(SERVICE_A)).toEqual(newPromotion);
                expect(console.warn).toHaveBeenCalledWith(
                    expect.stringContaining('second paid subscription'),
                    {
                        serviceId: SERVICE_A,
                        activeSubscriptionId: 'sub_new',
                        conflictingSubscriptionId: 'sub_old',
                    },
                );
                expect(sendMail).not.toHaveBeenCalled();
            });

            it('konflikt z nieoplacona subskrypcja nie loguje podwojnej oplaty', async () => {
                mockDb.subscriptions.set(SERVICE_A, storedActive(SERVICE_A, 'sub_new'));
                stripeReturns(stripeSubscription({ id: 'sub_old', status: 'canceled' }));

                const result = await syncSubscriptionFromStripe('sub_old', {
                    serviceId: SERVICE_A,
                });

                expect(result).toMatchObject({ outcome: 'conflict', isIncomingActive: false });
                expect(console.warn).not.toHaveBeenCalledWith(
                    expect.stringContaining('second paid subscription'),
                    expect.anything(),
                );
            });

            it('nieoplacona nowa (incomplete) nie wypiera past_due w karencji', async () => {
                mockDb.subscriptions.set(SERVICE_A, oldPastDue);
                stripeReturns(stripeSubscription({ id: 'sub_new', status: 'incomplete' }));

                const result = await syncSubscriptionFromStripe('sub_new', {
                    serviceId: SERVICE_A,
                });

                expect(result).toEqual({
                    outcome: 'conflict',
                    serviceId: SERVICE_A,
                    activeSubscriptionId: 'sub_old',
                    conflictingSubscriptionId: 'sub_new',
                    isIncomingActive: false,
                });
                expect(mockDb.subscriptions.get(SERVICE_A)).toEqual(oldPastDue);
            });
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
