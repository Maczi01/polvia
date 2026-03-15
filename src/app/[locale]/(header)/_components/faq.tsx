'use client';

import { useState, useRef, useMemo } from 'react';
import { ArrowRight, ChevronDown, ChevronUp, Mail, MapPin, Plus } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button/button';
import { serviceName } from '@/lib/consts';

export const Faq = () => {
    const [activeIndex, setActiveIndex] = useState<number | null>(null);
    const [announcement, setAnnouncement] = useState('');
    const panelRefs = useRef<(HTMLDivElement | null)[]>([]);

    const toggleAccordion = (index: number) => {
        const isOpening = activeIndex !== index;
        setActiveIndex(isOpening ? index : null);

        const questionText = t(faqs[index].question);
        const action = isOpening ?  t('opened') :  t('closed') ;
        setAnnouncement(`${action} ${t('question')}: ${questionText}`);

        setTimeout(() => setAnnouncement(''), 1000);
    };

    // Handle keyboard navigation
    const handleKeyDown = (event: React.KeyboardEvent, index: number) => {
        switch (event.key) {
            case 'ArrowDown':
                { event.preventDefault();
                const nextIndex = index < faqs.length - 1 ? index + 1 : 0;
                const nextButton = document.querySelector(`#faq-button-${nextIndex}`) as HTMLButtonElement;
                nextButton?.focus();
                break; }
            case 'ArrowUp':
                { event.preventDefault();
                const prevIndex = index > 0 ? index - 1 : faqs.length - 1;
                const prevButton = document.querySelector(`#faq-button-${prevIndex}`) as HTMLButtonElement;
                prevButton?.focus();
                break; }
            case 'Home':
                { event.preventDefault();
                const firstButton = document.querySelector('#faq-button-0') as HTMLButtonElement;
                firstButton?.focus();
                break; }
            case 'End':
                { event.preventDefault();
                const lastButton = document.querySelector(`#faq-button-${faqs.length - 1}`) as HTMLButtonElement;
                lastButton?.focus();
                break; }
            case 'Enter':
            case ' ':
                event.preventDefault();
                toggleAccordion(index);
                break;
        }
    };

    const t = useTranslations('Faq');

    const faqs = [
        { question: 'question1', answer: 'answer1' },
        { question: 'question2', answer: 'answer2' },
        { question: 'question3', answer: 'answer3' },
        { question: 'question4', answer: 'answer4' },
        { question: 'question5', answer: 'answer5' },
        { question: 'question6', answer: 'answer6' },
        { question: 'question7', answer: 'answer7' },
        { question: 'question8', answer: 'answer8' },
        { question: 'question9', answer: 'answer9' },
        { question: 'question10', answer: 'answer10' },
        { question: 'question11', answer: 'answer11' },
        { question: 'question12', answer: 'answer12' },
        { question: 'question13', answer: 'answer13' },
        // { question: 'question14', answer: 'answer14' },
        // { question: 'question15', answer: 'answer15' },
        // { question: 'question16', answer: 'answer16' },
    ];

    const faqSchema = useMemo(() => JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faqs.map((faq) => ({
            '@type': 'Question',
            name: t(faq.question),
            acceptedAnswer: {
                '@type': 'Answer',
                text: t(faq.answer),
            },
        })),
    }), [t]);

    return (
        <>
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: faqSchema }}
        />
        <section
            className="bg-gray-50 py-16 dark:bg-gray-800 md:py-24"
            aria-labelledby="faq-heading"
        >
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                <div className="mx-auto max-w-3xl text-center">
                    <h2
                        id="faq-heading"
                        className="text-3xl font-bold text-gray-900 dark:text-gray-100 sm:text-4xl"
                    >
                        {t('title')}
                    </h2>
                    <p className="mt-4 text-lg text-gray-600 dark:text-gray-300">
                        {t('subtitle')}
                    </p>
                </div>

                {/* Instructions for keyboard users */}
                <div className="sr-only" id="faq-instructions">
                    {t('navigate')}

                </div>

                {/* Live announcements */}
                <div
                    className="sr-only"
                    aria-live="polite"
                    aria-atomic="true"
                >
                    {announcement}
                </div>

                <div
                    className="mx-auto mt-16 max-w-3xl space-y-4"
                    role="region"
                    aria-label={t('title')}
                    aria-describedby="faq-instructions"
                >
                    {faqs.map((faq, index) => {
                        const isExpanded = activeIndex === index;
                        const faqId = `faq-${index}`;
                        const buttonId = `faq-button-${index}`;
                        const panelId = `faq-panel-${index}`;

                        return (
                            <div
                                key={index}
                                className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-all hover:shadow-md dark:border-transparent dark:bg-[#111827] dark:shadow-gray-900/20 dark:hover:shadow-gray-900/30"
                            >
                                <h3>
                                    <button
                                        id={buttonId}
                                        onClick={() => toggleAccordion(index)}
                                        onKeyDown={(e) => handleKeyDown(e, index)}
                                        className="flex w-full items-center justify-between p-6 text-left transition-colors focus:bg-transparent focus:outline-none focus:ring-2 focus:ring-transparent focus:ring-offset-2 dark:focus:bg-gray-700/50"
                                        aria-expanded={isExpanded}
                                        aria-controls={panelId}
                                        aria-describedby={`faq-${index}-hint`}
                                    >
                                        <span className="pr-4 text-lg font-semibold text-gray-900 dark:text-gray-100 md:text-xl">
                                            {t(faq.question)}
                                        </span>

                                        <span
                                            className="ml-4 shrink-0"
                                            aria-hidden="true"
                                        >
                                            {isExpanded ? (
                                                <ChevronUp className="size-5 text-blue-600 transition-transform duration-200 dark:text-blue-400" />
                                            ) : (
                                                <ChevronDown className="size-5 text-gray-500 transition-transform duration-200 dark:text-gray-400" />
                                            )}
                                        </span>
                                    </button>
                                </h3>

                                {/* Hidden hint for screen readers */}
                                <div id={`faq-${index}-hint`} className="sr-only">
                                    {isExpanded ? t('enterToClose') : t('enterToOpen') }
                                </div>

                                <div
                                    id={panelId}
                                    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                                    // @ts-expect-error
                                    ref={(el) => (panelRefs.current[index] = el)}
                                    role="region"
                                    aria-labelledby={buttonId}
                                    className={`transition-all duration-300 ease-in-out ${
                                        isExpanded
                                            ? 'max-h-96 opacity-100'
                                            : 'max-h-0 overflow-hidden opacity-0'
                                    }`}
                                    aria-hidden={!isExpanded}
                                >
                                    <div className="px-6 pb-6 pt-2">
                                        <p className="leading-relaxed text-gray-600 dark:text-gray-300">
                                            {t(faq.answer)}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Contact Section */}
                <div
                    className="mx-auto mt-16 max-w-3xl rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm dark:border-gray-600 dark:bg-[#111827] dark:shadow-gray-900/20"
                    role="complementary"
                    aria-labelledby="contact-heading"
                >
                    <div
                        className="mx-auto flex size-12 items-center justify-center rounded-full bg-green-100 text-green dark:bg-green-900/30 dark:text-green-400"
                        role="img"
                        aria-labelledby="contact-icon-label"
                    >
                        <span id="contact-icon-label" className="sr-only">
                            {t('icon')}
                        </span>
                        <Mail className="size-6" aria-hidden="true" />
                    </div>

                    <h3
                        id="contact-heading"
                        className="mt-4 text-xl font-semibold text-gray-900 dark:text-gray-100"
                    >
                        {t('questions')}
                    </h3>

                    <p className="mt-2 text-gray-600 dark:text-gray-300">
                        {t('subtitleContact')}
                    </p>

                    <div className="mt-6">
                        <Link
                            href="/contact"
                            prefetch={true}
                            className="group block w-full"
                            aria-describedby="contact-button-description"
                        >
                            <Button
                                variant="exploreMap"
                                size="hero"
                                className="w-full transition-all duration-200 hover:scale-105 focus:scale-105"
                            >
                                {t('contact')}
                                <ArrowRight
                                    className="mr-2 size-5 transition-transform duration-200 group-hover:scale-110"
                                    aria-hidden="true"
                                />
                            </Button>
                        </Link>
                        <div id="contact-button-description" className="sr-only">
                            {t('goToContact')}
                        </div>
                    </div>
                </div>

                {/* FAQ Summary for screen readers */}
                <div className="sr-only">
                    <h3>{t('SummaryOfFAQ')}</h3>
                    <p>
                        {
                            `${t('summaryFaq1')} ${faqs.length} ${t('summaryFaq2')} ${serviceName} ${t('summaryFaq3')}`
                        }
                    </p>
                </div>
            </div>

            {/* Reduced motion support */}
            <style jsx>{`
                @media (prefers-reduced-motion: reduce) {
                    .transition-all,
                    .transition-colors,
                    .transition-transform,
                    .duration-200,
                    .duration-300 {
                        transition: none !important;
                        animation: none !important;
                    }
                    .hover\\:scale-105:hover,
                    .focus\\:scale-105:focus,
                    .group-hover\\:scale-110 {
                        transform: none !important;
                    }
                }
            `}</style>
        </section>
    </>
    );
};
