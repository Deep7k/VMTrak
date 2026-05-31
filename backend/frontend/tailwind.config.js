export default {
    content: [
        './index.html',
        './src/**/*.{js,jsx}',
    ],
    theme: {
        extend: {
            fontFamily: {
                mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
            },
            colors: {
                slate: {
                    50: '#f9fafb',
                    100: '#f3f4f6',
                    800: '#1f2937',
                    900: '#111827',
                    950: '#030712',
                },
            },
        },
    },
    plugins: [],
};
