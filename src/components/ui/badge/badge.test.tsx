import { render, screen } from '@testing-library/react';
import { Badge } from '@/components/ui/badge';
import { axe, toHaveNoViolations } from 'jest-axe';
import userEvent from '@testing-library/user-event';

// Extend Jest with accessibility matchers
expect.extend(toHaveNoViolations);

describe('<Badge />', () => {
    // List of all variants to test
    const variants = [
        'default',
        'secondary',
        'destructive',
        'outline',
        'red',
        'green',
        'orange',
        'blue',
        'gold',
        'violet',
        'aqua',
        'lightblue',
        'darkviolet',
        'starfall',
        'overworld',
        'mojito',
    ] as const;

    // Test rendering and accessibility for each variant
    variants.forEach(variant => {
        test(`renders the ${variant} variant correctly`, () => {
            render(<Badge variant={variant}>{variant} Badge</Badge>);
            const badge = screen.getByText(`${variant} Badge`);
            expect(badge).toBeInTheDocument();
        });

        test(`passes strict accessibility rules for the ${variant} variant`, async () => {
            const { container } = render(<Badge variant={variant}>{variant} Badge</Badge>);
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

        test(`has proper color contrast for the ${variant} variant`, async () => {
            const { container } = render(<Badge variant={variant}>{variant} Badge</Badge>);
            const results = await axe(container, {
                rules: {
                    'color-contrast': { enabled: true }, // Focus on color contrast
                },
            });

            expect(results).toHaveNoViolations();
        });

        // Regresja: badge mial `tabIndex={0}`, wiec kazdy tag byl przystankiem Tab.
        // Trzy tagi na karcie i kilkaset kart to setki przystankow po samych
        // etykietach, ktorych i tak nie da sie uzyc.
        test(`is not a tab stop for the ${variant} variant`, async () => {
            render(
                <>
                    <Badge variant={variant}>{variant} Badge</Badge>
                    <button type="button">po badge</button>
                </>,
            );

            await userEvent.tab();

            expect(screen.getByText(`${variant} Badge`)).not.toHaveFocus();
            expect(screen.getByRole('button', { name: 'po badge' })).toHaveFocus();
        });

        // Regresja: `role="status"` czyni z elementu obszar live, wiec czytnik
        // oglaszal statyczna etykiete jak zmiane na zywo.
        test(`is not a live region for the ${variant} variant`, () => {
            render(<Badge variant={variant}>{variant} Badge</Badge>);

            expect(screen.queryByRole('status')).not.toBeInTheDocument();
            expect(screen.getByText(`${variant} Badge`)).not.toHaveAttribute('aria-live');
        });

        test(`forwards an explicit role for the ${variant} variant`, () => {
            render(
                <Badge variant={variant} role="status" aria-label={`${variant} status`}>
                    {variant} Badge
                </Badge>,
            );

            expect(screen.getByRole('status', { name: `${variant} status` })).toBeInTheDocument();
        });
    });

    // Additional tests for default behavior
    test('renders the badge with default props', () => {
        render(<Badge>Default Badge</Badge>);
        const badge = screen.getByText(/Default Badge/i);
        expect(badge).toBeInTheDocument();
        expect(badge).toHaveClass('bg-primary'); // Default variant class
    });

    test('renders the badge with a custom label', () => {
        render(<Badge label="Custom Label">Custom Badge</Badge>);
        const badge = screen.getByText(/Custom Label/i);
        expect(badge).toBeInTheDocument();
    });

    test('renders the badge with an index to cycle through variants', () => {
        render(
            <>
                <Badge index={0}>Index 0</Badge>
                <Badge index={1}>Index 1</Badge>
                <Badge index={2}>Index 2</Badge>
            </>,
        );

        expect(screen.getByText('Index 0')).toHaveClass(
            'bg-[#FFF0F0] border-[#F5D0D0]',
        ); // red
        expect(screen.getByText('Index 1')).toHaveClass(
            'bg-[#E6F7EF] border-[#B8E6CC]',
        ); // green
        expect(screen.getByText('Index 2')).toHaveClass(
            'bg-[#FFF3E0] border-[#FFD9A8]',
        ); // orange
    });
});
