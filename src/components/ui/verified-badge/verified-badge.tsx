import { ShieldCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utilities';

interface VerifiedBadgeProps {
    className?: string;
}

export function VerifiedBadge({ className }: VerifiedBadgeProps) {
    const t = useTranslations('VerifiedBadge');

    return (
        <div
            className={cn(
                'inline-flex items-center gap-1.5 rounded-full border border-slate-600 bg-slate-900 px-3 py-1 text-xs font-bold text-white',
                className,
            )}
        >
            <ShieldCheck className="size-4 fill-green-500 stroke-white" />
            <span>{t('text')}</span>
        </div>
    );
}