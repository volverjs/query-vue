import { HttpClient, RepositoryHttp } from '@volverjs/data'
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import { defineStoreRepository } from '../src/index'
import ReadProvider from './components/ReadProvider.vue'
import {
    fetchMock,
    foreignThenables,
    manualRepository,
    mountWithPinia,
    requestedId,
    sentRequests,
    setupStoreTest,
} from './utils'

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

    it('a read that joins a request keeps it running when the first query moves on', async () => {
        fetchMock.mockResponse((request: Request) => JSON.stringify([{ id: requestedId(request) }]))
        const useStore = defineStoreRepository<Entity>(
            repositoryHttp,
            'read-join-first-moves-on',
        )
        const { read } = useStore()
        const first = read({ id: '1' })
        // same params while the first request is in flight: it joins it
        const second = read({ id: '1' })
        expect(second.isLoading.value).toBe(true)
        // the first query moves on, the second one still waits on the request
        first.execute({ id: '2' })
        expect(second.isLoading.value).toBe(true)
        const [firstSnapshot, secondSnapshot] = await Promise.all([first, second])
        expect(firstSnapshot.aborted).toBe(true)
        expect(secondSnapshot.aborted).toBe(false)
        expect(secondSnapshot.isSuccess).toBe(true)
        expect(secondSnapshot.item?.id).toBe('1')
        await flushPromises()
        expect(second.isSuccess.value).toBe(true)
        expect(second.item.value?.id).toBe('1')
        expect(first.item.value?.id).toBe('2')
        expect(sentRequests()).toEqual([
            { id: '1', aborted: false },
            { id: '2', aborted: false },
        ])
    })

    it('a read that joined a request and moves on neither aborts it nor goes back to it', async () => {
        fetchMock.mockResponse((request: Request) => JSON.stringify([{ id: requestedId(request) }]))
        const useStore = defineStoreRepository<Entity>(
            repositoryHttp,
            'read-join-joiner-moves-on',
        )
        const { read } = useStore()
        const first = read({ id: '1' })
        const second = read({ id: '1' })
        second.execute({ id: '3' })
        const [firstSnapshot, secondSnapshot] = await Promise.all([first, second])
        expect(firstSnapshot.aborted).toBe(false)
        expect(firstSnapshot.item?.id).toBe('1')
        // the join was replaced: it neither waits for nor shows the first hash
        expect(secondSnapshot.aborted).toBe(true)
        await flushPromises()
        expect(first.item.value?.id).toBe('1')
        expect(second.item.value?.id).toBe('3')
        expect(sentRequests()).toEqual([
            { id: '1', aborted: false },
            { id: '3', aborted: false },
        ])
    })

    it('a shared request is aborted once every query waiting on it moves on', async () => {
        fetchMock.mockResponse((request: Request) => JSON.stringify([{ id: requestedId(request) }]))
        const useStore = defineStoreRepository<Entity>(
            repositoryHttp,
            'read-join-all-move-on',
        )
        const store = useStore()
        const first = store.read({ id: '1' })
        const second = store.read({ id: '1' })
        first.execute({ id: '2' })
        second.execute({ id: '3' })
        const [firstSnapshot, secondSnapshot] = await Promise.all([first, second])
        expect(firstSnapshot.aborted).toBe(true)
        expect(secondSnapshot.aborted).toBe(true)
        await flushPromises()
        expect(first.item.value?.id).toBe('2')
        expect(second.item.value?.id).toBe('3')
        expect(sentRequests()).toEqual([
            { id: '1', aborted: true },
            { id: '2', aborted: false },
            { id: '3', aborted: false },
        ])
    })

    it('a query that sends a new request on its hash releases the older one', async () => {
        fetchMock.mockResponse((request: Request) => JSON.stringify([{ id: requestedId(request) }]))
        const useStore = defineStoreRepository<Entity>(
            repositoryHttp,
            'read-same-hash-new-request',
        )
        const { read } = useStore()
        // with persistence 0 every execution sends a request: the repository
        // shares the one in flight for the same params
        const result = read({ id: '1' }, { persistence: 0 })
        result.execute({ id: '1' })
        result.execute({ id: '2' })
        await flushPromises()
        expect(result.item.value?.id).toBe('2')
        expect(sentRequests()).toEqual([
            { id: '1', aborted: true },
            { id: '2', aborted: false },
        ])
    })

    it('a query that joins a newer request on its hash keeps it when the sender moves on', async () => {
        fetchMock.mockResponse((request: Request) => JSON.stringify([{ id: requestedId(request) }]))
        const useStore = defineStoreRepository<Entity>(
            repositoryHttp,
            'read-join-newer-request',
        )
        const { read } = useStore()
        const first = read({ id: '1' })
        // persistence 0: the second query sends its own request on the same hash
        const second = read({ id: '1' }, { persistence: 0 })
        // the first query executes again and joins the newer request
        const again = first.execute({ id: '1' })
        second.execute({ id: '3' })
        const { aborted, isSuccess, item } = await again
        expect(aborted).toBe(false)
        expect(isSuccess).toBe(true)
        expect(item?.id).toBe('1')
    })

    it('two reads sharing a name follow the last params', async () => {
        fetchMock.mockResponse((request: Request) => JSON.stringify([{ id: requestedId(request) }]))
        const useStore = defineStoreRepository<Entity>(
            repositoryHttp,
            'read-shared-name',
        )
        const { read, getQueryByName } = useStore()
        const first = read({ id: '1' }, { name: 'q' })
        read({ id: '1' }, { name: 'q' })
        first.execute({ id: '2' })
        await flushPromises()
        expect(getQueryByName('q').value?.data.map(item => item.id)).toEqual(['2'])
    })

    it('an awaited read keeps the shared request of a later execution', async () => {
        fetchMock.mockResponse((request: Request) => JSON.stringify([{ id: requestedId(request) }]))
        const useStore = defineStoreRepository<Entity>(
            repositoryHttp,
            'read-awaited-keeps-later-request',
        )
        const { read } = useStore()
        // no owner: awaiting releases the query once the first execution ends
        const first = read({ id: '1' })
        const later = first.execute({ id: '2' })
        const other = read({ id: '2' })
        await first
        // the other query moves on, the later execution still waits
        other.execute({ id: '3' })
        const { aborted, isSuccess, item } = await later
        expect(aborted).toBe(false)
        expect(isSuccess).toBe(true)
        expect(item?.id).toBe('2')
    })

    it('a joining read cleaned up while waiting stays disabled when the request ends', async () => {
        fetchMock.mockResponse((request: Request) => JSON.stringify([{ id: requestedId(request) }]))
        const useStore = defineStoreRepository<Entity>(
            repositoryHttp,
            'read-join-cleaned-up-stays-disabled',
        )
        const { read, getQueryByName } = useStore()
        const first = read({ id: '1' })
        const scope = effectScope()
        scope.run(() => read({ id: '1' }, { name: 'joined' }))
        scope.stop()
        first.execute({ id: '2' })
        await flushPromises()
        // a clean up never aborts a request: the joined one still runs
        expect(sentRequests()).toEqual([
            { id: '1', aborted: false },
            { id: '2', aborted: false },
        ])
        expect(getQueryByName('joined').value?.enabled).toBe(false)
    })

    it('a joining read leaves a newer request on its hash abortable', async () => {
        const { repository, respond } = manualRepository<Entity>()
        const useStore = defineStoreRepository<Entity>(
            repository,
            'read-join-keeps-newer-request',
        )
        const { read } = useStore()
        const first = read({ id: '1' })
        // joins the request of the first query
        const second = read({ id: '1' })
        // persistence 0: sends a newer request on the same hash
        const third = read({ id: '1' }, { persistence: 0 })
        // the first request ends as aborted, as a network failure can
        respond[0]({ ok: false, aborted: true })
        await flushPromises()
        // the newer request is aborted when its query moves on
        third.execute({ id: '3' })
        await flushPromises()
        expect(first.isLoading.value).toBe(false)
        expect(second.isLoading.value).toBe(false)
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
