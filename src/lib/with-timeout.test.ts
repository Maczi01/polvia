import { TimeoutError, withTimeout } from './with-timeout';

function timeoutError(): TimeoutError {
    return new TimeoutError('Test operation', 100);
}

beforeEach(() => {
    jest.useFakeTimers();
});

afterEach(() => {
    jest.useRealTimers();
});

describe('withTimeout', () => {
    it('oddaje wynik operacji i sprzata timer', async () => {
        await expect(withTimeout(Promise.resolve('ok'), 100, timeoutError)).resolves.toBe('ok');

        expect(jest.getTimerCount()).toBe(0);
    });

    it('przepuszcza blad operacji bez zamiany na timeout i sprzata timer', async () => {
        const failure = new Error('ECONNRESET');

        await expect(withTimeout(Promise.reject(failure), 100, timeoutError)).rejects.toBe(
            failure,
        );
        expect(jest.getTimerCount()).toBe(0);
    });

    it('zawieszona operacja konczy sie bledem z fabryki dokladnie po limicie', async () => {
        const result = withTimeout(new Promise<never>(() => {}), 100, timeoutError);
        const settled = jest.fn();
        result.catch(settled);

        await jest.advanceTimersByTimeAsync(99);
        expect(settled).not.toHaveBeenCalled();

        await jest.advanceTimersByTimeAsync(1);
        await expect(result).rejects.toEqual(
            expect.objectContaining({
                name: 'TimeoutError',
                message: 'Test operation exceeded 100 ms',
                timeoutMs: 100,
            }),
        );
    });
});
