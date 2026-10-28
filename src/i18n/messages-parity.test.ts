import en from '../../messages/en.json';
import pl from '../../messages/pl.json';
import ru from '../../messages/ru.json';
import uk from '../../messages/uk.json';

/**
 * Brak klucza w jednym locale to blad next-intl w runtime, nie fallback (CLAUDE.md).
 * `pl` jest wzorcem: kazde locale ma dokladnie ten sam zestaw kluczy.
 */

function leafKeys(value: unknown, prefix = ''): string[] {
    if (typeof value !== 'object' || value === null) return [prefix];
    return Object.entries(value).flatMap(([key, child]) =>
        leafKeys(child, prefix ? `${prefix}.${key}` : key),
    );
}

const plKeys = new Set(leafKeys(pl));

describe('messages: zgodnosc kluczy z pl', () => {
    it.each(Object.entries({ en, ru, uk }))('%s nie ma brakujacych kluczy', (_locale, messages) => {
        const keys = new Set(leafKeys(messages));
        expect([...plKeys].filter(key => !keys.has(key))).toEqual([]);
    });

    it.each(Object.entries({ en, ru, uk }))('%s nie ma nadmiarowych kluczy', (_locale, messages) => {
        expect(leafKeys(messages).filter(key => !plKeys.has(key))).toEqual([]);
    });
});
