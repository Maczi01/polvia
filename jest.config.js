const nextJest = require('next/jest');

const createJestConfig = nextJest({
    dir: './',
});

const customJestConfig = {
    testEnvironment: 'jest-environment-jsdom',
    setupFilesAfterEnv: ['<rootDir>/jest.setup.js', '<rootDir>/setupAfterEnv.ts'],
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        // lucide-react wskazuje ESM dla warunku `browser`, ktory wybiera jsdom,
        // a next/jest wyklucza node_modules z transformacji (i nadpisuje
        // transformIgnorePatterns z tego pliku). Kierujemy Jesta na build CJS
        // samej biblioteki — ikony renderuja sie normalnie, bez stubowania.
        '^lucide-react$': '<rootDir>/node_modules/lucide-react/dist/cjs/lucide-react.js',
        // supercluster publikuje tylko ESM (`index.js`); build UMD z `dist/` ma
        // wbudowany kdbush, wiec testy klastrowania ida na prawdziwej bibliotece.
        '^supercluster$': '<rootDir>/node_modules/supercluster/dist/supercluster.js',
        // Build App Routera podmienia next/dynamic na app-dynamic (React.lazy) —
        // patrz createAppRouterApiAliases w next/dist/build/create-compiler-aliases.js.
        // Bez tego Jest bierze loader Pages Routera, ktory wiaze ref z `{ retry }`
        // zamiast z komponentem, np. mapRef.current.getMap przestaje istniec.
        '^next/dynamic$': '<rootDir>/node_modules/next/dist/shared/lib/app-dynamic.js',
        // nuqs pod warunkiem `require` wskazuje na zaslepke rzucajaca "ESM only";
        // kierujemy na jego pliki ESM, ktore transpiluje wyjatek z ESM_ONLY_PACKAGES.
        '^nuqs$': '<rootDir>/node_modules/nuqs/dist/index.js',
        '^nuqs/adapters/testing$': '<rootDir>/node_modules/nuqs/dist/adapters/testing.js',
    },
};

// Paczki bez zadnego buildu CJS (moduleNameMapper nie ma na co wskazac).
// next/jest nadpisuje transformIgnorePatterns z customJestConfig, wiec wyjatki
// doklejamy dopiero do konfiguracji, ktora on wyliczyl — SWC transpiluje je do CJS.
const ESM_ONLY_PACKAGES = ['next-intl', 'use-intl', 'nuqs', 'use-supercluster'];

module.exports = async function jestConfig() {
    const config = await createJestConfig(customJestConfig)();
    const esmOnly = ESM_ONLY_PACKAGES.join('|');
    return {
        ...config,
        transformIgnorePatterns: config.transformIgnorePatterns.map(pattern =>
            pattern.replace('(?!(geist)', `(?!(geist|${esmOnly})`),
        ),
    };
};
