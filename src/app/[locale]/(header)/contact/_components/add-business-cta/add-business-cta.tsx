import { useTranslations } from 'next-intl';
import type { JSX } from 'react';

import { buttonVariants } from '@/components/ui/button/button';
import { Link } from '@/i18n/navigation';

export function AddBusinessCta(): JSX.Element {
    const t = useTranslations('addBusiness.cta');

    return (
        <section
            aria-labelledby="add-business-cta-heading"
            className="mx-auto mt-10 flex w-full max-w-3xl flex-col items-center gap-4 text-center"
        >
            <h2
                id="add-business-cta-heading"
                className="text-2xl font-semibold text-gray-900 dark:text-gray-100"
            >
                {t('heading')}
            </h2>
            <p className="max-w-2xl text-gray-600 dark:text-gray-300">{t('description')}</p>
            <Link
                href="/add-business"
                className={buttonVariants({ variant: 'addBusiness', size: 'lg' })}
            >
                {t('button')}
            </Link>
        </section>
    );
}
