/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        './App.{js,jsx,ts,tsx}',
        './src/**/*.{js,jsx,ts,tsx}',
        '../../packages/ui/src/**/*.{js,jsx,ts,tsx}',
    ],
    darkMode: 'class',
    presets: [require('nativewind/preset')],
    theme: {
        extend: {
            // Keep the existing indigo utility names working while matching the web palette.
            colors: {
                indigo: {
                    50: '#fff8e1',
                    100: '#ffedb3',
                    200: '#ffe082',
                    300: '#ffd54f',
                    400: '#d79a00',
                    500: '#c58d00',
                    600: '#d79a00',
                    700: '#a87500',
                    800: '#806000',
                    900: '#664c00',
                    950: '#4d3800',
                },
                secondary: {
                    50: '#eff6ff',
                    100: '#dbeafe',
                    200: '#bfdbfe',
                    300: '#93c5fd',
                    400: '#5897d6',
                    500: '#5897d6',
                    600: '#5897d6',
                    700: '#3d78b5',
                    800: '#2c5d91',
                    900: '#21466e',
                    950: '#193552',
                },
            },
        },
    },
    plugins: [],
};
