import type { Meta, StoryObj } from '@storybook/react';
import { Filter } from '@/app/[locale]/(main)/_components/filter/filter';

const meta: Meta<typeof Filter> = {
    title: 'component/filter',
    component: Filter,
    parameters: {
        backgrounds: {
            default: 'red',
            values: [{ name: 'red', value: '#ff0000' }],
        },
    },
    args: {
        searchQuery: '',
        selectedCounty: 'all-voivodeships',
        selectedCategory: '',
        onSearchChange: query => console.log('Search changed:', query),
        onCountyChange: county => console.log('County changed:', county),
        onCategoryChange: category => console.log('Category changed:', category),
    },
};

export default meta;
type Story = StoryObj<typeof Filter>;

export const Primary: Story = {};
