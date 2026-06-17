import { HttpClient, RepositoryHttp } from '@volverjs/data'
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineStoreRepository } from '../src/index'
import { fetchMock, setupStoreTest } from './utils'

const httpClient = new HttpClient({
    prefixUrl: 'https://myapi.com/v1',
})
type Entity = { id: string }
const repositoryHttp = new RepositoryHttp<Entity>(httpClient, ':id?')

describe('remove advanced', () => {
    setupStoreTest()

    it('disables the query on cleanup by default', async () => {
        fetchMock.mockResponseOnce('', { status: 204 })
        const useStore = defineStoreRepository<Entity>(
            repositoryHttp,
            'remove-cleanup-default',
        )
        const { remove, getQueryByName } = useStore()
        const { cleanup } = remove({ id: '1' }, { name: 'rm' })
        await flushPromises()
        expect(getQueryByName('rm').value?.enabled).toBe(true)
        cleanup()
        expect(getQueryByName('rm').value?.enabled).toBe(false)
    })

    it('keeps the query alive on cleanup when keepAlive is true', async () => {
        fetchMock.mockResponseOnce('', { status: 204 })
        const useStore = defineStoreRepository<Entity>(
            repositoryHttp,
            'remove-keepalive',
        )
        const { remove, getQueryByName } = useStore()
        const { cleanup } = remove({ id: '1' }, {
            name: 'rm',
            keepAlive: true,
        })
        await flushPromises()
        expect(getQueryByName('rm').value?.enabled).toBe(true)
        cleanup()
        expect(getQueryByName('rm').value?.enabled).toBe(true)
    })

    it('does not execute when immediate is false', async () => {
        fetchMock.mockResponseOnce('', { status: 204 })
        const useStore = defineStoreRepository<Entity>(
            repositoryHttp,
            'remove-not-immediate',
        )
        const { remove } = useStore()
        const { isLoading, execute } = remove({ id: '1' }, {
            immediate: false,
        })
        expect(isLoading.value).toBe(false)
        expect(fetchMock.mock.calls.length).toBe(0)
        await execute()
        expect(fetchMock.mock.calls.length).toBe(1)
        const request = fetchMock.mock.calls[0][0] as Request
        expect(request.method).toBe('DELETE')
    })
})
