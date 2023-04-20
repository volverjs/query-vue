<div align="center">
  
[![volverjs](docs/static/volverjs-query.svg)](https://volverjs.github.io/query-vue)

## @volverjs/query-vue

`repository` `pinia` `store` `vue3` `read` `submit`

<br>

#### proudly powered by

<br>

[![24/Consulting](docs/static/24consulting.svg)](https://24consulting.it)

<br>

</div>

## Features

`@volverjs/query-vue` is a Vue 3 library that provides a simple way to sync the state of your application with a data source. It is designed to be used with [`pinia`](https://pinia.esm.dev/) and [`@volverjs/data`](https://github.com/volverjs/data) repository.

## Install

```bash
# pnpm
pnpm add @volverjs/query-vue

# yarn
yarn add @volverjs/query-vue

# npm
npm install @volverjs/query-vue --save
```

## Getting started

Following examples are based on a `RepositoryHttp` instance, but you can use any [`@volverjs/data`](https://github.com/volverjs/data) repository you want.

First of all, you need to [initialize `pinia`](https://pinia.vuejs.org/getting-started.html) in your application, then you can create a store composable using `defineStoreRepository()`:

```ts
// user-store.ts
import { defineStoreRepository } from '@volverjs/query-vue'
import { HttpClient, RepositoryHttp } from '@volverjs/data'

/* Define an User type */
export type User = {
  id?: number
  username: string
}

/* Create an HttpClient instance */
const httpClient = new HttpClient({
  baseURL: 'https://my-domain.com'
})

/* Create a RepositoryHttp instance */
const usersRepository = new RepositoryHttp<User>(httpClient, 'users/:id?')

/* Create a store repository composable */
export const useUsersStore = defineStoreRepository(
  usersRepository,
  // the store name
  'users'
)
```

In a component you can use the `useUsersStore()` composable to get store actions and getters.

## Read

`read()` action allow to read data from the repository:

```vue
<script setup lang="ts">
  import { useUsersStore } from './user-store'

  const { read } = useUsersStore()
  /*
   * With HttpRepository `read()` execute a
   * GET request to https://my-domain.com/users
   */
  const { data, isLoading, isError } = read()
</script>

<template>
  <div v-if="isLoading">Loading...</div>
  <div v-else-if="isError">An error occurred! 😭</div>
  <div v-else>
    <h1>Users</h1>
    <ul>
      <li v-for="user in data" :key="user.id">
        {{ user.username }}
      </li>
    </ul>
  </div>
</template>
```

`read()` returns an object that contains:

```ts
const {
  /* Reactive boolean that indicates if the request is loading */
  isLoading,
  /* Reactive boolean that indicates if the request has failed */
  isError,
  /* Reactive boolean that indicates if the request has succeeded */
  isSuccess,
  /* Reactive error object */
  error,
  /* Reactive status of the request */
  status,
  /* Reactive query object */
  query,
  /* Reactive array of data returned by the repository */
  data,
  /* Reactive metadata object returned by the repository */
  metadata,
  /* Reactive first item of the `data` array */
  item,
  /* Function to execute the `read()` action */
  execute,
  /* Function to stop `autoExecute` option */
  stop,
  /* Function to ignore reactive parameters updates */
  ignoreUpdates,
  /* Function to cleanup the store repository */
  cleanup
} = read()
```

### Parameters

`read()` accepts an optional parameters map.

```ts
const { data } = read({
  page: 1
})
```

The parameters map can be reactive, `data` will be automatically updated on parameters change with `autoExecute` option:

```ts
const parameters = ref({
  page: 1
})
const { data } = read(parameters, {
  autoExecute: true
})

// ...

parameters.value = {
  page: 2
}
// `read()` will be re-executed
```

`autoExecute` can be stopped with `stop()` function:

```ts
const parameters = ref({
  page: 1
})
const { data, stop } = read(parameters, {
  autoExecute: true
})

// ...

stop()
// `read()` will not be re-executed
```

A reactive parameters update can be ignored with `ignoreUpdates` function:

```ts
const params = ref({
  page: 1
})
const { data, ignoreUpdates } = read(params, {
  autoExecute: true
})

// ...

ignoreUpdates(() => {
  params.value = {
    page: 1,
    other: 'value'
  }
})
```

### Execute

You can re-execute the `read()` action by calling the `execute()` method:

```ts
const { data, execute } = read()

// ...

execute()
// `read()` will be re-executed
```

`execute()` accepts an optional parameters map that will override the current parameters:

```ts
const { data, execute } = read()

// ...

execute({
  sort: 'name',
  order: 'asc'
})
// `read()` will be re-executed with the given parameters
```

A `read()` can be executed later with `immediate: false` option:

```ts
const { data, execute } = read(
  {
    page: 1
  },
  {
    // `read()` will not be executed
    immediate: false
  }
)

// ...

execute()
// `read()` will be executed for the first time
```

### Execute When

A `read()` can be executed when a condition is met with `executeWhen` option:

```ts
const params = ref({
  page: undefined
})
const { data, execute } = read(params, {
  executeWhen: computed(() => params.value.page !== undefined)
})

// ...

params.value.page = 1
// `read()` will be executed
```

`executeWhen` can also be function that receives the parameters and returns a `boolean`:

```ts
const params = ref({
  page: undefined
})
const { data, execute } = read(params, {
  executeWhen: (newParams) => newParams.page !== undefined
})

// ...

params.value.page = 1
// `read()` will be executed
```

### Options

`read()` accepts the following options:

```ts
const {
  // ...
 } = read(
  /* The parameters map (default: undefined) */
  params,
  /* The options object (default: undefined) */
  {
  /*
   * The name of the query (default: undefined)
   * if not defined, the query name will be generated
   */
  name: undefined,
  /*
   * Group all queries executed by the same read() action
   * and exposes all items in `data` (default: false)
   * Can be useful when you need to display a list of items
   * (ex. inifinite scroll)
   */
  group: false,
  /*
   * Store query results in a
   * separate directory (default: false)
   */
  directory: false
  /*
   * Keep the query alive when
   * the component is unmounted (default: false)
   */
  keepAlive: false,
  /*
   * Execute the `read()` action immediately (default: true)
   */
  immediate: true,
  /*
   * The query cache time in milliseconds (default: 60 * 60 * 1000)
   */
  persistence: 60 * 60 * 1000,
  /*
   * A boolean reactive parameter (or a function) that indicates
   * when the `read()` action should be executed (default: undefined)
   * For example:
   * `executeWhen: (newParams) => newParams.id !== undefined`
   * Or:
   * `executeWhen: computed(() => parameters.value.id !== undefined)`
   */
  executeWhen: undefined,
  /*
   * Automatically execute the `read()` action
   * on reactive parameters change (default: false)
   */
  autoExecute: false,
  /*
   * The query auto execute throttle
   * in milliseconds (default: 0)
   */
  autoExecuteDebounce: 0
  /*
   * Automatically execute the `read()` action
   * on window focus (default: false)
   */
  autoExecuteOnWindowFocus: false,
  /*
   * Automatically execute the `read()` action
   * on document visibility change (default: false)
   */
  autoExecuteOnDocumentVisibility: false,
})
```

## Submit

`submit()` action allow to create or update data from the repository. Generally, has the same behavior of `read()` action but requires a `payload` parameter.

```vue
<script setup lang="ts">
  import { useUsersStore } from './user-store'

  const { submit } = useUsersStore()
  /*
   * With HttpRepository `submit()` execute a
   * POST request to https://my-domain.com/users
   */
  const { isLoading, isError, isSuccess } = submit({
    username: 'john.doe'
  })
</script>

<template>
  <div v-if="isLoading">Loading...</div>
  <div v-else-if="isError">An error occurred! 😭</div>
  <div v-else-if="isSuccess">Submit success! 🎉</div>
</template>
```

`submit()` returns an object that contains:

```ts
const {
  /* Reactive boolean that indicates if the request is loading */
  isLoading,
  /* Reactive boolean that indicates if the request has failed */
  isError,
  /* Reactive boolean that indicates if the request has succeeded */
  isSuccess,
  /* Reactive error object */
  error,
  /* Reactive status of the request */
  status,
  /* Reactive query object */
  query,
  /* Reactive array of data returned by the repository */
  data,
  /* Reactive metadata object returned by the repository */
  metadata,
  /* Reactive first item of the `data` array */
  item,
  /* Function to execute the `submit()` action */
  execute,
  /* Function to stop `autoExecute` option */
  stop,
  /* Function to ignore reactive parameters updates */
  ignoreUpdates,
  /* Function to cleanup the store repository */
  cleanup
} = submit()
```

### Options

`submit()` accepts the following options:

```ts
const {
  // ...
} = submit(
  /* The submit payload (required) */
  payload,
  /* The parameters map (default: undefined) */
  params,
  /* The options object (default: undefined) */
  {
  /*
   * The name of the query (default: undefined)
   * if not defined, the query name will be generated
   */
  name: undefined,
  /*
   * Keep the query alive when
   * the component is unmounted (default: false)
   */
  keepAlive: false,
  /*
   * Execute the `submit()` action immediately (default: true)
   */
  immediate: true,
  /*
   * A boolean reactive parameter (or a function) that indicates
   * when the `submit()` action should be executed (default: undefined)
   * For example:
   * `executeWhen: (newPayload, newParams) => newParams.id !== undefined`
   * Or:
   * `executeWhen: computed(() => parameters.value.id !== undefined)`
   */
  executeWhen: undefined,
  /*
   * Automatically execute the `submit()` action
   * on reactive parameters change (default: false)
   */
  autoExecute: false,
  /*
   * The query auto execute throttle
   * in milliseconds (default: 0)
   */
  autoExecuteDebounce: 0
  /*
   * Automatically execute the `submit()` action
   * on window focus (default: false)
   */
  autoExecuteOnWindowFocus: false,
  /*
   * Automatically execute the `submit()` action
   * on document visibility change (default: false)
   */
  autoExecuteOnDocumentVisibility: false,
})
```

As `read()` also `submit()` can be executed later too with `immediate: false` option:

```vue
<script setup lang="ts">
  import { ref } from 'vue'
  import { type User, useUsersStore } from './user-store'

  const user = ref<User>({
    username: ''
  })
  const { submit } = useUsersStore()
  const { isLoading, isError, isSuccess, execute } = submit(user, undefined, {
    // `submit()` will not be executed immediately
    immediate: false
  })
</script>

<template>
  <div v-if="isLoading">Loading...</div>
  <div v-else-if="isError">An error occurred! 😭</div>
  <div v-else-if="isSuccess">New user created! 🎉</div>
  <div v-else>
    <h1>Create User</h1>
    <form @submit.prevent="execute()">
      <input v-model="user.username" type="text" name="username" placeholder="Insert username" />
      <button type="submit">Submit</button>
    </forml>
  </div>
</template>
```

## Remove

`remove()` action allow to delete data from the repository:

```vue
<script setup lang="ts">
  import { useUsersStore } from './user-store'

  const { remove } = useUsersStore()
  /*
   * With HttpRepository `remove()` execute a
   * DELETE request to https://my-domain.com/users
   */
  const { isLoading, isError, isSuccess } = remove({
    // "id" or other "keyProperty" field
    id: '123-321'
  })
</script>

<template>
  <div v-if="isLoading">Loading...</div>
  <div v-else-if="isError">An error occurred! 😭</div>
  <div v-else-if="isSuccess">Delete success! 🎉</div>
</template>
```

`remove()` returns an object that contains:

```ts
const {
  /* Reactive boolean that indicates if the request is loading */
  isLoading,
  /* Reactive boolean that indicates if the request has failed */
  isError,
  /* Reactive boolean that indicates if the request has succeeded */
  isSuccess,
  /* Reactive error object */
  error,
  /* Reactive status of the request */
  status
  /* Function to execute the `remove()` action */
  execute,
} = remove({
  // ...
})
```

### Options

`remove()` accepts the following options:

```ts
const {
  // ...
} = remove(
  /* The parameters map (required) */
  params,
  /* The options object (default: undefined) */
  {
    /* Execute the `remove()` action immediately (default: true) */
    immediate: true
  }
)
```

## Components

`@volverjs/query-vue` also exposes some useful components:

### ReadProvider

`ReadProvider` is a component that allows to use `read()` action in a component tree:

```vue
<script setup lang="ts">
  import { useUsersStore } from './user-store'

  const { ReadProvider } = useUsersStore()
</script>

<template>
  <ReadProvider v-slot="{ isLoading, isError, data }">
    <div v-if="isLoading">Loading...</div>
    <div v-else-if="isError">An error occurred! 😭</div>
    <div v-else>
      <h1>Users</h1>
      <ul>
        <li v-for="user in data" :key="user.id">
          {{ user.username }}
        </li>
      </ul>
    </div>
  </ReadProvider>
</template>
```

`ReadProvider` exposes all the properties returned by `read()` in the `v-slot` scope and accepts the following props:

```vue
<template>
  <ReadProvider
    v-bind="{
      /* The parameters map (default: undefined) */
      params,
      /* The `read()` options object (default: undefined) */
      options
    }"
  />
</template>
```

### SubmitProvider

`SubmitProvider` is a component that allows to use `submit()` action in a component tree:

```vue
<script setup lang="ts">
  import { ref } from 'vue'
  import { type User, useUsersStore } from './user-store'

  const { SubmitProvider } = useUsersStore()
  const user = ref<User>({
    username: ''
  })
</script>

<template>
  <SubmitProvider v-model="user" v-slot="{ isLoading, isError, isSuccess, execute }">
    <div v-if="isLoading">Loading...</div>
    <div v-else-if="isError">An error occurred! 😭</div>
    <div v-else-if="isSuccess">New user created! 🎉</div>
    <div v-else>
      <h1>Create user</h1>
      <form @submit.prevent="execute()">
        <input
          v-model="user.username"
          type="text"
          name="username"
          placeholder="Insert username"
        />
        <button type="submit">Submit</button>
      </forml>
    </div>
  </SubmitProvider>
</template>
```

`SubmitProvider` exposes all the properties returned by `submit()` in the `v-slot` scope and accepts the following props:

```vue
<template>
  <SubmitProvider
    v-bind="{
      /* The payload (required) */
      modelValue,
      /* The parameters map (default: undefined) */
      params,
      /* The `submit()` options object (default: { immediate: false }) */
      options
    }"
  />
</template>
```

The `v-model` directive provides a two-way binding so the reactive payload object will be updated when the `submit()` action is executed (for example with the server response).

By default `SubmitProvider` will not execute the `submit()` action immediately, but you can change this behavior with `immediate` option.

### RemoveProvider

`RemoveProvider` is a component that allows to use `remove()` action in a component tree:

```vue
<script setup lang="ts">
  import { useUsersStore } from './user-store'

  const { RemoveProvider } = useUsersStore()
</script>

<template>
  <RemoveProvider
    :params="{ id: '123-321' }"
    v-slot="{ isLoading, isError, isSuccess, execute }"
  >
    <div v-if="isLoading">Loading...</div>
    <div v-else-if="isError">An error occurred! 😭</div>
    <div v-else-if="isSuccess">Delete success! 🎉</div>
    <div v-else>
      <button type="button" @click="execute()">Delete</button>
    </div>
  </RemoveProvider>
</template>
```

`RemoveProvider` exposes all the properties returned by `remove()` in the `v-slot` scope and accepts the following props:

```vue
<template>
  <RemoveProvider
    v-bind="{
      /* The parameters map (required) */
      params,
      /* The `remove()` options object (default: { immediate: false }) */
      options
    }"
  />
</template>
```

By default `RemoveProvider` will not execute the `remove()` action immediately, but you can change this behavior with `immediate` option.

## Acknoledgements

`@volverjs/query-vue` is inspired by [`React Query`](https://react-query-v3.tanstack.com/).

## License

[MIT](http://opensource.org/licenses/MIT)
