'use client';

import { MapPin, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button/button';
import { serviceNameFromCapitalLetter } from '@/lib/consts';

/**
 * Granica 404 dla trasy mapy.
 *
 * Po przeniesieniu walidacji slugu do `src/middleware.ts` bledne adresy mapy sa
 * przekierowywane (307) zanim dotra do renderu, wiec ta strona jest osiagalna
 * rzadko. Musi jednak byc poprawna: poprzednia wersja byla reliktem po forku
 * `abroad-services` — pokazywala SVG Irlandii, angielski tekst "businesses
 * across Ireland" i stopke z nazwa obcej firmy.
 *
 * Komponent kliencki, bo `getTranslations()` w granicy `not-found` nie ma
 * gwarantowanego kontekstu locale; `NextIntlClientProvider` z layoutu ma.
 */
export default function MapNotFound() {
    const t = useTranslations('NotFound');

    return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center bg-[#F6F6F7] px-4 py-16 dark:bg-gray-900">
            <div className="w-full max-w-md space-y-6 text-center">
                <div className="mx-auto inline-flex size-24 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                    <MapPin className="size-12 text-green-500 dark:text-green-400" />
                </div>

                <div className="space-y-3">
                    <p className="text-5xl font-extrabold text-green-500 dark:text-green-400">404</p>
                    <h1 className="text-2xl font-semibold text-gray-800 dark:text-gray-100">
                        {t('mapHeading')}
                    </h1>
                    <p className="text-gray-600 dark:text-gray-300">{t('mapDescription')}</p>
                </div>

                <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
                    <Link href="/map" className="w-full sm:w-auto">
                        <Button className="w-full rounded-full bg-green-500 px-6 text-white hover:bg-green-600">
                            <Search className="mr-2 size-4" />
                            {t('backToMap')}
                        </Button>
                    </Link>

                    <Link href="/" className="w-full sm:w-auto">
                        <Button
                            variant="outline"
                            className="w-full rounded-full border-2 border-green-500 px-6 text-green-600 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/20"
                        >
                            {t('backHome')}
                        </Button>
                    </Link>
                </div>
            </div>

            <p className="mt-12 text-sm text-gray-400 dark:text-gray-500">
                © {new Date().getFullYear()} {serviceNameFromCapitalLetter}
            </p>
        </div>
    );
}
