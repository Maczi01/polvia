'use client';

import React, { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Bell, CheckCircle, LoaderCircle, Send, X } from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button/button';
import { Input } from '@/components/ui/input/input';
import {
    NewsletterFormData,
    NewsletterState,
    createNewsletterSchema,
    submitNewsletterForm
} from '@/lib/newsletter';

export const Newsletter = ({ position = 'bottom-right' }) => {
    const [showNewsletter, setShowNewsletter] = useState(false);
    const [isMounted, setIsMounted] = useState(false);
    const t = useTranslations('NavBar');
    const [submitStatus, setSubmitStatus] = useState<NewsletterState | null>(null);

    const newsletterSchema = createNewsletterSchema(t);
    const form = useForm<NewsletterFormData>({
        resolver: zodResolver(newsletterSchema),
        defaultValues: { email: '' },
    });

    // Simple email validation function
    const isValidEmail = (email: string) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    };

    // Watch email field for validation
    const emailValue = form.watch('email');
    const isEmailValid = emailValue && isValidEmail(emailValue);

    useEffect(() => {
        const firstTrySeen = localStorage.getItem('newsletterFirstTry');
        const secondTrySeen = localStorage.getItem('newsletterSecondTry');
        const subscribed = localStorage.getItem('hasSeenNewsletterPopup');

        if (!firstTrySeen && !subscribed) {
            const firstTimer = setTimeout(() => {
                setShowNewsletter(true);
                setIsMounted(true);
                localStorage.setItem('newsletterFirstTry', 'true');
            }, 55_000);
            return () => clearTimeout(firstTimer);
        }

        if (firstTrySeen && !secondTrySeen && !subscribed) {
            const secondTimer = setTimeout(() => {
                setShowNewsletter(true);
                setIsMounted(true);
                localStorage.setItem('newsletterSecondTry', 'true');
            }, 120_000);
            return () => clearTimeout(secondTimer);
        }
    }, []);

    const dismissNewsletter = () => {
        setIsMounted(false);
        setTimeout(() => {
            setShowNewsletter(false);
            const secondTrySeen = localStorage.getItem('newsletterSecondTry');
            if (secondTrySeen) {
                localStorage.setItem('hasSeenNewsletterPopup', 'true');
            }
        }, 500);
    };

    const onSubmit = async (data: NewsletterFormData) => {
        setSubmitStatus(null);
        try {
            const result = await submitNewsletterForm(data);
            setSubmitStatus(result);
            if (result.success) {
                setTimeout(() => {
                    dismissNewsletter();
                }, 10_000);
                form.reset();
                localStorage.setItem('hasSeenNewsletterPopup', 'true');
            }
        } catch (error) {
            console.error('Newsletter submission error:', error);
            setSubmitStatus({
                success: false,
                message: t('Something went wrong. Please try again.'),
            });
        }
    };

    const positionClasses = {
        'bottom-right': 'bottom-0 left-0 right-0 sm:bottom-4 sm:right-4 sm:left-auto',
        'bottom-left': 'bottom-0 left-0 right-0 sm:bottom-4 sm:left-4 sm:right-auto',
        bottom: 'bottom-0 left-0 right-0',
    }[position] || 'bottom-0 left-0 right-0 sm:bottom-4 sm:right-4 sm:left-auto';

    const animationClass = {
        'bottom-right': 'animate-slideInRight',
        'bottom-left': 'animate-slideInLeft',
        bottom: 'animate-slideInBottom',
    }[position] || 'animate-slideInRight';

    if (!showNewsletter) return null;

    return (
        <>
            <style jsx global>{`
                @keyframes slideInFromRight {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes slideInFromLeft {
                    from { transform: translateX(-100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes slideInFromBottom {
                    from { transform: translateY(100%); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                @keyframes fadeOut {
                    from { opacity: 1; }
                    to { opacity: 0; }
                }
                .animate-slideInRight {
                    animation: slideInFromRight 0.5s ease-out forwards;
                }
                .animate-slideInLeft {
                    animation: slideInFromLeft 0.5s ease-out forwards;
                }
                .animate-slideInBottom {
                    animation: slideInFromBottom 0.5s ease-out forwards;
                }
                .animate-fadeOut {
                    animation: fadeOut 0.5s ease-out forwards;
                }
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                .animate-fadeIn {
                    animation: fadeIn 0.5s ease-out forwards;
                }
            `}</style>

            <div className={`fixed ${positionClasses} z-50 w-full max-w-none rounded-none p-2 shadow-xl dark:shadow-gray-900/50 sm:mx-0 sm:w-auto sm:max-w-md sm:rounded-lg sm:p-0 ${
                isMounted ? animationClass : 'animate-fadeOut'
            }`}>
                <div className="relative overflow-hidden rounded-lg border border-gray-200 bg-white shadow-md dark:border-gray-600 dark:bg-gray-800 dark:shadow-gray-900/30 sm:rounded-lg">
                    <button
                        onClick={dismissNewsletter}
                        className="absolute right-2 top-2 p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                        aria-label="Close newsletter"
                    >
                        <X size={20} />
                    </button>

                    <div className="border-b-4 border-green-500 bg-white p-4 dark:border-green-400 dark:bg-gray-800 sm:p-5">
                        <div className="flex flex-col gap-3 sm:gap-4">
                            <div className="flex items-center gap-2">
                                <Bell size={18} className="text-green-600 dark:text-green-400 sm:size-5" />
                                <p className="text-base font-medium text-gray-800 dark:text-gray-100 sm:text-lg">
                                    {t('signNewsletterTitle')}
                                </p>
                            </div>

                            <p className="text-xs leading-relaxed text-gray-600 dark:text-gray-300 sm:text-sm">
                                {t('newsletterDescription')}
                            </p>

                            {submitStatus && (
                                <div className="w-full">
                                    <div className={`${
                                        submitStatus.success
                                            ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                                            : 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-300'
                                    } animate-fadeIn flex items-center justify-between rounded-md p-3 sm:p-4`}>
                                        <div className="flex items-center gap-2">
                                            {submitStatus.success ? (
                                                <CheckCircle size={20} className="sm:size-6" />
                                            ) : (
                                                <X size={20} className="text-red-500 dark:text-red-400 sm:size-6" />
                                            )}
                                            <span className="text-sm font-medium sm:text-base">
                                                {submitStatus.success
                                                    ? t('thanks')
                                                    : t('somethingWentWrong') || 'Something went wrong. Please try again.'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {!submitStatus?.success && (
                                <Form {...form}>
                                    <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3">
                                        <FormField
                                            control={form.control}
                                            name="email"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormControl>
                                                        <Input
                                                            translate="no"
                                                            placeholder={t('Your email') || 'Your email'}
                                                            className={`rounded-md border bg-white p-3 text-sm text-gray-900 focus:border-green-500 focus:outline-none dark:bg-gray-700 dark:text-gray-100 dark:focus:border-green-400 ${
                                                                form.formState.errors.email || (emailValue && !isEmailValid)
                                                                    ? 'border-red-400 ring-1 ring-red-200 dark:border-red-500 dark:ring-red-800'
                                                                    : 'border-gray-200 dark:border-gray-600'
                                                            }`}
                                                            {...field}
                                                        />
                                                    </FormControl>
                                                </FormItem>
                                            )}
                                        />
                                        {form.formState.errors.email && (
                                            <div className="rounded bg-red-50 px-2 py-1 text-xs text-red-600 dark:bg-red-900/30 dark:text-red-300">
                                                {form.formState.errors.email.message}
                                            </div>
                                        )}
                                        {emailValue && !isEmailValid && !form.formState.errors.email && (
                                            <div className="rounded bg-red-50 px-2 py-1 text-xs text-red-600 dark:bg-red-900/30 dark:text-red-300">
                                                Please enter a valid email address
                                            </div>
                                        )}

                                        <div className="flex gap-2 sm:gap-3">
                                            <Button
                                                translate="no"
                                                type="button"
                                                className="w-1/2 border bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                                                onClick={dismissNewsletter}
                                            >
                                                <X size={14} className="mr-1" />
                                                {t('reject')}
                                            </Button>
                                            <Button
                                                translate="no"
                                                type="submit"
                                                disabled={form.formState.isSubmitting || !isEmailValid}
                                                className={`w-1/2 ${
                                                    isEmailValid
                                                        ? 'bg-green-600 text-white hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600'
                                                        : 'cursor-not-allowed bg-green-300 text-gray-500 dark:bg-gray-600 dark:text-gray-400'
                                                }`}
                                            >
                                                {form.formState.isSubmitting ? (
                                                    <LoaderCircle className="size-4 animate-spin" />
                                                ) : (
                                                    <>
                                                        <Send size={14} className="mr-1" />
                                                        {t('signUp')}
                                                    </>
                                                )}
                                            </Button>
                                        </div>
                                        <FormMessage className="mt-1 text-xs text-red-600 dark:text-red-400" />
                                        <p className="mt-1 text-center text-xs text-gray-500 dark:text-gray-400">
                                            {t('unsubscribeInfo')}
                                        </p>
                                    </form>
                                </Form>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};