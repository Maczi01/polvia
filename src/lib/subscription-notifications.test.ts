/**
 * @jest-environment node
 */
import { sendMail } from '@/lib/mailer';

import {
    NOTIFICATION_TIMEOUT_MS,
    notifyPremiumPurchased,
    notifySubscriptionConflict,
} from './subscription-notifications';

/** SMTP (za `@/lib/mailer`) i tryb klucza Stripe to granice zewnetrzne. */
const mockKeyMode = { isLive: true };

jest.mock('@/lib/stripe', () => ({
    get STRIPE_LIVE_MODE() {
        return mockKeyMode.isLive;
    },
}));
jest.mock('@/lib/mailer', () => ({
    sendMail: jest.fn(),
    getOperatorInbox: () => 'founder@polvia.pl',
}));

const PURCHASE = { serviceId: 'svc-1', stripeSubscriptionId: 'sub_1' };
const CONFLICT = {
    serviceId: 'svc-1',
    activeSubscriptionId: 'sub_first',
    conflictingSubscriptionId: 'sub_second',
};

function sentSubject(): string | undefined {
    return jest.mocked(sendMail).mock.calls[0]?.[0].subject;
}

beforeEach(() => {
    mockKeyMode.isLive = true;
    jest.mocked(sendMail).mockReset().mockResolvedValue({ ok: true });
    jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
});

describe('tryb klucza Stripe w temacie maila', () => {
    it.each([
        ['zakup', () => notifyPremiumPurchased(PURCHASE)],
        ['konflikt', () => notifySubscriptionConflict(CONFLICT)],
    ])('%s przy kluczu produkcyjnym: temat bez znacznika', async (_kind, notify) => {
        await notify();

        expect(sendMail).toHaveBeenCalledTimes(1);
        expect(sentSubject()).not.toContain('[TEST]');
    });

    it.each([
        ['zakup', () => notifyPremiumPurchased(PURCHASE)],
        ['konflikt', () => notifySubscriptionConflict(CONFLICT)],
    ])('%s przy kluczu testowym: temat z prefiksem [TEST]', async (_kind, notify) => {
        mockKeyMode.isLive = false;

        await notify();

        expect(sentSubject()).toMatch(/^\[TEST\] /);
    });

    it('mail o konflikcie idzie do foundera z identyfikatorami obu subskrypcji', async () => {
        await notifySubscriptionConflict(CONFLICT);

        const [message] = jest.mocked(sendMail).mock.calls[0] ?? [];
        expect(message?.to).toBe('founder@polvia.pl');
        expect(message?.text).toContain('sub_first');
        expect(message?.text).toContain('sub_second');
    });
});

describe('limit czasu i termin wolajacego', () => {
    it('bez terminu: zawieszona wysylka konczy sie po NOTIFICATION_TIMEOUT_MS z logiem', async () => {
        jest.useFakeTimers();
        jest.mocked(sendMail).mockReturnValue(new Promise(() => {}));

        const pending = notifyPremiumPurchased(PURCHASE);
        await jest.advanceTimersByTimeAsync(NOTIFICATION_TIMEOUT_MS);
        await pending;

        expect(console.error).toHaveBeenCalledWith('subscription notification not delivered', {
            kind: 'premium_purchased',
            result: 'timed_out',
        });
    });

    it('termin blizszy niz limit: wysylka konczy sie na terminie', async () => {
        jest.useFakeTimers();
        jest.mocked(sendMail).mockReturnValue(new Promise(() => {}));
        let isSettled = false;

        const pending = notifyPremiumPurchased(PURCHASE, { deadline: Date.now() + 1000 }).then(
            () => {
                isSettled = true;
            },
        );
        await jest.advanceTimersByTimeAsync(1000);
        await pending;

        expect(isSettled).toBe(true);
        expect(console.error).toHaveBeenCalledWith('subscription notification not delivered', {
            kind: 'premium_purchased',
            result: 'timed_out',
        });
    });

    it('termin juz minal: mail nie jest wysylany, wynik w logu', async () => {
        await notifySubscriptionConflict(CONFLICT, { deadline: Date.now() - 1 });

        expect(sendMail).not.toHaveBeenCalled();
        expect(console.error).toHaveBeenCalledWith('subscription notification not delivered', {
            kind: 'subscription_conflict',
            result: 'timed_out',
        });
    });

    it('nieudana wysylka konczy sie logiem failed, bez wyjatku', async () => {
        jest.mocked(sendMail).mockResolvedValue({ ok: false, code: 'SEND_FAILED' });

        await expect(notifyPremiumPurchased(PURCHASE)).resolves.toBeUndefined();
        expect(console.error).toHaveBeenCalledWith('subscription notification not delivered', {
            kind: 'premium_purchased',
            result: 'failed',
        });
    });
});
