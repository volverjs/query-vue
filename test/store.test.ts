import { HttpClient, RepositoryHttp } from '@volverjs/data'
import { Hash } from '@volverjs/data/hash'
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineStoreRepository } from '../src/index'
import { fetchMock, setupStoreTest } from './utils'

const httpClient = new HttpClient({
    prefixUrl: 'https://myapi.com/v1',
})
type Entity = { id: string }
const repositoryHttp = new RepositoryHttp<Entity>(httpClient, ':id?')

describe('store', () => {
    setupStoreTest()

    it('getQueryByName returns undefined for an unknown query', () => {
        const useStore = defineStoreRepository<Entity>(
            repositoryHttp,
            'store-unknown-query',
        )
        const { getQueryByName } = useStore()
        expect(getQueryByName('does-not-exist').value).toBeUndefined()
    })

    it('getItemsByKeys returns every cached item matching the keys', async () => {
        fetchMock.mockResponseOnce(
            JSON.stringify([{ id: '1' }, { id: '2' }, { id: '3' }]),
        )
        const useStore = defineStoreRepository<Entity>(
            repositoryHttp,
            'store-items-by-keys',
        )
        const { read, getItemsByKeys } = useStore()
        read({})
        await flushPromises()
        const items = getItemsByKeys(['1', '3', 'missing'])
        expect(items.value.map(item => item.id)).toEqual(['1', '3'])
    })

    it('resetQuery clears the query data and evicts unreferenced items', async () => {
        fetchMock.mockResponseOnce(JSON.stringify([{ id: '12345' }]))
        const useStore = defineStoreRepository<Entity>(
            repositoryHttp,
            'store-reset-query',
        )
        const { read, getItemByKey, getQueryByName, resetQuery } = useStore()
        read({ id: '12345' }, { name: 'my-query' })
        await flushPromises()
        expect(getItemByKey('12345').value?.id).toBe('12345')
        expect(getQueryByName('my-query').value?.data?.[0]?.id).toBe('12345')

        resetQuery('my-query')
        // the query is emptied
        expect(getQueryByName('my-query').value?.data).toEqual([])
        // and the item is evicted because no living hash references it anymore
        expect(getItemByKey('12345').value).toBeUndefined()
    })

    it('cleanUp removes disabled queries, their hashes and orphan items', async () => {
        fetchMock.mockResponseOnce(JSON.stringify([{ id: '12345' }]))
        const useStore = defineStoreRepository<Entity>(
            repositoryHttp,
            'store-cleanup',
        )
        const { read, getItemByKey, hashes, queries, cleanUp } = useStore()
        const handle = read({ id: '12345' }, { name: 'to-clean' })
        await flushPromises()
        expect(getItemByKey('12345').value?.id).toBe('12345')
        // `queries`/`hashes` are pinia state, already unwrapped to the Map
        expect(queries.has('to-clean')).toBe(true)

        // disable the query, then run the clean up
        handle.cleanup()
        cleanUp()

        expect(queries.has('to-clean')).toBe(false)
        expect(hashes.size).toBe(0)
        expect(getItemByKey('12345').value).toBeUndefined()
    })

    it('uses a custom keyProperty function to index items', async () => {
        type UuidEntity = { uuid: string }
        fetchMock.mockResponseOnce(JSON.stringify([{ uuid: 'abc' }]))
        const repo = new RepositoryHttp<UuidEntity>(httpClient, ':uuid?')
        const useStore = defineStoreRepository<UuidEntity>(
            repo,
            'store-keyproperty-fn',
            { keyProperty: entity => entity.uuid },
        )
        const { read, getItemByKey } = useStore()
        read({ uuid: 'abc' })
        await flushPromises()
        expect(getItemByKey('abc').value?.uuid).toBe('abc')
    })

    it('uses a custom keyProperty object { name, get }', async () => {
        type UuidEntity = { uuid: string }
        fetchMock.mockResponseOnce(JSON.stringify([{ uuid: 'xyz' }]))
        const repo = new RepositoryHttp<UuidEntity>(httpClient, ':uuid?')
        const useStore = defineStoreRepository<UuidEntity>(
            repo,
            'store-keyproperty-object',
            { keyProperty: { name: 'uuid', get: entity => entity.uuid } },
        )
        const { read, getItemByKey } = useStore()
        read({ uuid: 'xyz' })
        await flushPromises()
        expect(getItemByKey('xyz').value?.uuid).toBe('xyz')
    })

    it('merges defaultParameters into every request', async () => {
        fetchMock.mockResponseOnce(JSON.stringify([{ id: '1' }]))
        const useStore = defineStoreRepository<Entity>(
            repositoryHttp,
            'store-default-parameters',
            { defaultParameters: { lang: 'en' } },
        )
        const { read } = useStore()
        read({ id: '1' })
        await flushPromises()
        const request = fetchMock.mock.calls[0][0] as Request
        expect(request.url).toContain('lang=en')
    })

    it('uses the provided hashFunction', async () => {
        fetchMock.mockResponseOnce(JSON.stringify([{ id: '1' }]))
        const hashFunction = vi.fn((str: string) => Hash.cyrb53(str))
        const useStore = defineStoreRepository<Entity>(
            repositoryHttp,
            'store-hash-function',
            { hashFunction },
        )
        const { read } = useStore()
        read({ id: '1' })
        await flushPromises()
        expect(hashFunction).toHaveBeenCalled()
    })

    it('accepts cleanUpEvery: false (auto clean up disabled)', async () => {
        fetchMock.mockResponseOnce(JSON.stringify([{ id: '1' }]))
        const useStore = defineStoreRepository<Entity>(
            repositoryHttp,
            'store-cleanup-disabled',
            { cleanUpEvery: false },
        )
        const { read, getItemByKey } = useStore()
        const { isSuccess } = read({ id: '1' })
        await flushPromises()
        expect(isSuccess.value).toBe(true)
        expect(getItemByKey('1').value?.id).toBe('1')
    })
})
