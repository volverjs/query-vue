# remove()

`remove(params?, options?)` deletes data (DELETE) and, on success, evicts the matching items from
the normalized cache by their key. Unlike `read`/`submit`, its API is intentionally smaller (no
`autoExecute`, no `executeWhen`).

```ts
const result = remove(params, options)
```

- `params` — params map (or ref) identifying what to delete. Merged with `defaultParameters`.
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

## Options

```ts
remove(params, {
  /* Name the query. Default: generated. */
  name: undefined,

  /* Keep the query alive across unmount. Default false. */
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

### Delete a different record later

```ts
const { execute } = remove(undefined, { immediate: false })
function deleteUser(id: number) { execute({ id }) }
```

## RemoveProvider

A component that runs `remove()` via a scoped slot. It does **not** execute immediately (default
`options.immediate` is `false`) — call the slot's `execute()`.

Props:
- `params` — params map.
- `options` — a `remove()` options object.

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
