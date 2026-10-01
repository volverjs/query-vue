import { HttpClient, RepositoryHttp } from '@volverjs/data'
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { effectScope, ref } from 'vue'
import { defineStoreRepository } from '../src/index'
import SubmitProvider from './components/SubmitProvider.vue'
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
type Entity = { id?: string, name: string }
const repositoryHttp = new RepositoryHttp<Entity>(httpClient, ':id?')

describe('submit advanced', () => {
    setupStoreTest()

    it('two anonymous submits keep independent state (no queryName collision)', async () => {
        fetchMock.mockResponseOnce(JSON.stringify([{ id: '1', name: 'a' }]))
        fetchMock.mockResponseOnce(JSON.stringify([{ id: '2', name: 'b' }]))
        const useStore = defineStoreRepository<Entity>(
            repositoryHttp,
            'submit-independent',
        )
        const { submit } = useStore()
        // both are created in the same tick with distinct params (distinct
        // hashes): with Date.now() based names they would share the same query
        // and clobber each other
        const first = submit({ name: 'a' }, { tag: 'first' })
        const second = submit({ name: 'b' }, { tag: 'second' })
        await flushPromises()
        expect(first.item.value?.id).toBe('1')
        expect(second.item.value?.id).toBe('2')
        expect(first.query.value).not.toBe(second.query.value)
    })

    it('creates many items in a single submit (array payload)', async () => {
        fetchMock.mockResponseOnce(
            JSON.stringify([
                { id: '1', name: 'a' },
                { id: '2', name: 'b' },
            ]),
        )
        const useStore = defineStoreRepository<Entity>(
            repositoryHttp,
            'submit-array',
        )
        const { submit, getItemsByKeys } = useStore()
        const { isSuccess, data } = submit([{ name: 'a' }, { name: 'b' }])
        await flushPromises()
        expect(isSuccess.value).toBe(true)
        expect(data.value?.length).toBe(2)
        expect(getItemsByKeys(['1', '2']).value.length).toBe(2)
        const request = fetchMock.mock.calls[0][0] as Request
        expect(request.method).toBe('POST')
    })

    it('forces an update (PUT) via the action option even without a key', async () => {
        fetchMock.mockResponseOnce(JSON.stringify([{ id: '1', name: 'a' }]))
        const useStore = defineStoreRepository<Entity>(
            repositoryHttp,
            'submit-force-update',
        )
        const { submit } = useStore()
        const { isSuccess } = submit({ name: 'a' }, undefined, {
            action: 'update',
        })
        await flushPromises()
        expect(isSuccess.value).toBe(true)
        const request = fetchMock.mock.calls[0][0] as Request
        expect(request.method).toBe('PUT')
    })

    it('forces a create (POST) via the action option even with a key', async () => {
        fetchMock.mockResponseOnce(JSON.stringify([{ id: '1', name: 'a' }]))
        const useStore = defineStoreRepository<Entity>(
            repositoryHttp,
            'submit-force-create',
        )
        const { submit } = useStore()
        const { isSuccess } = submit({ id: '1', name: 'a' }, undefined, {
            action: 'create',
        })
        await flushPromises()
        expect(isSuccess.value).toBe(true)
        const request = fetchMock.mock.calls[0][0] as Request
        expect(request.method).toBe('POST')
    })

    it('does not sync the payload when disablePayloadSync is true', async () => {
        fetchMock.mockResponseOnce(JSON.stringify([{ id: '1', name: 'a' }]))
        const useStore = defineStoreRepository<Entity>(
            repositoryHttp,
            'submit-disable-sync',
        )
        const { submit } = useStore()
        const payload = ref<Entity>({ name: 'a' })
        const { isSuccess } = submit(payload, undefined, {
            disablePayloadSync: true,
        })
        await flushPromises()
        expect(isSuccess.value).toBe(true)
        // the response id is NOT written back into the payload
        expect(payload.value.id).toBeUndefined()
    })

    it('syncs the payload back by default', async () => {
        fetchMock.mockResponseOnce(JSON.stringify([{ id: '1', name: 'a' }]))
        const useStore = defineStoreRepository<Entity>(
            repositoryHttp,
            'submit-default-sync',
        )
        const { submit } = useStore()
        const payload = ref<Entity>({ name: 'a' })
        const { isSuccess } = submit(payload)
        await flushPromises()
        expect(isSuccess.value).toBe(true)
        expect(payload.value.id).toBe('1')
    })

    it('awaiting with immediate false resolves at once to the current snapshot', async () => {
        const useStore = defineStoreRepository<Entity>(
            repositoryHttp,
            'submit-await-not-immediate',
        )
        const { submit } = useStore()
        const result = submit({ name: 'a' }, undefined, { immediate: false })
        const before = await result
        expect(before.isSuccess).toBe(false)
        expect(before.isError).toBe(false)
        expect(before.aborted).toBe(false)
        expect(before.data).toEqual([])
        expect(fetchMock.mock.calls).toHaveLength(0)
        fetchMock.mockResponseOnce(JSON.stringify([{ id: '1', name: 'a' }]))
        await result.execute()
        const after = await result
        expect(after.isSuccess).toBe(true)
        expect(after.item?.id).toBe('1')
        expect(fetchMock.mock.calls).toHaveLength(1)
    })

    it('awaiting an aborted submit resolves with aborted true', async () => {
        fetchMock.mockResponse(JSON.stringify([{ id: '2', name: 'b' }]))
        const useStore = defineStoreRepository<Entity>(
            repositoryHttp,
            'submit-await-aborted',
        )
        const { submit } = useStore()
        const result = submit({ name: 'a' }, { tag: 'first' })
        // a new execution with other params aborts the immediate one: the abort
        // is synchronous, before the first fetch is sent, so the order is fixed
        result.execute({ name: 'b' }, { tag: 'second' })
        const { aborted, isError } = await result
        expect(aborted).toBe(true)
        expect(isError).toBe(false)
        await flushPromises()
        expect(result.item.value?.id).toBe('2')
    })

    it('a new execution aborts its own request, not the one of a submit with the same params', async () => {
        fetchMock.mockResponse((request: Request) => JSON.stringify([{ id: requestedId(request), name: 'saved' }]))
        const useStore = defineStoreRepository<Entity>(
            repositoryHttp,
            'submit-abort-own-request',
        )
        const { submit } = useStore()
        const first = submit({ id: '1', name: 'a' })
        // same action and params: the same hash
        const second = submit({ id: '1', name: 'a' })
        first.execute({ id: '2', name: 'b' }, { id: '2' })
        const [firstSnapshot, secondSnapshot] = await Promise.all([first, second])
        expect(firstSnapshot.aborted).toBe(true)
        expect(secondSnapshot.aborted).toBe(false)
        expect(secondSnapshot.isSuccess).toBe(true)
        await flushPromises()
        expect(second.isSuccess.value).toBe(true)
        expect(second.item.value?.id).toBe('1')
        expect(first.item.value?.id).toBe('2')
        expect(sentRequests()).toEqual([
            { id: '1', aborted: true },
            { id: '1', aborted: false },
            { id: '2', aborted: false },
        ])
    })

    it('an aborted request leaves the hash to the submit with the same params that succeeded', async () => {
        let respondToFirst!: () => void
        fetchMock.mockResponseOnce(() => new Promise((resolve) => {
            respondToFirst = () => resolve(JSON.stringify([{ id: '1', name: 'first' }]))
        }))
        fetchMock.mockResponse((request: Request) => JSON.stringify([{ id: requestedId(request), name: 'saved' }]))
        const useStore = defineStoreRepository<Entity>(
            repositoryHttp,
            'submit-abort-after-shared-success',
        )
        const { submit } = useStore()
        const first = submit({ id: '1', name: 'a' })
        const second = submit({ id: '1', name: 'a' })
        expect((await second).isSuccess).toBe(true)
        // the first request is still in flight on the hash the second one filled
        first.execute({ id: '2', name: 'b' }, { id: '2' })
        respondToFirst()
        expect((await first).aborted).toBe(true)
        await flushPromises()
        expect(second.isSuccess.value).toBe(true)
        expect(second.item.value?.name).toBe('saved')
    })

    it('the key of a payload does not leak into the params of the next execution', async () => {
        fetchMock.mockResponse((request: Request) => JSON.stringify([{ id: requestedId(request), name: 'saved' }]))
        const useStore = defineStoreRepository<Entity>(
            repositoryHttp,
            'submit-params-not-mutated',
        )
        const { submit } = useStore()
        const params = {}
        const result = submit({ id: '1', name: 'a' }, params)
        await result
        const { item } = await result.execute({ id: '2', name: 'b' })
        expect(item?.id).toBe('2')
        expect(params).toEqual({})
        const executeParams = {}
        await result.execute({ id: '3', name: 'c' }, executeParams)
        expect(executeParams).toEqual({})
        expect(sentRequests().map(({ id }) => id)).toEqual(['1', '2', '3'])
    })

    it('without an abort handle, an aborted response leaves the hash to the request still loading', async () => {
        // a repository whose requests have no `abort`
        const { repository, respond } = manualRepository<Entity>({ abortable: false })
        const useStore = defineStoreRepository<Entity>(
            repository,
            'submit-no-abort-handle',
        )
        const { submit } = useStore()
        const first = submit({ id: '1', name: 'a' })
        // same action and params: the same hash
        const second = submit({ id: '1', name: 'a' })
        respond[0]({ ok: false, aborted: true })
        expect((await first).aborted).toBe(true)
        expect(second.isLoading.value).toBe(true)
        respond[1]({ ok: true, data: [{ id: '1', name: 'saved' }] })
        expect((await second).isSuccess).toBe(true)
    })

    it('autoExecute does not run again because the payload key was written into the params', async () => {
        fetchMock.mockResponse((request: Request) => JSON.stringify([{ id: requestedId(request), name: 'saved' }]))
        const useStore = defineStoreRepository<Entity>(
            repositoryHttp,
            'submit-params-ref-not-mutated',
        )
        const { submit } = useStore()
        const params = ref({})
        const scope = effectScope()
        scope.run(() => submit({ id: '1', name: 'a' }, params, { autoExecute: true }))
        await flushPromises()
        expect(params.value).toEqual({})
        expect(sentRequests().map(({ id }) => id)).toEqual(['1'])
        scope.stop()
    })

    it('thenable assimilation runs one request and leaves no thenable in the store', async () => {
        fetchMock.mockResponseOnce(JSON.stringify([{ id: '1', name: 'a' }]))
        const useStore = defineStoreRepository<Entity>(
            repositoryHttp,
            'submit-await-assimilation',
        )
        const store = useStore()
        const result = store.submit({ name: 'a' })
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

    it('an awaited submit with no owner releases its query once it settles', async () => {
        fetchMock.mockResponseOnce(JSON.stringify([{ id: '1', name: 'a' }]))
        const useStore = defineStoreRepository<Entity>(
            repositoryHttp,
            'submit-await-release',
        )
        const { submit, getQueryByName } = useStore()
        // no component and no effect scope, as in an event handler
        const { isSuccess } = await submit({ name: 'a' }, undefined, { name: 'sb' })
        expect(isSuccess).toBe(true)
        expect(getQueryByName('sb').value?.enabled).toBe(false)
    })

    it('the SubmitProvider instance is not thenable', async () => {
        const wrapper = mountWithPinia(SubmitProvider)
        await flushPromises()
        const provider = wrapper.findComponent({
            name: 'StoreRepositorySubmitProvider',
        })
        expect(provider.exists()).toBe(true)
        expect(typeof (provider.vm as any).execute).toBe('function')
        expect((provider.vm as any).then).toBeUndefined()
        expect(fetchMock.mock.calls).toHaveLength(0)
    })
})
