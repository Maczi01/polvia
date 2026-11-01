import 'server-only';

import { redis } from '@/lib/redis';
import { TimeoutError, withTimeout } from '@/lib/with-timeout';

/**
 * Znacznik „materialy wyslane” per sesja Checkout. Strona `dziekujemy` pokazuje po nim
 * potwierdzenie zamiast formularza, a akcja nie wysyla drugiego maila tej samej sesji
 * (odswiezenie strony, podwojne klikniecie, ponowiony POST).
 *
 * Znacznik nie jest zabezpieczeniem: przy awarii Redisa wolajacy przepuszcza (fail-open),
 * bo gorszy od duplikatu maila jest platnik, ktory nie moze oddac materialow.
 */

const KEY_PREFIX = 'premium:materials-sent:';

/** Tydzien: dluzej, niz ktokolwiek wraca na strone sukcesu. Potem duplikat to tylko drugi mail. */
export const MATERIALS_SENT_TTL_SECONDS = 7 * 24 * 60 * 60;

/** Kazda komenda: zawieszony Redis nie moze zjesc budzetu akcji przed wysylka maila. */
export const MATERIALS_SENT_TIMEOUT_MS = 1500;

function keyFor(sessionId: string): string {
    return `${KEY_PREFIX}${sessionId}`;
}

function bounded<T>(command: Promise<T>): Promise<T> {
    return withTimeout(
        command,
        MATERIALS_SENT_TIMEOUT_MS,
        () => new TimeoutError('Materials-sent marker', MATERIALS_SENT_TIMEOUT_MS),
    );
}

export async function isMaterialsSent(sessionId: string): Promise<boolean> {
    return (await bounded(redis.get(keyFor(sessionId)))) !== null;
}

/**
 * Zajmuje wysylke dla sesji (`SET NX`): `true` = ta proba wysyla, `false` = materialy tej
 * sesji juz wyslano albo rownolegla proba jest w toku. Atomowe, wiec dwa rownolegle POST-y
 * nie wysla dwoch maili.
 */
export async function claimMaterialsSend(sessionId: string): Promise<boolean> {
    const result = await bounded(
        redis.set(keyFor(sessionId), '1', 'EX', MATERIALS_SENT_TTL_SECONDS, 'NX'),
    );
    return result === 'OK';
}

/** Zwalnia znacznik po nieudanej wysylce — platnik moze sprobowac ponownie. */
export async function releaseMaterialsSend(sessionId: string): Promise<void> {
    await bounded(redis.del(keyFor(sessionId)));
}
