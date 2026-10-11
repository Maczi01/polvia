import 'server-only';

import { ZodError } from 'zod';

import { DraftGenerationError } from '@/lib/add-business/llm-draft';
import {
    type ActionErrorCode,
    type ActionFailure,
    actionFailure,
    DRAFT_GENERATION_ERROR_TO_ACTION,
} from '@/lib/add-business/types';

/**
 * Granica akcji: wyjatek z modulu (LLM, Redis, `ZodError` przy zapisie szkicu) zamienia sie
 * na kod z `types.ts` i log bez danych osobowych. Do klienta nie wychodzi nic poza kodem.
 *
 * Mapowanie wyjatkow mieszka tu, a nie w `types.ts`, bo wymaga `instanceof` na klasach
 * z modulow `server-only`.
 */

function codeFromException(error: unknown): ActionErrorCode {
    if (error instanceof DraftGenerationError) return DRAFT_GENERATION_ERROR_TO_ACTION[error.code];
    return 'INTERNAL';
}

/** `ZodError` przy zapisie szkicu = blad programisty; wartosci to dane firmy, wiec tylko sciezki. */
function describeException(error: unknown): Record<string, unknown> {
    if (error instanceof ZodError) {
        return { name: error.name, paths: error.issues.map(issue => issue.path.join('.')) };
    }
    if (error instanceof DraftGenerationError) return { name: error.name, code: error.code };
    if (error instanceof Error) return { name: error.name, message: error.message };
    return { name: typeof error };
}

export async function withActionBoundary<Result>(
    action: string,
    run: () => Promise<Result>,
): Promise<Result | ActionFailure> {
    try {
        return await run();
    } catch (error) {
        const code = codeFromException(error);
        console.error('add-business action failed', {
            action,
            code,
            ...describeException(error),
        });
        return actionFailure(code);
    }
}
