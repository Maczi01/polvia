import '@testing-library/jest-dom/jest-globals';
import '@testing-library/jest-dom';
import 'jest-axe/extend-expect';

// jsdom nie implementuje ResizeObserver, a `virtua` (wirtualizowana lista wynikow)
// konstruuje go przy renderze kazdego elementu. Bez tego stuba kazdy test
// komponentu z VList wywala sie na "ResizeObserver is not a constructor".
if (!('ResizeObserver' in globalThis)) {
    class ResizeObserverStub implements ResizeObserver {
        observe(): void {}
        unobserve(): void {}
        disconnect(): void {}
    }

    globalThis.ResizeObserver = ResizeObserverStub;
}

// jsdom nie implementuje metod przewijania na elemencie (tylko na window). Pasek
// kategorii przewija aktywny kafel do widoku przy kazdej zmianie filtra, wiec bez
// tych stubow kazdy test montujacy pasek wywala sie na "scrollTo is not a function".
// Stub jest pusty celowo: testy sprawdzaja filtrowanie, a nie pozycje przewiniecia,
// ktorej jsdom i tak nie wylicza (wszystkie prostokaty maja zerowe wymiary).
// Straz na `Element`: czesc suit (np. route handlery) chodzi w srodowisku `node`,
// gdzie DOM-u nie ma wcale.
if (typeof Element !== 'undefined') {
    for (const method of ['scrollTo', 'scrollBy', 'scrollIntoView'] as const) {
        if (typeof Element.prototype[method] !== 'function') {
            Element.prototype[method] = function noop(): void {};
        }
    }
}
