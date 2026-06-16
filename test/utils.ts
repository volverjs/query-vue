import type { Component } from 'vue'
import { createTestingPinia } from '@pinia/testing'
import { mount } from '@vue/test-utils'
import { beforeEach, vi } from 'vitest'
import createFetchMock from 'vitest-fetch-mock'

/** Shared fetch mock for the test file that imports it. */
export const fetchMock = createFetchMock(vi)

/** Mounts a component with a fresh testing pinia instance. */
export function mountWithPinia(component: Component) {
    return mount(component, {
        global: {
            plugins: [createTestingPinia({ stubActions: false })],
        },
    })
}

/**
 * Provides an active testing pinia (via a dummy mount) for direct
 * `useStore()` calls and registers a `beforeEach` that (re)enables and
 * resets the fetch mocks. Call it once inside a `describe` body.
 */
export function setupStoreTest() {
    mountWithPinia({ template: '<div></div>' })
    beforeEach(() => {
        fetchMock.enableMocks()
        fetchMock.resetMocks()
    })
}
