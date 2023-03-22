import {
	type IgnoredUpdater,
	throttleFilter,
	useDocumentVisibility,
	useWindowFocus,
	watchIgnorable,
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
		refetchOnWindowFocus = false,
		refetchOnDocumentVisibility = false,
		when = () => true,
	} = options
	// watch params and refetch
	let stopHandler: WatchStopHandle | undefined
	let refetchOnFocunsStopHandler: WatchStopHandle | undefined
	let documentVisibilityStopHandler: WatchStopHandle | undefined
	if (isRef(params)) {
		if (!isRef(when)) {
			stopHandler = watch(
				params,
				(newValue, oldValue, onCleanup) => {
					if (when(newValue as ParamMap)) {
						refetch(
							params,
							oldValue as ParamMap | undefined,
							onCleanup,
						)
					}
				},
				{
					immediate,
					deep: true,
				},
			)
		} else {
			stopHandler = watch<ParamMap, boolean>(
				[params, when],
				(newValue, oldValue, onCleanup) => {
					if (newValue[1]) {
						refetch(newValue[0], oldValue?.[0], onCleanup)
					}
				},
				{
					immediate,
					deep: true,
				},
			)
		}
	} else {
		if (!isRef(when)) {
			if (when(params) && immediate) {
				refetch(params)
			}
		} else {
			stopHandler = watch(
				when,
				(newValue, oldValue, onCleanup) => {
					if (newValue) {
						return refetch(params, undefined, onCleanup)
					}
				},
				{
					immediate,
					deep: true,
				},
			)
		}
	}
	// refetch on window focus
	if (refetchOnWindowFocus) {
		const focused = useWindowFocus()
		refetchOnFocunsStopHandler = watch(focused, (isFocused) => {
			if (isFocused) {
				if (
					(isRef(when) && when.value) ||
					(!isRef(when) && when(unref(params)))
				) {
					refetch()
				}
			}
		})
	}
	// refetch on document visibility
	if (refetchOnDocumentVisibility) {
		const visibility = useDocumentVisibility()
		documentVisibilityStopHandler = watch(visibility, (visibilityState) => {
			if (
				visibilityState === 'visible' &&
				((isRef(when) && when.value) ||
					(!isRef(when) && when(unref(params))))
			) {
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
	return { stop }
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
		autoSubmit = false,
		autoSubmitThrottle = 500,
		autoSubmitOnWindowFocus = false,
		autoSubmitOnDocumentVisibility = false,
	} = options
	// watch params and refetch
	let stop: WatchStopHandle | undefined
	let ignoreUpdates: IgnoredUpdater | undefined = (cb: () => void) => cb()
	if (autoSubmit && isRef(item)) {
		const { stop: stopHandler, ignoreUpdates: ignoreUpdatesHandler } =
			watchIgnorable(
				item,
				async (
					newValue: Type | undefined,
					oldValue: Type | undefined,
					cleanUp,
				) => {
					if (newValue) {
						await resubmit(newValue, unref(params), cleanUp)
					}
				},
				{
					eventFilter: throttleFilter(autoSubmitThrottle),
					immediate,
					deep: true,
				},
			)
		ignoreUpdates = ignoreUpdatesHandler
		stop = () => {
			status.value = StoreRepositoryStatus.idle
			return stopHandler()
		}
	} else if (immediate) {
		resubmit()
	}
	// refetch on window focus
	if (autoSubmitOnWindowFocus) {
		const focused = useWindowFocus()
		watch(focused, (isFocused) => {
			if (!isFocused) {
				resubmit()
			}
		})
	}
	// refetch on document visibility
	if (autoSubmitOnDocumentVisibility) {
		const visibility = useDocumentVisibility()
		watch(visibility, (visibilityState) => {
			if (visibilityState !== 'visible') {
				resubmit()
			}
		})
	}
	return { stop, ignoreUpdates }
}
