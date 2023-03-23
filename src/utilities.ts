import {
	type IgnoredUpdater,
	useDocumentVisibility,
	useWindowFocus,
	watchIgnorable,
	debounceFilter,
} from '@vueuse/core'
import {
	type Ref,
	type WatchStopHandle,
	computed,
	ref,
	watchEffect,
	isRef,
	watch,
	unref,
} from 'vue'
import { StoreRepositoryStatus } from './constants'
import type {
	ParamMap,
	StoreRepositoryReadOptions,
	StoreRepositorySubmitOptions,
} from './types'

export function initStatus() {
	const status = ref<StoreRepositoryStatus>(StoreRepositoryStatus.idle)
	const isLoading = computed(
		() => status.value === StoreRepositoryStatus.loading,
	)
	const isError = computed(() => status.value === StoreRepositoryStatus.error)
	const isSuccess = computed(
		() => status.value === StoreRepositoryStatus.success,
	)
	const error = ref<Error | null>(null)
	watchEffect(() => {
		if (status.value === StoreRepositoryStatus.loading) {
			error.value = null
		}
	})
	return { status, isLoading, isError, isSuccess, error }
}

export function initRefetchHandlers(
	params: Ref<ParamMap> | ParamMap,
	refetch: (
		newValue?: ParamMap,
		oldValue?: ParamMap,
		onCleanup?: (cleanupFn: () => void) => void,
	) => void,
	status: Ref<StoreRepositoryStatus>,
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
	let ignoreUpdates: IgnoredUpdater | undefined = (cb: () => void) => cb()
	let stopHandler: WatchStopHandle | undefined
	let refetchOnFocunsStopHandler: WatchStopHandle | undefined
	let documentVisibilityStopHandler: WatchStopHandle | undefined
	const normalizedParams = isRef(params)
		? (params as Ref<ParamMap>)
		: computed<ParamMap>(() => params)
	const normalizedExecuteWhen = isRef(executeWhen)
		? executeWhen
		: computed(() => executeWhen(unref(params)))
	// refetch on params change
	if (autoExecute) {
		const { stop: watchStopHandler, ignoreUpdates: watchIgnoreUpdates } =
			watchIgnorable(
				[normalizedParams, normalizedExecuteWhen],
				([newParams, newWhen], [oldParams], onCleanup) => {
					if (newWhen) {
						refetch(newParams, oldParams, onCleanup)
					}
				},
				{
					eventFilter: debounceFilter(autoExecuteDebounce),
					immediate,
					deep: true,
				},
			)
		ignoreUpdates = watchIgnoreUpdates
		stopHandler = watchStopHandler
	} else {
		const { stop: watchStopHandler, ignoreUpdates: watchIgnoreUpdates } =
			watchIgnorable(
				normalizedExecuteWhen,
				(newWhen, oldWhen, onCleanup) => {
					if (newWhen && !oldWhen) {
						refetch(unref(params), undefined, onCleanup)
					}
				},
				{
					eventFilter: debounceFilter(autoExecuteDebounce),
					immediate,
					deep: true,
				},
			)
		ignoreUpdates = watchIgnoreUpdates
		stopHandler = watchStopHandler
	}
	// refetch on window focus
	if (autoExecuteOnWindowFocus) {
		const focused = useWindowFocus()
		refetchOnFocunsStopHandler = watch(focused, (isFocused) => {
			if (isFocused && normalizedExecuteWhen.value) {
				refetch()
			}
		})
	}
	// refetch on document visibility
	if (autoExecuteOnDocumentVisibility) {
		const visibility = useDocumentVisibility()
		documentVisibilityStopHandler = watch(visibility, (visibilityState) => {
			if (visibilityState === 'visible' && normalizedExecuteWhen.value) {
				refetch()
			}
		})
	}
	const stop = () => {
		status.value = StoreRepositoryStatus.idle
		stopHandler?.()
		refetchOnFocunsStopHandler?.()
		documentVisibilityStopHandler?.()
	}
	return { stop, ignoreUpdates }
}

export function initResubmitHandlers<Type>(
	item: Ref<Type | undefined> | Type,
	params: Ref<ParamMap> | ParamMap,
	resubmit: (
		item?: Type,
		params?: ParamMap,
		cleanUp?: (cleanupFn: () => void) => void,
	) => void,
	status: Ref<StoreRepositoryStatus>,
	options: StoreRepositorySubmitOptions = {},
) {
	const {
		immediate = true,
		executeWhen = () => true,
		autoExecute = false,
		autoExecuteDebounce = 500,
		autoExecuteOnWindowFocus = false,
		autoExecuteOnDocumentVisibility = false,
	} = options
	let ignoreUpdates: IgnoredUpdater | undefined = (cb: () => void) => cb()
	let stopHandler: WatchStopHandle | undefined
	let refetchOnFocunsStopHandler: WatchStopHandle | undefined
	let documentVisibilityStopHandler: WatchStopHandle | undefined
	const normalizedItem = isRef(item) ? item : computed(() => item)
	const normalizedParams = isRef(params)
		? (params as Ref<ParamMap>)
		: computed(() => params)
	const normalizedExecuteWhen = isRef(executeWhen)
		? executeWhen
		: computed(() => executeWhen(unref(params)))
	// auto-submit on item or params change
	if (autoExecute) {
		const { stop: watchStopHandler, ignoreUpdates: watchIgnoreUpdates } =
			watchIgnorable(
				[normalizedItem, normalizedParams, normalizedExecuteWhen],
				([newItem, newParams, newWhen], oldValue, onCleanup) => {
					if (newWhen) {
						resubmit(newItem, newParams, onCleanup)
					}
				},
				{
					eventFilter: debounceFilter(autoExecuteDebounce),
					immediate,
					deep: true,
				},
			)
		ignoreUpdates = watchIgnoreUpdates
		stopHandler = watchStopHandler
	} else {
		const { stop: watchStopHandler, ignoreUpdates: watchIgnoreUpdates } =
			watchIgnorable(
				normalizedExecuteWhen,
				(newWhen, oldWhen, onCleanup) => {
					if (newWhen && !oldWhen) {
						resubmit(unref(item), unref(params), onCleanup)
					}
				},
				{
					eventFilter: debounceFilter(autoExecuteDebounce),
					immediate,
					deep: true,
				},
			)
		ignoreUpdates = watchIgnoreUpdates
		stopHandler = watchStopHandler
	}

	// refetch on window focus
	if (autoExecuteOnWindowFocus) {
		const focused = useWindowFocus()
		refetchOnFocunsStopHandler = watch(focused, (isFocused) => {
			if (isFocused && normalizedExecuteWhen.value) {
				resubmit()
			}
		})
	}
	// refetch on document visibility
	if (autoExecuteOnDocumentVisibility) {
		const visibility = useDocumentVisibility()
		documentVisibilityStopHandler = watch(visibility, (visibilityState) => {
			if (visibilityState === 'visible' && normalizedExecuteWhen.value) {
				resubmit()
			}
		})
	}
	const stop = () => {
		status.value = StoreRepositoryStatus.idle
		stopHandler?.()
		refetchOnFocunsStopHandler?.()
		documentVisibilityStopHandler?.()
	}
	return { stop, ignoreUpdates }
}
