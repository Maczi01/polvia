// components/newsletter-form.tsx
'use client';

import { useState } from 'react';
import { NewsletterState } from '@/app/action';
import { useTranslations } from 'next-intl';
import {
    createNewsletterSchema,
    handleNewsletterSuccess,
    NewsletterFormData,
    submitNewsletterForm,
} from '@/lib/newsletter';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle, LoaderCircle } from 'lucide-react';

export const FooterNewsletter = () => {
    const t = useTranslations('NavBar');
    const [submitStatus, setSubmitStatus] = useState<NewsletterState | null>(null);

    const newsletterSchema = createNewsletterSchema(t);
    const form = useForm<NewsletterFormData>({
        resolver: zodResolver(newsletterSchema),
        defaultValues: { email: '' },
    });

    const onSubmit = async (data: NewsletterFormData) => {
        setSubmitStatus(null);
        const result = await submitNewsletterForm(data);
        setSubmitStatus(result);

        if (result.success) {
            handleNewsletterSuccess(() => {
                setSubmitStatus(null);
                form.reset();
            }, 5000);
        }
    };

    // Function to get translated error message
    const getErrorMessage = (message: string): string => {
        // Check if message contains "already been registered"
        if (message.includes('already been registered') || message.includes('already subscribed')) {
            return t('emailAlreadyRegistered') || 'This email is already registered.';
        }

        // Check if message contains "Too many attempts"
        if (message.includes('Too many attempts')) {
            return t('tooManyAttempts') || 'Too many attempts. Please try again later.';
        }

        // Check if message contains "Invalid email"
        if (message.includes('Invalid email') || message.includes('valid email')) {
            return t('invalidEmail') || 'Please enter a valid email address.';
        }

        // Default fallback
        return t('somethingWentWrong') || 'Something went wrong. Please try again.';
    };

    return (
        <div className="relative">
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col">
                <div className="flex h-10">
                    {submitStatus?.success ? (
                        <div className="flex w-full items-center rounded-md border border-green-200 bg-green-100 px-4 py-2 text-green-600 dark:border-green-800 dark:bg-green-900/30 dark:text-green-300">
                            <CheckCircle size={16} className="mr-2" />
                            {t('thanksFooter')}
                        </div>
                    ) : (
                        <div className="flex w-full rounded-md border border-gray-300 dark:border-gray-600 overflow-hidden transition-all duration-300 focus-within:scale-105 focus-within:shadow-lg focus-within:border-green-400 dark:focus-within:border-green-500">
                            <input
                                {...form.register('email')}
                                placeholder={t('Your email') || 'Enter your email'}
                                className="w-full border-none px-4 py-2 focus:outline-none dark:bg-gray-800 dark:text-gray-100 md:w-64 bg-white"
                                disabled={form.formState.isSubmitting}
                            />
                            <button
                                type="submit"
                                className="flex md:w-32 w-40 items-center justify-center bg-green-500 px-4 py-2 text-white transition-all duration-300 hover:bg-green-600 disabled:opacity-50"
                                disabled={form.formState.isSubmitting}
                            >
                                {form.formState.isSubmitting ? (
                                    <>
                                        <LoaderCircle className="mr-2 size-4 animate-spin" />
                                        {t('loading') || 'Loading...'}
                                    </>
                                ) : (
                                    <>{t('signUp') || 'Subscribe'}</>
                                )}
                            </button>
                        </div>
                    )}
                </div>
            </form>

            {/* Absolutely positioned error messages to avoid layout shifts */}
            {(form.formState.errors.email || (submitStatus?.message && !submitStatus.success)) && (
                <div className="absolute top-full left-0 right-0 mt-2">
                    <p className="text-sm text-red-600 dark:text-red-400">
                        {form.formState.errors.email?.message ||
                            (submitStatus?.message && !submitStatus.success ? getErrorMessage(submitStatus.message) : '')}
                    </p>
                </div>
            )}
        </div>
    );
};