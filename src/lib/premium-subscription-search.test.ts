/**
 * @jest-environment node
 */
import {
    hasActivePremiumSubscription,
    SUBSCRIPTION_SEARCH_TIMEOUT_MS,
} from './premium-subscription-search';

/** Stripe to zewnetrzny serwis. Getter, bo fabryka `jest.mock` jest hoistowana. */
const mockSearch = jest.fn();

jest.mock('@/lib/stripe', () => ({
    stripe: {
        subscriptions: {
            get search() {
                return mockSearch;
            },
        },
    },
}));

const SERVICE_ID = '6f1c2a9e-3b7d-4c55-9a10-2f4e8d7b1c01';

beforeEach(() => {
    mockSearch.mockReset();
    jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
});

describe('hasActivePremiumSubscription', () => {
    it('szuka po metadata serviceId ustawianym przy tworzeniu sesji', async () => {
        mockSearch.mockResolvedValue({ data: [] });

        expect(await hasActivePremiumSubscription(SERVICE_ID)).toBe(false);
        expect(mockSearch).toHaveBeenCalledWith({
            query: `metadata['serviceId']:'${SERVICE_ID}'`,
            limit: 10,
        });
    });

    it.each(['active', 'trialing'])('subskrypcja %s blokuje drugi checkout', async status => {
        mockSearch.mockResolvedValue({ data: [{ status: 'canceled' }, { status }] });

        expect(await hasActivePremiumSubscription(SERVICE_ID)).toBe(true);
    });

    it.each(['canceled', 'incomplete', 'incomplete_expired', 'past_due', 'unpaid'])(
        'subskrypcja %s nie blokuje zakupu',
        async status => {
            mockSearch.mockResolvedValue({ data: [{ status }] });

            expect(await hasActivePremiumSubscription(SERVICE_ID)).toBe(false);
        },
    );

    it('awaria Stripe nie blokuje sprzedazy: false i log bez surowego komunikatu', async () => {
        mockSearch.mockRejectedValue(new Error('api_key sk_live_secret invalid'));

        expect(await hasActivePremiumSubscription(SERVICE_ID)).toBe(false);
        expect(console.error).toHaveBeenCalledWith(
            expect.stringContaining('subscription search failed'),
            { name: 'Error' },
        );
        expect(JSON.stringify(jest.mocked(console.error).mock.calls)).not.toContain('sk_live');
    });

    it('zawieszony search po limicie czasu przepuszcza zakup', async () => {
        jest.useFakeTimers();
        mockSearch.mockReturnValue(new Promise(() => {}));

        const result = hasActivePremiumSubscription(SERVICE_ID);
        await jest.advanceTimersByTimeAsync(SUBSCRIPTION_SEARCH_TIMEOUT_MS);

        expect(await result).toBe(false);
        expect(console.error).toHaveBeenCalledWith(
            expect.stringContaining('subscription search failed'),
            { name: 'TimeoutError' },
        );
    });
});
