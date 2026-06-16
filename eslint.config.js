import antfu from '@antfu/eslint-config'

export default antfu({
    type: 'lib',
    typescript: {
        overrides: {
            'ts/explicit-function-return-type': 'off',
            'ts/consistent-type-definitions': 'off',
        },
    },
    vue: true,
    node: true,
    yaml: false,
    stylistic: {
        indent: 4,
        quotes: 'single',
        semi: false,
    },
    rules: {
        'style/no-tabs': 'off',
        'style/no-mixed-spaces-and-tabs': ['error', 'smart-tabs'],
        'sort-imports': 'off',
    },
}, {
    // `skills` and `.claude-plugin` ship the agent skill / Claude Code plugin:
    // docs and manifests for end users, not library source, so the library's
    // own style rules (4-space indent, etc.) should not apply to them.
    ignores: ['.vscode', 'dist', 'node_modules', 'skills', '.claude-plugin'],
})
