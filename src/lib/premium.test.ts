import {
    isPremiumActive,
    premiumRankingExpiry,
    type PremiumSubscriptionState,
} from '@/lib/premium';

const PERIOD_START = new Date('2026-10-31T12:00:00.000Z');
const PERIOD_END = new Date('2026-11-30T12:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;

function subscription(overrides: Partial<PremiumSubscriptionState> = {}): PremiumSubscriptionState {
    return {
        status: 'active',
        currentPeriodStart: PERIOD_START,
        currentPeriodEnd: PERIOD_END,
        cancelAtPeriodEnd: false,
        ...overrides,
    };
}

/**
 * Stan, ktory Stripe produkuje po nieudanym odnowieniu: okres JUZ przesuniety
 * (start = koniec oplaconego okresu, koniec = +1 miesiac), status `past_due`.
 */
function pastDueAfterRenewal(): PremiumSubscriptionState {
    return subscription({
        status: 'past_due',
        currentPeriodStart: PERIOD_END,
        currentPeriodEnd: new Date('2026-12-30T12:00:00.000Z'),
    });
}

describe('isPremiumActive', () => {
    it('zwraca true dla aktywnej subskrypcji w trakcie okresu', () => {
        const now = new Date('2026-11-15T12:00:00.000Z');

        expect(isPremiumActive(subscription(), now)).toBe(true);
    });

    it('zwraca true dla past_due w karencji po nieudanym odnowieniu', () => {
        const now = new Date('2026-12-02T12:00:00.000Z');

        expect(isPremiumActive(pastDueAfterRenewal(), now)).toBe(true);
    });

    it('zwraca false dla past_due po karencji, mimo ze nowy koniec okresu jest w przyszlosci', () => {
        const now = new Date('2026-12-04T12:00:00.000Z');

        expect(isPremiumActive(pastDueAfterRenewal(), now)).toBe(false);
    });

    it('past_due: periodEnd za 28 dni, periodStart 4 dni temu — brak premium', () => {
        const now = new Date('2026-11-15T12:00:00.000Z');
        const sub = subscription({
            status: 'past_due',
            currentPeriodStart: new Date(now.getTime() - 4 * DAY_MS),
            currentPeriodEnd: new Date(now.getTime() + 28 * DAY_MS),
        });

        expect(isPremiumActive(sub, now)).toBe(false);
    });

    it('past_due: periodStart 1 dzien temu — premium w karencji', () => {
        const now = new Date('2026-11-15T12:00:00.000Z');
        const sub = subscription({
            status: 'past_due',
            currentPeriodStart: new Date(now.getTime() - DAY_MS),
            currentPeriodEnd: new Date(now.getTime() + 29 * DAY_MS),
        });

        expect(isPremiumActive(sub, now)).toBe(true);
    });

    it('zwraca false dla canceled nawet w trakcie okresu', () => {
        const now = new Date('2026-11-15T12:00:00.000Z');

        expect(isPremiumActive(subscription({ status: 'canceled' }), now)).toBe(false);
    });

    it('anulowanie z koncem okresu nie skraca oplaconego okresu', () => {
        const now = new Date('2026-11-29T12:00:00.000Z');

        expect(isPremiumActive(subscription({ cancelAtPeriodEnd: true }), now)).toBe(true);
    });

    it('zwraca false bez subskrypcji', () => {
        const now = new Date('2026-11-15T12:00:00.000Z');

        expect(isPremiumActive(null, now)).toBe(false);
    });

    it('zwraca false dokladnie na granicy konca okresu plus karencja', () => {
        const now = new Date('2026-12-03T12:00:00.000Z');

        expect(isPremiumActive(subscription(), now)).toBe(false);
    });

    it('zwraca true milisekunde przed granica karencji', () => {
        const now = new Date('2026-12-03T11:59:59.999Z');

        expect(isPremiumActive(subscription(), now)).toBe(true);
    });
});

describe('premiumRankingExpiry', () => {
    it('zwraca koniec okresu plus 3 dni karencji', () => {
        expect(premiumRankingExpiry(subscription())).toEqual(new Date('2026-12-03T12:00:00.000Z'));
    });

    it('past_due: poczatek (przesunietego) okresu plus 3 dni, nie nowy koniec', () => {
        expect(premiumRankingExpiry(pastDueAfterRenewal())).toEqual(
            new Date('2026-12-03T12:00:00.000Z'),
        );
    });

    it('nie mutuje daty konca okresu', () => {
        const sub = subscription();

        premiumRankingExpiry(sub);

        expect(sub.currentPeriodEnd).toEqual(new Date('2026-11-30T12:00:00.000Z'));
    });
});
