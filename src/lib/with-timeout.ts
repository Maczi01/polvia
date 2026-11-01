/**
 * Gorny limit czasu dla operacji, ktora sama go nie ma (np. komenda ioredis bez
 * `commandTimeout`) albo ma limit per faza, a nie calkowity (SMTP). Kod po nieodwracalnym
 * kroku musi skonczyc sie w `maxDuration` funkcji — inaczej Vercel ubija ja bez logu.
 */

/** Operacja nie zakonczyla sie w czasie. Sama operacja nie jest przerywana. */
export class TimeoutError extends Error {
    constructor(
        readonly operation: string,
        readonly timeoutMs: number,
    ) {
        super(`${operation} exceeded ${timeoutMs} ms`);
        this.name = 'TimeoutError';
    }
}

/**
 * Wynik `promise` albo odrzucenie bledem z `createError` po `timeoutMs`. Timer jest
 * sprzatany w obu przypadkach, wiec rozwiazana operacja nie trzyma procesu ani nie
 * zostawia odrzuconej obietnicy bez obslugi.
 */
export async function withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    createError: () => Error,
): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(createError()), timeoutMs);
    });
    try {
        return await Promise.race([promise, timeout]);
    } finally {
        clearTimeout(timer);
    }
}
