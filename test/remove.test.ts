import { HttpClient, RepositoryHttp } from '@volverjs/data'
import { flushPromises } from '@vue/test-utils'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { nextTick } from 'vue'
import { defineStoreRepository } from '../src/index'
import RemoveProvider from './components/RemoveProvider.vue'
import { fetchMock, mountWithPinia, setupStoreTest } from './utils'

const httpClient = new HttpClient({
    prefixUrl: 'https://myapi.com/v1',
})
type Entity = { id: string }
const repositoryHttp = new RepositoryHttp<Entity>(httpClient, ':id?')

describe('remove', () => {
    setupStoreTest()

    it('remove from a parameters map with component provider', async () => {
        fetchMock.mockResponseOnce(JSON.stringify([{ id: '12345' }]))
        const wrapper = mountWithPinia(RemoveProvider)
        expect(wrapper.find('div[data-test="loading"]').exists()).toBe(true)
        await flushPromises()
        await nextTick()
        expect(wrapper.find('div[data-test="loading"]').exists()).toBe(false)
        const request = fetchMock.mock.calls[0][0] as Request
        expect(request.url).toEqual('https://myapi.com/v1/12345')
        expect(request.method).toEqual('GET')
        const removeButton = wrapper.find('button[data-test="remove-button"]')
        expect(removeButton.exists()).toBe(true)
        fetchMock.mockResponseOnce('', {
            status: 204,
        })
        removeButton.trigger('click')
        await flushPromises()
        const deleteRequest = fetchMock.mock.calls[1][0] as Request
        expect(deleteRequest.url).toEqual('https://myapi.com/v1/12345')
        expect(deleteRequest.method).toEqual('DELETE')
    })

    it('remove from a parameters map', async () => {
        fetchMock.mockResponseOnce(JSON.stringify([{ id: '12345' }]))
        const useStoreReposotory = defineStoreRepository<Entity>(
            repositoryHttp,
            'remove',
        )
        const { read, getItemByKey, remove } = useStoreReposotory()

        // read the item with id '12345'
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

        // now remove the item with id '12345'
        const {
            isLoading: isLoadingRemove,
            isSuccess: isSuccessRemove,
            isError: isErrorRemove,
        } = remove({
            id: '12345',
        })
        expect(isLoadingRemove.value).toBe(true)
        await flushPromises()
        expect(isErrorRemove.value).toBe(false)
        expect(isLoadingRemove.value).toBe(false)
        expect(isSuccessRemove.value).toBe(true)
        expect(getItemByKey('12345').value).toBe(undefined)
    })

    it('awaits the removal and resolves to plain values', async () => {
        fetchMock.mockResponseOnce(JSON.stringify([{ id: '12345' }]))
        const useStoreReposotory = defineStoreRepository<Entity>(
            repositoryHttp,
            'remove-await',
        )
        const { read, getItemByKey, remove } = useStoreReposotory()
        await read({ id: '12345' })
        expect(getItemByKey('12345').value?.id).toBe('12345')

        fetchMock.mockResponseOnce('', { status: 204 })
        const result = remove({ id: '12345' })
        const { isSuccess, isError, error, aborted } = await result
        expectTypeOf(isSuccess).toEqualTypeOf<boolean>()
        expect(result.isLoading.value).toBe(false)
        expect(isSuccess).toBe(true)
        expect(isError).toBe(false)
        expect(error).toBeUndefined()
        expect(aborted).toBe(false)
        expect(getItemByKey('12345').value).toBeUndefined()
        const request = fetchMock.mock.calls[1][0] as Request
        expect(request.method).toEqual('DELETE')
        expect(fetchMock.mock.calls).toHaveLength(2)
    })

    it('awaits a failed removal and resolves with isError', async () => {
        // 400 is not retried by ky, so a single mocked response is enough
        fetchMock.mockResponseOnce('Bad Request', { status: 400 })
        const useStoreReposotory = defineStoreRepository<Entity>(
            repositoryHttp,
            'remove-await-error',
        )
        const { remove } = useStoreReposotory()
        const { isSuccess, isError, error, errors, aborted } = await remove({
            id: '12345',
        })
        expect(isSuccess).toBe(false)
        expect(isError).toBe(true)
        expect(error).toBeInstanceOf(Error)
        expect(errors).toHaveLength(1)
        expect(aborted).toBe(false)
    })
})
