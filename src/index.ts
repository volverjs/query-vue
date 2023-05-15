import {
	type Ref,
	type PropType,
	computed,
	isRef,
	ref,
	unref,
	watch,
	defineComponent,
	toRefs,
	markRaw,
	onBeforeUnmount,
} from 'vue'
import { useIdle, tryOnUnmounted } from '@vueuse/core'
import { defineStore } from 'pinia'
import { Hash } from '@volverjs/data/hash'
import type { Repository } from '@volverjs/data'
import type {
	ParamMap,
	StoreRepositoryHash,
	StoreRepositoryOptions,
	StoreRepositoryQuery,
	StoreRepositoryReadOptions,
	StoreRepositorySubmitOptions,
	StoreRepositoryRemoveOptions,
} from './types'
import { StoreRepositoryStatus } from './constants'
import {
	clone,
	initStatus,
	initAutoExecuteReadHandlers,
	initAutoExecuteSubmitHandlers,
} from './utilities'

export const defineStoreRepository = <T>(
	repository: Repository<T>,
	name: string,
	options: StoreRepositoryOptions<T> = {},
) => {
	const keyProperty = options.keyProperty ?? ('id' as keyof T)
	const defaultPersistence = options.defaultPersistence ?? 60 * 60 * 1000
	const defaultDebounce = options.defaultDebounce ?? 0
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

	return defineStore(name, () => {
		const storeQueries: Ref<Map<string, StoreRepositoryQuery>> = ref(
			new Map(),
		)
		const storeItems: Ref<Map<unknown, T>> = ref(new Map())
		const storeHashes: Ref<Map<string, StoreRepositoryHash>> = ref(
			new Map(),
		)

		const getItemByKey = (key: unknown | Ref<unknown>) =>
			computed(() => storeItems.value.get(unref(key)))

		const getItemsByKeys = (keys: unknown[] | Ref<unknown[]>) =>
			computed(() => {
				return unref(keys).reduce((acc: T[], key) => {
					if (storeItems.value.get(key)) {
						acc.push(storeItems.value.get(key) as T)
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
									acc.data.push(...(data as T[]))
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
							data: [] as T[],
							metadata: {} as ParamMap,
							params: {} as ParamMap,
							timestamp: 0,
						},
					)
					if (keys.length) {
						data.push(
							...keys.reduce((acc: T[], key) => {
								if (storeItems.value.get(key)) {
									acc.push(storeItems.value.get(key) as T)
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

		const hasHash = (
			hash: string,
			options?: StoreRepositoryReadOptions,
		): boolean => {
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
				data,
				timestamp,
				params,
				metadata,
				group,
				directory,
			}: Partial<StoreRepositoryHash<T>> & {
				group?: boolean
				directory?: boolean
			} = {},
		) => {
			const storeHash =
				storeHashes.value.get(hash) ??
				({
					storeQueries: new Set(),
				} as StoreRepositoryHash)
			storeHash.storeQueries.add(storeQueryName)
			if (timestamp || data) {
				storeHash.timestamp = timestamp ?? new Date().getTime()
			}
			if (data) {
				if (!directory) {
					const keys: unknown[] = []
					data.forEach((item) => {
						const key = item[keyProperty]
						if (key) {
							keys.push(key)
							storeItems.value.set(key, item)
						}
					})
					storeHash.keys = keys
				} else {
					storeHash.data = data
				}
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
				options?.name ??
				crypto.getRandomValues(new Uint32Array(1))[0].toString()
			const storeQuery = getQueryByName(storeQueryName)
			const { status, isLoading, isError, isSuccess, error } =
				initStatus()
			const hasCleanupRequest = ref(false)

			// execute function
			const execute = async (
				newParamsOrForceExecute?: ParamMap | boolean,
				oldParamsOrForceExecute?: ParamMap,
				onCleanup?: (cleanupFn: () => void) => void,
			) => {
				let newParams: ParamMap | undefined
				let forceExecute = false
				if (typeof newParamsOrForceExecute === 'boolean') {
					forceExecute = newParamsOrForceExecute
				} else {
					newParams = newParamsOrForceExecute
				}
				if (typeof oldParamsOrForceExecute === 'boolean') {
					forceExecute = oldParamsOrForceExecute
				}
				if (!newParams && isRef(params)) {
					newParams = unref<ParamMap>(params)
				}
				if (!newParams && storeQuery.value) {
					newParams = storeQuery.value.params
				}
				if (!newParams) {
					newParams = params ?? {}
				}
				const hash = paramsToHash(newParams, options)
				// check if hash is already set
				if (hasHash(hash, options) && !forceExecute) {
					setHash(hash, storeQueryName, {
						group: options?.group,
					})
					status.value = StoreRepositoryStatus.success
					error.value = undefined
					return {
						query: storeQuery.value,
						data: storeQuery.value?.data,
						itme: storeQuery.value?.data?.[0],
						metadata: storeQuery.value?.metadata,
						error: error.value,
						status: status.value,
						isSuccess: isSuccess.value,
						isError: isError.value,
					}
				}
				// set new hash
				setHash(hash, storeQueryName, {
					group: options?.group,
				})
				status.value = StoreRepositoryStatus.loading
				const { responsePromise, abort } = repository.read(newParams, {
					key: hash,
				})
				if (abort && onCleanup) {
					onCleanup(() => {
						hasCleanupRequest.value = true
						abort()
					})
				}
				try {
					hasCleanupRequest.value = false
					const { data, metadata, aborted } = await responsePromise
					if (aborted) {
						if (hasCleanupRequest.value) {
							status.value = StoreRepositoryStatus.idle
						}
						return { status: status.value, aborted }
					}
					if (!data) {
						status.value = StoreRepositoryStatus.error
						error.value = new Error(
							`read: empty response is not allowed`,
						)
						return {
							error: error.value,
							status: status.value,
							isSuccess: isSuccess.value,
							isError: isError.value,
						}
					}
					if (
						!options?.directory &&
						data.length > 0 &&
						!data.every((item) => item[keyProperty])
					) {
						status.value = StoreRepositoryStatus.error
						error.value = new Error(
							`read: response must contain a ${String(
								keyProperty,
							)} property`,
						)
						return {
							error: error.value,
							status: status.value,
							isSuccess: isSuccess.value,
							isError: isError.value,
						}
					}
					setHash(hash, storeQueryName, {
						data,
						params,
						metadata,
						group: options?.group,
						directory: options?.directory,
					})
					status.value = StoreRepositoryStatus.success
				} catch (err) {
					status.value = StoreRepositoryStatus.error
					error.value = err as Error
				}
				return {
					query: storeQuery.value,
					data: storeQuery.value?.data,
					item: storeQuery.value?.data?.[0],
					metadata: storeQuery.value?.metadata,
					error: error.value,
					status: status.value,
					isSuccess: isSuccess.value,
					isError: isError.value,
				}
			}
			const { stop, ignoreUpdates } = initAutoExecuteReadHandlers(
				params,
				execute,
				status,
				{
					...options,
					autoExecuteDebounce:
						options?.autoExecuteDebounce ?? defaultDebounce,
				},
			)
			const cleanup = () => {
				if (!options?.keepAlive) {
					stop?.()
					disableQuery(storeQueryName)
				}
			}
			tryOnUnmounted(() => {
				cleanup()
			})
			return {
				isLoading,
				isError,
				isSuccess,
				error,
				status,
				query: storeQuery,
				data: computed(() => storeQuery.value?.data),
				item: computed(() => storeQuery.value?.data?.[0]),
				metadata: computed(() => storeQuery.value?.metadata),
				execute,
				stop,
				ignoreUpdates,
				cleanup,
			}
		}

		const ReadProvider = markRaw(
			// eslint-disable-next-line
			defineComponent({
				name: 'StoreRepositoryReadProvider',
				props: {
					params: {
						type: Object as PropType<ParamMap>,
						default: undefined,
					},
					options: {
						type: Object as PropType<StoreRepositoryReadOptions>,
						default: undefined,
					},
				},
				setup(props, { slots, expose }) {
					const { params, options } = toRefs(props)
					const toExpose = read(params, options.value)
					expose(toExpose)
					onBeforeUnmount(() => {
						toExpose.cleanup()
					})
					return () => {
						const slot = slots.default?.({
							isLoading: toExpose.isLoading.value,
							isError: toExpose.isError.value,
							isSuccess: toExpose.isSuccess.value,
							error: toExpose.error.value,
							status: toExpose.status.value,
							query: toExpose.query.value,
							data: toExpose.data.value,
							item: toExpose.item.value,
							metadata: toExpose.metadata.value,
							execute: toExpose.execute,
							stop: toExpose.stop,
							ignoreUpdates: toExpose.ignoreUpdates,
							cleanup: toExpose.cleanup,
						})
						return slot ? slot : slots.default
					}
				},
			}),
		)

		const submit = (
			item: Ref<T | undefined> | T,
			params: Ref<ParamMap> | ParamMap = {},
			options?: StoreRepositorySubmitOptions<T>,
		) => {
			const hasCleanupRequest = ref(false)
			const storeQueryName =
				options?.name ?? new Date().getTime().toString()
			const storeQuery = getQueryByName(storeQueryName)

			// init status
			const { status, isLoading, isError, isSuccess, error } =
				initStatus()

			// execute function
			const execute = async (
				newItem?: T,
				newParams?: ParamMap,
				onCleanup?: (cleanupFn: () => void) => void,
			) => {
				newItem = newItem ?? unref(item)
				newParams = newParams ?? unref(params) ?? {}
				if (newItem) {
					if (
						newItem?.[keyProperty] &&
						!newParams[keyProperty as string]
					) {
						newParams[keyProperty as string] = newItem[keyProperty]
					}
					const hash = paramsToHash(newParams)
					status.value = StoreRepositoryStatus.loading
					const { responsePromise, abort } = newItem[keyProperty]
						? repository.update(newItem, newParams, options)
						: repository.create(newItem, newParams, options)

					if (abort && onCleanup) {
						onCleanup(() => {
							hasCleanupRequest.value = true
							abort()
						})
					}
					try {
						hasCleanupRequest.value = false
						const { data, metadata, aborted } =
							await responsePromise
						if (aborted) {
							if (hasCleanupRequest.value) {
								status.value = StoreRepositoryStatus.idle
							}
							return {
								error: error.value,
								status: status.value,
								aborted,
							}
						}
						if (!data) {
							status.value = StoreRepositoryStatus.error
							error.value = new Error(
								`submit: empty response is not allowed`,
							)
							return {
								error: error.value,
								status: status.value,
								isSuccess: isSuccess.value,
								isError: isError.value,
							}
						}
						const key = data[keyProperty]
						if (!key) {
							status.value = StoreRepositoryStatus.error
							error.value = new Error(
								`submit: response must contain a ${String(
									keyProperty,
								)} property`,
							)
							return {
								error: error.value,
								status: status.value,
								isSuccess: isSuccess.value,
								isError: isError.value,
							}
						}
						setHash(hash, storeQueryName, {
							data: [data],
							params,
							metadata,
						})
						if (isRef(item)) {
							ignoreUpdates(() => {
								if (data && typeof data === 'object') {
									item.value = clone<T>(data)
								}
							})
						}
						status.value = StoreRepositoryStatus.success
					} catch (err) {
						status.value = StoreRepositoryStatus.error
						error.value = err as Error
					}
				}
				return {
					query: storeQuery.value,
					data: storeQuery.value?.data,
					item: storeQuery.value?.data?.[0],
					metadata: storeQuery.value?.metadata,
					error: error.value,
					status: status.value,
					isSuccess: isSuccess.value,
					isError: isError.value,
				}
			}
			const { stop, ignoreUpdates } = initAutoExecuteSubmitHandlers<T>(
				item,
				params,
				execute,
				status,
				{
					...options,
					autoExecuteDebounce:
						options?.autoExecuteDebounce ?? defaultDebounce,
				},
			)
			const cleanup = () => {
				if (!options?.keepAlive) {
					stop?.()
					disableQuery(storeQueryName)
				}
			}
			tryOnUnmounted(() => {
				cleanup()
			})
			return {
				isLoading,
				isError,
				isSuccess,
				error,
				status,
				query: storeQuery,
				data: computed(() => storeQuery.value?.data),
				item: computed(() => storeQuery.value?.data?.[0]),
				metadata: computed(() => storeQuery.value?.metadata),
				execute,
				stop,
				ignoreUpdates,
				cleanup,
			}
		}

		const SubmitProvider = markRaw(
			// eslint-disable-next-line
			defineComponent({
				name: 'StoreRepositorySubmitProvider',
				props: {
					modelValue: {
						type: Object as PropType<T>,
						default: undefined,
					},
					params: {
						type: Object as PropType<ParamMap>,
						default: undefined,
					},
					options: {
						type: Object as PropType<
							StoreRepositorySubmitOptions<T>
						>,
						default: () => ({
							immediate: false,
						}),
					},
				},
				emits: ['update:modelValue'],
				setup(props, { slots, expose, emit }) {
					const { modelValue, params, options } = toRefs(props)
					const localItem = computed({
						get: () => modelValue.value,
						set: (value) => {
							emit('update:modelValue', value)
						},
					}) as Ref<T | undefined>
					const toExpose = submit(localItem, params, options.value)
					expose(toExpose)
					onBeforeUnmount(() => {
						toExpose.cleanup()
					})
					return () => {
						const slot = slots.default?.({
							isLoading: toExpose.isLoading.value,
							isError: toExpose.isError.value,
							isSuccess: toExpose.isSuccess.value,
							status: toExpose.status.value,
							error: toExpose.error.value,
							query: toExpose.query.value,
							data: toExpose.data.value,
							item: toExpose.item.value,
							metadata: toExpose.metadata.value,
							execute: toExpose.execute,
							stop: toExpose.stop,
							ignoreUpdates: toExpose.ignoreUpdates,
							cleanup: toExpose.cleanup,
						})
						return slot ? slot : slots.default
					}
				},
			}),
		)

		const remove = (
			params: Ref<ParamMap> | ParamMap,
			{ immediate = true }: StoreRepositoryRemoveOptions = {},
		) => {
			// init status
			const { status, isLoading, isError, isSuccess, error } =
				initStatus()

			// execute function
			const execute = async () => {
				status.value = StoreRepositoryStatus.loading
				const normalizedParams = unref(params)
				const { responsePromise } = repository.remove(
					normalizedParams,
					options,
				)

				// check if keyProperty exists in params
				if (!(keyProperty in params)) {
					status.value = StoreRepositoryStatus.error
					error.value = new Error(
						`remove: params must contain a ${String(
							keyProperty,
						)} property`,
					)
					return {
						error: error.value,
						status: status.value,
						isSuccess: false,
						isError: true,
					}
				}
				try {
					const { aborted } = await responsePromise
					if (aborted) {
						status.value = StoreRepositoryStatus.idle
						return
					}
					status.value = StoreRepositoryStatus.success
					const keysToRemove = Array.isArray(
						normalizedParams[keyProperty as string],
					)
						? normalizedParams[keyProperty as string]
						: [normalizedParams[keyProperty as string]]

					// remove keys from store
					keysToRemove.forEach((key: string) => {
						storeItems.value.delete(key)
					})
				} catch (err) {
					status.value = StoreRepositoryStatus.error
					error.value = err as Error
				}
				return {
					error: error.value,
					status: status.value,
					isSuccess: isSuccess.value,
					isError: isError.value,
				}
			}
			// execute immediately
			if (immediate) {
				execute()
			}
			return {
				isLoading,
				isError,
				isSuccess,
				error,
				status,
				execute,
			}
		}

		const RemoveProvider = markRaw(
			// eslint-disable-next-line
			defineComponent({
				name: 'StoreRepositoryRemoveProvider',
				props: {
					params: {
						type: Object as PropType<ParamMap>,
						default: undefined,
					},
					options: {
						type: Object as PropType<StoreRepositoryRemoveOptions>,
						default: () => ({
							immediate: false,
						}),
					},
				},
				setup(props, { slots, expose }) {
					const { params, options } = toRefs(props)
					const toExpose = remove(params, options.value)
					expose(toExpose)
					return () => {
						const slot = slots.default?.({
							isLoading: toExpose.isLoading.value,
							isError: toExpose.isError.value,
							isSuccess: toExpose.isSuccess.value,
							status: toExpose.status.value,
							error: toExpose.error.value,
							execute: toExpose.execute,
						})
						return slot ? slot : slots.default
					}
				},
			}),
		)

		return {
			queries: storeQueries,
			items: storeItems,
			hashes: storeHashes,
			read,
			submit,
			remove,
			getQueryByName,
			getItemByKey,
			getItemsByKeys,
			cleanHashes,
			ReadProvider,
			SubmitProvider,
			RemoveProvider,
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
