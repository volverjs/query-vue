import { defineConfig } from 'vitest/config'
import Vue from '@vitejs/plugin-vue'
import ESLint from '@nabla/vite-plugin-eslint'
import dts from 'vite-plugin-dts'
import path from 'path'

// https://vitejs.dev/config/
export default () => {
	return defineConfig({
		test: {
			globals: true,
			environment: 'happy-dom',
		},
		build: {
			lib: {
				name: '@volverjs/query-vue',
				entry: path.resolve(__dirname, 'src/index.ts'),
				fileName: (format) => `index.${format}.js`,
			},
			rollupOptions: {
				external: [
					'vue',
					'pinia',
					'@vueuse/core',
					new RegExp(`^@volverjs(?:/.+)?$`),
				],
				output: {
					exports: 'named',
					globals: {
						vue: 'Vue',
						pinia: 'pinia',
						'@vueuse/core': 'VueUseCore',
						'@volverjs/data/hash': 'VolverDataHash',
					},
				},
			},
		},
		plugins: [
			// https://github.com/vitejs/vite-plugin-vue
			Vue({
				include: [/\.vue$/],
			}),

			// https://github.com/gxmari007/vite-plugin-eslint
			ESLint(),

			// https://github.com/qmhc/vite-plugin-dts
			dts({
				insertTypesEntry: true,
			}),
		],
	})
}
