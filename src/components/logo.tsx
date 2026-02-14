import Image from 'next/image';
import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';

export const Logo = () => {
    const t = useTranslations('images');

    return (
        <Link href="/">
            <div>
                <Image
                    className="hidden dark:block"
                    src="/logo/logo-dark.svg"
                    alt={t('logo')}
                    width={84}
                    height={32}
                    priority
                />
                <Image
                    className="block dark:hidden"
                    src="/logo/logo.svg"
                    alt={t('logo')}
                    width={84}
                    height={32}
                    priority
                />
            </div>
        </Link>
    );
};
