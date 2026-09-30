import type { IgnoredUpdater } from '@vueuse/core'
import type { Ref, WatchStopHandle } from 'vue'
import type {
    ParamMap,
    StoreRepositoryReadOptions,
    StoreRepositorySubmitOptions,
} from './types'
import {
    debounceFilter,

    useDocumentVisibility,
    useWindowFocus,
    watchIgnorable,
} from '@vueuse/core'
import {
    computed,
    isRef,
    ref,
    unref,
    watch,
    watchEffect,

} from 'vue'
import { StoreRepositoryStatus } from './constants'

export function clone<T>(value: T): T {
    if (value === undefined || value === null) {
        return value
    }
    if (
        typeof value === 'object'
        && 'clone' in value
        && typeof value.clone === 'function'
    ) {
        return value.clone() as T
    }
    return JSON.parse(JSON.stringify(value)) as T
}

export function initStatus() {
    const status = ref<StoreRepositoryStatus>(StoreRepositoryStatus.idle)
    const isLoading = computed(
        () => status.value === StoreRepositoryStatus.loading,
    )
    const isError = computed(() => status.value === StoreRepositoryStatus.error)
    const isSuccess = computed(
        () => status.value === StoreRepositoryStatus.success,
    )
    const error = ref<Error | undefined>()
    watchEffect(() => {
        if (status.value === StoreRepositoryStatus.loading) {
            error.value = undefined
        }
    })
    return { status, isLoading, isError, isSuccess, error }
}

/**
 * Makes the value returned by an action awaitable, like VueUse's `useFetch`.
 * Awaiting it settles on the execution started by the action call itself and
 * resolves to the plain snapshot that `execute()` resolves to. When the call
 * started no execution (`immediate: false`, or `executeWhen` false at call
 * time), it resolves at once to the current snapshot.
 * `then` never starts a request, so `Promise.resolve()` or a `return` from an
 * async function can call it any number of times and the action still runs once.
 * `release`, passed when no effect scope owns the action (an event handler, a
 * plain async function), runs once the awaited execution settles: awaiting
 * hands the result over as a plain snapshot and nothing else would clean up.
 * Only `then`, never `catch` or `finally`: Vue treats a value with both `then`
 * and `catch` as a promise, so `setup() { return read() }` would become an
 * async setup and `@click="remove(...)"` handlers would get a rejection handler.
 */
export function toAwaitable<TState extends object, TSnapshot>(
    state: TState,
    execution: Promise<TSnapshot> | undefined,
    snapshot: () => TSnapshot,
    release?: () => void,
): TState & PromiseLike<TSnapshot> {
    let released = false
    const then: PromiseLike<TSnapshot>['then'] = (onFulfilled, onRejected) => {
        if (!execution) {
            return Promise.resolve(snapshot()).then(onFulfilled, onRejected)
        }
        if (release && !released) {
            released = true
            execution.then(release, release)
        }
        return execution.then(onFulfilled, onRejected)
    }
    return { ...state, then }
}

export function initAutoExecuteReadHandlers<TResult>(
    params: Ref<ParamMap> | ParamMap,
    execute: (
        newValue?: ParamMap,
        oldValue?: ParamMap,
    ) => Promise<TResult>,
    options: StoreRepositoryReadOptions = {},
) {
    const {
        immediate = true,
        executeWhen = () => true,
        autoExecute = false,
        autoExecuteDebounce = 0,
        autoExecuteOnWindowFocus = false,
        autoExecuteOnDocumentVisibility = false,
    } = options
    let ignoreUpdates: IgnoredUpdater | undefined
    let stopHandler: WatchStopHandle | undefined
    let executeOnFocusStopHandler: WatchStopHandle | undefined
    let documentVisibilityStopHandler: WatchStopHandle | undefined
    const normalizedParams = isRef(params)
        ? (params as Ref<ParamMap>)
        : computed<ParamMap>(() => params)
    const normalizedExecuteWhen = isRef(executeWhen)
        ? executeWhen
        : computed(() => executeWhen(unref(params) as ParamMap))
    // execute on params  change
    if (autoExecute) {
        const { stop: watchStopHandler, ignoreUpdates: watchIgnoreUpdates }
            = watchIgnorable(
                [normalizedParams, normalizedExecuteWhen],
                ([newParams, newWhen]) => {
                    if (newWhen) {
                        execute(newParams)
                    }
                },
                {
                    eventFilter: debounceFilter(autoExecuteDebounce),
                    deep: true,
                },
            )
        ignoreUpdates = watchIgnoreUpdates
        stopHandler = watchStopHandler
    }
    else {
        const { stop: watchStopHandler, ignoreUpdates: watchIgnoreUpdates }
            = watchIgnorable(
                normalizedExecuteWhen,
                (newWhen, oldWhen) => {
                    if (newWhen && !oldWhen) {
                        execute(unref(params) as ParamMap)
                    }
                },
                {
                    eventFilter: debounceFilter(autoExecuteDebounce),
                    deep: true,
                },
            )
        ignoreUpdates = watchIgnoreUpdates
        stopHandler = watchStopHandler
    }

    // the call's own execution: awaiting the action settles on it
    const execution = immediate && normalizedExecuteWhen.value
        ? execute(unref(params) as ParamMap)
        : undefined

    // execute on window focus
    if (autoExecuteOnWindowFocus) {
        const focused = useWindowFocus()
        executeOnFocusStopHandler = watch(focused, (isFocused) => {
            if (isFocused && normalizedExecuteWhen.value) {
                execute()
            }
        })
    }
    // execute on document visibility
    if (autoExecuteOnDocumentVisibility) {
        const visibility = useDocumentVisibility()
        documentVisibilityStopHandler = watch(visibility, (visibilityState) => {
            if (visibilityState === 'visible' && normalizedExecuteWhen.value) {
                execute()
            }
        })
    }
    const stop = () => {
        stopHandler?.()
        executeOnFocusStopHandler?.()
        documentVisibilityStopHandler?.()
    }
    return { stop, ignoreUpdates, execution }
}

