import { HttpClient, RepositoryHttp } from '@volverjs/data'
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineStoreRepository } from '../src/index'
import RemoveProvider from './components/RemoveProvider.vue'
import { fetchMock, foreignThenables, mountWithPinia, setupStoreTest } from './utils'

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

    it('awaiting with immediate false resolves at once to the current snapshot', async () => {
        const useStore = defineStoreRepository<Entity>(
            repositoryHttp,
            'remove-await-not-immediate',
        )
        const { remove } = useStore()
        const result = remove({ id: '1' }, { immediate: false })
        const before = await result
        expect(before.isSuccess).toBe(false)
        expect(before.isError).toBe(false)
        expect(before.aborted).toBe(false)
        expect(fetchMock.mock.calls.length).toBe(0)
        // awaiting reflects later executions only through the current snapshot
        fetchMock.mockResponseOnce('', { status: 204 })
        await result.execute()
        const after = await result
        expect(after.isSuccess).toBe(true)
        expect(fetchMock.mock.calls.length).toBe(1)
    })

    it('awaiting an aborted removal resolves with aborted true', async () => {
        fetchMock.mockResponse('', { status: 204 })
        const useStore = defineStoreRepository<Entity>(
            repositoryHttp,
            'remove-await-aborted',
        )
        const { remove } = useStore()
        const result = remove({ id: '1' })
        // a new execution with other params aborts the immediate one: the abort
        // is synchronous, before the first fetch is sent, so the order is fixed
        result.execute({ id: '2' })
        const { aborted, isError } = await result
        expect(aborted).toBe(true)
        expect(isError).toBe(false)
        await flushPromises()
        expect(result.isSuccess.value).toBe(true)
    })

    it('thenable assimilation runs one request and leaves no thenable in the store', async () => {
        fetchMock.mockResponseOnce('', { status: 204 })
        const useStore = defineStoreRepository<Entity>(
            repositoryHttp,
            'remove-await-assimilation',
        )
        const store = useStore()
        const result = store.remove({ id: '1' })
        // in flight a read holds its native `responsePromise`, never the awaitable
        expect(foreignThenables(store)).toEqual([])
        const [direct, resolved, returned] = await Promise.all([
            result,
            Promise.resolve(result),
            (async () => result)(),
        ])
        expect(await result).toBe(direct)
        expect(resolved).toBe(direct)
        expect(returned).toBe(direct)
        expect(direct.isSuccess).toBe(true)
        expect('then' in direct).toBe(false)
        expect(fetchMock.mock.calls.length).toBe(1)
        expect(foreignThenables(store)).toEqual([])
    })

    it('an awaited removal with no owner releases its query once it settles', async () => {
        fetchMock.mockResponseOnce('', { status: 204 })
        const useStore = defineStoreRepository<Entity>(
            repositoryHttp,
            'remove-await-release',
        )
        const { remove, getQueryByName } = useStore()
        // no component and no effect scope, as in an event handler
        const { isSuccess } = await remove({ id: '1' }, { name: 'rm' })
        expect(isSuccess).toBe(true)
        expect(getQueryByName('rm').value?.enabled).toBe(false)
    })

    it('an awaited removal with no owner and keepAlive keeps its query', async () => {
        fetchMock.mockResponseOnce('', { status: 204 })
        const useStore = defineStoreRepository<Entity>(
            repositoryHttp,
            'remove-await-keepalive',
        )
        const { remove, getQueryByName } = useStore()
        await remove({ id: '1' }, { name: 'rm', keepAlive: true })
        expect(getQueryByName('rm').value?.enabled).toBe(true)
    })

    it('the RemoveProvider instance is not thenable', async () => {
        fetchMock.mockResponseOnce(JSON.stringify([{ id: '12345' }]))
        const wrapper = mountWithPinia(RemoveProvider)
        await flushPromises()
        const provider = wrapper.findComponent({
            name: 'StoreRepositoryRemoveProvider',
        })
        expect(provider.exists()).toBe(true)
        expect(typeof (provider.vm as any).execute).toBe('function')
        expect((provider.vm as any).then).toBeUndefined()
        expect(fetchMock.mock.calls.length).toBe(1)
    })
})
