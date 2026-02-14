import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTermsOfService } from '@/lib/posts';
import { ArrowLeftIcon } from 'lucide-react';
import { formatDate, serviceNameFromCapitalLetter } from '@/lib/consts';
import { MDXContent } from '@/app/[locale]/blog/_components/mdx-content';
import { getTranslations, setRequestLocale } from 'next-intl/server'; // Add setRequestLocale
import { Link } from '@/i18n/navigation';
import { env } from '../../../../env';

export async function generateStaticParams() {
    return ['en', 'pl'].map(locale => ({
        locale,
    }));
}

export async function generateMetadata({
                                           params,
                                       }: {
    params: Promise<{ locale: string }>;
}): Promise<Metadata> {
    const { locale } = await params;

    // Add this critical line
    setRequestLocale(locale);

    const post = await getTermsOfService(locale);

    if (!post) {
        return { title: 'Post Not Found' };
    }

    const baseUrl = env.NEXT_PUBLIC_SITE_URL;
    const termsPath = locale === 'en' ? 'terms' : 'regulamin';

    return {
        title: post.metadata.title,
        description: post.metadata.summary || post.metadata.title,
        metadataBase: new URL(baseUrl), // Add this line
        alternates: {
            canonical: `${baseUrl}/${locale}/${termsPath}`,
            languages: {
                'x-default': `${baseUrl}/pl/regulamin`,
                en: `${baseUrl}/en/terms`,
                pl: `${baseUrl}/pl/regulamin`,
            },
        },
        openGraph: {
            title: post.metadata.title, // Add explicit title
            description: post.metadata.summary || post.metadata.title, // Add description
            url: `${baseUrl}/${locale}/${termsPath}`,
            images: post.metadata.image ? [post.metadata.image.toString()] : [],
            type: 'article',
            publishedTime: post.metadata.publishedAt,
            authors: post.metadata.author ? [post.metadata.author] : [],
            locale, // Add locale
            siteName: serviceNameFromCapitalLetter, // Add site name
        },
        twitter: { // Add Twitter meta
            card: 'summary_large_image',
            title: post.metadata.title,
            description: post.metadata.summary || post.metadata.title,
        },
        robots: {
            index: true,
            follow: true,
            googleBot: { // Add specific googleBot directive
                index: true,
                follow: true,
            },
        },
    };
}

export default async function Terms({
                                        params
                                    }: {
    params: Promise<{ locale: string }>
}) {
    const { locale } = await params;

    // Add this critical line
    setRequestLocale(locale);

    const post = await getTermsOfService(locale);
    const t = await getTranslations('Rules');

    if (!post) {
        notFound();
    }

    const { metadata, content } = post;
    const { title, author, publishedAt } = metadata;

    return (
        <article className="pb-24 pt-8">
            <div className="container mx-auto max-w-4xl px-4 sm:px-6">
                <div className="mb-8 flex items-center justify-between">
                    <Link
                        href={`/`}
                        className="inline-flex items-center gap-2 text-sm font-light text-muted-foreground transition-colors hover:text-foreground"
                    >
                        <ArrowLeftIcon className="size-5" />
                        <span>{t('backToMainPage')}</span>
                    </Link>
                </div>

                <header className="text-center sm:text-left">
                    <h1 className="title mb-3">{title}</h1>
                    <div className="text-sm text-muted-foreground">
                        {author && <span className="font-medium">{author}</span>}
                        {publishedAt && author && ' • '}
                        {publishedAt && <span>{formatDate(publishedAt)}</span>}
                    </div>
                </header>

                <div className="prose prose-lg mt-12 max-w-none dark:prose-invert">
                    <MDXContent source={content} />
                </div>
            </div>
        </article>
    );
}
