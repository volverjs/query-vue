import vue from '@vitejs/plugin-vue'
import { configDefaults, defineConfig } from 'vitest/config'

// https://vitejs.dev/config/
export default defineConfig({
    test: {
        globals: true,
        environment: 'happy-dom',
        exclude: configDefaults.exclude,
    },
    plugins: [
        // https://github.com/vitejs/vite-plugin-vue
        vue({
            include: [/\.vue$/],
        }),
    ],
})
