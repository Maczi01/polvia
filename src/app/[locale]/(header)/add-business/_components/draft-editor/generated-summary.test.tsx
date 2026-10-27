import { render, type RenderResult, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { NextIntlClientProvider } from 'next-intl';

import en from '../../../../../../../messages/en.json';
import pl from '../../../../../../../messages/pl.json';
import uk from '../../../../../../../messages/uk.json';
import { PREVIEW_FIXTURE } from '../business-card-preview/preview-fixture';
import { GeneratedSummary } from './generated-summary';

expect.extend(toHaveNoViolations);

const MESSAGES = { en, pl, uk };

/** Tagi wybiera locale STRONY (locale tresci), nie jezyk obslugi — `be` nie ma tagow. */
function renderSummary(locale: keyof typeof MESSAGES): RenderResult {
    return render(
        <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]} timeZone="Europe/Warsaw">
            <GeneratedSummary
                category={PREVIEW_FIXTURE.category}
                coverage={PREVIEW_FIXTURE.coverage}
                tags={PREVIEW_FIXTURE.tags}
            />
        </NextIntlClientProvider>,
    );
}

describe('<GeneratedSummary />', () => {
    it('na stronie uk pokazuje tagi po ukrainsku', () => {
        renderSummary('uk');

        expect(screen.getByText('кав’ярня, випічка, кейтеринг').tagName).toBe('DD');
        expect(screen.queryByText('kawiarnia, wypieki, catering')).not.toBeInTheDocument();
    });

    it('na stronie en pokazuje tagi po angielsku', () => {
        renderSummary('en');

        expect(screen.getByText('cafe, pastries, catering').tagName).toBe('DD');
    });

    it('nie ma naruszen dostepnosci', async () => {
        const { container } = renderSummary('pl');

        expect(await axe(container)).toHaveNoViolations();
    });
});
