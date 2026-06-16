# read()

`read(params?, options?)` fetches data (GET-style) with caching, query tracking, and the
normalized item cache. By default it executes immediately.

```ts
const result = read(params, options)
```

- `params` — a params map **or a `Ref` to one**. Passing a ref enables reactive patterns
  (`autoExecute`, `executeWhen`). Merged with the store's `defaultParameters`.

## Return value

All fields are reactive (`computed`/`ref`) — bind them directly; don't read `.value` in templates.

```ts
const {
  data,        // TResponse[] — always an array (empty when nothing)
  item,        // TResponse | undefined — data[0], convenient for single-record reads
  isLoading,   // boolean
  isSuccess,   // boolean
  isError,     // boolean
  error,       // Error | undefined — first error
  errors,      // Error[]
  metadata,    // ParamMap | undefined — repository-provided metadata (pagination, etc.)
  status,      // StoreRepositoryStatus: 'idle' | 'loading' | 'success' | 'error'
  query,        // the tracked query object

  execute,     // (newParamsOrForce?, newRepositoryOptionsOrForce?) => Promise<...>
  reset,       // () => void — reset this query
  stop,        // () => void — stop autoExecute watchers
  cleanup,     // () => void — disable the query (called automatically on unmount)
  ignoreUpdates, // (cb) => void — run cb without triggering autoExecute watchers
} = read(params, options)
```

### `execute()`

Re-run the query. Flexible signature:

```ts
execute()                          // re-run with current params (served from cache if fresh)
execute(true)                      // force a network call, ignoring the cache
execute({ id: 2 })                 // run with new params
execute({ id: 2 }, { signal })     // new params + per-call repositoryOptions
```

The first argument is either new params or a boolean "force"; the second is either
repositoryOptions or a boolean "force".

## Options

```ts
read(params, {
  /* Name the query so you can address it via getQueryByName/resetQuery. Default: generated. */
  name: undefined,

  /*
   * Accumulate results from every read() under this query instead of replacing them.
   * Use for infinite scroll / "load more": each page's items are appended to `data`.
   */
  group: false,

  /*
   * Directory mode: store the response as a standalone list on the query and DON'T normalize
   * items into the shared item cache. Use for keyless rows or lists you don't want to dedupe.
   * In directory mode the key-property validation is skipped.
   */
  directory: false,

  /* Keep the query (and its cache) alive when the component unmounts. Default false. */
  keepAlive: false,

  /* Execute as soon as read() is called. Default true. */
  immediate: true,

  /* Cache TTL (ms) for this query's hash. 0 disables caching. Default: store defaultPersistence. */
  persistence: 60 * 60 * 1000,

  /*
   * Gate execution. A reactive boolean ref OR a predicate over params.
   * The action only runs when this is truthy.
   *   executeWhen: computed(() => params.value.id !== undefined)
   *   executeWhen: (p) => p?.id !== undefined
   */
  executeWhen: undefined,

  /*
   * Reset the query when this becomes true. A boolean ref OR a predicate over (newParams, oldParams).
   *   resetWhen: (newP, oldP) => newP.id !== oldP?.id
   */
  resetWhen: undefined,

  /* Re-run automatically when reactive `params` change (requires a ref params). Debounced. */
  autoExecute: false,

  /* Debounce (ms) for autoExecute. Default: store defaultDebounce (0). */
  autoExecuteDebounce: 0,

  /* Re-run on window focus / document becoming visible. Default false. */
  autoExecuteOnWindowFocus: false,
  autoExecuteOnDocumentVisibility: false,

  /* Passed straight to the repository read method (headers, signal, ...). */
  repositoryOptions: undefined,
})
```

## Patterns

### Single record by id

```ts
const { item, isLoading } = read({ id: route.params.id })
// item is data[0]; render it directly
```

### Reactive params + autoExecute (refetch on change)

```ts
const params = ref({ id: '1' })
const { data, isLoading } = read(params, { autoExecute: true })
// later: params.value.id = '2'  -> refetches automatically (debounced)
```

### Gate until ready with `executeWhen`

```ts
const params = ref<{ id?: string }>({ id: undefined })
const { item } = read(params, {
  autoExecute: true,
  executeWhen: p => p?.id !== undefined, // skips the request until id is set
})
```

### Infinite scroll with `group`

```ts
const params = ref({ page: 1, limit: 20 })
const { data, isLoading } = read(params, { group: true, autoExecute: true })
function loadMore() { params.value.page++ } // appends the next page to `data`
```

### Force refresh / bypass cache

```ts
const { data, execute } = read({ active: true })
function refresh() { execute(true) }        // ignore the persistence window
// or read({ active: true }, { persistence: 0 }) to never cache
```

### Reading from the normalized cache elsewhere

Once any read has loaded an entity, other components can grab it without a request:

```ts
const { getItemByKey } = useUsersStore()
const user = getItemByKey(selectedId) // selectedId can be a ref
```

## ReadProvider

A component that runs `read()` and exposes the result through a scoped slot — useful instead of
lifting state. It **executes immediately** (unlike Submit/Remove providers).

Props:
- `params` — the params map.
- `options` — a `read()` options object.

The default slot receives the same fields `read()` returns (`isLoading`, `isError`, `data`,
`item`, `error`, `execute`, `reset`, …).

```vue
<template>
  <ReadProvider v-slot="{ isLoading, isError, data, error }" :params="{ active: true }">
    <p v-if="isLoading">Loading…</p>
    <p v-else-if="isError">{{ error?.message }}</p>
    <ul v-else>
      <li v-for="user in data" :key="user.id">{{ user.username }}</li>
    </ul>
  </ReadProvider>
</template>
```
