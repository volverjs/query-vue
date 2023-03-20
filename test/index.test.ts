import { mount, flushPromises } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import createFetchMock from 'vitest-fetch-mock'
import { describe, vi, beforeEach, it, expect } from 'vitest'
import { defineStoreRepository } from '../src/index'
import { RepositoryHttp, HttpClient } from '@volverjs/data'
import { ref, nextTick, computed } from 'vue'

const fetchMocker = createFetchMock(vi)
const httpClient = new HttpClient({
	prefixUrl: 'https://myapi.com/v1',
})
type Entity = { id: string }
const repositoryHttp = new RepositoryHttp<Entity>(httpClient, ':id?')

describe('Read', () => {
	// Mount app
	mount(
		{
			template: '<div></div>',
		},
		{
			global: {
				plugins: [createTestingPinia({ stubActions: false })],
			},
		},
	)

	// Reset mocks for each test
	beforeEach(() => {
		fetchMocker.enableMocks()
		fetchMocker.resetMocks()
	})

	it('Read from a parameters map', async () => {
		fetchMocker.mockResponseOnce(JSON.stringify([{ id: '12345' }]), {})
		const useStoreReposotory = defineStoreRepository<Entity>(
			'read',
			repositoryHttp,
		)
		const { read, getItemByKey } = useStoreReposotory()
		const { isLoading, isSuccess, data, item } = read({
			id: '12345',
		})
		expect(isLoading.value).toBe(true)
		await flushPromises()
		expect(isLoading.value).toBe(false)
		expect(isSuccess.value).toBe(true)
		expect(data.value?.[0].id).toBe('12345')
		expect(item.value.id).toBe('12345')
		expect(getItemByKey('12345').value.id).toBe('12345')
	})

	it('Read cached values and force refetch', async () => {
		fetchMocker.mockResponseOnce(JSON.stringify([{ id: '12345' }]), {})
		const useStoreReposotory = defineStoreRepository<Entity>(
			'read',
			repositoryHttp,
		)
		const { read, getItemByKey } = useStoreReposotory()
		const { isLoading, isSuccess, data, item, refetch } = read({
			id: '12345',
		})
		expect(isLoading.value).toBe(false)
		expect(isSuccess.value).toBe(true)
		expect(data.value?.[0].id).toBe('12345')
		expect(item.value.id).toBe('12345')
		refetch()
		expect(isLoading.value).toBe(true)
		await flushPromises()
		expect(isLoading.value).toBe(false)
		expect(isSuccess.value).toBe(true)
		expect(data.value?.[0].id).toBe('12345')
		expect(item.value.id).toBe('12345')
		expect(getItemByKey('12345').value.id).toBe('12345')
	})

	it('Read values without persistence', async () => {
		fetchMocker.mockResponseOnce(JSON.stringify([{ id: '12345' }]), {})
		const useStoreReposotory = defineStoreRepository<Entity>(
			'read',
			repositoryHttp,
		)
		const { read, getItemByKey } = useStoreReposotory()
		const { isLoading, isSuccess, data, item } = read(
			{
				id: '12345',
			},
			{ persistence: 0 },
		)
		expect(isLoading.value).toBe(true)
		await flushPromises()
		expect(isLoading.value).toBe(false)
		expect(isSuccess.value).toBe(true)
		expect(data.value?.[0].id).toBe('12345')
		expect(item.value.id).toBe('12345')
		expect(getItemByKey('12345').value.id).toBe('12345')
	})

	it('Read from a parameters map and query name', async () => {
		fetchMocker.mockResponseOnce(JSON.stringify([{ id: '12345' }]), {})
		const useStoreReposotory = defineStoreRepository<Entity>(
			'read-query-name',
			repositoryHttp,
		)
		const QUERY_NAME = 'my-query'
		const { read, getQueryByName, getItemByKey } = useStoreReposotory()
		const { isLoading, isSuccess } = read(
			{
				id: '12345',
			},
			{ name: QUERY_NAME },
		)
		const query = getQueryByName(QUERY_NAME)
		expect(isLoading.value).toBe(true)
		await flushPromises()
		expect(isLoading.value).toBe(false)
		expect(isSuccess.value).toBe(true)
		expect(query.value.data?.[0].id).toBe('12345')
		expect(getItemByKey('12345').value.id).toBe('12345')
	})

	it('Read from a parameters map and directory', async () => {
		fetchMocker.mockResponseOnce(JSON.stringify([{ id: '12345' }]), {})
		const useStoreReposotory = defineStoreRepository<Entity>(
			'read-directory',
			repositoryHttp,
		)
		const { read, getItemByKey } = useStoreReposotory()
		const { isLoading, isSuccess, data } = read(
			{
				id: '12345',
			},
			{ directory: true },
		)
		const item = getItemByKey('12345')
		expect(isLoading.value).toBe(true)
		await flushPromises()
		expect(isLoading.value).toBe(false)
		expect(isSuccess.value).toBe(true)
		expect(data.value?.[0].id).toBe('12345')
		expect(item.value).toBe(undefined)
	})

	it('Read from a parameters map not immediate', async () => {
		fetchMocker.mockResponseOnce(JSON.stringify([{ id: '12345' }]), {})
		const useStoreReposotory = defineStoreRepository<Entity>(
			'read-not-immediate',
			repositoryHttp,
		)
		const { read, getItemByKey } = useStoreReposotory()
		const { isLoading, isSuccess, refetch, data } = read(
			{
				id: '12345',
			},
			{ immediate: false },
		)
		expect(isLoading.value).toBe(false)
		await refetch()
		expect(isLoading.value).toBe(false)
		expect(isSuccess.value).toBe(true)
		expect(data.value?.[0].id).toBe('12345')
		expect(getItemByKey('12345').value.id).toBe('12345')
	})

	it('Read from a parameters ref', async () => {
		fetchMocker.mockResponseOnce(async () => {
			return JSON.stringify([{ id: '12345' }])
		})
		const useStoreReposotory = defineStoreRepository<Entity>(
			'read-ref',
			repositoryHttp,
		)
		const { read, getItemByKey } = useStoreReposotory()
		const params = ref({ id: '12345' })
		const { isLoading, isSuccess, data, item } = read(params)
		expect(isLoading.value).toBe(true)
		await flushPromises()
		expect(isLoading.value).toBe(false)
		expect(isSuccess.value).toBe(true)
		expect(data.value?.[0].id).toBe('12345')
		expect(item.value.id).toBe('12345')
		// change params
		fetchMocker.mockResponseOnce(JSON.stringify([{ id: '54321' }]))
		params.value.id = '54321'
		await nextTick()
		expect(isLoading.value).toBe(true)
		await flushPromises()
		expect(isLoading.value).toBe(false)
		expect(isSuccess.value).toBe(true)
		expect(data.value?.[0].id).toBe('54321')
		expect(item.value.id).toBe('54321')
		expect(getItemByKey('12345').value.id).toBe('12345')
		expect(getItemByKey('54321').value.id).toBe('54321')
	})

	it('Read from a parameters ref and stop', async () => {
		fetchMocker.mockResponseOnce(async () => {
			return JSON.stringify([{ id: '12345' }])
		})
		const useStoreReposotory = defineStoreRepository<Entity>(
			'read-ref-stop',
			repositoryHttp,
		)
		const { read, getItemByKey } = useStoreReposotory()
		const params = ref({ id: '12345' })
		const { isLoading, isSuccess, data, item, stop } = read(params)
		expect(isLoading.value).toBe(true)
		await flushPromises()
		expect(isLoading.value).toBe(false)
		expect(isSuccess.value).toBe(true)
		expect(data.value?.[0].id).toBe('12345')
		expect(item.value.id).toBe('12345')
		expect(getItemByKey('12345').value.id).toBe('12345')
		stop()
		params.value.id = '54321'
		await nextTick()
		expect(isLoading.value).toBe(false)
	})

	it('Refetch', async () => {
		fetchMocker.mockResponseOnce(async () => {
			return JSON.stringify([{ id: '12345' }])
		})
		const useStoreReposotory = defineStoreRepository<Entity>(
			'read-refetch',
			repositoryHttp,
		)
		const { read, getItemByKey } = useStoreReposotory()
		const { isLoading, isSuccess, data, item, refetch } = read({
			id: '12345',
		})
		expect(isLoading.value).toBe(true)
		await flushPromises()
		expect(isLoading.value).toBe(false)
		expect(isSuccess.value).toBe(true)
		expect(data.value?.[0].id).toBe('12345')
		expect(item.value.id).toBe('12345')
		expect(getItemByKey('12345').value.id).toBe('12345')
		// change params
		fetchMocker.mockResponseOnce(JSON.stringify([{ id: '54321' }]))
		refetch({ id: '54321' })
		await nextTick()
		expect(isLoading.value).toBe(true)
		await flushPromises()
		expect(isLoading.value).toBe(false)
		expect(isSuccess.value).toBe(true)
		expect(data.value?.[0].id).toBe('54321')
		expect(item.value.id).toBe('54321')
		expect(getItemByKey('54321').value.id).toBe('54321')
	})

	it('When with params map', async () => {
		fetchMocker.mockResponseOnce(async () => {
			return JSON.stringify([{ id: '12345' }])
		})
		const useStoreReposotory = defineStoreRepository<Entity>(
			'read-when',
			repositoryHttp,
		)
		const { read, getItemByKey } = useStoreReposotory()
		const when = ref(false)
		const { isLoading, isSuccess, data, item } = read(
			{
				id: '12345',
			},
			{ when },
		)
		expect(isLoading.value).toBe(false)
		// change when
		when.value = true
		await nextTick()
		expect(isLoading.value).toBe(true)
		await flushPromises()
		expect(isLoading.value).toBe(false)
		expect(isSuccess.value).toBe(true)
		expect(data.value?.[0].id).toBe('12345')
		expect(item.value.id).toBe('12345')
		expect(getItemByKey('12345').value.id).toBe('12345')
	})

	it('When with computed', async () => {
		fetchMocker.mockResponseOnce(async () => {
			return JSON.stringify([{ id: '12345' }])
		})
		const useStoreReposotory = defineStoreRepository<Entity>(
			'read-when-ref',
			repositoryHttp,
		)
		const { read, getItemByKey } = useStoreReposotory()
		const params = ref({ id: undefined })
		const { isLoading, isSuccess, data, item } = read(params, {
			when: computed(() => params.value.id !== undefined),
		})
		expect(isLoading.value).toBe(false)
		// change when
		params.value.id = '12345'
		await nextTick()
		expect(isLoading.value).toBe(true)
		await flushPromises()
		expect(isLoading.value).toBe(false)
		expect(isSuccess.value).toBe(true)
		expect(data.value?.[0].id).toBe('12345')
		expect(item.value.id).toBe('12345')
		expect(getItemByKey('12345').value.id).toBe('12345')
	})

	it('When with function', async () => {
		fetchMocker.mockResponseOnce(async () => {
			return JSON.stringify([{ id: '12345' }])
		})
		const useStoreReposotory = defineStoreRepository<Entity>(
			'read-when-func',
			repositoryHttp,
		)
		const { read, getItemByKey } = useStoreReposotory()
		const params = ref({ id: undefined })
		const { isLoading, isSuccess, data, item } = read(params, {
			when: (params) => params.id !== undefined,
		})
		expect(isLoading.value).toBe(false)
		// change when
		params.value.id = '12345'
		await nextTick()
		expect(isLoading.value).toBe(true)
		await flushPromises()
		expect(isLoading.value).toBe(false)
		expect(isSuccess.value).toBe(true)
		expect(data.value?.[0].id).toBe('12345')
		expect(item.value.id).toBe('12345')
		expect(getItemByKey('12345').value.id).toBe('12345')
	})
})
