'use client';

import React, { useEffect, useState } from 'react';
import { ContactFormData } from '@/app/api/submit-contact-query/route';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button/button';
import { Check, LoaderCircle } from 'lucide-react';
import clsx from 'clsx';

import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input/input';

const formSchema = z.object({
    email: z.string().email({ message: 'Invalid email' }).max(100),
    topic: z.string()
        .min(1, 'Topic is required')
        .max(50)
        .refine((val) => val.trim().length > 0, {
            message: 'Topic cannot be empty or contain only spaces'
        }),
    message: z.string()
        .min(1, 'Message is required')
        .max(500)
        .refine((val) => val.trim().length > 0, {
            message: 'Message cannot be empty or contain only spaces'
        }),
});

type FormData = z.infer<typeof formSchema>;

const submitContactForm = async (formData: ContactFormData) => {
    const res = await fetch('/api/submit-contact-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
    });

    return await res.json();
};

export const ContactForm = () => {
    const t = useTranslations('ContactForm');
    const router = useRouter();
    const [submitStatus, setSubmitStatus] = useState<{
        success?: boolean;
        message?: string;
        errors?: Record<string, string[]>;
    } | null>(null);

    const form = useForm<FormData>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            email: '',
            topic: '',
            message: '',
        },
    });

    // ---------------------------------------------------------------------------
    // Character counters
    // ---------------------------------------------------------------------------
    const [charCounts, setCharCounts] = useState({ email: 0, topic: 0, message: 0 });
    const maxLengths = { email: 100, topic: 50, message: 500 } as const;

    const watched = form.watch();
    useEffect(() => {
        setCharCounts({
            email: watched.email.length,
            topic: watched.topic.length,
            message: watched.message.length,
        });
    }, [watched.email, watched.topic, watched.message]);

    const getCounterColor = (count: number, max: number) => {
        const p = count / max;
        if (p < 0.75) return 'text-gray-400 dark:text-gray-500';
        if (p < 0.9) return 'text-yellow-500 dark:text-yellow-400';
        return 'text-red-500 dark:text-red-400';
    };

    const onSubmit = async (data: FormData) => {
        setSubmitStatus(null);
        const result = await submitContactForm(data);
        setSubmitStatus(result);
        if (result.success) form.reset();
    };

    if (submitStatus?.success) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center p-4">
                <div className="w-full max-w-md space-y-6 rounded-2xl bg-white/80 p-8 text-center shadow-2xl dark:bg-gray-800/90">
                    <Check className="mx-auto mb-4 size-12 text-green-600 dark:text-green-400" />
                    <h2 className="text-2xl font-semibold text-green-600 dark:text-green-400">{t('thanks')}</h2>
                    <p className="text-gray-700 dark:text-gray-300">{t('success')}</p>
                    <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                        <Button
                            variant="outline"
                            onClick={() => router.push('/')}
                            className="rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                        >
                            {t('goBack')}
                        </Button>
                        <Button
                            onClick={() => setSubmitStatus(null)}
                            className="rounded-full bg-orange-500 text-white hover:bg-orange-600 dark:bg-orange-600 dark:hover:bg-orange-500"
                        >
                            {t('sendAnother')}
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="mx-auto w-full max-w-3xl rounded-xl bg-white/70 p-6 shadow-2xl ring-1 ring-gray-100 backdrop-blur dark:bg-gray-800/90 dark:ring-gray-700 sm:p-8 md:p-12">
            <div className="mb-10 text-center">
                <h1 className="mb-4 text-4xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
                    {t('title')}
                </h1>
                <p className="mx-auto max-w-2xl text-gray-600 dark:text-gray-300">{t('info')}</p>
            </div>

            {submitStatus?.success === false && (
                <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300">
                    <p>{submitStatus.message}</p>
                </div>
            )}

            <Form {...form}>
                <form
                    onSubmit={form.handleSubmit(onSubmit)}
                    className="grid grid-cols-1 gap-6 md:grid-cols-2"
                >
                    {/* Email */}
                    <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                            <FormItem>
                                <div className="mb-2 flex justify-between">
                                    <FormLabel className="font-medium text-gray-700 dark:text-gray-300">
                                        {t('yourEmail')}
                                    </FormLabel>
                                    <span
                                        className={`text-xs ${getCounterColor(charCounts.email, maxLengths.email)}`}
                                    >
                                        {charCounts.email}/{maxLengths.email}
                                    </span>
                                </div>
                                <FormControl>
                                    <Input
                                        className={`w-full rounded-md border ${
                                            form.formState.errors.email
                                                ? 'border-red-300 dark:border-red-600'
                                                : 'border-gray-200 dark:border-gray-600'
                                        } bg-white px-4 py-3 text-gray-900 focus:border-2 focus:border-gray-600 focus:ring-0 focus-visible:outline-none dark:bg-gray-700 dark:text-gray-100 dark:focus:border-gray-400`}
                                        placeholder={t('yourEmailPlaceholder')}
                                        {...field}
                                    />
                                </FormControl>
                                <FormMessage className="mt-1 text-sm text-red-600 dark:text-red-400" />
                            </FormItem>
                        )}
                    />

                    {/* Topic */}
                    <FormField
                        control={form.control}
                        name="topic"
                        render={({ field }) => (
                            <FormItem>
                                <div className="mb-2 flex justify-between">
                                    <FormLabel className="font-medium text-gray-700 dark:text-gray-300">
                                        {t('topic')}
                                    </FormLabel>
                                    <span
                                        className={`text-xs ${getCounterColor(charCounts.topic, maxLengths.topic)}`}
                                    >
                                        {charCounts.topic}/{maxLengths.topic}
                                    </span>
                                </div>
                                <FormControl>
                                    <Input
                                        className={`w-full rounded-md border ${
                                            form.formState.errors.topic
                                                ? 'border-red-300 dark:border-red-600'
                                                : 'border-gray-200 dark:border-gray-600'
                                        } bg-white px-4 py-3 text-gray-900 focus:border-2 focus:border-gray-600 focus:ring-0 focus-visible:outline-none dark:bg-gray-700 dark:text-gray-100 dark:focus:border-gray-400`}
                                        placeholder={t('topicPlaceholder')}
                                        {...field}
                                    />
                                </FormControl>
                                <FormMessage className="mt-1 text-sm text-red-600 dark:text-red-400" />
                            </FormItem>
                        )}
                    />

                    {/* Message */}
                    <FormField
                        control={form.control}
                        name="message"
                        render={({ field }) => (
                            <FormItem className="relative md:col-span-2">   {/* <- added md:col-span-2 */}
                                <div className="mb-2 flex justify-between">
                                    <FormLabel className="font-medium text-gray-700 dark:text-gray-300">
                                        {t('message')}
                                    </FormLabel>
                                    <span
                                        className={`text-xs ${getCounterColor(charCounts.message, maxLengths.message)}`}
                                    >
                                            {charCounts.message}/{maxLengths.message}
                                        </span>
                                </div>
                                <FormControl>
                                    <Textarea
                                        className={`w-full rounded-md border ${
                                            form.formState.errors.message
                                                ? 'border-red-300 dark:border-red-600'
                                                : 'border-gray-200 dark:border-gray-600'
                                        } bg-white px-4 py-3 text-gray-900 focus:border-2 focus:border-gray-600 focus:ring-0 focus-visible:outline-none dark:bg-gray-700 dark:text-gray-100 dark:focus:border-gray-400`}
                                        rows={2}
                                        placeholder={t('messagePlaceholder')}
                                        {...field}
                                    />
                                </FormControl>
                                <FormMessage className="mt-1 text-sm text-red-600 dark:text-red-400" />
                            </FormItem>
                        )}
                    />

                    {/* Submit button */}
                    <div className="flex justify-end md:col-span-2">
                        <Button
                            type="submit"
                            disabled={form.formState.isSubmitting}
                            className={clsx(
                                'flex w-full items-center justify-center gap-2 rounded-lg p-3 font-medium text-white transition-colors md:w-40',
                                form.formState.isSubmitting
                                    ? 'bg-orange-400 dark:bg-orange-500'
                                    : 'bg-orange-500 hover:bg-orange-600 dark:bg-orange-600 dark:hover:bg-orange-500',
                            )}
                        >
                            {form.formState.isSubmitting && (
                                <LoaderCircle className="size-4 animate-spin" />
                            )}
                            {form.formState.isSubmitting ? t('sending') : t('send')}
                        </Button>
                    </div>
                </form>
            </Form>
        </div>
    );
};

