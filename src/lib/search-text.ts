/**
 * Male litery bez polskich znakow — uzytkownik pisze raz "ksiegowa", raz "księgowa",
 * a dane sa niespojne w obie strony. `ł` nie rozklada sie w NFD, stad osobna zamiana.
 *
 * Cyrylica (opisy i tagi ru/uk) przechodzi przez to samo zdejmowanie celowo, NIE jest
 * ograniczone do alfabetu lacinskiego: NFD rozklada "й" na "и" + znak laczacy, a "ї" i
 * "ё" na "і"/"е" + znak laczacy, wiec po zlozeniu й≡и, ї≡і, ё≡е. Skladanie obu stron
 * sprawia, ze dokladne zapytanie dalej trafia, a dochodza trafienia pozadane: "ё" w
 * rosyjskim zwykle pisze sie jako "е", a "Киів"/"Украіна" to czeste formy bez "ї".
 * Koszt (np. "мой" trafia tez w "мои") przy szukaniu podciagow jest pomijalny.
 * Ograniczenie do lacinki przywrociloby ten sam bug co z polskimi znakami, tylko dla "ё".
 *
 * Stosuj po OBU stronach porownania (zapytanie i przeszukiwany tekst).
 * NIE dodawac tu `import 'server-only'` — funkcje wola Client Components.
 */
export function foldForSearch(text: string): string {
    return text.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/ł/g, 'l');
}
