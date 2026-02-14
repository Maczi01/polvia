import type { Meta, StoryObj } from '@storybook/react';
import { Badge } from '@/components/ui/badge/badge';

const meta = {
    title: 'component/badge',
    component: Badge,
    parameters: {
        // Optional parameter to center the component in the Canvas. More info: https://storybook.js.org/docs/configure/story-layout
        // layout: 'centered',
    },
    // This component will have an automatically generated Autodocs entry: https://storybook.js.org/docs/writing-docs/autodocs
    // tags: ['autodocs'],
    // More on argTypes: https://storybook.js.org/docs/api/argtypes
    // argTypes: {
    //     backgroundColor: { control: 'color' },
    // },
    // Use `fn` to spy on the onClick arg, which will appear in the actions panel once invoked: https://storybook.js.org/docs/essentials/actions#action-args
    args: {},
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Red: Story = {
    args: {
        variant: 'red',
        label: 'Transport',
    },
};
export const Green: Story = {
    args: {
        variant: 'green',
        label: 'Transport',
    },
};
export const Blue: Story = {
    args: {
        variant: 'blue',
        label: 'Transport',
    },
};
export const Orange: Story = {
    args: {
        variant: 'orange',
        label: 'Transport',
    },
};
export const Gold: Story = {
    args: {
        variant: 'gold',
        label: 'Transport',
    },
};
export const Violet: Story = {
    args: {
        variant: 'violet',
        label: 'Transport',
    },
};
export const Aqua: Story = {
    args: {
        variant: 'aqua',
        label: 'Transport',
    },
};
export const Lightblue: Story = {
    args: {
        variant: 'lightblue',
        label: 'Transport',
    },
};
export const Darkviolet: Story = {
    args: {
        variant: 'darkviolet',
        label: 'Transport',
    },
};
export const Starfall: Story = {
    args: {
        variant: 'starfall',
        label: 'Transport',
    },
};
export const Overworld: Story = {
    args: {
        variant: 'overworld',
        label: 'Transport',
    },
};
export const Mojito: Story = {
    args: {
        variant: 'mojito',
        label: 'Transport',
    },
};
