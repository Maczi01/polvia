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
