import { HttpClient, RepositoryHttp } from '@volverjs/data'
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import { defineStoreRepository } from '../src/index'
import ReadProvider from './components/ReadProvider.vue'
import { fetchMock, foreignThenables, mountWithPinia, setupStoreTest } from './utils'

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

    it('awaiting with immediate false resolves at once to the current snapshot', async () => {
        const useStore = defineStoreRepository<Entity>(
            repositoryHttp,
            'read-await-not-immediate',
        )
        const { read } = useStore()
        const result = read({ id: '1' }, { immediate: false })
        const before = await result
        expect(before.isSuccess).toBe(false)
        expect(before.isError).toBe(false)
        expect(before.aborted).toBe(false)
        expect(before.data).toEqual([])
        expect(fetchMock.mock.calls).toHaveLength(0)
        fetchMock.mockResponseOnce(JSON.stringify([{ id: '1' }]))
        await result.execute()
        const after = await result
        expect(after.item?.id).toBe('1')
        expect(fetchMock.mock.calls).toHaveLength(1)
    })

    it('awaiting while executeWhen is false resolves at once without a request', async () => {
        const useStore = defineStoreRepository<Entity>(
            repositoryHttp,
            'read-await-execute-when',
        )
        const { read } = useStore()
        const executeWhen = ref(false)
        const { isSuccess, aborted } = await read({ id: '1' }, { executeWhen })
        expect(isSuccess).toBe(false)
        expect(aborted).toBe(false)
        expect(fetchMock.mock.calls).toHaveLength(0)
    })

    it('awaiting with autoExecute settles on the first execution only', async () => {
        fetchMock.mockResponseOnce(JSON.stringify([{ id: '1' }]))
        const useStore = defineStoreRepository<Entity>(
            repositoryHttp,
            'read-await-auto-execute',
        )
        const { read } = useStore()
        const params = ref({ id: '1' })
        // owned by a scope, as in a component: awaiting does not release it
        const scope = effectScope()
        const result = scope.run(() => read(params, { autoExecute: true }))!
        const first = await result
        expect(first.item?.id).toBe('1')
        fetchMock.mockResponseOnce(JSON.stringify([{ id: '2' }]))
        params.value.id = '2'
        await nextTick()
        await flushPromises()
        expect(result.item.value?.id).toBe('2')
        // the awaitable is the first execution: it does not follow the watcher
        expect(await result).toBe(first)
        expect(fetchMock.mock.calls).toHaveLength(2)
        scope.stop()
    })

    it('awaiting an aborted read resolves with aborted true', async () => {
        fetchMock.mockResponse(JSON.stringify([{ id: '2' }]))
        const useStore = defineStoreRepository<Entity>(
            repositoryHttp,
            'read-await-aborted',
        )
        const { read } = useStore()
        const result = read({ id: '1' })
        // a new execution with other params aborts the immediate one: the abort
        // is synchronous, before the first fetch is sent, so the order is fixed
        result.execute({ id: '2' })
        const { aborted, isError } = await result
        expect(aborted).toBe(true)
        expect(isError).toBe(false)
        await flushPromises()
        expect(result.item.value?.id).toBe('2')
    })

    it('awaiting a read that joins a failing request resolves with the error', async () => {
        fetchMock.mockResponseOnce('Bad Request', { status: 400 })
        const useStore = defineStoreRepository<Entity>(
            repositoryHttp,
            'read-await-join-error',
        )
        const { read } = useStore()
        const first = read({ id: '1' })
        // same params while the first request is in flight: it joins it
        const second = read({ id: '1' })
        const [firstSnapshot, secondSnapshot] = await Promise.all([first, second])
        expect(firstSnapshot.isError).toBe(true)
        expect(secondSnapshot.isError).toBe(true)
        expect(secondSnapshot.error).toBeInstanceOf(Error)
        expect(second.error.value).toBe(first.error.value)
        expect(first.error.value).toBeInstanceOf(Error)
        expect(fetchMock.mock.calls).toHaveLength(1)
    })

    it('awaiting a read that joins an aborted request resolves with aborted true', async () => {
        fetchMock.mockResponse(JSON.stringify([{ id: '2' }]))
        const useStore = defineStoreRepository<Entity>(
            repositoryHttp,
            'read-await-join-aborted',
        )
        const { read } = useStore()
        const first = read({ id: '1' })
        // same params while the first request is in flight: it joins it
        const second = read({ id: '1' })
        // the first query moves on and aborts the shared request
        first.execute({ id: '2' })
        const { aborted, isSuccess } = await second
        expect(aborted).toBe(true)
        expect(isSuccess).toBe(false)
    })

    it('thenable assimilation runs one request and leaves no thenable in the store', async () => {
        fetchMock.mockResponseOnce(JSON.stringify([{ id: '1' }]))
        const useStore = defineStoreRepository<Entity>(
            repositoryHttp,
            'read-await-assimilation',
        )
        const store = useStore()
        const result = store.read({ id: '1' })
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
        expect(direct.item?.id).toBe('1')
        expect('then' in direct).toBe(false)
        expect(fetchMock.mock.calls).toHaveLength(1)
        expect(foreignThenables(store)).toEqual([])
    })

    it('an awaited read with no owner releases its query and items once it settles', async () => {
        fetchMock.mockResponseOnce(JSON.stringify([{ id: '1' }]))
        const useStore = defineStoreRepository<Entity>(
            repositoryHttp,
            'read-await-release',
        )
        const store = useStore()
        // no component and no effect scope, as in an event handler
        const { isSuccess } = await store.read({ id: '1' }, { name: 'q' })
        expect(isSuccess).toBe(true)
        expect(store.getQueryByName('q').value?.enabled).toBe(false)
        store.cleanUp()
        expect(store.getQueryByName('q').value).toBeUndefined()
        expect(store.items.size).toBe(0)
    })

    it('a read owned by an effect scope is cleaned up when the scope is disposed', async () => {
        fetchMock.mockResponseOnce(JSON.stringify([{ id: '1' }]))
        const useStore = defineStoreRepository<Entity>(
            repositoryHttp,
            'read-scope-dispose',
        )
        const { read, getQueryByName } = useStore()
        const scope = effectScope()
        const result = scope.run(() => read({ id: '1' }, { name: 'q' }))!
        await result
        // awaiting does not release a query that has an owner
        expect(getQueryByName('q').value?.enabled).toBe(true)
        scope.stop()
        expect(getQueryByName('q').value?.enabled).toBe(false)
    })

    it('the ReadProvider instance is not thenable', async () => {
        fetchMock.mockResponseOnce(JSON.stringify([{ id: '12345' }]))
        const wrapper = mountWithPinia(ReadProvider)
        await flushPromises()
        const provider = wrapper.findComponent({
            name: 'StoreRepositoryReadProvider',
        })
        expect(provider.exists()).toBe(true)
        expect(typeof (provider.vm as any).execute).toBe('function')
        expect((provider.vm as any).then).toBeUndefined()
        expect(fetchMock.mock.calls).toHaveLength(1)
    })
})
