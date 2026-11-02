import type { Locale } from '@/i18n/config';

/**
 * Teksty fikcyjnej firmy przykladowej strony premium (`/cennik/przyklad`) we wszystkich
 * locale. To dane, nie tlumaczenia interfejsu — dlatego tu, a nie w `messages/`.
 * Firma, adres, telefon i opinie sa zmyslone; nie odpowiadaja zadnemu wpisowi katalogu.
 */

type ExamplePriceItem = { name: string; price: string; note?: string };

type ExampleFaqItem = { question: string; answer: string };

export type PremiumExampleTexts = {
    description: string;
    tags: string[];
    coverAlt: string;
    galleryAlts: [string, string, string];
    priceList: ExamplePriceItem[];
    faq: ExampleFaqItem[];
};

export const PREMIUM_EXAMPLE_TEXTS: Record<Locale, PremiumExampleTexts> = {
    pl: {
        description:
            'Prowadzimy księgowość jednoosobowych działalności i małych spółek. Rozliczamy podatki, ZUS i kadry, a dokumenty możesz przesłać zdjęciem z telefonu.\n\nObsługujemy klientów po polsku, ukraińsku, rosyjsku i angielsku — w biurze w Warszawie albo w pełni zdalnie.',
        tags: ['Księgowość JDG', 'Pełna księgowość', 'Kadry i płace', 'Rozliczenia PIT', 'ZUS'],
        coverAlt: 'Biuro w centrum Warszawy',
        galleryAlts: [
            'Ilustracja: finanse małej firmy',
            'Ilustracja: klienci z całej Polski',
            'Ilustracja: branże, które obsługujemy',
        ],
        priceList: [
            {
                name: 'Konsultacja wstępna (30 min)',
                price: 'bezpłatnie',
                note: 'W biurze lub online',
            },
            { name: 'Księgowość JDG — ryczałt', price: 'od 250 zł/mies.' },
            { name: 'Księgowość JDG — KPiR', price: 'od 350 zł/mies.', note: 'Do 30 dokumentów' },
            { name: 'Pełna księgowość spółki', price: 'od 1 200 zł/mies.' },
            { name: 'Kadry i płace', price: 'od 60 zł/pracownika' },
        ],
        faq: [
            {
                question: 'Czy mogę przesyłać dokumenty zdalnie?',
                answer: 'Tak. Wystarczy zdjęcie albo skan — dokumenty przyjmujemy mailem i przez aplikację.',
            },
            {
                question: 'Czy pomożecie założyć działalność?',
                answer: 'Tak. Doradzimy formę opodatkowania i złożymy wniosek CEIDG razem z Tobą.',
            },
            {
                question: 'W jakich językach rozmawiacie?',
                answer: 'Po polsku, ukraińsku, rosyjsku i angielsku — także przez telefon i na wideorozmowie.',
            },
        ],
    },
    uk: {
        description:
            'Ведемо бухгалтерію ФОП та малих компаній. Розраховуємо податки, ZUS і кадри, а документи можна надіслати фото з телефона.\n\nОбслуговуємо клієнтів польською, українською, російською та англійською — в офісі у Варшаві або повністю дистанційно.',
        tags: ['Бухгалтерія JDG', 'Повна бухгалтерія', 'Кадри і зарплати', 'Декларації PIT', 'ZUS'],
        coverAlt: 'Офіс у центрі Варшави',
        galleryAlts: [
            'Ілюстрація: фінанси малої компанії',
            'Ілюстрація: клієнти з усієї Польщі',
            'Ілюстрація: галузі, які ми обслуговуємо',
        ],
        priceList: [
            {
                name: 'Первинна консультація (30 хв)',
                price: 'безкоштовно',
                note: 'В офісі або онлайн',
            },
            { name: 'Бухгалтерія JDG — ричалт', price: 'від 250 зл/міс.' },
            { name: 'Бухгалтерія JDG — KPiR', price: 'від 350 зл/міс.', note: 'До 30 документів' },
            { name: 'Повна бухгалтерія компанії', price: 'від 1 200 зл/міс.' },
            { name: 'Кадри і зарплати', price: 'від 60 зл/працівника' },
        ],
        faq: [
            {
                question: 'Чи можна надсилати документи дистанційно?',
                answer: 'Так. Достатньо фото або скану — приймаємо документи поштою та через застосунок.',
            },
            {
                question: 'Чи допоможете відкрити бізнес?',
                answer: 'Так. Порадимо форму оподаткування та разом із вами подамо заяву до CEIDG.',
            },
            {
                question: 'Якими мовами ви спілкуєтеся?',
                answer: 'Польською, українською, російською та англійською — також телефоном і по відеозв’язку.',
            },
        ],
    },
    en: {
        description:
            'We keep the books for sole traders and small companies. We handle taxes, social security (ZUS) and payroll, and you can send documents as a photo from your phone.\n\nWe serve clients in Polish, Ukrainian, Russian and English — at our Warsaw office or fully remotely.',
        tags: ['Sole trader accounting', 'Full accounting', 'Payroll', 'PIT returns', 'ZUS'],
        coverAlt: 'Office in central Warsaw',
        galleryAlts: [
            'Illustration: small business finances',
            'Illustration: clients from all over Poland',
            'Illustration: industries we serve',
        ],
        priceList: [
            {
                name: 'Initial consultation (30 min)',
                price: 'free',
                note: 'At the office or online',
            },
            { name: 'Sole trader accounting — lump-sum tax', price: 'from 250 PLN/month' },
            {
                name: 'Sole trader accounting — KPiR',
                price: 'from 350 PLN/month',
                note: 'Up to 30 documents',
            },
            { name: 'Full company accounting', price: 'from 1,200 PLN/month' },
            { name: 'Payroll', price: 'from 60 PLN/employee' },
        ],
        faq: [
            {
                question: 'Can I send documents remotely?',
                answer: 'Yes. A photo or a scan is enough — we accept documents by email and through our app.',
            },
            {
                question: 'Will you help me register a business?',
                answer: 'Yes. We will advise on the tax option and file the CEIDG application with you.',
            },
            {
                question: 'Which languages do you speak?',
                answer: 'Polish, Ukrainian, Russian and English — also on the phone and on video calls.',
            },
        ],
    },
    ru: {
        description:
            'Ведём бухгалтерию ИП и небольших компаний. Рассчитываем налоги, ZUS и кадры, а документы можно отправить фото с телефона.\n\nОбслуживаем клиентов на польском, украинском, русском и английском — в офисе в Варшаве или полностью удалённо.',
        tags: [
            'Бухгалтерия JDG',
            'Полная бухгалтерия',
            'Кадры и зарплаты',
            'Декларации PIT',
            'ZUS',
        ],
        coverAlt: 'Офис в центре Варшавы',
        galleryAlts: [
            'Иллюстрация: финансы небольшой компании',
            'Иллюстрация: клиенты со всей Польши',
            'Иллюстрация: отрасли, которые мы обслуживаем',
        ],
        priceList: [
            {
                name: 'Первичная консультация (30 мин)',
                price: 'бесплатно',
                note: 'В офисе или онлайн',
            },
            { name: 'Бухгалтерия JDG — рычалт', price: 'от 250 зл/мес.' },
            { name: 'Бухгалтерия JDG — KPiR', price: 'от 350 зл/мес.', note: 'До 30 документов' },
            { name: 'Полная бухгалтерия компании', price: 'от 1 200 зл/мес.' },
            { name: 'Кадры и зарплаты', price: 'от 60 зл/сотрудника' },
        ],
        faq: [
            {
                question: 'Можно ли отправлять документы удалённо?',
                answer: 'Да. Достаточно фото или скана — принимаем документы по почте и через приложение.',
            },
            {
                question: 'Поможете открыть бизнес?',
                answer: 'Да. Подскажем форму налогообложения и вместе с вами подадим заявление в CEIDG.',
            },
            {
                question: 'На каких языках вы говорите?',
                answer: 'На польском, украинском, русском и английском — также по телефону и по видеосвязи.',
            },
        ],
    },
};
