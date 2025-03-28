import { createTestingPinia } from '@pinia/testing'
import { HttpClient, RepositoryHttp } from '@volverjs/data'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import createFetchMock from 'vitest-fetch-mock'
import { computed, nextTick, ref } from 'vue'
import { defineStoreRepository } from '../src/index'
import ReadProvider from './components/ReadProvider.vue'

const fetchMock = createFetchMock(vi)
const httpClient = new HttpClient({
    prefixUrl: 'https://myapi.com/v1',
})
type Entity = { id: string }
const repositoryHttp = new RepositoryHttp<Entity>(httpClient, ':id?')

describe('read', () => {
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

    it('read from a parameters map with component provider', async () => {
        fetchMock.mockResponseOnce(JSON.stringify([{ id: '12345' }]))
        const wrapper = mount(ReadProvider, {
            global: {
                plugins: [createTestingPinia({ stubActions: false })],
            },
        })
        expect(wrapper.text()).toContain('Loading...')
        await flushPromises()
        await nextTick()
        expect(wrapper.text()).not.toContain('Loading...')
        expect(wrapper.text()).toContain('12345')
        const request = fetchMock.mock.calls[0][0] as Request
        expect(request.url).toEqual('https://myapi.com/v1/12345')
        expect(request.method).toEqual('GET')
        const item = JSON.parse(wrapper.find('div[data-test="item"]').text())
        expect(item.id).toEqual('12345')
    })

    it('read from a parameters map', async () => {
        fetchMock.mockResponseOnce(JSON.stringify([{ id: '12345' }]))
        const useStoreReposotory = defineStoreRepository<Entity>(
            repositoryHttp,
            'read',
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
        expect(item.value?.id).toBe('12345')
        expect(getItemByKey('12345').value?.id).toBe('12345')
        const request = fetchMock.mock.calls[0][0] as Request
        expect(request.url).toEqual('https://myapi.com/v1/12345')
        expect(request.method).toEqual('GET')
    })

    it('read cached values and force execute', async () => {
        fetchMock.mockResponseOnce(JSON.stringify([{ id: '12345' }]))
        const useStoreReposotory = defineStoreRepository<Entity>(
            repositoryHttp,
            'read',
        )
        const { read, getItemByKey } = useStoreReposotory()
        const { isLoading, isSuccess, data, item, execute } = read({
            id: '12345',
        })
        expect(isLoading.value).toBe(false)
        expect(isSuccess.value).toBe(true)
        expect(data.value?.[0].id).toBe('12345')
        expect(item.value?.id).toBe('12345')
        execute(true)
        expect(isLoading.value).toBe(true)
        await flushPromises()
        expect(isLoading.value).toBe(false)
        expect(isSuccess.value).toBe(true)
        expect(data.value?.[0].id).toBe('12345')
        expect(item.value?.id).toBe('12345')
        expect(getItemByKey('12345').value?.id).toBe('12345')
        expect(fetchMock.mock.calls.length).toBe(1)
        const request = fetchMock.mock.calls[0][0] as Request
        expect(request.url).toEqual('https://myapi.com/v1/12345')
        expect(request.method).toEqual('GET')
    })

    it('read without persistence', async () => {
        fetchMock.mockResponseOnce(JSON.stringify([{ id: '12345' }]))
        const useStoreReposotory = defineStoreRepository<Entity>(
            repositoryHttp,
            'read',
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
        expect(item.value?.id).toBe('12345')
        expect(getItemByKey('12345').value?.id).toBe('12345')
        const request = fetchMock.mock.calls[0][0] as Request
        expect(request.url).toEqual('https://myapi.com/v1/12345')
        expect(request.method).toEqual('GET')
    })

    it('read from a map and query name', async () => {
        fetchMock.mockResponseOnce(JSON.stringify([{ id: '12345' }]))
        const useStoreReposotory = defineStoreRepository<Entity>(
            repositoryHttp,
            'read-query-name',
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
        expect(query.value?.data?.[0].id).toBe('12345')
        expect(getItemByKey('12345').value?.id).toBe('12345')
        const request = fetchMock.mock.calls[0][0] as Request
        expect(request.url).toEqual('https://myapi.com/v1/12345')
        expect(request.method).toEqual('GET')
    })

    it('read from a map and make a directory', async () => {
        fetchMock.mockResponseOnce(JSON.stringify([{ id: '12345' }]))
        const useStoreReposotory = defineStoreRepository<Entity>(
            repositoryHttp,
            'read-directory',
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
        const request = fetchMock.mock.calls[0][0] as Request
        expect(request.url).toEqual('https://myapi.com/v1/12345')
        expect(request.method).toEqual('GET')
    })

    it('read from a map not immediate', async () => {
        fetchMock.mockResponseOnce(JSON.stringify([{ id: '12345' }]))
        const useStoreReposotory = defineStoreRepository<Entity>(
            repositoryHttp,
            'read-not-immediate',
        )
        const { read, getItemByKey } = useStoreReposotory()
        const { isLoading, isSuccess, execute, data } = read(
            {
                id: '12345',
            },
            { immediate: false },
        )
        expect(isLoading.value).toBe(false)
        await execute()
        expect(isLoading.value).toBe(false)
        expect(isSuccess.value).toBe(true)
        expect(data.value?.[0].id).toBe('12345')
        expect(getItemByKey('12345').value?.id).toBe('12345')
        const request = fetchMock.mock.calls[0][0] as Request
        expect(request.url).toEqual('https://myapi.com/v1/12345')
        expect(request.method).toEqual('GET')
    })

    it('read from a ref with autoExecute', async () => {
        fetchMock.mockResponseOnce(async () => {
            return JSON.stringify([{ id: '12345' }])
        })
        const useStoreReposotory = defineStoreRepository<Entity>(
            repositoryHttp,
            'read-ref',
        )
        const { read, getItemByKey } = useStoreReposotory()
        const params = ref({ id: '12345' })
        const { isLoading, isSuccess, data, item } = read(params, {
            autoExecute: true,
        })
        expect(isLoading.value).toBe(true)
        await flushPromises()
        expect(isLoading.value).toBe(false)
        expect(isSuccess.value).toBe(true)
        expect(data.value?.[0].id).toBe('12345')
        expect(item.value?.id).toBe('12345')
        // change params
        fetchMock.mockResponseOnce(JSON.stringify([{ id: '54321' }]))
        params.value.id = '54321'
        await nextTick()
        expect(isLoading.value).toBe(true)
        await flushPromises()
        expect(isLoading.value).toBe(false)
        expect(isSuccess.value).toBe(true)
        expect(data.value?.[0].id).toBe('54321')
        expect(item.value?.id).toBe('54321')
        expect(getItemByKey('12345').value?.id).toBe('12345')
        expect(getItemByKey('54321').value?.id).toBe('54321')
        expect(fetchMock.mock.calls.length).toBe(2)
        const firstRequest = fetchMock.mock.calls[0][0] as Request
        expect(firstRequest.url).toEqual('https://myapi.com/v1/12345')
        expect(firstRequest.method).toEqual('GET')
        const secondRequest = fetchMock.mock.calls[1][0] as Request
        expect(secondRequest.url).toEqual('https://myapi.com/v1/54321')
        expect(secondRequest.method).toEqual('GET')
    })

    it('read from a ref with autoExecute and stop', async () => {
        fetchMock.mockResponseOnce(async () => {
            return JSON.stringify([{ id: '12345' }])
        })
        const useStoreReposotory = defineStoreRepository<Entity>(
            repositoryHttp,
            'read-ref-stop',
        )
        const { read, getItemByKey } = useStoreReposotory()
        const params = ref({ id: '12345' })
        const { isLoading, isSuccess, data, item, stop } = read(params, {
            autoExecute: true,
        })
        expect(isLoading.value).toBe(true)
        await flushPromises()
        expect(isLoading.value).toBe(false)
        expect(isSuccess.value).toBe(true)
        expect(data.value?.[0].id).toBe('12345')
        expect(item.value?.id).toBe('12345')
        expect(getItemByKey('12345').value?.id).toBe('12345')
        stop()
        params.value.id = '54321'
        await nextTick()
        expect(isLoading.value).toBe(false)
        expect(fetchMock.mock.calls.length).toBe(1)
        const secondRequest = fetchMock.mock.calls[0][0] as Request
        expect(secondRequest.url).toEqual('https://myapi.com/v1/12345')
        expect(secondRequest.method).toEqual('GET')
    })

    it('re-execute', async () => {
        fetchMock.mockResponseOnce(async () => {
            return JSON.stringify([{ id: '12345' }])
        })
        const useStoreReposotory = defineStoreRepository<Entity>(
            repositoryHttp,
            'read-execute',
        )
        const { read, getItemByKey } = useStoreReposotory()
        const { isLoading, isSuccess, data, item, execute } = read({
            id: '12345',
        })
        expect(isLoading.value).toBe(true)
        await flushPromises()
        expect(isLoading.value).toBe(false)
        expect(isSuccess.value).toBe(true)
        expect(data.value?.[0].id).toBe('12345')
        expect(item.value?.id).toBe('12345')
        expect(getItemByKey('12345').value?.id).toBe('12345')
        // change params
        fetchMock.mockResponseOnce(JSON.stringify([{ id: '54321' }]))
        execute({ id: '54321' })
        await nextTick()
        expect(isLoading.value).toBe(true)
        await flushPromises()
        expect(isLoading.value).toBe(false)
        expect(isSuccess.value).toBe(true)
        expect(data.value?.[0].id).toBe('54321')
        expect(item.value?.id).toBe('54321')
        expect(getItemByKey('54321').value?.id).toBe('54321')
        expect(fetchMock.mock.calls.length).toBe(2)
        const firstRequest = fetchMock.mock.calls[0][0] as Request
        expect(firstRequest.url).toEqual('https://myapi.com/v1/12345')
        expect(firstRequest.method).toEqual('GET')
        const secondRequest = fetchMock.mock.calls[1][0] as Request
        expect(secondRequest.url).toEqual('https://myapi.com/v1/54321')
        expect(secondRequest.method).toEqual('GET')
    })

    it('ref executeWhen ', async () => {
        fetchMock.mockResponseOnce(async () => {
            return JSON.stringify([{ id: '12345' }])
        })
        const useStoreReposotory = defineStoreRepository<Entity>(
            repositoryHttp,
            'read-execute-when',
        )
        const { read, getItemByKey } = useStoreReposotory()
        const executeWhen = ref(false)
        const { isLoading, isSuccess, data, item } = read(
            {
                id: '12345',
            },
            { executeWhen },
        )
        expect(isLoading.value).toBe(false)
        // change executeWhen
        executeWhen.value = true
        await nextTick()
        expect(isLoading.value).toBe(true)
        await flushPromises()
        expect(isLoading.value).toBe(false)
        expect(isSuccess.value).toBe(true)
        expect(data.value?.[0].id).toBe('12345')
        expect(item.value?.id).toBe('12345')
        expect(getItemByKey('12345').value?.id).toBe('12345')
        expect(fetchMock.mock.calls.length).toBe(1)
        const secondRequest = fetchMock.mock.calls[0][0] as Request
        expect(secondRequest.url).toEqual('https://myapi.com/v1/12345')
        expect(secondRequest.method).toEqual('GET')
    })

    it('computed executeWhen', async () => {
        fetchMock.mockResponseOnce(async () => {
            return JSON.stringify([{ id: '12345' }])
        })
        const useStoreReposotory = defineStoreRepository<Entity>(
            repositoryHttp,
            'read-execute-when-computed',
        )
        const { read, getItemByKey } = useStoreReposotory()
        const params = ref<{ id?: string }>({ id: undefined })
        const { isLoading, isSuccess, data, item } = read(params, {
            executeWhen: computed(() => params.value.id !== undefined),
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
        expect(item.value?.id).toBe('12345')
        expect(getItemByKey('12345').value?.id).toBe('12345')
        expect(fetchMock.mock.calls.length).toBe(1)
        const secondRequest = fetchMock.mock.calls[0][0] as Request
        expect(secondRequest.url).toEqual('https://myapi.com/v1/12345')
        expect(secondRequest.method).toEqual('GET')
    })

    it('function executeWhen', async () => {
        fetchMock.mockResponseOnce(async () => {
            return JSON.stringify([{ id: '12345' }])
        })
        const useStoreReposotory = defineStoreRepository<Entity>(
            repositoryHttp,
            'read-when-func',
        )
        const { read, getItemByKey } = useStoreReposotory()
        const params = ref<{ id?: string }>({ id: undefined })
        const { isLoading, isSuccess, data, item } = read(params, {
            executeWhen: params => params?.id !== undefined,
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
        expect(item.value?.id).toBe('12345')
        expect(getItemByKey('12345').value?.id).toBe('12345')
        expect(fetchMock.mock.calls.length).toBe(1)
        const secondRequest = fetchMock.mock.calls[0][0] as Request
        expect(secondRequest.url).toEqual('https://myapi.com/v1/12345')
        expect(secondRequest.method).toEqual('GET')
    })

    it('group queries (infinite scroll)', async () => {
        // page 1
        fetchMock.mockResponseOnce(async () => {
            return JSON.stringify([{ id: '1' }, { id: '2' }])
        })
        const useStoreReposotory = defineStoreRepository<Entity>(
            repositoryHttp,
            'read-group',
        )
        const { read } = useStoreReposotory()
        const params = ref({ page: 1, limit: 2 })
        const { isLoading, isSuccess, data } = read(params, {
            group: true,
            autoExecute: true,
        })
        expect(isLoading.value).toBe(true)
        await flushPromises()
        expect(isLoading.value).toBe(false)
        expect(isSuccess.value).toBe(true)
        expect(data.value.length).toBe(2)
        // page 2
        fetchMock.mockResponseOnce(async () => {
            return JSON.stringify([{ id: 1 }, { id: 2 }])
        })
        params.value.page = 2
        await nextTick()
        expect(isLoading.value).toBe(true)
        await flushPromises()
        expect(isLoading.value).toBe(false)
        expect(isSuccess.value).toBe(true)
        expect(data.value.length).toBe(4)
        expect(fetchMock.mock.calls.length).toBe(2)
    })
})
