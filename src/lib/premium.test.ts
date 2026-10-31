import {
    isPremiumActive,
    PREMIUM_GRACE_DAYS,
    premiumRankingExpiry,
    type PremiumSubscriptionState,
} from '@/lib/premium';

const PERIOD_END = new Date('2026-11-30T12:00:00.000Z');

function subscription(overrides: Partial<PremiumSubscriptionState> = {}): PremiumSubscriptionState {
    return {
        status: 'active',
        currentPeriodEnd: PERIOD_END,
        cancelAtPeriodEnd: false,
        ...overrides,
    };
}

describe('isPremiumActive', () => {
    it('zwraca true dla aktywnej subskrypcji w trakcie okresu', () => {
        const now = new Date('2026-11-15T12:00:00.000Z');

        expect(isPremiumActive(subscription(), now)).toBe(true);
    });

    it('zwraca true dla past_due w karencji po koncu okresu', () => {
        const now = new Date('2026-12-02T12:00:00.000Z');

        expect(isPremiumActive(subscription({ status: 'past_due' }), now)).toBe(true);
    });

    it('zwraca false dla past_due po karencji', () => {
        const now = new Date('2026-12-04T12:00:00.000Z');

        expect(isPremiumActive(subscription({ status: 'past_due' }), now)).toBe(false);
    });

    it('zwraca false dla canceled nawet w trakcie okresu', () => {
        const now = new Date('2026-11-15T12:00:00.000Z');

        expect(isPremiumActive(subscription({ status: 'canceled' }), now)).toBe(false);
    });

    it('zwraca true dla anulowania z koncem okresu, dopoki okres trwa', () => {
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
    it('zwraca koniec okresu plus PREMIUM_GRACE_DAYS dni', () => {
        expect(PREMIUM_GRACE_DAYS).toBe(3);
        expect(premiumRankingExpiry(subscription())).toEqual(new Date('2026-12-03T12:00:00.000Z'));
    });

    it('nie mutuje daty konca okresu', () => {
        const sub = subscription();

        premiumRankingExpiry(sub);

        expect(sub.currentPeriodEnd).toEqual(new Date('2026-11-30T12:00:00.000Z'));
    });
});
