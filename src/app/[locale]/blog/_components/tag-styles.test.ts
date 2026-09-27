import { tagLink } from './tag-styles';

describe('tagLink', () => {
    it('dla pl wskazuje /blog bez prefiksu — /pl/blog odpowiada 307', () => {
        expect(tagLink('pl', 'Praca')).toBe('/blog?tag=Praca');
    });

    it('dla pozostalych locale zachowuje prefiks', () => {
        expect(tagLink('uk', 'Praca')).toBe('/uk/blog?tag=Praca');
    });

    it('koduje znaki specjalne i polskie litery w tagu', () => {
        expect(tagLink('pl', 'Urzędy & PESEL')).toBe('/blog?tag=Urz%C4%99dy%20%26%20PESEL');
    });
});
