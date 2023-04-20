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
import { useIdle, tryOnBeforeUnmount } from '@vueuse/core'
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

export const defineStoreRepository = <Type>(
	repository: Repository<Type>,
	name: string,
	options: StoreRepositoryOptions<Type> = {},
) => {
	const keyProperty = options.keyProperty ?? ('id' as keyof Type)
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
			const execute = async (
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
						error.value = undefined
						return {
							query: storeQuery.value,
							data: storeQuery.value?.data,
							metadata: storeQuery.value?.metadata,
							status: status.value,
							error: error.value,
							isSuccess: isSuccess.value,
							isError: isError.value,
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
					newParams = params ?? {}
				}
				const hash = paramsToHash(newParams, options)
				status.value = StoreRepositoryStatus.loading
				const { responsePromise, abort } = repository.read(newParams, {
					key: hash,
				})
				if (abort && onCleanup) {
					onCleanup(abort)
				}
				try {
					const { data, metadata, aborted } = await responsePromise
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
					if (
						!options?.directory &&
						!data.every((item) => item[keyProperty])
					) {
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
				} catch (err) {
					status.value = StoreRepositoryStatus.error
					error.value = err as Error
				}
				return {
					query: storeQuery.value,
					data: storeQuery.value?.data,
					metadata: storeQuery.value?.metadata,
					status: status.value,
					error: error.value,
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
			tryOnBeforeUnmount(() => {
				cleanup()
			})
			return {
				isLoading,
				isError,
				isSuccess,
				status,
				error,
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

		const submit = (
			item: Ref<Type | undefined> | Type,
			params: Ref<ParamMap> | ParamMap = {},
			options?: StoreRepositorySubmitOptions<Type>,
		) => {
			const storeQueryName =
				options?.name ?? new Date().getTime().toString()
			const storeQuery = getQueryByName(storeQueryName)
			const { status, isLoading, isError, isSuccess, error } =
				initStatus()
			const execute = async (
				newItem?: Type,
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
						onCleanup(abort)
					}
					try {
						const { data, metadata, aborted } =
							await responsePromise
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
						})
						const key = data[keyProperty]
						if (key) {
							storeItems.value.set(key, data)
						}
						if (isRef(item)) {
							ignoreUpdates(() => {
								if (data && typeof data === 'object') {
									item.value = clone<Type>(data)
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
					metadata: storeQuery.value?.metadata,
					status: status.value,
					error: error.value,
					isSuccess: isSuccess.value,
					isError: isError.value,
				}
			}
			const { stop, ignoreUpdates } = initAutoExecuteSubmitHandlers<Type>(
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
			tryOnBeforeUnmount(() => {
				cleanup()
			})
			return {
				isLoading,
				isError,
				isSuccess,
				status,
				error,
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
						type: Object as PropType<Type>,
						default: undefined,
					},
					params: {
						type: Object as PropType<ParamMap>,
						default: undefined,
					},
					options: {
						type: Object as PropType<
							StoreRepositorySubmitOptions<Type>
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
					}) as Ref<Type | undefined>
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
			const { status, isLoading, isError, isSuccess, error } =
				initStatus()

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
					return
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
