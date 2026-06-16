# submit()

`submit(payload, params?, options?)` creates (POST) or updates (PUT) data. Whether it's a create
or an update is **inferred from the payload's key property**, or you can force it with `action`.

```ts
const result = submit(payload, params, options)
```

- `payload` — the item, an array of items, or a **`Ref`** to either. A ref enables `autoExecute`
  and two-way sync.
- `params` — params map (or ref). Merged with the store's `defaultParameters`. If the payload
  carries a key and the params don't already include it, the key is added to params automatically
  (so the URL targets the right record on update).

## Create vs. update

- **No key on the payload → create (POST).** `submit({ username: 'ada' })`
- **Key present on the payload → update (PUT).** `submit({ id: 1, username: 'ada' })`
- For an array payload: update if *every* item has a key, otherwise create.
- Override explicitly with `action: 'create' | 'update'` (only those two are valid).

## Return value

Same reactive shape as `read()`:

```ts
const {
  data,        // TResponse[] — the server response (always an array)
  item,        // TResponse | undefined — data[0]
  isLoading, isSuccess, isError,
  error, errors,
  metadata,
  status,
  query,
  execute,     // (newData?, newParams?, newRepositoryOptions?) => Promise<...>
  stop, cleanup, ignoreUpdates,
} = submit(payload, params, options)
```

### `execute()`

```ts
execute()                              // submit the current payload/params
execute({ username: 'grace' })         // submit new data
execute(newData, { team: 'x' })        // new data + params
execute(newData, params, { signal })   // + per-call repositoryOptions
```

## Payload sync (two-way)

When `payload` is a ref, on success the server response is written back into it (so server-assigned
fields like `id` or timestamps appear in your local object). This is what makes `v-model` on
`SubmitProvider` work. Disable it with `disablePayloadSync: true`.

```ts
const draft = ref<User>({ username: 'ada' })
const { isSuccess } = submit(draft)
// after success: draft.value.id is populated from the response
```

The write-back is wrapped so it does **not** retrigger an `autoExecute` submit.

## Options

```ts
submit(payload, params, {
  /* Name the query. Default: generated (each call is independent). */
  name: undefined,

  /* Keep the query alive across unmount. Default false. */
  keepAlive: false,

  /* Submit as soon as submit() is called. Default true. */
  immediate: true,

  /*
   * Gate execution: a boolean ref OR a predicate over (payload, params).
   *   executeWhen: (p) => !!p?.username
   */
  executeWhen: undefined,

  /* Re-submit automatically when reactive payload/params change (debounced). Default false. */
  autoExecute: false,
  autoExecuteDebounce: 0, // default: store defaultDebounce

  /* Re-submit on window focus / visibility. Default false. */
  autoExecuteOnWindowFocus: false,
  autoExecuteOnDocumentVisibility: false,

  /* Don't write the response back into a ref payload. Default false. */
  disablePayloadSync: false,

  /*
   * Force the operation instead of inferring it from the key.
   * Only 'create' or 'update' are valid (the enum members or the strings).
   */
  action: undefined,

  /* Passed straight to the repository create/update method. */
  repositoryOptions: undefined,
})
```

The response must contain the `keyProperty` for each item, or the query goes to `error`.

## Patterns

### Create from a form, then read the assigned id

```ts
const draft = ref<User>({ username: '' })
const { submit } = useUsersStore()
const { isLoading, isSuccess, execute } = submit(draft, undefined, { immediate: false })
function onSubmit() { execute() } // POST; draft.value.id is filled on success
```

### Update an existing record

```ts
const user = ref<User>({ id: 1, username: 'ada' })
submit(user) // PUT /users/1 (key inferred -> update)
```

### Auto-save on change

```ts
const user = ref<User>({ id: 1, username: 'ada' })
submit(user, undefined, { autoExecute: true, autoExecuteDebounce: 500 })
// edits to user.value are persisted ~500ms after the last change
```

### Force a create even though the payload has an id

```ts
submit({ id: 1, username: 'ada' }, undefined, { action: 'create' }) // POST, not PUT
```

### Submit many at once

```ts
submit([{ username: 'a' }, { username: 'b' }]) // create (no keys) -> POST with an array body
```

## SubmitProvider

A component that runs `submit()` via a scoped slot, with `v-model` for the payload.
It does **not** execute immediately (default `options.immediate` is `false`) — trigger it with the
slot's `execute()`.

Props:
- `v-model` (`modelValue`) — the payload; kept in sync with the server response.
- `params` — params map.
- `options` — a `submit()` options object.

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { useUsersStore } from '@/stores/users'

const { SubmitProvider } = useUsersStore()
const form = ref({ username: '' })
</script>

<template>
  <SubmitProvider v-slot="{ isLoading, error, execute }" v-model="form">
    <form @submit.prevent="execute()">
      <input v-model="form.username" name="username">
      <p v-if="error">{{ error.message }}</p>
      <button type="submit" :disabled="isLoading">Save</button>
    </form>
  </SubmitProvider>
</template>
```
