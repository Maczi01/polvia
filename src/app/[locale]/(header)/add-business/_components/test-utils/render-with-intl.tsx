import { render, type RenderResult } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { JSX, ReactElement, ReactNode } from 'react';

import messages from '../../../../../../../messages/pl.json';

function IntlWrapper({ children }: { children: ReactNode }): JSX.Element {
    return (
        <NextIntlClientProvider locale="pl" messages={messages} timeZone="Europe/Warsaw">
            {children}
        </NextIntlClientProvider>
    );
}

/**
 * Prawdziwe tlumaczenia `pl` zamiast mocka zwracajacego klucz: test failuje, gdy klucz
 * nie istnieje, a asercje czytaja to, co widzi uzytkownik. `wrapper`, zeby `rerender`
 * zachowal provider.
 */
export function renderWithIntl(ui: ReactElement): RenderResult {
    return render(ui, { wrapper: IntlWrapper });
}
