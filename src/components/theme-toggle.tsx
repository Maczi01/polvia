'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';

const fadeInKeyframes = `
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
.animate-fadeIn {
  animation: fadeIn 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}

/* FIX: Composited animations using pseudo-elements */
.theme-button {
  position: relative;
  overflow: hidden;
}

.theme-button::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  border-radius: inherit;
  opacity: 0;
  transition: opacity 0.3s ease-in-out;
  pointer-events: none;
}

.theme-button.light::before {
  background-color: #1877F2;
}

.theme-button.dark::before {
  background-color: #1877F2;
}

.theme-button.active::before {
  opacity: 1;
}

.theme-button:hover::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  border-radius: inherit;
  background-color: rgba(0, 0, 0, 0.1);
  opacity: 1;
  transition: opacity 0.3s ease-in-out;
  pointer-events: none;
}

.theme-button.active:hover::after {
  display: none;
}
`;

export const ThemeToggle = () => {
    const [mounted, setMounted] = useState(false);
    const { theme, resolvedTheme, setTheme } = useTheme();

    useEffect(() => {
        setMounted(true);
    }, []);

    // Consistent container dimensions
    const containerClass = "flex items-center bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-full p-1 w-[76px] h-[36px] gap-1";

    if (!mounted) {
        return (
            <div className={containerClass}>
                <div className="size-8 animate-pulse rounded-full bg-gray-300 dark:bg-gray-600" />
                <div className="ml-1 size-8 animate-pulse rounded-full bg-gray-300 dark:bg-gray-600" />
            </div>
        );
    }

    const currentTheme = theme === "system" ? resolvedTheme : theme;

    return (
        <div className="animate-fadeIn">
            <style>{fadeInKeyframes}</style>
            {/* FIX: Removed transition-colors to avoid non-composited animations */}
            <div className={`${containerClass} will-change-[box-shadow] contain-layout hover:shadow-md`}>
                <button
                    onClick={() => setTheme('light')}
                    className={`theme-button light group ${currentTheme === 'light' ? 'active' : ''} 
                        relative z-10 flex size-8 items-center justify-center 
                        rounded-full will-change-[opacity]
                        ${currentTheme === 'light'
                        ? 'text-white shadow-lg'
                        : 'text-gray-600 dark:text-gray-400'
                    }`}
                    title="Light mode"
                    aria-label="Switch to light mode"
                >
                    <Sun
                        size={16}
                        className="relative z-20 transition-transform duration-300 group-hover:rotate-12 group-active:scale-90"
                    />
                </button>
                <button
                    onClick={() => setTheme('dark')}
                    className={`theme-button dark group ${currentTheme === 'dark' ? 'active' : ''} 
                        relative z-10 flex size-8 items-center justify-center 
                        rounded-full will-change-[opacity]
                        ${currentTheme === 'dark'
                        ? 'text-white shadow-lg'
                        : 'text-gray-600 dark:text-gray-400'
                    }`}
                    title="Dark mode"
                    aria-label="Switch to dark mode"
                >
                    <Moon
                        size={16}
                        className="relative z-20 transition-transform duration-300 group-hover:rotate-12 group-active:scale-90"
                    />
                </button>
            </div>
        </div>
    );
};