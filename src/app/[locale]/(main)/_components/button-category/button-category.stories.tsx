// import * as React from "react"
//
// import { cn } from "@/lib/utils"

import type { Meta, StoryObj } from '@storybook/react';
import { ButtonCategory } from '@/app/[locale]/(main)/_components/button-category/button-category';

const meta = {
    title: 'component/buttonCategory',
    component: ButtonCategory,
    parameters: {
        a11y: {
            config: {
                rules: [{ id: 'color-contrast', enabled: false }], // Można wyłączyć konkretne reguły
            },
        },
    },
    args: {
        text: 'Transport',
        image: '/icons/transport.svg',
    },
} satisfies Meta<typeof ButtonCategory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Transport: Story = {
    args: {
        text: 'Transport',
        image: '/icons/transport.svg',
        variant: 'green',
    },
};
export const Grocery: Story = {
    args: {
        text: 'Grocery',
        image: '/icons/grocery.svg',
        variant: 'red',
    },
};
export const Financial: Story = {
    args: {
        text: 'Financial',
        image: '/icons/financial.svg',
        variant: 'orange',
    },
};
export const Renovation: Story = {
    args: {
        text: 'Renovation',
        image: '/icons/renovation.svg',
        variant: 'blue',
    },
};
export const Law: Story = {
    args: {
        text: 'Law',
        image: '/icons/law.svg',
        variant: 'gold',
    },
};
export const Beauty: Story = {
    args: {
        text: 'Beauty',
        image: '/icons/beauty.svg',
        variant: 'violet',
    },
};
export const Government: Story = {
    args: {
        text: 'Government',
        image: '/icons/gov.svg',
        variant: 'aqua',
    },
};
export const Health: Story = {
    args: {
        text: 'Health',
        image: '/icons/health.svg',
        variant: 'lightblue',
    },
};
export const Mechanics: Story = {
    args: {
        text: 'Mechanics',
        image: '/icons/mechanic.svg',
        variant: 'darkviolet',
    },
};
export const RealEstate: Story = {
    args: {
        text: 'RealEstate',
        image: '/icons/real-estate.svg',
        variant: 'starfall',
    },
};
export const HelpSupport: Story = {
    args: {
        text: 'HelpSupport',
        image: '/icons/help-support.svg',
        variant: 'coral',
    },
};
export const Education: Story = {
    args: {
        text: 'Education',
        image: '/icons/education.svg',
        variant: 'overworld',
    },
};
export const Others: Story = {
    args: {
        text: 'Others',
        image: '/icons/others.svg',
        variant: 'mojito',
    },
};
