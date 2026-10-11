import { act, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';

import { renderWithIntl } from '../test-utils/render-with-intl';
import { GenerationProgress, LINK_STAGES, STAGE_DURATION_MS } from './generation-progress';

expect.extend(toHaveNoViolations);

describe('<GenerationProgress />', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('nieaktywny zostawia pusty region live gotowy na komunikaty', () => {
        renderWithIntl(<GenerationProgress isActive={false} stages={LINK_STAGES} />);

        const region = screen.getByRole('status');
        expect(region).toHaveAttribute('aria-live', 'polite');
        expect(region).toBeEmptyDOMElement();
    });

    it('przechodzi przez etapy i zatrzymuje sie na ostatnim', () => {
        renderWithIntl(<GenerationProgress isActive stages={LINK_STAGES} />);
        expect(screen.getByRole('status')).toHaveTextContent('Czytam stronę…');

        act(() => jest.advanceTimersByTime(STAGE_DURATION_MS));
        expect(screen.getByRole('status')).toHaveTextContent('Klasyfikuję firmę…');

        act(() => jest.advanceTimersByTime(STAGE_DURATION_MS * 5));
        expect(screen.getByRole('status')).toHaveTextContent('Piszę opisy w czterech językach…');
    });

    it('czysci timer po odmontowaniu', () => {
        const { unmount } = renderWithIntl(<GenerationProgress isActive stages={LINK_STAGES} />);
        expect(jest.getTimerCount()).toBe(1);

        unmount();

        expect(jest.getTimerCount()).toBe(0);
    });

    it('nie ma naruszen dostepnosci', async () => {
        jest.useRealTimers();
        const { container } = renderWithIntl(<GenerationProgress isActive stages={LINK_STAGES} />);

        expect(await axe(container)).toHaveNoViolations();
    });
});
