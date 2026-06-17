import { HttpClient, RepositoryHttp } from '@volverjs/data'
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { defineStoreRepository } from '../src/index'
import { fetchMock, setupStoreTest } from './utils'

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
})
