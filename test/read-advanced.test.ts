import { HttpClient, RepositoryHttp } from '@volverjs/data'
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { defineStoreRepository } from '../src/index'
import { fetchMock, setupStoreTest } from './utils'

const httpClient = new HttpClient({
    prefixUrl: 'https://myapi.com/v1',
})
type Entity = { id: string }
const repositoryHttp = new RepositoryHttp<Entity>(httpClient, ':id?')

describe('read advanced', () => {
    setupStoreTest()

    it('disables the query on cleanup by default', async () => {
        fetchMock.mockResponseOnce(JSON.stringify([{ id: '1' }]))
        const useStore = defineStoreRepository<Entity>(
            repositoryHttp,
            'read-cleanup-default',
        )
        const { read, getQueryByName } = useStore()
        const { cleanup } = read({ id: '1' }, { name: 'q' })
        await flushPromises()
        expect(getQueryByName('q').value?.enabled).toBe(true)
        cleanup()
        expect(getQueryByName('q').value?.enabled).toBe(false)
    })

    it('keeps the query alive on cleanup when keepAlive is true', async () => {
        fetchMock.mockResponseOnce(JSON.stringify([{ id: '1' }]))
        const useStore = defineStoreRepository<Entity>(
            repositoryHttp,
            'read-keepalive',
        )
        const { read, getQueryByName } = useStore()
        const { cleanup } = read({ id: '1' }, { name: 'q', keepAlive: true })
        await flushPromises()
        expect(getQueryByName('q').value?.enabled).toBe(true)
        cleanup()
        expect(getQueryByName('q').value?.enabled).toBe(true)
    })

    it('getItemByKey reacts to a ref key', async () => {
        fetchMock.mockResponseOnce(JSON.stringify([{ id: '1' }, { id: '2' }]))
        const useStore = defineStoreRepository<Entity>(
            repositoryHttp,
            'read-reactive-key',
        )
        const { read, getItemByKey } = useStore()
        read({})
        await flushPromises()
        const key = ref('1')
        const item = getItemByKey(key)
        expect(item.value?.id).toBe('1')
        key.value = '2'
        expect(item.value?.id).toBe('2')
    })

    it('does not refetch a cached query within the persistence window', async () => {
        fetchMock.mockResponseOnce(JSON.stringify([{ id: '1' }]))
        const useStore = defineStoreRepository<Entity>(
            repositoryHttp,
            'read-persistence-cache',
        )
        const { read } = useStore()
        const first = read({ id: '1' })
        await flushPromises()
        expect(first.isSuccess.value).toBe(true)
        // a second read with the same params hits the cache, no extra request
        const second = read({ id: '1' })
        await flushPromises()
        expect(second.isSuccess.value).toBe(true)
        expect(fetchMock.mock.calls.length).toBe(1)
    })
})
