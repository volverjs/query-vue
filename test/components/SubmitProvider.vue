<script lang="ts" setup>
import { HttpClient } from '@volverjs/data/http-client'
import { RepositoryHttp } from '@volverjs/data/repository-http'
import { ref } from 'vue'
import { defineStoreRepository } from '../../src'

	type User = { id: string, firstname: string, lastname: string }

const httpClient = new HttpClient({
    prefixUrl: 'https://myapi.com/v1',
})
const repositoryHttp = new RepositoryHttp<Partial<User>>(httpClient, ':id?')
const useStoreRepository = defineStoreRepository(
    repositoryHttp,
    'submit-provider',
)
const { SubmitProvider } = useStoreRepository()
const formData = ref<Partial<User>>({})
</script>

<template>
    <SubmitProvider v-slot="{ isLoading, error, execute }" v-model="formData">
        <div v-if="isLoading" data-test="loading">
            Loading...
        </div>
        <div v-if="error" data-test="error">
            {{ error }}
        </div>
        <div data-test="form-data">
            {{ formData }}
        </div>
        <form @submit.prevent="execute()">
            <input
                v-model="formData.firstname"
                type="text"
                data-test="firstname"
                name="firstname"
                placeholder="firstname"
            >
            <input
                v-model="formData.lastname"
                type="text"
                data-test="lastname"
                name="lastname"
                placeholder="lastname"
            >
            <button type="submit" data-test="submit">
                Submit
            </button>
        </form>
    </SubmitProvider>
</template>
