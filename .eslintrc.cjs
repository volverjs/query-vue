module.exports = {
	env: {
		browser: true,
	},
	globals: {
		request: true,
	},
	parserOptions: {
		ecmaVersion: 'latest',
		sourceType: 'module',
	},
	extends: [
		'eslint:recommended',
		'plugin:@typescript-eslint/recommended',
		'plugin:vue/vue3-recommended',
		'@vue/typescript/recommended',
		'prettier',
	],
	rules: {
		'no-mixed-spaces-and-tabs': ['error', 'smart-tabs'],
		'no-unused-vars': 'off',
		'sort-imports': 'off',
	},
}
