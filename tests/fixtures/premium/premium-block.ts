/**
 * Poprawny blok `premium` pliku wpisu (wejscie `premiumContentSchema`). Testy nadpisuja
 * tylko badane pole, wiec kazdy blad walidacji ma jedna, jawna przyczyne.
 */
export function premiumBlock(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        template: 'gallery',
        coverImage: 'cover.jpg',
        gallery: [
            {
                file: 'salon-1.webp',
                alt: {
                    pl: 'Wnetrze salonu',
                    uk: 'Інтерʼєр салону',
                    en: 'Salon interior',
                    ru: 'Интерьер салона',
                },
            },
        ],
        priceList: [
            {
                name: { pl: 'Strzyzenie', uk: 'Стрижка', en: 'Haircut', ru: 'Стрижка' },
                price: { pl: 'od 80 zl', uk: 'від 80 зл', en: 'from 80 PLN', ru: 'от 80 зл' },
            },
        ],
        faq: [
            {
                q: {
                    pl: 'Czy trzeba sie umawiac?',
                    uk: 'Чи потрібно записуватися?',
                    en: 'Do I need an appointment?',
                    ru: 'Нужно ли записываться?',
                },
                a: {
                    pl: 'Tak, telefonicznie.',
                    uk: 'Так, телефоном.',
                    en: 'Yes, by phone.',
                    ru: 'Да, по телефону.',
                },
            },
        ],
        ...overrides,
    };
}
