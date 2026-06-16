import { copyFileSync, existsSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import ESLint from '@nabla/vite-plugin-eslint'
import vue from '@vitejs/plugin-vue'
import dts from 'unplugin-dts/vite'
import { defineConfig } from 'vite'

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

        // https://github.com/qmhc/unplugin-dts
        dts({
            exclude: ['**/test/**'],
            processor: 'vue',
            compilerOptions: {
                rootDir: path.resolve(__dirname, 'src'),
            },
            // Manually copy types after build since unplugin-dts bug with only types export
            afterBuild: (emittedFiles) => {
                // copy src/types.ts to dist/types.d.ts
                const srcTypesPath = path.resolve(__dirname, 'src/types.ts')
                const distTypesPath = path.resolve(__dirname, 'dist/types.d.ts')
                if (existsSync(srcTypesPath)) {
                    copyFileSync(srcTypesPath, distTypesPath)
                }
                // unplugin-dts emits a non-portable relative import for
                // `@vue/shared` (e.g. `../node_modules/@vue/shared`). Rewrite it
                // to a bare specifier so the published types resolve for
                // consumers (it is provided transitively by the `vue` peer dep).
                for (const [filePath, content] of emittedFiles) {
                    if (!filePath.endsWith('.d.ts')) {
                        continue
                    }
                    const rewritten = content.replace(
                        /(['"])(?:\.\.\/)*node_modules\/@vue\/shared\1/g,
                        '$1@vue/shared$1',
                    )
                    if (rewritten !== content) {
                        writeFileSync(filePath, rewritten)
                    }
                }
            },
        }),
    ],
})
