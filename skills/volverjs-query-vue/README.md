# Volver Query Skill for Claude Code

Agent skill that helps Claude Code build Vue 3 data-fetching and mutation logic with [@volverjs/query-vue](https://github.com/volverjs/query-vue), a Pinia store built on the repository pattern with request caching, a normalized item cache, and query tracking.

## Installation

```bash
npx skills add volverjs/query-vue
```

This adds the skill to your Claude Code configuration.

## What This Skill Covers

The skill is specialized for real `@volverjs/query-vue` implementation patterns:

- **Store scaffolding**: `defineStoreRepository()` over a `@volverjs/data` `Repository`/`RepositoryHttp`, with all store options (`keyProperty`, `defaultPersistence`, `defaultParameters`, `cleanUpEvery`, custom-key strategies).
- **The three actions**: `read()` (GET-style fetching), `submit()` (create/update, auto-inferred POST/PUT), and `remove()` (DELETE with cache eviction), plus their options (`autoExecute`, `group`, `directory`, `executeWhen`/`resetWhen`, `persistence`, `keepAlive`…).
- **Provider components**: `ReadProvider`, `SubmitProvider`, and `RemoveProvider`, including scoped-slot usage and `v-model` payload sync.
- **The cache model**: query tracking, params-hash request caching, the normalized item cache (`getItemByKey`, `getItemsByKeys`), and persistence windows.
- **Lifecycle**: automatic idle `cleanUp()`, `keepAlive`, query reset, and unmount cleanup.
- **Best practices**: error handling, reactivity preservation in templates, and avoiding common footguns.

## Usage

Once installed, Claude Code should automatically use this skill when you ask to:

- Set up a store with `defineStoreRepository`.
- Fetch, create, update, or delete data via `read()` / `submit()` / `remove()`.
- Wire `ReadProvider` / `SubmitProvider` / `RemoveProvider` into templates.
- Reason about caching, persistence, the item cache, or cleanup.

### Example Prompts

```text
Wire up a store repository for "users" with defineStoreRepository and RepositoryHttp, then list them in a component using read().
```

```text
Build a form that creates and updates a product with submit() and v-model payload sync via SubmitProvider.
```

```text
Set up an infinite-scroll list using read() with the `group` option.
```

```text
Fetch a directory-mode list of keyless rows and explain why keyProperty isn't required there.
```

```text
Add delete-with-confirmation using remove() and RemoveProvider, evicting the item from the cache on success.
```

## Source of Truth

When coding, verify implementation details directly from the library source:

- `src/index.ts` — `defineStoreRepository`, the `read`/`submit`/`remove` actions, getters, and provider components.
- `src/types.ts` — store, action, and option type definitions.
- `src/utilities.ts` — hashing, normalization, and cleanup helpers.
- `src/constants.ts` — default values (persistence, debounce, cleanup interval).

## Documentation

- [Volver Query Repository](https://github.com/volverjs/query-vue)
- [Skill Specification](./SKILL.md)
- [@volverjs/data](https://github.com/volverjs/data) — the underlying repository library

## License

MIT
