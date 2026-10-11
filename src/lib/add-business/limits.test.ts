import { createFakeRedis } from '../../../tests/fixtures/add-business/fake-redis';
import {
    ADD_BUSINESS_WINDOW_SECONDS,
    consumeFetchLimit,
    consumeGenerationLimit,
    consumeSubmitLimit,
    GENERATION_GLOBAL_KEY,
    GENERATIONS_GLOBAL,
    generationIpKey,
    peekGenerationLimit,
} from './limits';

const mockRedis = createFakeRedis();

// Redis to zewnetrzny serwis. Getter, bo fabryka `jest.mock` jest hoistowana nad
// inicjalizacje `mockRedis` — odczyt nastepuje dopiero przy pierwszym wywolaniu.
jest.mock('@/lib/redis', () => ({
    get redis() {
        return mockRedis;
    },
}));

const IP = '203.0.113.7';
const OTHER_IP = '198.51.100.4';

beforeEach(() => {
    mockRedis.reset();
});

describe('consumeGenerationLimit', () => {
    it('przepuszcza dwa generowania z jednego IP w oknie', async () => {
        expect(await consumeGenerationLimit(IP)).toMatchObject({ allowed: true });
        expect(await consumeGenerationLimit(IP)).toMatchObject({ allowed: true });
    });

    it('trzecie generowanie w oknie odrzuca z czasem do konca okna', async () => {
        await consumeGenerationLimit(IP);
        await consumeGenerationLimit(IP);
        mockRedis.advance(600);

        const third = await consumeGenerationLimit(IP);

        expect(third).toEqual({
            allowed: false,
            retryAfter: ADD_BUSINESS_WINDOW_SECONDS - 600,
        });
    });

    it('po uplywie okna znow przepuszcza', async () => {
        await consumeGenerationLimit(IP);
        await consumeGenerationLimit(IP);
        mockRedis.advance(ADD_BUSINESS_WINDOW_SECONDS);

        expect(await consumeGenerationLimit(IP)).toMatchObject({ allowed: true });
    });

    it('wyczerpany limit globalny blokuje mimo wolnego limitu IP', async () => {
        mockRedis.seed(GENERATION_GLOBAL_KEY, String(GENERATIONS_GLOBAL), 3600);

        const result = await consumeGenerationLimit(OTHER_IP);

        expect(result).toEqual({ allowed: false, retryAfter: 3600 });
    });

    it('odrzucone IP nie wypala puli globalnej', async () => {
        await consumeGenerationLimit(IP);
        await consumeGenerationLimit(IP);
        await consumeGenerationLimit(IP);
        await consumeGenerationLimit(IP);

        expect(await mockRedis.get(GENERATION_GLOBAL_KEY)).toBe('2');
    });
});

describe('peekGenerationLimit', () => {
    it('nie inkrementuje licznika', async () => {
        await peekGenerationLimit(IP);
        await peekGenerationLimit(IP);
        await peekGenerationLimit(IP);

        expect(await mockRedis.get(generationIpKey(IP))).toBeNull();
        expect(await consumeGenerationLimit(IP)).toEqual({ allowed: true, remaining: 1 });
    });

    it('po wyczerpaniu limitu IP odrzuca przed jakimkolwiek zuzyciem', async () => {
        await consumeGenerationLimit(IP);
        await consumeGenerationLimit(IP);

        expect(await peekGenerationLimit(IP)).toMatchObject({ allowed: false });
    });

    it('widzi wyczerpany limit globalny', async () => {
        mockRedis.seed(GENERATION_GLOBAL_KEY, String(GENERATIONS_GLOBAL), 120);

        expect(await peekGenerationLimit(IP)).toEqual({ allowed: false, retryAfter: 120 });
    });
});

describe('consumeFetchLimit i consumeSubmitLimit', () => {
    it('fetch: szesc pobran przechodzi, siodme nie', async () => {
        for (let attempt = 0; attempt < 6; attempt += 1) {
            expect(await consumeFetchLimit(IP)).toMatchObject({ allowed: true });
        }

        expect(await consumeFetchLimit(IP)).toMatchObject({ allowed: false });
    });

    it('submit: trzecie wyslanie odrzuca, inne IP ma wlasny licznik', async () => {
        await consumeSubmitLimit(IP);
        await consumeSubmitLimit(IP);

        expect(await consumeSubmitLimit(IP)).toMatchObject({ allowed: false });
        expect(await consumeSubmitLimit(OTHER_IP)).toMatchObject({ allowed: true });
    });
});
