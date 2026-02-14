import { fireEvent, render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { ButtonCategory } from '@/components/button-category/buttonCategory';

expect.extend(toHaveNoViolations);

describe('<ButtonCategory />', () => {
    const mockImage = '/test-icon.png';

    test('renders the button with default props', () => {
        render(<ButtonCategory text="Click Me" image={mockImage} />);
        const button = screen.getByRole('button', { name: /click me/i });
        expect(button).toBeInTheDocument();
        expect(button).toHaveClass('text-primary-foreground');
    });

    test('renders different variants correctly', () => {
        render(
            <>
                <ButtonCategory text="Red" image={mockImage} variant="red" />
                <ButtonCategory text="Green" image={mockImage} variant="green" />
                <ButtonCategory text="Blue" image={mockImage} variant="blue" />
            </>,
        );

        expect(screen.getByText('Red')).toHaveClass('bg-gradient-to-r from-[#F86187]');
        expect(screen.getByText('Green')).toHaveClass('bg-gradient-to-r from-[#00AA66]');
        expect(screen.getByText('Blue')).toHaveClass('bg-gradient-to-r from-[#298EED]');
    });

    test('handles click events', () => {
        const handleClick = jest.fn();
        render(<ButtonCategory text="Click Me" image={mockImage} onClick={handleClick} />);

        const button = screen.getByRole('button', { name: /click me/i });
        fireEvent.click(button);

        expect(handleClick).toHaveBeenCalledTimes(1);
    });

    test('Button is keyboard accessible', async () => {
        render(<ButtonCategory text="Click Me" image={mockImage} />);
        const button = screen.getByRole('button', { name: /click me/i });

        userEvent.tab().then(() => {
            expect(button).toHaveFocus();
        });
    });

    test('renders an image inside the button', () => {
        render(<ButtonCategory text="Click Me" image={mockImage} />);

        const image = screen.getByRole('img', { name: 'icon' });

        expect(image).toBeInTheDocument();

        // Fix: Check if the generated `src` contains the expected image name
        expect(image.getAttribute('src')).toContain(encodeURIComponent(mockImage));
    });

    test('renders a disabled button', () => {
        render(<ButtonCategory text="Disabled" image={mockImage} disabled />);

        const button = screen.getByRole('button', { name: /Disabled/i });
        expect(button).toBeDisabled();
        expect(button).toHaveClass('disabled:opacity-50');
    });

    test('Button component passes strict accessibility rules', async () => {
        const { container } = render(<ButtonCategory text="Click Me" image={mockImage} />);
        const results = await axe(container, {
            rules: {
                'color-contrast': { enabled: true }, // Enforce color contrast
                'button-name': { enabled: true }, // Ensure buttons have an accessible name
                label: { enabled: true }, // Ensure form elements have labels
                'image-alt': { enabled: true }, // Ensure images have alt text
                'heading-order': { enabled: true }, // Enforce correct heading structure
                'link-name': { enabled: true }, // Ensure links have descriptive text
                region: { enabled: true }, // Ensure landmarks are used correctly
                'aria-hidden-focus': { enabled: true }, // Prevent focusable elements inside aria-hidden elements
            },
        });

        expect(results).toHaveNoViolations();
    });
});
