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
export type User = {
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

In a component you can use the `useStore` composable to access the store repository actions and getters:

```vue
<script setup lang="ts">
  import { type User, useUsersStore } from './user-store'

  const { read } = useStore()
  /*
   * `read()` automatically execute a
   * GET request to https://my-domain.com/users
   */
  const { data: users, isLoading, isError } = read()
</script>

<template>
  <div v-if="isLoading">Loading...</div>
  <div v-else-if="isError">An error occurred! 😭</div>
  <div v-else>
    <h1>Users</h1>
    <ul>
      <li v-for="user in users" :key="user.id">
        {{ user.name }}
      </li>
    </ul>
  </div>
</template>
```

## Acknoledgements

`@volverjs/query-vue` is inspired by [`React Query`](https://react-query-v3.tanstack.com/).

## License

[MIT](http://opensource.org/licenses/MIT)
