import type { SubscriptionStatus } from './premium';
import type { StoredSubscription } from './subscription-store';
import { decideSubscriptionWrite } from './subscription-write-decision';

const NOW = new Date('2026-11-01T12:00:00Z');
const DAY_MS = 24 * 60 * 60 * 1000;

function subscription(id: string, status: SubscriptionStatus): StoredSubscription {
    return {
        stripeSubscriptionId: id,
        status,
        // Okres trwa; dla past_due start = nieudane odnowienie dzien temu (karencja trwa).
        currentPeriodStart: new Date(NOW.getTime() - DAY_MS),
        currentPeriodEnd: new Date(NOW.getTime() + 29 * DAY_MS),
        cancelAtPeriodEnd: false,
    };
}

describe('decideSubscriptionWrite', () => {
    it('brak zapisanej subskrypcji: zapis', () => {
        expect(decideSubscriptionWrite(null, subscription('sub_a', 'active'), NOW)).toEqual({
            kind: 'write',
            replacedSubscriptionId: null,
        });
    });

    it('ta sama subskrypcja po stanie koncowym: stale', () => {
        const stored = subscription('sub_a', 'canceled');

        expect(decideSubscriptionWrite(stored, subscription('sub_a', 'active'), NOW)).toEqual({
            kind: 'stale',
        });
    });

    it('ta sama subskrypcja, stan koncowy po stanie koncowym: zapis', () => {
        const stored = subscription('sub_a', 'incomplete_expired');

        expect(decideSubscriptionWrite(stored, subscription('sub_a', 'canceled'), NOW)).toEqual({
            kind: 'write',
            replacedSubscriptionId: null,
        });
    });

    it.each<SubscriptionStatus>(['active', 'trialing'])(
        'oplacona (%s) inna subskrypcja wypiera past_due: zapis z replacedSubscriptionId',
        status => {
            const stored = subscription('sub_old', 'past_due');

            expect(decideSubscriptionWrite(stored, subscription('sub_new', status), NOW)).toEqual({
                kind: 'write',
                replacedSubscriptionId: 'sub_old',
            });
        },
    );

    it('past_due w karencji wobec zapisanej aktywnej: konflikt NIEoplacony', () => {
        const stored = subscription('sub_new', 'active');

        expect(decideSubscriptionWrite(stored, subscription('sub_old', 'past_due'), NOW)).toEqual({
            kind: 'conflict',
            activeSubscriptionId: 'sub_new',
            isIncomingPaid: false,
        });
    });

    it('oplacona wobec zapisanej aktywnej: konflikt oplacony', () => {
        const stored = subscription('sub_a', 'active');

        expect(decideSubscriptionWrite(stored, subscription('sub_b', 'active'), NOW)).toEqual({
            kind: 'conflict',
            activeSubscriptionId: 'sub_a',
            isIncomingPaid: true,
        });
    });

    it('past_due nie wypiera innej past_due w karencji (konflikt bez oplaty)', () => {
        const stored = subscription('sub_a', 'past_due');

        expect(decideSubscriptionWrite(stored, subscription('sub_b', 'past_due'), NOW)).toEqual({
            kind: 'conflict',
            activeSubscriptionId: 'sub_a',
            isIncomingPaid: false,
        });
    });

    it('zapisana bez premium (canceled): inna subskrypcja zapisuje sie bez wyparcia', () => {
        const stored = subscription('sub_a', 'canceled');

        expect(decideSubscriptionWrite(stored, subscription('sub_b', 'incomplete'), NOW)).toEqual({
            kind: 'write',
            replacedSubscriptionId: null,
        });
    });
});
