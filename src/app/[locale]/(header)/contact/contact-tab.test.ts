import { CONTACT_TAB_PARAM, QUESTION_TAB_VALUE, readContactTab } from './contact-tab';

function read(query: string): ReturnType<typeof readContactTab> {
    return readContactTab(new URLSearchParams(query));
}

describe('readContactTab', () => {
    it('bez query otwiera zakladke firmy', () => {
        expect(read('')).toBe('business');
    });

    it(`?${CONTACT_TAB_PARAM}=${QUESTION_TAB_VALUE} otwiera formularz`, () => {
        expect(read(`${CONTACT_TAB_PARAM}=${QUESTION_TAB_VALUE}`)).toBe('question');
    });

    it('zapytanie o premium (z profilu albo cennika) otwiera formularz', () => {
        expect(read('topic=premium&firma=kancelaria-nowak')).toBe('question');
        expect(read('topic=premium')).toBe('question');
    });

    it('nieznana wartosc zakladki wraca do zakladki firmy', () => {
        expect(read(`${CONTACT_TAB_PARAM}=cokolwiek`)).toBe('business');
    });
});