export function initAutoExecuteSubmitHandlers<TRequest, TResult>(
    payload: Ref<TRequest | TRequest[] | undefined> | TRequest | TRequest[] | undefined,
    params: Ref<ParamMap> | ParamMap,
    resubmit: (
        item?: TRequest | TRequest[],
        params?: ParamMap,
    ) => Promise<TResult>,
    options: StoreRepositorySubmitOptions<TRequest> = {},
) {
    const {
        immediate = true,
        executeWhen = () => true,
        autoExecute = false,
        autoExecuteDebounce = 0,
        autoExecuteOnWindowFocus = false,
        autoExecuteOnDocumentVisibility = false,
    } = options
    let ignoreUpdates: IgnoredUpdater | undefined
    let stopHandler: WatchStopHandle | undefined
    let executeOnFocusStopHandler: WatchStopHandle | undefined
    let documentVisibilityStopHandler: WatchStopHandle | undefined
    const normalizedPayload = isRef(payload) ? payload : computed(() => payload)
    const normalizedParams = isRef(params)
        ? (params as Ref<ParamMap>)
        : computed(() => params)
    const normalizedExecuteWhen = isRef(executeWhen)
        ? executeWhen
        : computed(() => executeWhen(unref(payload), unref(params) as ParamMap))
    // auto-submit on item or params change
    if (autoExecute) {
        const { stop: watchStopHandler, ignoreUpdates: watchIgnoreUpdates }
            = watchIgnorable(
                [normalizedPayload, normalizedParams, normalizedExecuteWhen],
                ([newPayload, newParams, newWhen], _) => {
                    if (newWhen) {
                        resubmit(newPayload, newParams)
                    }
                },
                {
                    eventFilter: debounceFilter(autoExecuteDebounce),
                    deep: true,
                },
            )
        ignoreUpdates = watchIgnoreUpdates
        stopHandler = watchStopHandler
    }
    else {
        const { stop: watchStopHandler, ignoreUpdates: watchIgnoreUpdates }
            = watchIgnorable(
                normalizedExecuteWhen,
                (newWhen, oldWhen) => {
                    if (newWhen && !oldWhen) {
                        resubmit(unref(payload), unref(params) as ParamMap)
                    }
                },
                {
                    eventFilter: debounceFilter(autoExecuteDebounce),
                    deep: true,
                },
            )
        ignoreUpdates = watchIgnoreUpdates
        stopHandler = watchStopHandler
    }

    // the call's own execution: awaiting the action settles on it
    const execution = immediate && normalizedExecuteWhen.value
        ? resubmit(unref(payload), unref(params) as ParamMap)
        : undefined

    // execute on window focus
    if (autoExecuteOnWindowFocus) {
        const focused = useWindowFocus()
        executeOnFocusStopHandler = watch(focused, (isFocused) => {
            if (isFocused && normalizedExecuteWhen.value) {
                resubmit()
            }
        })
    }
    // execute on document visibility
    if (autoExecuteOnDocumentVisibility) {
        const visibility = useDocumentVisibility()
        documentVisibilityStopHandler = watch(visibility, (visibilityState) => {
            if (visibilityState === 'visible' && normalizedExecuteWhen.value) {
                resubmit()
            }
        })
    }
    const stop = () => {
        stopHandler?.()
        executeOnFocusStopHandler?.()
        documentVisibilityStopHandler?.()
    }
    return { stop, ignoreUpdates, execution }
}

export function getRandomValues() {
    const array = new Uint32Array(1)
    return crypto.getRandomValues(array)[0]
}
