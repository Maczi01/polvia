import type { Meta, StoryObj } from '@storybook/react';
import { Header } from '@/components/header/header';

const meta = {
    title: 'component/header',
    component: Header,
    parameters: {},

    args: {},
} satisfies Meta<typeof Header>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary2: Story = {
    args: {},
};
