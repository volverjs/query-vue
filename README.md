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

Following examples are based on a simple `RepositoryHttp` instance, but you can use any `@volverjs/data` repository you want.

First of all, you need to [initialize `pinia`](https://pinia.vuejs.org/getting-started.html) in your application, then you can create using `defineStoreRepository` function:

```ts
// user-store.ts
import { defineStoreRepository } from '@volverjs/query-vue'
import { HttpClient, RepositoryHttp } from '@volverjs/data'

/* Define an User type */
type User = {
  id: number
  username: string
}

/* Create an HttpClient instance */
const httpClient = new HttpClient({
  baseURL: 'https://my-domain.com'
})

/* Create a RepositoryHttp instance */
const usersRepository = new RepositoryHttp<User>(httpClient, 'users/:id?')

/* Create a store repository composable */
export const useUsersStore = defineStoreRepository<User>(
  usersRepository,
  // the pinia store name
  'users'
)
```

## Read

In a component you can use the `useUsersStore` composable to access the store repository actions and getters and read data from the repository:

```vue
<script setup lang="ts">
  import { useUsersStore } from './user-store'

  const { read } = useUsersStore()
  /*
   * `read()` automatically execute a
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
  // Reactive boolean that indicates if the request is loading
  isLoading,
  // Reactive boolean that indicates if the request has failed
  isError,
  // Reactive boolean that indicates if the request has succeeded
  isSuccess,
  // Reactive error object
  error,
  // Reactive status of the request
  status,
  // Reactive query object
  query,
  // Reactive array of data returned by the repository
  data,
  // Reactive metadata object returned by the repository
  metadata,
  // Reactive first item of the `data` array
  item,
  // Function to execute the `read()` action
  execute,
  // Function to stop `autoExecute` option
  stop,
  // Function to ignore reactive parameters updates
  ignoreUpdates,
  // Function to cleanup the store repository
  cleanup
} = read()
```

### Parameters

`read()` accepts an optional parameters object that will be passed to the repository `read()` method:

```ts
const { data } = read({
  page: 1
})
```

Parameters can be reactive, `data` will be automatically updated on parameters change with `autoExecute` option:

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
```

`autoExecute` can be stopped with `stop()` method:

```ts
const parameters = ref({
  page: 1
})
const { data, stop } = read(parameters, {
  autoExecute: true
})

// ...

stop()
```

A reactive parameters update can be ignored with `ignoreUpdates` method:

```ts
const parameters = ref({
  page: 1
})
const { data, ignoreUpdates } = read(parameters, {
  autoExecute: true
})

// ...

ignoreUpdates(() => {
  parameters.value = {
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
```

`execute()` accepts an optional parameters object that will be passed to the repository `read()` method:

```ts
const { data, execute } = read()

// ...

execute({
  sort: 'name',
  order: 'asc'
})
```

A `read()` can be executed later with `immediate: false` option:

```ts
const { data, execute } = read(
  {
    page: 1
  },
  {
    immediate: false
  }
)

// ...

execute()
```

### Execute When

A `read()` can be executed when a condition is met with `executeWhen` option:

```ts
const parameters = ref({
  page: undefined
})
const { data, execute } = read(parameters, {
  executeWhen: computed(() => parameters.value.page !== undefined)
})

// ...

// `read()` will be executed
parameters.value.page = 1
```

`executeWhen` can also be function that receives the parameters and returns a boolean:

```ts
const parameters = ref({
  page: undefined
})
const { data, execute } = read(parameters, {
  executeWhen: (newParams) => newParams.page !== undefined
})

// ...

// `read()` will be executed
parameters.value.page = 1
```

### Options

`read()` accepts an optional options object:

```ts
const { data } = read(parameters, {
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
   * in milliseconds (default: 500)
   */
  autoExecuteThrottle: 500
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

## Acknoledgements

`@volverjs/query-vue` is inspired by [`React Query`](https://react-query-v3.tanstack.com/).

## License

[MIT](http://opensource.org/licenses/MIT)
