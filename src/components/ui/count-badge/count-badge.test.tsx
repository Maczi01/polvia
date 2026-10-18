import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';

import { CountBadge } from './count-badge';

expect.extend(toHaveNoViolations);

describe('<CountBadge />', () => {
    it('pokazuje sama liczbe, bez nawiasow', () => {
        render(<CountBadge count={52} />);

        expect(screen.getByText('52')).toBeInTheDocument();
        expect(screen.queryByText('(52)')).not.toBeInTheDocument();
    });

    it('zero tez jest pokazywane', () => {
        render(<CountBadge count={0} />);

        expect(screen.getByText('0')).toBeInTheDocument();
    });

    it('ma ten sam czarny okrag co licznik klastra na mapie', () => {
        render(<CountBadge count={4} />);

        expect(screen.getByText('4')).toHaveClass('rounded-full', 'bg-black', 'text-white');
    });

    it('dokleja className z zewnatrz', () => {
        render(<CountBadge count={4} className="absolute" />);

        expect(screen.getByText('4')).toHaveClass('absolute', 'bg-black');
    });

    it('nie ma naruszen dostepnosci', async () => {
        const { container } = render(<CountBadge count={17} />);

        expect(await axe(container)).toHaveNoViolations();
    });
});
