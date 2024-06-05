import { describe, vi, beforeEach, it, expect } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import createFetchMock from 'vitest-fetch-mock'
import { RepositoryHttp, HttpClient } from '@volverjs/data'
import { nextTick } from 'vue'
import { defineStoreRepository } from '../src/index'
import RemoveProvider from './components/RemoveProvider.vue'

const fetchMock = createFetchMock(vi)
const httpClient = new HttpClient({
    prefixUrl: 'https://myapi.com/v1',
})
type Entity = { id: string }
const repositoryHttp = new RepositoryHttp<Entity>(httpClient, ':id?')

describe('remove', () => {
    // Mount app
    mount(
        {
            template: '<div></div>',
        },
        {
            global: {
                plugins: [createTestingPinia({ stubActions: false })],
            },
        },
    )

    // Reset mocks for each test
    beforeEach(() => {
        fetchMock.enableMocks()
        fetchMock.resetMocks()
    })

    it('remove from a parameters map with component provider', async () => {
        fetchMock.mockResponseOnce(JSON.stringify([{ id: '12345' }]))
        const wrapper = mount(RemoveProvider, {
            global: {
                plugins: [createTestingPinia({ stubActions: false })],
            },
        })
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
})
