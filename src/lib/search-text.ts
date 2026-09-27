/**
 * Male litery bez polskich znakow — uzytkownik pisze raz "ksiegowa", raz "księgowa",
 * a dane sa niespojne w obie strony. `ł` nie rozklada sie w NFD, stad osobna zamiana.
 *
 * Stosuj po OBU stronach porownania (zapytanie i przeszukiwany tekst).
 * NIE dodawac tu `import 'server-only'` — funkcje wola Client Components.
 */
export function foldForSearch(text: string): string {
    return text.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/ł/g, 'l');
}
