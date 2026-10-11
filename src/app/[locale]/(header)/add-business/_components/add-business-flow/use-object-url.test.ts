import { renderHook } from '@testing-library/react';

import { useObjectUrl } from './use-object-url';

describe('useObjectUrl', () => {
    const createObjectURL = jest.fn((file: Blob) => `blob:test/${file.size}`);
    const revokeObjectURL = jest.fn();

    beforeEach(() => {
        createObjectURL.mockClear();
        revokeObjectURL.mockClear();
        // jsdom nie implementuje blob URL-i — to API przegladarki, nie kod pod testem.
        Object.assign(URL, { createObjectURL, revokeObjectURL });
    });

    it('bez pliku nie tworzy URL-a', () => {
        const { result } = renderHook(() => useObjectUrl(null));

        expect(result.current).toBeNull();
        expect(createObjectURL).not.toHaveBeenCalled();
    });

    it('zwalnia poprzedni URL przy zmianie pliku i przy odmontowaniu', () => {
        const first = new File(['a'], 'a.png', { type: 'image/png' });
        const second = new File(['bb'], 'b.png', { type: 'image/png' });
        const { result, rerender, unmount } = renderHook(({ file }) => useObjectUrl(file), {
            initialProps: { file: first },
        });
        expect(result.current).toBe('blob:test/1');

        rerender({ file: second });
        expect(revokeObjectURL).toHaveBeenCalledWith('blob:test/1');
        expect(result.current).toBe('blob:test/2');

        unmount();
        expect(revokeObjectURL).toHaveBeenCalledWith('blob:test/2');
    });
});
