import { mount, flushPromises } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import createFetchMock from 'vitest-fetch-mock'
import { describe, vi, beforeEach, it, expect } from 'vitest'
import { defineStoreRepository } from '../src/index'
import { RepositoryHttp, HttpClient } from '@volverjs/data'

const fetchMock = createFetchMock(vi)
const httpClient = new HttpClient({
	prefixUrl: 'https://myapi.com/v1',
})
type Entity = { id: string }
const repositoryHttp = new RepositoryHttp<Entity>(httpClient, ':id?')

describe('Remove', () => {
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
		fetchMock.enableMocks()
		fetchMock.resetMocks()
	})

	it('Remove from a parameters map', async () => {
		fetchMock.mockResponseOnce(JSON.stringify([{ id: '12345' }]))
		const useStoreReposotory = defineStoreRepository<Entity>(
			repositoryHttp,
			'remove',
		)
		const { read, getItemByKey, remove } = useStoreReposotory()

		// read the item with id '12345'
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

		// now remove the item with id '12345'
		const {
			isLoading: isLoadingRemove,
			isSuccess: isSuccessRemove,
			isError: isErrorRemove,
		} = remove({
			id: '12345',
		})
		expect(isLoadingRemove.value).toBe(true)
		await flushPromises()
		expect(isErrorRemove.value).toBe(false)
		expect(isLoadingRemove.value).toBe(false)
		expect(isSuccessRemove.value).toBe(true)
		expect(getItemByKey('12345').value).toBe(undefined)
	})
})
