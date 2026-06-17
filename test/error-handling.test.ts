import { HttpClient, RepositoryHttp } from '@volverjs/data'
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { defineStoreRepository } from '../src/index'
import { fetchMock, setupStoreTest } from './utils'

const httpClient = new HttpClient({
    prefixUrl: 'https://myapi.com/v1',
})
type Entity = { id?: string, name?: string }
const repositoryHttp = new RepositoryHttp<Entity>(httpClient, ':id?')

describe('error handling', () => {
    setupStoreTest()

    it('read sets the error state when the request fails', async () => {
        // 400 is not retried by ky, so a single mocked response is enough
        fetchMock.mockResponseOnce('Bad Request', { status: 400 })
        const useStore = defineStoreRepository<Entity>(
            repositoryHttp,
            'error-read',
        )
        const { read } = useStore()
        const { isLoading, isError, isSuccess, error, errors } = read({
            id: '1',
        })
        expect(isLoading.value).toBe(true)
        await flushPromises()
        expect(isLoading.value).toBe(false)
        expect(isError.value).toBe(true)
        expect(isSuccess.value).toBe(false)
        expect(error.value).toBeInstanceOf(Error)
        expect(errors.value.length).toBeGreaterThan(0)
    })

    it('read succeeds with an empty array response', async () => {
        fetchMock.mockResponseOnce(JSON.stringify([]))
        const useStore = defineStoreRepository<Entity>(
            repositoryHttp,
            'error-read-empty',
        )
        const { read } = useStore()
        const { isError, isSuccess, data } = read({ id: '1' })
        await flushPromises()
        expect(isError.value).toBe(false)
        expect(isSuccess.value).toBe(true)
        expect(data.value).toEqual([])
    })

    it('read errors when the response is missing the key property', async () => {
        fetchMock.mockResponseOnce(JSON.stringify([{ name: 'no-id' }]))
        const useStore = defineStoreRepository<Entity>(
            repositoryHttp,
            'error-read-missing-key',
        )
        const { read } = useStore()
        const { isError, isSuccess, error } = read({ id: '1' })
        await flushPromises()
        expect(isError.value).toBe(true)
        expect(isSuccess.value).toBe(false)
        expect(error.value?.message).toContain('id')
    })

    it('read in directory mode does not require the key property', async () => {
        fetchMock.mockResponseOnce(JSON.stringify([{ name: 'no-id' }]))
        const useStore = defineStoreRepository<Entity>(
            repositoryHttp,
            'error-read-directory-no-key',
        )
        const { read } = useStore()
        const { isError, isSuccess, data } = read(
            { id: '1' },
            { directory: true },
        )
        await flushPromises()
        expect(isError.value).toBe(false)
        expect(isSuccess.value).toBe(true)
        expect(data.value?.[0]?.name).toBe('no-id')
    })

    it('submit sets the error state when the request fails', async () => {
        fetchMock.mockResponseOnce('Bad Request', { status: 400 })
        const useStore = defineStoreRepository<Entity>(
            repositoryHttp,
            'error-submit',
        )
        const { submit } = useStore()
        const { isError, isSuccess, error } = submit({ name: 'test' })
        await flushPromises()
        expect(isError.value).toBe(true)
        expect(isSuccess.value).toBe(false)
        expect(error.value).toBeInstanceOf(Error)
    })

    it('submit does not throw on an empty array response (clone of undefined)', async () => {
        fetchMock.mockResponseOnce(JSON.stringify([]))
        const useStore = defineStoreRepository<Entity>(
            repositoryHttp,
            'error-submit-empty',
        )
        const { submit } = useStore()
        const payload = ref<Entity>({ name: 'test' })
        const { isError, isSuccess } = submit(payload)
        await flushPromises()
        // before the clone(undefined) guard this flipped to an error state
        expect(isError.value).toBe(false)
        expect(isSuccess.value).toBe(true)
    })

    it('remove sets the error state when the request fails', async () => {
        fetchMock.mockResponseOnce('Bad Request', { status: 400 })
        const useStore = defineStoreRepository<Entity>(
            repositoryHttp,
            'error-remove',
        )
        const { remove } = useStore()
        const { isError, isSuccess, error } = remove({ id: '1' })
        await flushPromises()
        expect(isError.value).toBe(true)
        expect(isSuccess.value).toBe(false)
        expect(error.value).toBeInstanceOf(Error)
    })
})
