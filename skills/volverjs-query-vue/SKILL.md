---
name: volverjs-query-vue
description: >-
  Build Vue 3 data-fetching and mutation logic with the @volverjs/query-vue
  library (a Pinia store built on the repository pattern with caching, a
  normalized item cache, and query tracking). Use this skill whenever the user
  works with @volverjs/query-vue or mentions defineStoreRepository, a "store
  repository", or the read()/submit()/remove() composable actions, or the
  ReadProvider/SubmitProvider/RemoveProvider components — and also when they ask
  to fetch/create/update/delete data in Vue through a @volverjs/data Repository
  or RepositoryHttp wired into Pinia, even if they don't name the library
  explicitly. Covers store scaffolding, the three actions and their options
  (autoExecute, group, directory, executeWhen, persistence, keepAlive…), the
  provider components, and caching/error-handling best practices.
---

# @volverjs/query-vue

`@volverjs/query-vue` turns a [`@volverjs/data`](https://github.com/volverjs/data)
repository into a Pinia store with **query tracking**, **request caching**, and a
**normalized item cache**. It is conceptually close to TanStack Query, but built
around the repository pattern and Pinia.

You help users wire up a store and write correct, idiomatic code that uses it.
Read the relevant `references/*.md` file before writing non-trivial code for an
action — they hold the full option lists and patterns, and this main file stays
deliberately short so it loads fast.

## When this applies

- Setting up a store with `defineStoreRepository()`.
- Reading, creating/updating, or deleting data via `read()`, `submit()`, `remove()`.
- Using `ReadProvider` / `SubmitProvider` / `RemoveProvider` in templates.
- Reasoning about caching, persistence, the item cache, error handling, or cleanup.

Default stack for examples: **Vue 3 SFC + `<script setup lang="ts">` + Pinia +
`RepositoryHttp`**. Adapt if the user is on JS or a different `@volverjs/data` repository.

## Mental model (read this first)

Four concepts explain almost every behavior. Keep them straight and the API is predictable:

- **Query** — a single, named tracked request returned by an action (`read`/`submit`/`remove`).
  Its reactive `data`, `isLoading`, `isError`, etc. are what your component renders. If you
  don't pass a `name`, one is generated, so each call is independent.
- **Hash** — a cache entry keyed by a hash of the request parameters. Two reads with the same
  params share a hash (and its cached result). This is what makes caching and request
  de-duplication work.
- **Item** — the *normalized entity cache*. On success, every returned item is stored keyed by
  its `keyProperty` (default `'id'`). `getItemByKey` / `getItemsByKeys` read from here, so an
  entity fetched by one query is instantly available to another.
- **Persistence** — a hash's time-to-live (default 1 hour). Within the window, a `read()` for the
  same params returns the cached result without refetching (unless you force it).

`cleanUp()` runs automatically on idle and removes disabled queries, orphaned hashes, and items
no longer referenced by any hash, so the store stays bounded.

## Install

```bash
pnpm add @volverjs/query-vue @volverjs/data pinia vue
```

`@volverjs/data`, `pinia`, and `vue` are peer dependencies. Pinia must be
[installed in the app](https://pinia.vuejs.org/getting-started.html) before any store is used.

## Quick start — define a store

A store is a composable created once (usually in its own file) and reused across components.
See `references/store-setup.md` for every store option (`keyProperty`, `defaultPersistence`,
`defaultParameters`, `cleanUpEvery`, …) and custom-key strategies.

```ts
// stores/users.ts
import { HttpClient, RepositoryHttp } from '@volverjs/data'
import { defineStoreRepository } from '@volverjs/query-vue'

export type User = { id?: number, username: string }

const httpClient = new HttpClient({ prefixUrl: 'https://my-domain.com' })
// ':id?' is an optional path segment; other params become query string
const usersRepository = new RepositoryHttp<User>(httpClient, 'users/:id?')

export const useUsersStore = defineStoreRepository(usersRepository, 'users')
```

In a component, call the composable to get actions, getters, state, and provider components:

```ts
const {
    read, submit, remove,                       // actions
    getItemByKey, getItemsByKeys, getQueryByName, // getters
    ReadProvider, SubmitProvider, RemoveProvider, // components
    cleanUp, resetQuery,
    queries, items, hashes,                       // reactive state (Maps)
} = useUsersStore()
```

## The three actions

Each action returns reactive refs you bind directly in the template. Full option lists, return
shapes, and patterns live in the reference files — open the one you need:

- **`read(params?, options?)`** → `references/read.md`. GET-style fetching with caching,
  `autoExecute` on reactive params, `executeWhen`/`resetWhen` gating, `group` (infinite scroll),
  and `directory` (list mode). Returns `{ data, item, isLoading, isError, isSuccess, error, errors, metadata, query, status, execute, reset, stop, cleanup, ignoreUpdates }`.
- **`submit(payload, params?, options?)`** → `references/submit.md`. Create (POST) or update (PUT),
  auto-inferred from whether the payload carries a `keyProperty`, or forced with `action`.
  Two-way payload sync (great with `v-model`). Returns the same shape as `read` plus the synced payload.
- **`remove(params?, options?)`** → `references/remove.md`. DELETE; evicts matching items from the
  cache on success. Executes immediately by default.

Minimal read example:

```vue
<script setup lang="ts">
import { useUsersStore } from '@/stores/users'

const { read } = useUsersStore()
const { data, isLoading, isError } = read() // GET /users
</script>

<template>
  <p v-if="isLoading">Loading…</p>
  <p v-else-if="isError">Something went wrong 😭</p>
  <ul v-else>
    <li v-for="user in data" :key="user.id">{{ user.username }}</li>
  </ul>
</template>
```

## Provider components

Providers expose an action's reactive result through a scoped slot — handy when you'd otherwise
lift state or prop-drill. They accept `params` and `options` props; `SubmitProvider` also takes a
`v-model` for the payload. Detailed prop/slot tables are in each action's reference file.

Important default: **`ReadProvider` runs immediately, but `SubmitProvider` and `RemoveProvider`
do not** (their default `options` set `immediate: false`) — you trigger them via the slot's
`execute()`.

```vue
<template>
  <ReadProvider v-slot="{ isLoading, isError, data }" :params="{ active: true }">
    <p v-if="isLoading">Loading…</p>
    <ul v-else-if="!isError">
      <li v-for="user in data" :key="user.id">{{ user.username }}</li>
    </ul>
  </ReadProvider>
</template>
```

## Best practices & gotchas

- **`keyProperty` is required in responses.** A non-`directory` `read()` and every `submit()`
  expect each returned item to carry the key (default `'id'`); otherwise the query goes to
  `error`. Use `directory: true` for lists of keyless rows, or set a custom `keyProperty` at
  store creation (see `references/store-setup.md`).
- **Don't destructure away reactivity in templates.** The returned `data`, `isLoading`, … are
  refs/computeds — keep them as refs and let the template unwrap them. (Pinia `state` like
  `items`/`queries` is already unwrapped to the underlying `Map`.)
- **Caching is by params hash + persistence.** Re-reading the same params within the persistence
  window won't refetch. Force a network call with `execute(true)`; bypass caching with
  `persistence: 0`.
- **Prefer `isLoading`/`isSuccess`/`status` over inspecting `data`** to detect state. `data` is
  always an array (empty when there's nothing), so `data.length === 0` is "empty", not "not loaded".
- **Error handling.** `RepositoryHttp` (via `ky`) rejects on non-2xx; the action catches it and
  sets `isError`/`error`/`errors`. Render from those refs.
- **Cleanup & `keepAlive`.** On unmount an action's query is disabled and eventually cleaned up.
  Pass `keepAlive: true` to keep a query (and its cache) alive across unmounts — useful for data
  shared between routes. Disable the idle cleanup entirely with `cleanUpEvery: 0` (or `false`).
- **`autoExecute` is debounced.** It re-runs on reactive `params`/`payload` changes;
  `defaultDebounce` (store) or `autoExecuteDebounce` (per call) controls the delay (default `0`).
- **One store per resource, created once.** Reusing the same store `name` across modules returns
  the same Pinia store instance — intentional for sharing, a footgun if accidental.

## Reference files

- `references/store-setup.md` — `defineStoreRepository`, all store options, custom `keyProperty`,
  repository setup, getters (`getItemByKey`, `getItemsByKeys`, `getQueryByName`), `resetQuery`/`cleanUp`.
- `references/read.md` — `read()` options, return values, caching, `autoExecute`, `executeWhen`,
  `resetWhen`, `group`, `directory`, `ReadProvider`.
- `references/submit.md` — `submit()` create vs update, `action` override, payload sync /
  `disablePayloadSync`, arrays, `SubmitProvider` with `v-model`.
- `references/remove.md` — `remove()` options, item eviction, `RemoveProvider`.
