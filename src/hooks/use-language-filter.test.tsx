import type { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { NuqsTestingAdapter, type UrlUpdateEvent } from 'nuqs/adapters/testing';

import { useLanguageFilter } from './use-language-filter';

function renderLanguageFilter(
    searchParams: string,
    onUrlUpdate?: (event: UrlUpdateEvent) => void,
): ReturnType<typeof renderHook<ReturnType<typeof useLanguageFilter>, unknown>> {
    const wrapper = ({ children }: { children: ReactNode }): ReactNode => (
        <NuqsTestingAdapter searchParams={searchParams} onUrlUpdate={onUrlUpdate}>
            {children}
        </NuqsTestingAdapter>
    );
    return renderHook(() => useLanguageFilter(), { wrapper });
}

describe('useLanguageFilter', () => {
    it('czyta znany kod z ?lang', () => {
        const { result } = renderLanguageFilter('?lang=ru');

        expect(result.current[0]).toBe('ru');
    });

    it('nieznany kod to brak filtra, nie pusty wynik (R10)', () => {
        const { result } = renderLanguageFilter('?lang=xx');

        expect(result.current[0]).toBeNull();
    });

    it('bez parametru filtr jest wylaczony', () => {
        const { result } = renderLanguageFilter('');

        expect(result.current[0]).toBeNull();
    });

    it('ustawienie jezyka dopisuje ?lang wpisem historii (Wstecz cofa zmiane)', async () => {
        const onUrlUpdate = jest.fn<void, [UrlUpdateEvent]>();
        const { result } = renderLanguageFilter('?query=prawnik', onUrlUpdate);

        await act(async () => {
            await result.current[1]('uk');
        });

        expect(result.current[0]).toBe('uk');
        expect(onUrlUpdate).toHaveBeenCalledTimes(1);
        const [event] = onUrlUpdate.mock.calls[0];
        expect(event.queryString).toBe('?query=prawnik&lang=uk');
        expect(event.options.history).toBe('push');
    });

    it('null zdejmuje ?lang z adresu', async () => {
        const onUrlUpdate = jest.fn<void, [UrlUpdateEvent]>();
        const { result } = renderLanguageFilter('?lang=ru', onUrlUpdate);

        await act(async () => {
            await result.current[1](null);
        });

        expect(result.current[0]).toBeNull();
        expect(onUrlUpdate.mock.calls[0][0].searchParams.has('lang')).toBe(false);
    });
});
