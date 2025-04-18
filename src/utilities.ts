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
    if (
        typeof value === 'object'
        && value !== null
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

export function initAutoExecuteReadHandlers<T>(
    params: Ref<ParamMap> | ParamMap,
    execute: (
        newValue?: ParamMap,
        oldValue?: ParamMap,
    ) => Promise<{
        query:
            | {
                isLoading: boolean
                isError: boolean
                isSuccess: boolean
                errors: Error[]
                metadata: ParamMap
                data: T[]
                timestamp: number
                params: ParamMap
                storeHashes: Set<string>
                enabled: boolean
            }
            | undefined
        data: T[]
        item: T | undefined
        metadata: ParamMap | undefined
        errors: Error[]
        error: Error | undefined
        isSuccess: boolean
        isError: boolean
        aborted: boolean
    }>,
    options: StoreRepositoryReadOptions = {},
) {
    const {
        immediate = true,
        executeWhen = () => true,
        autoExecute = false,
        autoExecuteDebounce = 500,
        autoExecuteOnWindowFocus = false,
        autoExecuteOnDocumentVisibility = false,
    } = options
    let ignoreUpdates: IgnoredUpdater | undefined
    let stopHandler: WatchStopHandle | undefined
    let executeOnFocunsStopHandler: WatchStopHandle | undefined
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

    if (immediate && normalizedExecuteWhen.value) {
        execute(unref(params) as ParamMap)
    }

    // execute on window focus
    if (autoExecuteOnWindowFocus) {
        const focused = useWindowFocus()
        executeOnFocunsStopHandler = watch(focused, (isFocused) => {
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
        executeOnFocunsStopHandler?.()
        documentVisibilityStopHandler?.()
    }
    return { stop, ignoreUpdates }
}

export function initAutoExecuteSubmitHandlers<T>(
    payload: Ref<T | T[] | undefined> | T | T[] | undefined,
    params: Ref<ParamMap> | ParamMap,
    resubmit: (
        item?: T | T[],
        params?: ParamMap,
    ) => Promise<{
        query:
            | {
                isLoading: boolean
                isError: boolean
                isSuccess: boolean
                errors: Error[]
                metadata: ParamMap
                data: T[]
                timestamp: number
                params: ParamMap
                storeHashes: Set<string>
                enabled: boolean
            }
            | undefined
        data: T[]
        item: T | undefined
        metadata: ParamMap | undefined
        errors: Error[]
        error: Error | undefined
        isSuccess: boolean
        isError: boolean
        aborted: boolean
    }>,
    options: StoreRepositorySubmitOptions<T> = {},
) {
    const {
        immediate = true,
        executeWhen = () => true,
        autoExecute = false,
        autoExecuteDebounce = 500,
        autoExecuteOnWindowFocus = false,
        autoExecuteOnDocumentVisibility = false,
    } = options
    let ignoreUpdates: IgnoredUpdater | undefined
    let stopHandler: WatchStopHandle | undefined
    let executeOnFocunsStopHandler: WatchStopHandle | undefined
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

    if (immediate && normalizedExecuteWhen.value) {
        resubmit(unref(payload), unref(params) as ParamMap)
    }

    // execute on window focus
    if (autoExecuteOnWindowFocus) {
        const focused = useWindowFocus()
        executeOnFocunsStopHandler = watch(focused, (isFocused) => {
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
        executeOnFocunsStopHandler?.()
        documentVisibilityStopHandler?.()
    }
    return { stop, ignoreUpdates }
}

export function getRandomValues(length: number) {
    const array = new Uint32Array(length)
    if (typeof crypto === 'undefined') {
        // eslint-disable-next-line ts/no-require-imports
        const webcrypto = require('node:crypto').webcrypto
        return webcrypto.getRandomValues(array)[0]
    }
    return crypto.getRandomValues(array)[0]
}
