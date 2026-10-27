import type { JSX } from 'react';

import { PopularServicesGridClient } from '@/app/[locale]/(header)/_components/popular-services-card';
import { getHomepageServices } from '@/lib/queries';

interface PopularServicesProps {
    params: Promise<{ locale: string }>;
}

export async function PopularServices({ params }: PopularServicesProps): Promise<JSX.Element> {
    const { locale } = await params;
    const { popular, newest } = await getHomepageServices(locale);

    return <PopularServicesGridClient popular={popular} newest={newest} />;
}
