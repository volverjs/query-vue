import type { Component } from 'vue'
import { createTestingPinia } from '@pinia/testing'
import { mount } from '@vue/test-utils'
import { beforeEach, vi } from 'vitest'
import createFetchMock from 'vitest-fetch-mock'
import { toRaw } from 'vue'

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

/**
 * Every raw value held by the store state: the hashes, the queries and the
 * items, plus the fields of each hash and query.
 */
export function storeStateValues(store: {
    hashes: Map<string, object>
    queries: Map<string, object>
    items: Map<unknown, unknown>
}) {
    const entries = [...store.hashes.values(), ...store.queries.values()]
    return [
        ...entries,
        ...entries.flatMap(entry => Object.values(toRaw(entry))),
        ...store.items.values(),
    ].map(value => toRaw(value))
}

/**
 * Thenables held by the store state other than native promises: an action's
 * awaitable would be one, the repository `responsePromise` of a read is not.
 */
export function foreignThenables(store: Parameters<typeof storeStateValues>[0]) {
    return storeStateValues(store).filter(value =>
        typeof value?.then === 'function' && !(value instanceof Promise),
    )
}
