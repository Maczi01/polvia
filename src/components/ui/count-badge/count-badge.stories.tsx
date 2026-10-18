import type { Meta, StoryObj } from '@storybook/react';
import { CountBadge } from '@/components/ui/count-badge/count-badge';

const meta = {
    title: 'component/countBadge',
    component: CountBadge,
    args: {
        count: 4,
    },
} satisfies Meta<typeof CountBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SingleDigit: Story = {};
export const ThreeDigits: Story = {
    args: {
        count: 128,
    },
};
