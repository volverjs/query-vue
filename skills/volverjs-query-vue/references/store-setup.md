# Store setup

`defineStoreRepository(repository, name, options?)` creates a Pinia store composable from a
`@volverjs/data` repository. Call it once per resource (typically in its own module) and import
the returned composable wherever you need it.

```ts
function defineStoreRepository<TRequest, TResponse = TRequest>(
  repository: Repository<TRequest, TResponse> | RepositoryHttp<TRequest, TResponse>,
  name: string,
  options?: StoreRepositoryOptions<TResponse>,
): /* a Pinia store definition */
```

- `TRequest` is the shape you send; `TResponse` defaults to `TRequest` and is the shape you read
  back. Use two type params when request and response differ (e.g. a create DTO vs. the stored entity).
- `name` is the Pinia store id. **Reusing the same `name` returns the same store instance** — great
  for sharing data, a bug if accidental.

## Repository

Any `@volverjs/data` repository works; `RepositoryHttp` is the common one.

```ts
import { HttpClient, RepositoryHttp } from '@volverjs/data'

const httpClient = new HttpClient({ prefixUrl: 'https://my-domain.com' })

// The template maps params to the URL. `:id?` is an optional path segment;
// any param not consumed by the template is appended as a query-string value.
const usersRepository = new RepositoryHttp<User>(httpClient, 'users/:id?')
// read({ id: 1 })            -> GET   /users/1
// read({ active: true })     -> GET   /users?active=true
// read({ id: 1, lang: 'en' }) -> GET  /users/1?lang=en
```

Per-action `repositoryOptions` are passed straight through to the repository method (headers,
signal, etc.), so you rarely need to touch the repository after creation.

## Store options

All optional. Defaults shown.

```ts
export const useUsersStore = defineStoreRepository(usersRepository, 'users', {
  /*
   * How to uniquely identify an item. Drives the normalized item cache and the
   * key-property validation on responses. Default: 'id'.
   * Three forms:
   *   keyProperty: 'uuid'                                   // a key of the item
   *   keyProperty: item => item.uuid                        // a getter function
   *   keyProperty: { name: 'uuid', get: item => item.uuid } // named getter (best for fn-based keys)
   */
  keyProperty: 'id',

  /* Default cache TTL (ms) for every query. Override per read() with `persistence`. Default 1h. */
  defaultPersistence: 60 * 60 * 1000,

  /* Default debounce (ms) for autoExecute. Override per action with `autoExecuteDebounce`. Default 0. */
  defaultDebounce: 0,

  /* Params merged into every request. Default {}. */
  defaultParameters: {},

  /* Hash function for request params. Default Hash.cyrb53 from @volverjs/data. */
  hashFunction: undefined,

  /*
   * Idle interval (ms) for the automatic store clean up.
   * Pass 0 or false to disable it entirely. Default 3000.
   */
  cleanUpEvery: 3 * 1000,
})
```

### Choosing a `keyProperty`

- Prefer the simple string form (`'id'`, `'uuid'`) — it's used both to read the key and (for the
  object/string forms) to know which param name carries the key during `submit`/`remove`.
- The bare function form (`item => item.uuid`) can read the key but has no name, so internally the
  param name falls back to `'id'`. If your key field isn't `id`, use the **named** object form
  `{ name: 'uuid', get: item => item.uuid }` so submit/remove target the right param.

## What the composable returns

```ts
const store = useUsersStore()
```

**Actions** (see the per-action references):
- `read(params?, options?)`
- `submit(payload, params?, options?)`
- `remove(params?, options?)`

**Getters** (all return reactive `computed`s, so use them in templates / watchers):
- `getItemByKey(key)` — one item from the normalized cache. `key` may be a ref.
  ```ts
  const selectedId = ref(1)
  const user = getItemByKey(selectedId) // recomputes when selectedId changes
  ```
- `getItemsByKeys(keys)` — array of items for the given keys (missing keys are skipped). `keys`
  may be a ref to an array.
- `getQueryByName(name)` — the tracked query object for a named query, or `undefined`.

**State** (Pinia state, already unwrapped to plain reactive `Map`s — no `.value`):
- `items` — `Map<key, TResponse>`, the normalized cache.
- `queries` — `Map<name, query>`.
- `hashes` — `Map<hashKey, hash>`.

**Maintenance:**
- `resetQuery(name)` — clears a named query's results (and triggers a cleanup). Items only
  referenced by that query are evicted.
- `cleanUp()` — manually run the cleanup that otherwise fires on idle: drop disabled queries,
  orphaned hashes, and items no longer referenced by any hash.

**Provider components:** `ReadProvider`, `SubmitProvider`, `RemoveProvider` (see per-action references).

## Naming queries

Pass `name` in an action's options to address a query later with `getQueryByName(name)` or
`resetQuery(name)`. Without a name, each action call gets a fresh random name and is fully
independent — so two un-named `submit()`s in the same tick won't clobber each other.
