import { CATEGORIES } from '@/lib/categories';
import { CategoryPreviewClient } from '@/app/[locale]/(header)/_components/category-preview-client';

export async function CategoryPreviewServer() {
    return <CategoryPreviewClient categories={CATEGORIES} />;
}