/**
 * @jest-environment node
 */
import { createFakeRedis } from '../../tests/fixtures/add-business/fake-redis';
import { isWithinPremiumLimit, PREMIUM_LIMIT_PER_IP } from './premium-rate-limit';
import { RateLimitStoreError } from './rate-limit';

const mockRedis = createFakeRedis();
const mockRequestHeaders = { forwardedFor: '203.0.113.7' };

// Zewnetrzne: Redis i naglowki requestu. Licznik (`rate-limit`) jest prawdziwy.
jest.mock('@/lib/redis', () => ({
    get redis() {
        return mockRedis;
    },
}));
jest.mock('next/headers', () => ({
    headers: async () => new Headers({ 'x-forwarded-for': mockRequestHeaders.forwardedFor }),
}));

beforeEach(() => {
    mockRedis.reset();
    mockRequestHeaders.forwardedFor = '203.0.113.7';
});

describe('isWithinPremiumLimit', () => {
    it('liczy zapytanie pod kluczem endpointu i adresu klienta', async () => {
        expect(await isWithinPremiumLimit('checkout')).toBe(true);

        expect(await mockRedis.get('premium:checkout:203.0.113.7')).toBe('1');
        expect(await mockRedis.ttl('premium:checkout:203.0.113.7')).toBe(3600);
    });

    it('po wyczerpaniu limitu endpointu odmawia, nie ruszajac innych endpointow', async () => {
        mockRedis.seed('premium:materials:203.0.113.7', String(PREMIUM_LIMIT_PER_IP.materials));

        expect(await isWithinPremiumLimit('materials')).toBe(false);
        expect(await isWithinPremiumLimit('thanks')).toBe(true);
    });

    it('adresy IPv6 z jednej sieci /64 dziela limit', async () => {
        mockRequestHeaders.forwardedFor = '2001:db8:abcd:12::1';
        await isWithinPremiumLimit('thanks');
        mockRequestHeaders.forwardedFor = '2001:db8:abcd:12::2';
        await isWithinPremiumLimit('thanks');

        expect(await mockRedis.get('premium:thanks:2001:db8:abcd:12::/64')).toBe('2');
    });

    it('awaria Redisa leci do wolajacego', async () => {
        jest.spyOn(mockRedis, 'multi').mockImplementation(() => {
            throw new RateLimitStoreError('broken');
        });

        await expect(isWithinPremiumLimit('thanks')).rejects.toBeInstanceOf(RateLimitStoreError);
        jest.restoreAllMocks();
    });
});
