import { screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';

import { renderWithIntl } from '../profile-test-utils';
import { ProfileLanguages } from './profile-languages';

expect.extend(toHaveNoViolations);

describe('ProfileLanguages', () => {
    it('wymienia jezyki obslugi w kolejnosci z danych', async () => {
        const { container } = renderWithIntl(<ProfileLanguages languages={['uk', 'pl', 'be']} />);

        const items = screen.getAllByRole('listitem').map(item => item.textContent);
        expect(items).toEqual(['ukraiński', 'polski', 'białoruski']);
        expect(screen.getByText('Obsługa w językach')).toBeInTheDocument();
        expect(await axe(container)).toHaveNoViolations();
    });

    it('bez jezykow nie renderuje niczego', () => {
        const { container } = renderWithIntl(<ProfileLanguages languages={[]} />);

        expect(container).toBeEmptyDOMElement();
    });
});
