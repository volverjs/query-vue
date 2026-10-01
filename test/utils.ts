import type { Repository } from '@volverjs/data'
import type { Component } from 'vue'
import { createTestingPinia } from '@pinia/testing'
import { mount } from '@vue/test-utils'
import { beforeEach, vi } from 'vitest'
import createFetchMock from 'vitest-fetch-mock'
import { toRaw } from 'vue'

/** Shared fetch mock for the test file that imports it. */
export const fetchMock = createFetchMock(vi)

/** The last path segment of a request, the `:id` of an `':id?'` template. */
export function requestedId(request: Request) {
    return new URL(request.url).pathname.split('/').pop()
}

type ManualResponse<T> = { ok: boolean, aborted?: boolean, data?: T[] }

/**
 * A repository whose requests settle only when the test calls
 * `respond[i](response)`, in the order they were sent. With `abortable`, a
 * request has an `abort()` that settles it as aborted.
 */
export function manualRepository<T>({ abortable = true } = {}) {
    const respond: ((response: ManualResponse<T>) => void)[] = []
    const request = () => {
        let settle!: (response: ManualResponse<T>) => void
        const responsePromise = new Promise<ManualResponse<T>>((resolve) => {
            settle = resolve
        })
        respond.push(settle)
        return {
            responsePromise,
            abort: abortable ? () => settle({ ok: false, aborted: true }) : undefined,
        }
    }
    const repository = {
        read: request,
        create: request,
        update: request,
        remove: request,
    } as unknown as Repository<T>
    return { repository, respond }
}

/** The requests sent to the fetch mock so far, an aborted one included. */
export function sentRequests(): { id?: string, aborted: boolean }[] {
    // the HTTP client calls `fetch` with a `Request`
    return fetchMock.mock.calls.map(([request]: [Request]) => ({
        id: requestedId(request),
        aborted: request.signal.aborted,
    }))
}

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
