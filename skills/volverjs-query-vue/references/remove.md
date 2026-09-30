# remove()

`remove(params?, options?)` deletes data (DELETE) and, on success, evicts the matching items from
the normalized cache by their key. Unlike `read`/`submit`, its API is intentionally smaller (no
`autoExecute`, no `executeWhen`).

```ts
const result = remove(params, options)
```

- `params`: params map (or ref) identifying what to delete. Merged with `defaultParameters`.
  The key param (e.g. `id`) determines which cached items are evicted; it may be a single value
  or an array.

## Return value

```ts
const {
  isLoading, isSuccess, isError,
  error,      // Error | undefined
  errors,     // Error[]
  status,     // 'idle' | 'loading' | 'success' | 'error'
  query,
  execute,    // (newParams?, newRepositoryOptions?) => Promise<...>
  cleanup,    // () => void
} = remove(params, options)
```

Note: `remove()` does not expose `data`/`item` (a delete has no entity to return).

### Awaiting (since 2.1.0)

The returned object is awaitable. `await remove(...)` waits for the DELETE the call started and
resolves to the plain snapshot `execute()` resolves to: booleans and values, not refs.

```ts
const { isSuccess, isError, error, errors, aborted, query, metadata } = await remove({ id: 1 })
```

- Never rejects: a failed DELETE (also one that cannot be built, e.g. a missing path param)
  resolves with `isError: true` and `error`; an aborted one (replaced by an `execute()` with other
  params) resolves with `aborted: true`.
- Settles on the call's own execution only; `await execute()` to wait for a later one.
- With `immediate: false` the call starts nothing, so awaiting resolves at once to the current
  snapshot (`isSuccess: false` until an execution succeeds) and sends no request.
- Awaiting never starts a request: `Promise.resolve()`, `Promise.all()` or returning the object
  from an async function do not delete twice.
- With no owning effect scope (an event handler), awaiting also releases the query once it
  settles, unless `keepAlive: true`.
- On 2.0.x the object is not awaitable: `await remove(...)` returns it before the DELETE ends and
  `isSuccess` is a `ComputedRef`, always truthy, so the success branch runs even on failure. There,
  use `remove(undefined, { immediate: false })` and `await execute({ id })`.

## Options

```ts
remove(params, {
  /* Name the query. Default: generated. */
  name: undefined,

  /* Keep the query alive across unmount (and, with no owner, after an awaited execution). Default false. */
  keepAlive: false,

  /* Execute immediately when remove() is called. Default true. */
  immediate: true,

  /* Passed straight to the repository remove method. */
  repositoryOptions: undefined,
})
```

## Patterns

### Delete immediately

```ts
const { remove } = useUsersStore()
const { isSuccess } = remove({ id: 1 }) // DELETE /users/1; item 1 leaves the cache on success
```

### Delete on demand (button handler)

```ts
const { remove } = useUsersStore()
const { execute, isLoading } = remove({ id: 1 }, { immediate: false })
// in template: <button :disabled="isLoading" @click="execute()">Delete</button>
```

### Delete and react to the outcome

```ts
const { remove } = useUsersStore()

async function deleteUser(id: number) {
  // outside setup(): awaiting releases the query once the DELETE settles
  const { isSuccess, error } = await remove({ id })
  if (isSuccess) { notifySuccess(); reload() }
  else { notifyError(error) }
}
```

### Delete a different record later

Or create the action once in `setup()` and await `execute()` for each record:

```ts
const { execute } = remove(undefined, { immediate: false })
async function deleteUser(id: number) {
  const { isSuccess } = await execute({ id })
  if (isSuccess) reload()
}
```

## RemoveProvider

A component that runs `remove()` via a scoped slot. It does **not** execute immediately (default
`options.immediate` is `false`): call the slot's `execute()`.

Props:
- `params`: params map.
- `options`: a `remove()` options object.

The slot receives `isLoading`, `isError`, `isSuccess`, `error`, `errors`, `status`, `query`,
`execute`, `cleanup`.

```vue
<script setup lang="ts">
import { useUsersStore } from '@/stores/users'

const { RemoveProvider } = useUsersStore()
</script>

<template>
  <RemoveProvider v-slot="{ execute, isLoading }" :params="{ id: 1 }">
    <button :disabled="isLoading" @click="execute()">Delete user</button>
  </RemoveProvider>
</template>
```

### Common composition: read then remove

A typical UI reads a record and, once available, lets the user delete it. Nest a
`RemoveProvider` inside a `ReadProvider`:

```vue
<template>
  <ReadProvider v-slot="{ item, isLoading }" :params="{ id: 1 }">
    <p v-if="isLoading">Loading…</p>
    <RemoveProvider
      v-else-if="item"
      v-slot="{ execute }"
      :params="{ id: item.id }"
    >
      <span>{{ item.username }}</span>
      <button @click="execute()">Delete</button>
    </RemoveProvider>
  </ReadProvider>
</template>
```
