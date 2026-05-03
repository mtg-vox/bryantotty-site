/** @type {import('tailwindcss').Config} */
export default {
    content: [
        './*.html',
        './projects/**/*.html',
        './blog/**/*.html',
        './main.js',
    ],
    theme: {
        extend: {
            colors: {
                // Site-wide brand palette
                dark: '#050505',
                accent: '#e2e8f0',
                glow: '#c8102e',
                'glow-dim': '#8b0000',
                // Used by projects/artist-growth-os.html
                good: '#22c55e',
                kill: '#ef4444',
                warn: '#eab308',
                // Used by projects/ibm-pureflex.html
                ibm: {
                    blue: '#1F70C1',
                    deep: '#0530AD',
                    green: '#22c55e',
                },
                // Used by projects/shadowscan-ai.html
                cyber: '#3b82f6',
                cyberDeep: '#1d3bb8',
            },
        },
    },
    plugins: [],
};
