import { nextTick, ref } from 'vue'
import { describe, vi, beforeEach, it, expect } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import createFetchMock from 'vitest-fetch-mock'
import { RepositoryHttp, HttpClient } from '@volverjs/data'
import { defineStoreRepository } from '../src/index'
import SubmitProvider from './components/SubmitProvider.vue'

const fetchMock = createFetchMock(vi)
const httpClient = new HttpClient({
    prefixUrl: 'https://myapi.com/v1',
})
type Entity = { id?: string, name: string }
const repositoryHttp = new RepositoryHttp<Entity>(httpClient, ':subroute?/:id?')

describe('submit', () => {
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

    it('submit an item with POST with component provider', async () => {
        fetchMock.mockResponseOnce(
            JSON.stringify([
                { id: '12345', firstname: 'John', lastname: 'Doe' },
            ]),
            {},
        )
        const wrapper = mount(SubmitProvider, {
            global: {
                plugins: [createTestingPinia({ stubActions: false })],
            },
        })
        const form = wrapper.find('form')
        const firstname = wrapper.find('input[name="firstname"]')
        const lastname = wrapper.find('input[name="lastname"]')
        firstname.setValue('John')
        lastname.setValue('Doe')
        form.trigger('submit.prevent')
        await nextTick()
        expect(wrapper.find('div[data-test="loading"]').exists()).toBe(true)
        await flushPromises()
        await nextTick()
        expect(wrapper.find('div[data-test="loading"]').exists()).toBe(false)
        const request = fetchMock.mock.calls[0][0] as Request
        expect(request.url).toEqual('https://myapi.com/v1/')
        expect(request.method).toEqual('POST')
        const formData = JSON.parse(
            wrapper.find('div[data-test="form-data"]').text(),
        )
        expect(formData.id).toEqual('12345')
        expect(formData.firstname).toEqual('John')
        expect(formData.lastname).toEqual('Doe')
    })

    it('submit an item with POST', async () => {
        fetchMock.mockResponseOnce(
            JSON.stringify([{ id: '12345', name: 'test' }]),
            {},
        )
        const useStoreReposotory = defineStoreRepository<Entity>(
            repositoryHttp,
            'submit-post',
        )
        const { submit, getItemByKey } = useStoreReposotory()
        const { isLoading, isSuccess, data, item } = submit({
            name: 'test',
        })
        expect(isLoading.value).toBe(true)
        await flushPromises()
        expect(isLoading.value).toBe(false)
        expect(isSuccess.value).toBe(true)
        expect(data.value?.[0].id).toBe('12345')
        expect(item.value?.id).toBe('12345')
        expect(getItemByKey('12345').value?.id).toBe('12345')
        const request = fetchMock.mock.calls[0][0] as Request
        expect(request.url).toEqual('https://myapi.com/v1/')
        expect(request.method).toEqual('POST')
    })

    it('submit an item with POST with params', async () => {
        fetchMock.mockResponseOnce(
            JSON.stringify([{ id: '12345', name: 'test' }]),
            {},
        )
        const useStoreReposotory = defineStoreRepository<Entity>(
            repositoryHttp,
            'submit-post-subroute',
        )
        const { submit, getItemByKey } = useStoreReposotory()
        const { isLoading, isSuccess, data, item } = submit(
            {
                name: 'test',
            },
            {
                subroute: 'test',
            },
        )
        expect(isLoading.value).toBe(true)
        await flushPromises()
        expect(isLoading.value).toBe(false)
        expect(isSuccess.value).toBe(true)
        expect(data.value?.[0].id).toBe('12345')
        expect(item.value?.id).toBe('12345')
        expect(getItemByKey('12345').value?.id).toBe('12345')
        const request = fetchMock.mock.calls[0][0] as Request
        expect(request.url).toEqual('https://myapi.com/v1/test')
        expect(request.method).toEqual('POST')
    })

    it('submit an item with PUT', async () => {
        fetchMock.mockResponseOnce(
            JSON.stringify([{ id: '12345', name: 'test' }]),
        )
        const useStoreReposotory = defineStoreRepository<Entity>(
            repositoryHttp,
            'submit-put',
        )
        const { submit, getItemByKey } = useStoreReposotory()
        const { isLoading, isSuccess, data, item } = submit({
            id: '12345',
            name: 'test',
        })
        expect(isLoading.value).toBe(true)
        await flushPromises()
        expect(isLoading.value).toBe(false)
        expect(isSuccess.value).toBe(true)
        expect(data.value?.[0].id).toBe('12345')
        expect(item.value?.id).toBe('12345')
        expect(getItemByKey('12345').value?.id).toBe('12345')
        const request = fetchMock.mock.calls[0][0] as Request
        expect(request.method).toEqual('PUT')
    })

    it('submit an item with PUT with params', async () => {
        fetchMock.mockResponseOnce(
            JSON.stringify([{ id: '12345', name: 'test' }]),
        )
        const useStoreReposotory = defineStoreRepository<Entity>(
            repositoryHttp,
            'submit-put-subroute',
        )
        const { submit, getItemByKey } = useStoreReposotory()
        const { isLoading, isSuccess, data, item } = submit(
            {
                id: '12345',
                name: 'test',
            },
            {
                subroute: 'test',
            },
        )
        expect(isLoading.value).toBe(true)
        await flushPromises()
        expect(isLoading.value).toBe(false)
        expect(isSuccess.value).toBe(true)
        expect(data.value?.[0].id).toBe('12345')
        expect(item.value?.id).toBe('12345')
        expect(getItemByKey('12345').value?.id).toBe('12345')
        const request = fetchMock.mock.calls[0][0] as Request
        expect(request.url).toEqual('https://myapi.com/v1/test/12345')
        expect(request.method).toEqual('PUT')
    })

    it('create and update an item with autoExecute', async () => {
        fetchMock.mockResponseOnce(
            JSON.stringify([{ id: '12345', name: 'test' }]),
        )
        const useStoreReposotory = defineStoreRepository<Entity>(
            repositoryHttp,
            'submit-post-put',
        )
        const { submit, getItemByKey } = useStoreReposotory()
        const item = ref<Entity>({
            name: 'test',
        })
        const { isLoading, isSuccess, data } = submit(item, undefined, {
            autoExecute: true,
        })
        expect(isLoading.value).toBe(true)
        await flushPromises()
        expect(isLoading.value).toBe(false)
        expect(isSuccess.value).toBe(true)
        expect(data.value?.[0].id).toBe('12345')
        expect(item.value.id).toBe('12345')
        expect(getItemByKey('12345').value?.id).toBe('12345')
        const postRequest = fetchMock.mock.calls[0][0] as Request
        expect(postRequest.url).toEqual('https://myapi.com/v1/')
        expect(postRequest.method).toEqual('POST')
        fetchMock.mockResponseOnce(
            JSON.stringify([{ id: '12345', name: 'test-modified' }]),
        )
        item.value.name = 'test-modified'
        await nextTick()
        expect(isLoading.value).toBe(true)
        await flushPromises()
        expect(isLoading.value).toBe(false)
        expect(isSuccess.value).toBe(true)
        expect(data.value?.[0].name).toBe('test-modified')
        expect(item.value.name).toBe('test-modified')
        expect(getItemByKey('12345').value?.name).toBe('test-modified')
        const putRequest = fetchMock.mock.calls[1][0] as Request
        expect(putRequest.url).toEqual('https://myapi.com/v1/12345')
        expect(putRequest.method).toEqual('PUT')
    })
})
