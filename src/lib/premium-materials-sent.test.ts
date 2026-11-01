/**
 * @jest-environment node
 */
import { createFakeRedis } from '../../tests/fixtures/add-business/fake-redis';
import {
    claimMaterialsSend,
    isMaterialsSent,
    MATERIALS_SENT_TIMEOUT_MS,
    MATERIALS_SENT_TTL_SECONDS,
    releaseMaterialsSend,
} from './premium-materials-sent';

const fakeRedis = createFakeRedis();
/** Atrapa nie ma `DEL` — ten sam efekt daje jej `GETDEL`. */
const mockRedis = {
    ...fakeRedis,
    del: async (key: string): Promise<number> => ((await fakeRedis.getdel(key)) === null ? 0 : 1),
};

// Redis to jedyny zewnetrzny serwis modulu.
jest.mock('@/lib/redis', () => ({
    get redis() {
        return mockRedis;
    },
}));

const SESSION_ID = 'cs_test_a1B2c3';

beforeEach(() => {
    fakeRedis.reset();
});

afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
});

describe('premium-materials-sent', () => {
    it('pierwsza proba zajmuje wysylke na tydzien, kolejna dostaje odmowe', async () => {
        expect(await isMaterialsSent(SESSION_ID)).toBe(false);

        expect(await claimMaterialsSend(SESSION_ID)).toBe(true);
        expect(await claimMaterialsSend(SESSION_ID)).toBe(false);

        expect(await isMaterialsSent(SESSION_ID)).toBe(true);
        expect(await fakeRedis.ttl(`premium:materials-sent:${SESSION_ID}`)).toBe(
            MATERIALS_SENT_TTL_SECONDS,
        );
    });

    it('znacznik jednej sesji nie blokuje innej', async () => {
        await claimMaterialsSend(SESSION_ID);

        expect(await isMaterialsSent('cs_test_other')).toBe(false);
        expect(await claimMaterialsSend('cs_test_other')).toBe(true);
    });

    it('zwolniony znacznik pozwala wyslac ponownie', async () => {
        await claimMaterialsSend(SESSION_ID);

        await releaseMaterialsSend(SESSION_ID);

        expect(await isMaterialsSent(SESSION_ID)).toBe(false);
        expect(await claimMaterialsSend(SESSION_ID)).toBe(true);
    });

    it('po tygodniu znacznik wygasa', async () => {
        await claimMaterialsSend(SESSION_ID);

        fakeRedis.advance(MATERIALS_SENT_TTL_SECONDS);

        expect(await isMaterialsSent(SESSION_ID)).toBe(false);
    });

    it('zawieszony Redis: odczyt konczy sie TimeoutError po limicie', async () => {
        jest.useFakeTimers();
        jest.spyOn(mockRedis, 'get').mockReturnValue(new Promise(() => {}));

        const result = isMaterialsSent(SESSION_ID);
        const assertion = expect(result).rejects.toMatchObject({
            name: 'TimeoutError',
            timeoutMs: MATERIALS_SENT_TIMEOUT_MS,
        });
        await jest.advanceTimersByTimeAsync(MATERIALS_SENT_TIMEOUT_MS);

        await assertion;
    });
});
