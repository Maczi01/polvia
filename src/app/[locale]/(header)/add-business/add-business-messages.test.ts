import { EXTRA_FIELD_ERRORS, ACTION_ERROR_CODES } from '@/lib/add-business/types';
import { OWNER_EDIT_ERRORS } from '@/lib/add-business/owner-edits-schema';

import en from '../../../../../messages/en.json';
import pl from '../../../../../messages/pl.json';
import ru from '../../../../../messages/ru.json';
import uk from '../../../../../messages/uk.json';

/**
 * Brak klucza w jednym locale to blad next-intl w runtime, nie fallback (CLAUDE.md).
 * Test zastepuje recznego grepa: kazdy klucz `addBusiness.*` jest we wszystkich 4 plikach,
 * a kazdy kod i blad pola z kontraktu U8 ma tlumaczenie.
 */

const LOCALES = { pl, en, ru, uk };

function leafKeys(value: unknown, prefix = ''): string[] {
    if (typeof value !== 'object' || value === null) return [prefix];
    return Object.entries(value).flatMap(([key, child]) =>
        leafKeys(child, prefix ? `${prefix}.${key}` : key),
    );
}

function lookup(messages: unknown, path: string): unknown {
    return path.split('.').reduce<unknown>((node, segment) => {
        if (typeof node !== 'object' || node === null) return;
        return Object.entries(node).find(([key]) => key === segment)?.[1];
    }, messages);
}

const plKeys = leafKeys(pl.addBusiness, 'addBusiness').sort();

describe('messages: namespace addBusiness', () => {
    it.each(Object.entries(LOCALES))(
        '%s ma dokladnie te same klucze co pl',
        (_locale, messages) => {
            expect(leafKeys(messages.addBusiness, 'addBusiness').sort()).toEqual(plKeys);
        },
    );

    it.each(Object.entries(LOCALES))('%s nie ma pustych tlumaczen', (_locale, messages) => {
        for (const key of plKeys) {
            const value = lookup(messages, key);
            expect(typeof value === 'string' && value.trim() !== '').toBe(true);
        }
    });

    it('kazdy blad pola z kontraktu akcji ma tlumaczenie', () => {
        const errorKeys = [
            ...Object.values(OWNER_EDIT_ERRORS),
            ...Object.values(EXTRA_FIELD_ERRORS),
        ];

        for (const key of errorKeys) expect(plKeys).toContain(key);
    });

    it('kazdy kod bledu akcji i powod trybu recznego ma tlumaczenie', () => {
        for (const code of ACTION_ERROR_CODES) {
            expect(plKeys).toContain(`addBusiness.actionErrors.${code}`);
        }
        for (const reason of ['SOCIAL_LINK', 'UNREADABLE']) {
            expect(plKeys).toContain(`addBusiness.manual.reasons.${reason}`);
        }
    });
});
