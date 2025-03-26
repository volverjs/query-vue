import path from 'node:path'
import ESLint from '@nabla/vite-plugin-eslint'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

// https://vitejs.dev/config/
export default defineConfig({
    build: {
        lib: {
            name: '@volverjs/query-vue',
            entry: path.resolve(__dirname, 'src/index.ts'),
            fileName: format => `index.${format}.js`,
        },
        rollupOptions: {
            external: [
                'vue',
                'pinia',
                '@vueuse/core',
                /^@volverjs(?:\/.+)?$/,
            ],
            output: {
                exports: 'named',
                globals: {
                    'vue': 'Vue',
                    'pinia': 'pinia',
                    '@vueuse/core': 'VueUseCore',
                    '@volverjs/data/hash': 'VolverDataHash',
                },
            },
        },
    },
    plugins: [
        // https://github.com/vitejs/vite-plugin-vue
        vue({
            include: [/\.vue$/],
        }),

        // https://github.com/gxmari007/vite-plugin-eslint
        ESLint(),

        // https://github.com/qmhc/vite-plugin-dts
        dts({
            insertTypesEntry: true,
            exclude: ['**/test/**'],
        }),
    ],
})