// <FormItem>
//     <div className="mb-2 flex justify-between">
//         <FormLabel className="font-medium text-gray-700">
//             {t('yourEmail')}
//         </FormLabel>
//         <span
//             className={`text-xs ${getCounterColor(charCounts.email, maxLengths.email)}`}
//         >
//                                             {charCounts.email}/{maxLengths.email}
//                                         </span>
//     </div>
//     <FormControl>
//         <Input
//             className={`w-full rounded-md border ${
//                 form.formState.errors.email
//                     ? 'border-red-300'
//                     : 'border-gray-200'
//             } px-4 py-3 focus:border-2 focus:border-gray-600 focus:ring-0 focus-visible:outline-none`}
//             placeholder={t('yourEmailPlaceholder')}
//             {...field}
//         />
//     </FormControl>
//     <FormMessage className="mt-1 text-sm text-red-600" />
// </FormItem>

// <FormItem>
//     <div className="mb-2 flex justify-between">
//         <FormLabel className="font-medium text-gray-700">
//             {t('message')}
//         </FormLabel>
//         <span
//             className={`text-xs ${getCounterColor(charCounts.message, maxLengths.message)}`}
//         >
//                                             {charCounts.message}/{maxLengths.message}
//                                         </span>
//     </div>
//     <FormControl>
//         <Textarea
//             className={`w-full rounded-md border ${
//                 form.formState.errors.message
//                     ? 'border-red-300'
//                     : 'border-gray-200'
//             } px-4 py-3 focus:border-2 focus:border-gray-600 focus:ring-0 focus-visible:outline-none`}
//             rows={2}
//             placeholder={t('messagePlaceholder')}
//             {...field}
//         />
//     </FormControl>
//     <FormMessage className="mt-1 text-sm text-red-600" />
// </FormItem>

// <FormItem>
//     <div className="mb-2 flex justify-between">
//         <FormLabel className="font-medium text-gray-700">
//             {t('topic')}
//         </FormLabel>
//         <span
//             className={`text-xs ${getCounterColor(charCounts.topic, maxLengths.topic)}`}
//         >
//                                             {charCounts.topic}/{maxLengths.topic}
//                                         </span>
//     </div>
//     <FormControl>
//         <Input
//             className={`w-full rounded-md border ${
//                 form.formState.errors.topic
//                     ? 'border-red-300'
//                     : 'border-gray-200'
//             } px-4 py-3 focus:border-2 focus:border-gray-600 focus:ring-0 focus-visible:outline-none`}
//             placeholder={t('topicPlaceholder')}
//             {...field}
//         />
//     </FormControl>
//     <FormMessage className="mt-1 text-sm text-red-600" />
// </FormItem>
