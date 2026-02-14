import Image from 'next/image';
import { cn } from '@/lib/utilities';

interface CircleImageProps {
    src: string;
    alt: string;
    size?: number;
    className?: string;
}

export function CircleImage({ src, alt, size = 64, className }: CircleImageProps) {
    return (
        <div
            className={cn('relative overflow-hidden rounded-full', className)}
            style={{
                width: size,
                height: size,
            }}
        >
            <Image src={src} alt={alt} fill className="object-cover" sizes={`${size}px`} />
        </div>
    );
}
