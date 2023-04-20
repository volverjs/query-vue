<script lang="ts" setup>
	import { HttpClient } from '@volverjs/data/http-client'
	import { RepositoryHttp } from '@volverjs/data/repository-http'
	import { defineStoreRepository } from '../../src'
	import { ref } from 'vue'

	type Entity = { id: string }

	const httpClient = new HttpClient({
		prefixUrl: 'https://myapi.com/v1',
	})
	const repositoryHttp = new RepositoryHttp<Entity>(httpClient, ':id?')
	const useStoreRepository = defineStoreRepository(
		repositoryHttp,
		'read-provider',
	)
	const { ReadProvider } = useStoreRepository()
	const params = ref({ id: '12345' })
</script>

<template>
	<ReadProvider v-slot="{ isLoading, error, item }" v-bind="{ params }">
		<div v-if="isLoading" data-test="loading">Loading...</div>
		<div v-if="error" data-test="error">{{ error }}</div>
		<div v-if="item" data-test="item">{{ item }}</div>
	</ReadProvider>
</template>
