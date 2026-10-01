# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.1.1] - 2026-10-01

### Changed

- A `read()` that moves to params already cached or already loading now aborts its own previous request too, as it does when it sends a new one (unless another query still waits on that request);
- the hash of a `submit()` or `remove()` in flight now holds the `promise` of its request, as the one of a `read()` does.

### Fix

- Re-executing a query with other params could abort the request of another query with the same params: that query lost its result and stayed `idle`, with no data and no error. A query now aborts only its own previous request;
- a `read()` that joins a request in flight with the same params now keeps it running when the query that sent it moves on, and gets its data: the request is aborted only when no query waits on it any more. A joining `read()` cleaned up meanwhile (for example by a component unmount) is no longer enabled again when the request ends, which kept its query in the store for ever. While it waits, the joining `read()` now shows the request as loading instead of `idle`, and if it moves to other params meanwhile it no longer switches back to the old ones when that request ends;
- two `read()` calls sharing a `name` now follow the params of the last execution, instead of switching back to the params of a request that ends later;
- with a `persistence` shorter than a request, a `read()` that sends the same request again now releases the older one, a `read()` that joins the newer one is no longer aborted by the query that sent it, and the hash no longer stays `loading` for ever when such requests overlap;
- an aborted request no longer resets to `idle` the result of another query with the same params, also with a repository whose requests have no `abort`.

## [2.1.0] - 2026-09-30

### Added

