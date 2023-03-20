import { defineConfig } from 'vitest/config'
import ESLint from 'vite-plugin-eslint'
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
				name: '@volverjs/store-repository-pinia',
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
					},
				},
			},
		},
		plugins: [ESLint()],
	})
}
