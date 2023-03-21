import {
	type Ref,
	type WatchStopHandle,
	computed,
	isRef,
	ref,
	unref,
	watch,
	watchEffect,
} from 'vue'
import {
	type IgnoredUpdater,
	throttleFilter,
	useWindowFocus,
	useDocumentVisibility,
	watchIgnorable,
	useIdle,
	tryOnBeforeUnmount,
} from '@vueuse/core'
import { defineStore } from 'pinia'
import { Hash } from '@volverjs/data/hash'
import { type Repository } from '@volverjs/data'
import type {
	ParamMap,
	StoreRepositoryHash,
	StoreRepositoryQuery,
	StoreRepositoryReadOptions,
	StoreRepositorySubmitOptions,
} from './types'

export const StoreRepositoryStatus = {
	loading: 'loading',
	error: 'error',
	success: 'success',
	idle: 'idle',
} as const

export type StoreRepositoryStatus =
	(typeof StoreRepositoryStatus)[keyof typeof StoreRepositoryStatus]

export const defineStoreRepository = <Type>(
	repository: Repository<Type>,
	name: string,
	options: {
		keyProperty?: keyof Type
		defaultPersistence?: number
		defaultThrottle?: number
		hashFunction?: (str: string) => number
		cleanUpEvery?: number
	} = {},
) => {
	const keyProperty = options.keyProperty ?? ('id' as keyof Type)
	const defaultPersistence = options.defaultPersistence ?? 60 * 60 * 1000
	const defaultThrottle = options.defaultThrottle ?? 500
	const hashFunction = options.hashFunction ?? Hash.cyrb53
	const cleanUpEvery = options.cleanUpEvery ?? 3 * 1000

	function paramsToHash(
		params: ParamMap | Ref<ParamMap>,
		options?: { directory?: boolean },
	) {
		const prefix = options?.directory ? 'directory' : undefined
		return `${prefix ? `${prefix}-` : ''}${hashFunction(
			JSON.stringify(unref(params)),
		)}`
	}

	function initStatus() {
		const status = ref<StoreRepositoryStatus>(StoreRepositoryStatus.idle)
		const isLoading = computed(
			() => status.value === StoreRepositoryStatus.loading,
		)
		const isError = computed(
			() => status.value === StoreRepositoryStatus.error,
		)
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

	function initRefetchHandlers(
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
			documentVisibilityStopHandler = watch(
				visibility,
				(visibilityState) => {
					if (
						visibilityState === 'visible' &&
						((isRef(when) && when.value) ||
							(!isRef(when) && when(unref(params))))
					) {
						refetch()
					}
				},
			)
		}
		const stop = () => {
			status.value = StoreRepositoryStatus.idle
			stopHandler?.()
			refetchOnFocunsStopHandler?.()
			documentVisibilityStopHandler?.()
		}
		return { stop }
	}

	function initResubmitHandlers(
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
			autoSubmitThrottle = defaultThrottle,
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

	return defineStore(name, () => {
		const storeQueries: Ref<Map<string, StoreRepositoryQuery>> = ref(
			new Map(),
		)
		const storeItems: Ref<Map<unknown, Type>> = ref(new Map())
		const storeHashes: Ref<Map<string, StoreRepositoryHash>> = ref(
			new Map(),
		)

		const getItemByKey = (key: unknown | Ref<unknown>) =>
			computed(() => storeItems.value.get(unref(key)))

		const getItemsByKeys = (keys: unknown[] | Ref<unknown[]>) =>
			computed(() => {
				return unref(keys).reduce((acc: Type[], key) => {
					if (storeItems.value.get(key)) {
						acc.push(storeItems.value.get(key) as Type)
						return acc
					}
					return acc
				}, [])
			})

		const getQueryByName = (name: string | Ref<string>) =>
			computed(() => {
				if (storeQueries.value.has(unref(name))) {
					const query = storeQueries.value.get(
						unref(name),
					) as StoreRepositoryQuery
					const { keys, data, metadata, timestamp, params } = [
						...query.storeHashes,
					].reduce(
						(acc, item) => {
							if (storeHashes.value.has(item)) {
								const {
									keys,
									data,
									metadata,
									timestamp,
									params,
								} = storeHashes.value.get(
									item,
								) as StoreRepositoryHash
								if (keys) {
									acc.keys.push(...keys)
								}
								if (data) {
									acc.data.push(...(data as Type[]))
								}
								acc.metadata = { ...acc.metadata, ...metadata }
								if (acc.timestamp < timestamp) {
									acc.timestamp = timestamp
									acc.params = params
								}
							}
							return acc
						},
						{
							keys: [] as unknown[],
							data: [] as Type[],
							metadata: {} as ParamMap,
							params: {} as ParamMap,
							timestamp: 0,
						},
					)
					if (keys.length) {
						data.push(
							...keys.reduce((acc: Type[], key) => {
								if (storeItems.value.get(key)) {
									acc.push(storeItems.value.get(key) as Type)
								}
								return acc
							}, []),
						)
					}
					return {
						...query,
						metadata,
						data,
						timestamp,
						params,
					}
				}
				return undefined
			})

		function hasHash(
			hash: string,
			options?: StoreRepositoryReadOptions,
		): boolean {
			const persistence = options?.persistence ?? defaultPersistence
			// get store hash
			const storeHash = storeHashes.value.get(hash)
			// if store hash is not set
			if (!storeHash) {
				return false
			}
			return storeHash.timestamp + persistence > Date.now()
		}

		const setHash = (
			hash: string,
			storeQueryName: string,
			{
				keys,
				data,
				timestamp,
				params,
				metadata,
				group,
			}: Partial<StoreRepositoryHash> & { group?: boolean } = {},
		) => {
			const storeHash =
				storeHashes.value.get(hash) ??
				({
					storeQueries: new Set(),
				} as StoreRepositoryHash)
			storeHash.storeQueries.add(storeQueryName)
			if (timestamp || keys || data) {
				storeHash.timestamp = timestamp ?? new Date().getTime()
			}
			if (keys) {
				storeHash.keys = keys
			}
			if (data) {
				storeHash.data = data
			}
			if (params) {
				storeHash.params = params
			}
			if (metadata) {
				storeHash.metadata = metadata
			}
			// set new hash
			storeHashes.value.set(hash, storeHash)
			// update query
			const query = storeQueries.value.get(storeQueryName)
			if (query) {
				// update query with new hash
				if (group) {
					storeQueries.value.set(storeQueryName, {
						enabled: true,
						storeHashes: new Set([...query.storeHashes, hash]),
					} as StoreRepositoryQuery)
					return hash
				}
				if (!query.storeHashes.has(hash)) {
					// remove query from old storeHashes
					query.storeHashes.forEach((item) => {
						storeHashes.value
							.get(item)
							?.storeQueries.delete(storeQueryName)
					})
				}
			}
			// create query
			storeQueries.value.set(storeQueryName, {
				enabled: true,
				storeHashes: new Set([hash]),
			} as StoreRepositoryQuery)
			return hash
		}

		const disableQuery = (name: string) => {
			const query = storeQueries.value.get(name)
			if (query) {
				storeQueries.value.set(name, {
					...query,
					enabled: false,
				} as StoreRepositoryQuery)
			}
		}

		const clearQueries = () => {
			storeQueries.value.forEach((item, name) => {
				if (!item.enabled) {
					item.storeHashes.forEach((hash) => {
						storeHashes.value.get(hash)?.storeQueries.delete(name)
					})
					storeQueries.value.delete(name)
				}
			})
		}

		const cleanHashes = () => {
			storeHashes.value.forEach((item, name) => {
				if (item.storeQueries.size === 0) {
					storeHashes.value.delete(name)
				}
			})
		}

		if (cleanUpEvery !== undefined) {
			const { idle } = useIdle(cleanUpEvery)
			watch(idle, (isIdle) => {
				if (isIdle) {
					clearQueries()
					cleanHashes()
				}
			})
		}

		const read = (
			params: Ref<ParamMap> | ParamMap = {},
			options?: StoreRepositoryReadOptions,
		) => {
			const storeQueryName =
				options?.name ?? new Date().getTime().toString()
			const storeQuery = getQueryByName(storeQueryName)
			const { status, isLoading, isError, isSuccess, error } =
				initStatus()
			const refetch = async (
				newParams?: ParamMap,
				oldParams?: ParamMap,
				onCleanup?: (cleanupFn: () => void) => void,
			) => {
				if (newParams) {
					const cacheHash = paramsToHash(newParams, options)
					if (hasHash(cacheHash, options)) {
						setHash(cacheHash, storeQueryName, {
							group: options?.group,
						})
						status.value = StoreRepositoryStatus.success
						return {
							data: storeQuery.value?.data,
							status: status.value,
						}
					}
				}
				if (!newParams && isRef(params)) {
					newParams = unref<ParamMap>(params)
				}
				if (!newParams && storeQuery.value) {
					newParams = storeQuery.value.params
				}
				if (!newParams) {
					newParams = unref(params)
				}
				const hash = paramsToHash(newParams, options)
				status.value = StoreRepositoryStatus.loading
				const { response, abort } = repository.read(newParams, {
					key: hash,
				})
				if (abort && onCleanup) {
					onCleanup(abort)
				}
				try {
					const { data, metadata, aborted } = await response
					if (aborted) {
						status.value = StoreRepositoryStatus.idle
						return { status: status.value, aborted }
					}
					if (!data) {
						status.value = StoreRepositoryStatus.error
						error.value = new Error(
							`read: empty response is not allowed`,
						)
						return { error: error.value, status: status.value }
					}
					if (!data.every((item) => item[keyProperty])) {
						status.value = StoreRepositoryStatus.error
						error.value = new Error(
							`read: response must contain a ${String(
								keyProperty,
							)} property`,
						)
						return { error: error.value, status: status.value }
					}
					setHash(hash, storeQueryName, {
						keys: !options?.directory
							? data.map((item) => item[keyProperty])
							: undefined,
						data: options?.directory ? data : undefined,
						params,
						metadata,
						group: options?.group,
					})
					if (!options?.directory) {
						data.forEach((item) => {
							const key = item[keyProperty]
							if (key) {
								storeItems.value.set(key, item)
							}
						})
					}
					status.value = StoreRepositoryStatus.success
					return { data, metadata, status: status.value }
				} catch (err) {
					status.value = StoreRepositoryStatus.error
					error.value = err as Error
					return { error: error.value, status: status.value }
				}
			}
			const { stop } = initRefetchHandlers(
				params,
				refetch,
				status,
				options,
			)
			const cleanup = () => {
				if (!options?.keepAlive) {
					stop?.()
					disableQuery(storeQueryName)
				}
			}
			tryOnBeforeUnmount(() => {
				cleanup()
			})
			return {
				isLoading,
				isError,
				isSuccess,
				status,
				error,
				refetch,
				stop,
				query: storeQuery,
				data: computed(() => storeQuery.value?.data),
				item: computed(() => storeQuery.value?.data?.[0]),
				metadata: computed(() => storeQuery.value?.metadata),
				cleanup,
			}
		}

		const submit = (
			item: Ref<Type | undefined> | Type,
			params: Ref<ParamMap> | ParamMap = {},
			options?: StoreRepositorySubmitOptions,
		) => {
			const storeQueryName =
				options?.name ?? new Date().getTime().toString()
			const storeQuery = getQueryByName(storeQueryName)
			const { status, isLoading, isError, isSuccess, error } =
				initStatus()
			const resubmit = async (
				newItem?: Type,
				newParams?: ParamMap,
				onCleanup?: (cleanupFn: () => void) => void,
			) => {
				newItem = newItem ?? unref(item)
				newParams = newParams ?? unref(params)
				if (newItem) {
					if (
						newItem?.[keyProperty] &&
						!newParams[keyProperty as string]
					) {
						newParams[keyProperty as string] = newItem[keyProperty]
					}
					if (options?.when) {
						if (isRef(options.when)) {
							if (!unref(options.when)) {
								return
							}
						} else {
							if (!options.when(newItem, newParams)) {
								return
							}
						}
					}
					const hash = paramsToHash(newParams)
					status.value = StoreRepositoryStatus.loading
					const { response, abort } = newItem[keyProperty]
						? repository.update(newParams, newItem, options)
						: repository.create(newParams, newItem, options)

					if (abort && onCleanup) {
						onCleanup(abort)
					}
					try {
						const { data, metadata, aborted } = await response
						if (aborted) {
							status.value = StoreRepositoryStatus.idle
							return
						}
						if (!data) {
							status.value = StoreRepositoryStatus.error
							error.value = new Error(
								`submit: empty response is not allowed`,
							)
							return
						}
						if (!data[keyProperty]) {
							status.value = StoreRepositoryStatus.error
							error.value = new Error(
								`submit: response must contain a ${String(
									keyProperty,
								)} property`,
							)
							return
						}
						setHash(hash, storeQueryName, {
							keys: [data[keyProperty]],
							params,
							metadata,
							group: options?.group,
						})
						const key = data[keyProperty]
						if (key) {
							storeItems.value.set(key, data)
						}
						if (isRef(item)) {
							ignoreUpdates(() => {
								if (data && typeof data === 'object') {
									item.value =
										'clone' in data &&
										typeof data.clone === 'function'
											? data.clone()
											: JSON.parse(JSON.stringify(data))
								}
							})
						}
						status.value = StoreRepositoryStatus.success
					} catch (err) {
						status.value = StoreRepositoryStatus.error
						error.value = err as Error
					}
				}
			}
			const { stop, ignoreUpdates } = initResubmitHandlers(
				item,
				params,
				resubmit,
				status,
				options,
			)
			const cleanup = () => {
				if (!options?.keepAlive) {
					stop?.()
					disableQuery(storeQueryName)
				}
			}
			tryOnBeforeUnmount(() => {
				cleanup()
			})
			return {
				isLoading,
				isError,
				isSuccess,
				status,
				error,
				resubmit,
				stop,
				ignoreUpdates,
				query: storeQuery,
				data: computed(() => storeQuery.value?.data),
				item: computed(() => storeQuery.value?.data?.[0]),
				metadata: computed(() => storeQuery.value?.metadata),
				cleanup,
			}
		}

		return {
			queries: storeQueries,
			items: storeItems,
			hashes: storeHashes,
			read,
			submit,
			getQueryByName,
			getItemByKey,
			getItemsByKeys,
			cleanHashes,
		}
	})
}

export type {
	ParamMap,
	StoreRepositoryHash,
	StoreRepositoryQuery,
	StoreRepositoryReadOptions,
	StoreRepositorySubmitOptions,
}