- `read()`, `submit()` and `remove()` now return an awaitable object (a `PromiseLike`, like VueUse's `useFetch`): awaiting it waits for the execution started by the call and resolves to the same plain snapshot `execute()` resolves to (`isSuccess`, `isError`, `error`, `aborted`, ...). `const { isSuccess } = await remove({ id })` now does what it reads: before, `await` returned the object at once, before the request ended, and `isSuccess` was a `ComputedRef`, always truthy, so the success branch also ran on failed requests;
- awaiting never rejects (a failure resolves with `isError: true`, an aborted request with `aborted: true`), settles on the execution started by the call only (the first one with `autoExecute`), resolves at once to the current snapshot when the call starts no execution (`immediate: false`, or `executeWhen` false) and never starts a request itself, so `Promise.resolve()` or a `return` from an async function cannot run the action twice;
- the reactive fields and `execute()` are unchanged, and the provider components' template refs are not thenable.

### Changed

- Code that awaited an action, or returned it from an async function, and then used its refs now gets plain values: `const { data } = await read()` followed by `data.value` is now a type error, and the same destructuring after a top-level `await` in `<script setup>` renders once and no longer updates. Drop the `await`, or keep the returned object and await it on its own (`const users = read(); await users`);
- actions are cleaned up when the effect scope that created them is disposed, instead of on component unmount only: components behave as before, and `effectScope()` and Pinia setup stores are now covered too;
- dependencies update: minor/patch updates to `@types/node`, `eslint`, `unplugin-dts`, `vite` and `vitest`; `packageManager` bumped to `pnpm@12.8.1`.

### Fix

- An action created outside any effect scope (an event handler, a plain async function) was never cleaned up, so its query, hash and items stayed in the store for ever: awaiting it now releases its query once the awaited execution settles, unless `keepAlive` is `true`;
- a request that could not be built (for example a `RepositoryHttp` template with a missing path parameter) made `execute()` reject, with an unhandled rejection on the immediate execution, and left the query idle; the query now gets the error and `execute()` resolves with `isError: true`;
- a `read()` joining an in-flight request with the same params rejected, with an unhandled rejection, when that request failed, and its query never showed the error; it now joins the query and resolves with the error state, keeps the shared error, and resolves with `aborted: true` when the shared request is aborted.

## [2.0.8] - 2026-09-17

### Changed

- Dependencies update: `@vueuse/core` `^14.3.0` -> `^15.0.0` and `vitest` `^4.1.10` -> `^5.0.1` (major bumps), plus minor/patch updates to `@antfu/eslint-config`, `@types/node`, `@vitejs/plugin-vue`, `@vue/language-core`, `@vue/shared`, `@vue/test-utils`, `eslint`, `happy-dom`, `pinia`, `unplugin-dts`, `vite`, `vue` and `vue-tsc`; `packageManager` bumped to `pnpm@12.4.2`;
- `@vueuse/core` peer dependency range widened to `^14.3.0 || ^15.0.0`, so consumers can stay on v14 or move to v15;
- peer dependency ranges normalized from the redundant `^x.y.x` form to plain `^x.y.z` (same resolved intervals).

## [2.0.7] - 2026-07-20

### Changed

- Dependencies update: `pinia` `^3.0.4` -> `^4.0.2` and `@pinia/testing` `^1.0.3` -> `^2.0.1` (major bumps), plus minor/patch updates to `@antfu/eslint-config`, `@types/node`, `@vitejs/plugin-vue`, `@vue/language-core`, `@vue/shared`, `eslint`, `happy-dom`, `vite`, `vitest`, `vue` and `vue-tsc`; `packageManager` bumped to `pnpm@11.15.1`.

## [2.0.6] - 2026-06-16

### Added

- `keepAlive` option for the `remove()` action, consistent with `read()` and `submit()`;
- `volverjs-query-vue` Claude Code plugin / agent skill (under `skills/`) that teaches AI coding agents how to use the library; installable with `/plugin marketplace add volverjs/query-vue`.

### Changed

- `submit()` `action` option is now restricted to `'create' | 'update'` (the only meaningful write operations);
- `submit().data` and the `remove()` action `errors` are now always arrays (empty instead of `undefined`), consistent with `read()`.

### Fix

- Portable type declarations: the emitted `.d.ts` referenced `@vue/shared` through a non-portable `.pnpm/…` path (TS2883), which broke type-checking for consumers; it now emits a bare `@vue/shared` specifier;
- `submit()` derived query names from `Date.now()`, so two submissions in the same millisecond could collide and overwrite each other's state; query names are now random;
- `submit()` could throw and flip to an error state on an empty response because `clone()` failed on `undefined`; `clone()` now returns `undefined`/`null` untouched;
- `cleanUpEvery` could not be disabled because of the default fallback; passing `0` or `false` now disables the automatic idle clean up;
- `cleanUp()` never evicted items from the normalized cache, so it could grow unbounded; items no longer referenced by any hash are now removed.

## [2.0.5] - 2026-03-26

### Fix

- `unplugin-dts` was generating `.d.ts` files in `dist/src/` instead of `dist/`; fixed by passing `compilerOptions: { rootDir: 'src' }` to the plugin in `vite.config.ts` and updated all type paths in `package.json` accordingly (`exports`, `types`, `typesVersions`, `afterBuild` hook).

## [2.0.4] - 2026-03-25

### Fix

- `dist/src/types.d.ts` was not generated by `unplugin-dts` when the source file only contains `export type` declarations; added an `afterBuild` hook in `vite.config.ts` that copies `src/types.ts` to `dist/src/types.d.ts` as a workaround.

## [2.0.3] - 2026-03-25

### Fix

- `dist/index.d.ts` was empty after upgrading to `unplugin-dts` v4; removed obsolete `insertTypesEntry` option and updated `package.json` types entry to `dist/src/index.d.ts`.

## [2.0.2] - 2026-03-25

### Added

- `status` computed ref exposed from `read()`, `submit()` and `remove()` actions;
- `errors` array exposed from `read()`, `submit()` and `remove()` actions;
- `ReadProvider`, `SubmitProvider` and `RemoveProvider` now expose all properties returned by their respective actions in the default slot.

### Changed

- Minimum Node.js version bumped to `>= 19.x` (global `crypto.getRandomValues` is available natively).

### Fix

- Abort of in-flight requests was broken when `persistence` was set to `0`; the abort logic now bypasses the persistence check when looking up the previous hash.

## [2.0.1] - 2025-09-16

### Added
- `keyProperty` option now can be also a function or an object with `name` and `get` properties; 

## [2.0.0] - 2025-03-26

### Changed

- `@volverjs/data@2.x.x` support;
- Hash `method` is now `action`;
- `cleanHashes` is now `cleanUp`.

### Added

- `repositoryOptions` for all methods;
- `repositoryOptions` as last parameter of all `execute()` functions;
- `submit()` support for multiple items;
- `reset()` method for `read()` action;
- `resetWhen` option for `read()` action;
- `resetQuery()` method.

## [1.0.3] - 2023-10-03

### Added

- `defaultParameters` on `StoreRepositoryOptions`

### Fix

- Status and method are properties of hash;
- `submit()` params clone;
- `submit()` action type check.

## [1.0.2] - 2023-05-15

### Fix

- Require `node:crypto` only in node environment.

## [1.0.1] - 2023-05-15

### Added

- `ReadProvider`, `SubmitProvider` and `RemoveProvider` components;
- `immediate` option to `remove()` action;
- Read `execute()` function can be forced with `force` option.

### Fix

- Read key check is not needed with directory structure;
- - All `execute()` functions return the same values;
- `isLoading` keep `true` on request update (abort and retry);
- An empty response is allowed in `read()` action.

## [1.0.0] - 2023-04-12

### Added

- Doc example with `useRepositoryHttp()`.

### Change

- Use new `@volverjs/data` version `1.0.0`.

## [0.0.3] - 2023-03-27

### Fix

- The `execute()` function has the same output in the `read` and `submit` actions.

## [0.0.2] - 2023-03-24

### Added

- `remove()` action and tests.

### Change

- `refetch()` to `execute()`.

### Fix

- `immediate` not use debounce timeout.

## 0.0.1 - 2023-03-21

### Added

- `defineStoreRepository` a function to create a store repository;
- `read` and `submit` actions;
- `getQueryByName` and `getItemByKey` getters.

[2.0.6]: https://github.com/volverjs/query-vue/compare/v2.0.5...v2.0.6
[2.0.5]: https://github.com/volverjs/query-vue/compare/v2.0.4...v2.0.5
[2.0.4]: https://github.com/volverjs/query-vue/compare/v2.0.3...v2.0.4
[2.0.3]: https://github.com/volverjs/query-vue/compare/v2.0.2...v2.0.3
[2.0.2]: https://github.com/volverjs/query-vue/compare/v2.0.1...v2.0.2
[2.0.1]: https://github.com/volverjs/query-vue/compare/v2.0.0...v2.0.1
[2.0.0]: https://github.com/volverjs/query-vue/compare/v1.0.3...v2.0.0
[1.0.3]: https://github.com/volverjs/query-vue/compare/v1.0.2...v1.0.3
[1.0.2]: https://github.com/volverjs/query-vue/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/volverjs/query-vue/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/volverjs/query-vue/compare/v0.0.3...v1.0.0
[0.0.3]: https://github.com/volverjs/query-vue/compare/v0.0.2...v0.0.3
[0.0.2]: https://github.com/volverjs/query-vue/compare/v0.0.1...v0.0.2
