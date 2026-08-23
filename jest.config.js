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
    },
};

module.exports = createJestConfig(customJestConfig);
