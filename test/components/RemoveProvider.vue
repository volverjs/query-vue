<script lang="ts" setup>
import { HttpClient } from '@volverjs/data/http-client'
import { RepositoryHttp } from '@volverjs/data/repository-http'
import { ref } from 'vue'
import { defineStoreRepository } from '../../src'

	type Entity = { id: string }

const httpClient = new HttpClient({
    prefixUrl: 'https://myapi.com/v1',
})
const repositoryHttp = new RepositoryHttp<Entity>(httpClient, ':id?')
const useStoreRepository = defineStoreRepository(
    repositoryHttp,
    'read-provider',
)
const { ReadProvider, RemoveProvider } = useStoreRepository()
const params = ref({ id: '12345' })
</script>

<template>
    <ReadProvider v-slot="{ isLoading, error, item }" v-bind="{ params }">
        <div v-if="isLoading" data-test="loading">
            Loading...
        </div>
        <div v-if="error" data-test="error">
            {{ error }}
        </div>
        <RemoveProvider
            v-if="item"
            v-slot="{ execute }"
            :params="{ id: item.id }"
        >
            <button data-test="remove-button" @click="execute()">
                Remove
            </button>
        </RemoveProvider>
    </ReadProvider>
</template>
