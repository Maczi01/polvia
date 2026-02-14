import { fireEvent, render, screen } from '@testing-library/react';
import { Button } from '@/components/ui/button';
import { axe, toHaveNoViolations } from 'jest-axe';
import userEvent from '@testing-library/user-event';

// Extend Jest with accessibility matchers
expect.extend(toHaveNoViolations);

describe('<Button />', () => {
    test('renders the button with default props', () => {
        render(<Button>Click Me</Button>);
        const button = screen.getByText(/Click Me/i);
        expect(button).toBeInTheDocument();
        expect(button).toHaveClass('bg-primary'); // Default variant class
    });

    test('handles click events', () => {
        const handleClick = jest.fn();
        render(<Button onClick={handleClick}>Click Me</Button>);

        const button = screen.getByText(/Click Me/i);
        fireEvent.click(button);

        expect(handleClick).toHaveBeenCalledTimes(1);
    });

    test('Button is keyboard accessible', async () => {
        render(<Button>Click Me</Button>);
        const button = screen.getByText('Click Me');

        await userEvent.tab().then(() => {
            expect(button).toHaveFocus();
        });
    });

    test('renders different variants correctly', () => {
        render(
            <>
                <Button variant="destructive">Delete</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="link">Link</Button>
                <Button variant="active">Active</Button>
                <Button variant="explore">Explore</Button>
            </>,
        );

        expect(screen.getByText('Delete')).toHaveClass('bg-destructive');
        expect(screen.getByText('Outline')).toHaveClass('border-input');
        expect(screen.getByText('Ghost')).toHaveClass('hover:bg-accent');
        expect(screen.getByText('Link')).toHaveClass('underline-offset-4');
        expect(screen.getByText('Active')).toHaveClass('bg-green');
        expect(screen.getByText('Explore')).toHaveClass('bg-gradient-to-r');
    });

    test('renders different sizes correctly', () => {
        render(
            <>
                <Button size="sm">Small</Button>
                <Button size="lg">Large</Button>
                <Button size="icon">Icon</Button>
            </>,
        );

        expect(screen.getByText('Small')).toHaveClass('h-8 text-xs');
        expect(screen.getByText('Large')).toHaveClass('h-10 px-8');
    });

    test('renders a disabled button', () => {
        render(<Button disabled>Disabled</Button>);

        const button = screen.getByText('Disabled');
        expect(button).toBeDisabled();
        expect(button).toHaveClass('disabled:opacity-50');
    });

    test('renders with an accessible aria-label', () => {
        render(<Button aria-label="Submit Form">Submit</Button>);

        const button = screen.getByRole('button', { name: 'Submit Form' });
        expect(button).toBeInTheDocument();
    });

    test('Button component passes strict accessibility rules', async () => {
        const { container } = render(<Button>Click Me</Button>);
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
