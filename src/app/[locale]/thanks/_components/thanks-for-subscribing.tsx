import Image from 'next/image';
import { Button } from '@/components/ui/button/button';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

export const ThanksForSubscribing = async () => {
    const t = await getTranslations('NewsletterThanks');
    return (
        <main className="flex min-h-screen items-center justify-center bg-white px-4 dark:bg-gray-900">
            <div className="w-full max-w-2xl rounded-xl border border-gray-200 bg-white p-8 text-center shadow-lg dark:border-gray-700 dark:bg-gray-800">
                <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-full bg-green dark:bg-green">
                    <Image
                        src="/logo/only.svg"
                        alt="confirmed"
                        width={72}
                        height={72}
                        className="hidden dark:block dark:brightness-0 dark:invert"
                    />
                    <Image
                        src="/logo/only-dark.svg"
                        alt="confirmed"
                        width={72}
                        height={72}
                        className=" block dark:hidden dark:brightness-0 dark:invert"
                    />
                </div>

                <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white sm:text-4xl">
                    {t('title')}
                </h1>
                <p className="mx-auto mt-4 max-w-md text-base text-gray-600 dark:text-gray-300">
                    {t('description')}
                </p>

                <div className="mt-2 flex flex-row justify-between gap-3 sm:gap-4 md:mt-4">
                    <Link href="/" prefetch className="w-full group">
                        <Button variant="exploreMap" size="hero" className="w-full">
                            {t('main')}
                        </Button>
                    </Link>
                    <Link href="/map"  prefetch className="w-full group">
                        <Button variant="addBusiness" size="hero" className="w-full">
                            {t('map')}
                        </Button>
                    </Link>
                </div>

                <div className="mt-10 border-t border-gray-100 pt-6 dark:border-gray-700">
                    <p className="text-sm text-gray-500 dark:text-gray-400">{t('join')}</p>
                </div>
            </div>
        </main>
    );
};
