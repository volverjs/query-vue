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
import type { Repository, RepositoryHttp } from '@volverjs/data'
import type {
	ParamMap,
	StoreRepositoryHash,
	StoreRepositoryOptions,
	StoreRepositoryQuery,
	StoreRepositoryReadOptions,
	StoreRepositorySubmitOptions,
	StoreRepositoryRemoveOptions,
} from './types'
import { StoreRepositoryAction, StoreRepositoryStatus } from './constants'
import {
	clone,
	initAutoExecuteReadHandlers,
	initAutoExecuteSubmitHandlers,
	getRandomValues,
} from './utilities'

export const defineStoreRepository = <T>(
	repository: Repository<T> | RepositoryHttp<T>,
	name: string,
	options: StoreRepositoryOptions<T> = {},
) => {
	const keyProperty = options.keyProperty ?? ('id' as keyof T)
	const defaultPersistence = options.defaultPersistence ?? 60 * 60 * 1000
	const defaultDebounce = options.defaultDebounce ?? 0
	const defaultParameters = options.defaultParameters ?? {}
	const hashFunction = options.hashFunction ?? Hash.cyrb53
	const cleanUpEvery = options.cleanUpEvery ?? 3 * 1000

	function hashParams(
		params: ParamMap | Ref<ParamMap>,
		action: StoreRepositoryAction,
		options?: { directory?: boolean },
	) {
		const prefix = options?.directory ? 'directory' : undefined
		return `${prefix ? prefix + '-' : ''}${action}-${hashFunction(
			JSON.stringify(unref(params)),
		)}`
	}

	function checkKeyValue(value: unknown) {
		return value !== undefined && value !== null && value !== ''
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
					const {
						keys,
						data,
						metadata,
						timestamp,
						params,
						isError,
						isLoading,
						isSuccess,
						errors,
					} = [...query.storeHashes].reduce(
						(acc, item) => {
							if (storeHashes.value.has(item)) {
								const {
									keys,
									data,
									metadata,
									timestamp,
									params,
									status,
									error,
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
								acc.isLoading =
									acc.isLoading ||
									status === StoreRepositoryStatus.loading
								acc.isError =
									acc.isError ||
									status === StoreRepositoryStatus.error
								acc.isSuccess =
									acc.isSuccess ||
									status === StoreRepositoryStatus.success
								if (
									status === StoreRepositoryStatus.error &&
									error
								) {
									acc.errors.push(error)
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
							isLoading: false,
							isError: false,
							isSuccess: false,
							errors: [] as Error[],
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
						isLoading,
						isError,
						isSuccess,
						errors,
						metadata,
						data,
						timestamp,
						params,
					}
				}
				return undefined
			})

		const getHash = (
			hash: string,
			options?: StoreRepositoryReadOptions<
				Parameters<typeof repository.read>[1]
			>,
		): StoreRepositoryHash | undefined => {
			// get store hash
			const storeHash = storeHashes.value.get(hash)
			if (!storeHash) {
				return undefined
			}
			const persistence = options?.persistence ?? defaultPersistence
			// if store hash is not set
			if (storeHash.timestamp + persistence > Date.now()) {
				return storeHash
			}
			return undefined
		}

		const setHash = (
			hashKey: string,
			{
				queryName,
				data,
				timestamp,
				params,
				metadata,
				group,
				directory,
				status,
				error,
				action,
				abort,
				promise,
			}: Partial<StoreRepositoryHash<T>> & {
				queryName?: string
				group?: boolean
			} = {},
		) => {
			const storeHash =
				storeHashes.value.get(hashKey) ??
				({
					storeQueries: new Set(),
					status: StoreRepositoryStatus.idle,
					directory: false,
					action: StoreRepositoryAction.read,
				} as StoreRepositoryHash)
			storeHash.timestamp = timestamp ?? new Date().getTime()
			if (params) {
				storeHash.params = params
			}
			if (metadata) {
				storeHash.metadata = metadata
			}
			if (queryName) {
				storeHash.storeQueries.add(queryName)
			}
			if (status) {
				storeHash.status = status
			}
			if (action) {
				storeHash.action = action
			}
			if (abort) {
				storeHash.abort = abort
			} else {
				storeHash.abort = undefined
			}
			if (error) {
				storeHash.error = error
			} else {
				storeHash.error = undefined
			}
			if (promise) {
				storeHash.promise = promise
			} else {
				storeHash.promise = undefined
			}
			if (typeof directory === 'boolean') {
				storeHash.directory = directory
			}
			if (data) {
				if (!storeHash.directory) {
					const keyValues: unknown[] = []
					data.forEach((item) => {
						const keyValue = item[keyProperty]
						if (checkKeyValue(keyValue)) {
							keyValues.push(keyValue)
							storeItems.value.set(keyValue, item)
						}
					})
					storeHash.keys = keyValues
				} else {
					storeHash.data = data
				}
			}
			// update hash
			storeHashes.value.set(hashKey, storeHash)
			// update query
			if (queryName) {
				const storeQuery = storeQueries.value.get(queryName)
				if (storeQuery) {
					// update query with new hash
					if (group) {
						storeQueries.value.set(queryName, {
							enabled: true,
							storeHashes: new Set([
								...storeQuery.storeHashes,
								hashKey,
							]),
						} as StoreRepositoryQuery)
						return
					}
					if (!storeQuery.storeHashes.has(hashKey)) {
						// remove query from old storeHashes
						storeQuery.storeHashes.forEach((item) => {
							storeHashes.value
								.get(item)
								?.storeQueries.delete(queryName)
						})
					}
				}
				// create query
				storeQueries.value.set(queryName, {
					enabled: true,
					storeHashes: new Set([hashKey]),
				} as StoreRepositoryQuery)
			}
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

		const resetQuery = (name: string) => {
			const query = storeQueries.value.get(name)
			if (query) {
				query.storeHashes.forEach((hash) => {
					storeHashes.value.get(hash)?.storeQueries.delete(name)
				})
				query.storeHashes.clear()
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
			{
				repositoryOptions,
				...options
			}: StoreRepositoryReadOptions<
				Parameters<typeof repository.read>[1]
			> = {},
		) => {
			const queryName = options?.name ?? getRandomValues(1).toString()
			const storeQuery = getQueryByName(queryName)
			const executeReturn = (aborted = false) => ({
				query: storeQuery.value,
				data: storeQuery.value?.data ?? [],
				item: storeQuery.value?.data?.[0],
				metadata: storeQuery.value?.metadata,
				errors: storeQuery.value?.errors ?? [],
				error: storeQuery.value?.errors?.[0],
				isSuccess: storeQuery.value?.isSuccess ?? false,
				isError: storeQuery.value?.isError ?? false,
				aborted,
			})
			const reset = () => {
				resetQuery(queryName)
			}
			// execute function
			const execute = async (
				newParamsOrForceExecute?: ParamMap | boolean,
				newRepositoryOptionsOrForceExecute?: Parameters<
					typeof repository.read
				>[1],
			) => {
				let newParams: ParamMap | undefined
				let newRepositoryOptions:
					| Parameters<typeof repository.read>[1]
					| undefined
				let forceExecute = false
				if (typeof newParamsOrForceExecute === 'boolean') {
					forceExecute = newParamsOrForceExecute
				} else {
					newParams = newParamsOrForceExecute
				}
				if (typeof newRepositoryOptionsOrForceExecute === 'boolean') {
					forceExecute = newRepositoryOptionsOrForceExecute
				} else {
					newRepositoryOptions = newRepositoryOptionsOrForceExecute
				}
				if (!newParams && isRef(params)) {
					newParams = params
				}
				if (!newParams && storeQuery.value) {
					newParams = storeQuery.value.params
				}
				if (!newParams) {
					newParams = params ?? {}
				}
				newParams = unref(newParams)
				newParams = { ...defaultParameters, ...newParams }
				// reset query
				if (
					options?.resetWhen &&
					((isRef(options.resetWhen) && options.resetWhen.value) ||
						(typeof options.resetWhen === 'function' &&
							options.resetWhen(
								newParams,
								storeQuery.value?.params,
							)))
				) {
					reset()
				}
				// create hash
				const hashKey = hashParams(
					newParams,
					StoreRepositoryAction.read,
					options,
				)
				const storeHash = getHash(hashKey, options)
				// check if hash is already set
				if (
					storeHash &&
					(storeHash.status === StoreRepositoryStatus.loading ||
						(storeHash.status === StoreRepositoryStatus.success &&
							!forceExecute))
				) {
					if (storeHash.promise) {
						await storeHash.promise
					}
					setHash(hashKey, {
						queryName,
						group: options?.group,
					})
					return executeReturn()
				}
				// abort old request
				if (!options?.group) {
					const oldHashKey = storeQuery.value?.storeHashes
						.values()
						?.next().value
					if (oldHashKey !== hashKey) {
						const oldStoreHash = getHash(oldHashKey)
						if (oldStoreHash) {
							oldStoreHash.abort?.()
						}
					}
				}
				// create new request
				const repositoryReadOptions =
					newRepositoryOptions ?? unref(repositoryOptions)
				const { responsePromise, abort } = repository.read(newParams, {
					key: hashKey,
					...repositoryReadOptions,
				})
				setHash(hashKey, {
					queryName,
					params: newParams,
					directory: options?.directory,
					group: options?.group,
					status: StoreRepositoryStatus.loading,
					abort,
					promise: responsePromise,
				})
				try {
					const { data, metadata, aborted } = await responsePromise
					if (aborted) {
						setHash(hashKey, {
							status: StoreRepositoryStatus.idle,
						})
						return executeReturn(true)
					}
					if (!data) {
						setHash(hashKey, {
							status: StoreRepositoryStatus.error,
							error: new Error(
								`read: empty response is not allowed`,
							),
						})
						return executeReturn()
					}
					if (
						data.length > 0 &&
						!options?.directory &&
						!data.every((item) => checkKeyValue(item[keyProperty]))
					) {
						setHash(hashKey, {
							status: StoreRepositoryStatus.error,
							error: new Error(
								`read: response must contain a ${String(
									keyProperty,
								)} property`,
							),
						})
						return executeReturn()
					}
					setHash(hashKey, {
						status: StoreRepositoryStatus.success,
						data,
						metadata,
					})
				} catch (error) {
					setHash(hashKey, {
						status: StoreRepositoryStatus.error,
						error: error as Error,
					})
				}
				return executeReturn()
			}
			const { stop, ignoreUpdates } = initAutoExecuteReadHandlers<T>(
				params,
				execute,
				{
					...options,
					autoExecuteDebounce:
						options?.autoExecuteDebounce ?? defaultDebounce,
				},
			)
			const cleanup = () => {
				if (!options?.keepAlive) {
					stop?.()
					disableQuery(queryName)
				}
			}
			tryOnUnmounted(() => {
				cleanup()
			})
			return {
				query: storeQuery,
				isLoading: computed(() => storeQuery.value?.isLoading ?? false),
				isError: computed(() => storeQuery.value?.isError ?? false),
				isSuccess: computed(() => storeQuery.value?.isSuccess ?? false),
				error: computed(() => storeQuery.value?.errors?.[0]),
				errors: computed(() => storeQuery.value?.errors ?? []),
				data: computed(() => storeQuery.value?.data ?? []),
				item: computed(() => storeQuery.value?.data?.[0]),
				metadata: computed(() => storeQuery.value?.metadata),
				execute,
				stop,
				ignoreUpdates,
				cleanup,
				reset,
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
						type: Object as PropType<
							StoreRepositoryReadOptions<
								Parameters<typeof repository.read>[1]
							>
						>,
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
			payload: Ref<T | T[] | undefined> | T | T[] | undefined,
			params: Ref<ParamMap> | ParamMap = {},
			{
				repositoryOptions,
				...options
			}: StoreRepositorySubmitOptions<
				T,
				Parameters<typeof repository.create>[2]
			> = {},
		) => {
			const queryName = options?.name ?? new Date().getTime().toString()
			const storeQuery = getQueryByName(queryName)

			const executeReturn = (aborted = false) => ({
				query: storeQuery.value,
				data: storeQuery.value?.data ?? [],
				item: storeQuery.value?.data?.[0],
				metadata: storeQuery.value?.metadata,
				errors: storeQuery.value?.errors ?? [],
				error: storeQuery.value?.errors?.[0],
				isSuccess: storeQuery.value?.isSuccess ?? false,
				isError: storeQuery.value?.isError ?? false,
				aborted,
			})

			// execute function
			const execute = async (
				newData?: T | T[],
				newParams?: ParamMap,
				newRepositoryOptions?: Parameters<typeof repository.create>[2],
			) => {
				newData = newData ?? unref(payload)
				newParams = newParams ?? (params ? { ...unref(params) } : {})
				if (
					!newData ||
					(Array.isArray(newData) && newData.length === 0)
				) {
					return executeReturn()
				}
				if (
					!Array.isArray(newData) &&
					checkKeyValue(newData[keyProperty]) &&
					!newParams[keyProperty as string]
				) {
					newParams[keyProperty as string] = newData[keyProperty]
				}
				newParams = { ...defaultParameters, ...newParams }

				// action
				let action: StoreRepositoryAction | undefined = options?.action
				if (!action) {
					if (!Array.isArray(newData)) {
						action = checkKeyValue(newData[keyProperty])
							? StoreRepositoryAction.update
							: StoreRepositoryAction.create
					} else {
						action = newData.every((item) =>
							checkKeyValue(item[keyProperty]),
						)
							? StoreRepositoryAction.update
							: StoreRepositoryAction.create
					}
				}
				const hashKey = hashParams(newParams, action)

				// abort old request
				const oldHashKey = storeQuery.value?.storeHashes
					.values()
					?.next().value
				if (oldHashKey !== hashKey) {
					const oldStoreHash = getHash(oldHashKey)
					if (oldStoreHash) {
						oldStoreHash.abort?.()
					}
				}
				// create new request
				const repositorySubmitOptions =
					newRepositoryOptions ?? unref(repositoryOptions)
				const { responsePromise, abort } =
					action === StoreRepositoryAction.update
						? repository.update(
								newData,
								newParams,
								repositorySubmitOptions,
							)
						: repository.create(
								newData,
								newParams,
								repositorySubmitOptions,
							)

				setHash(hashKey, {
					queryName,
					params: newParams,
					status: StoreRepositoryStatus.loading,
					action,
					abort,
				})
				try {
					const { data, metadata, aborted } = await responsePromise
					if (aborted) {
						setHash(hashKey, {
							status: StoreRepositoryStatus.idle,
						})
						return executeReturn(true)
					}
					if (!data) {
						setHash(hashKey, {
							status: StoreRepositoryStatus.error,
							error: new Error(
								`submit: empty response is not allowed`,
							),
						})
						return executeReturn()
					}
					if (
						!data.every((item) => checkKeyValue(item[keyProperty]))
					) {
						setHash(hashKey, {
							status: StoreRepositoryStatus.error,
							error: new Error(
								`submit: response must contain a ${String(
									keyProperty,
								)} property`,
							),
						})
						return executeReturn()
					}
					setHash(hashKey, {
						status: StoreRepositoryStatus.success,
						data,
						metadata,
					})
					if (isRef(payload)) {
						ignoreUpdates(() => {
							if (Array.isArray(payload.value)) {
								payload.value = clone<T[]>(data)
								return
							}
							payload.value = clone<T>(data[0])
						})
					}
				} catch (error) {
					setHash(hashKey, {
						status: StoreRepositoryStatus.error,
						error: error as Error,
					})
				}
				return executeReturn()
			}
			const { stop, ignoreUpdates } = initAutoExecuteSubmitHandlers<T>(
				payload,
				params,
				execute,
				{
					...options,
					autoExecuteDebounce:
						options?.autoExecuteDebounce ?? defaultDebounce,
				},
			)
			const cleanup = () => {
				if (!options?.keepAlive) {
					stop?.()
					disableQuery(queryName)
				}
			}
			tryOnUnmounted(() => {
				cleanup()
			})
			return {
				query: storeQuery,
				isLoading: computed(() => storeQuery.value?.isLoading),
				isError: computed(() => storeQuery.value?.isError),
				isSuccess: computed(() => storeQuery.value?.isSuccess),
				errors: computed(() => storeQuery.value?.errors),
				error: computed(() => storeQuery.value?.errors?.[0]),
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
						type: Object as PropType<T | T[]>,
						default: undefined,
					},
					params: {
						type: Object as PropType<ParamMap>,
						default: undefined,
					},
					options: {
						type: Object as PropType<
							StoreRepositorySubmitOptions<
								T,
								Parameters<typeof repository.create>[2]
							>
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
					}) as Ref<T | T[] | undefined>
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
			params?: Ref<ParamMap> | ParamMap,
			{
				name,
				immediate = true,
				repositoryOptions,
			}: StoreRepositoryRemoveOptions<
				Parameters<typeof repository.remove>[1]
			> = {},
		) => {
			const queryName = name ?? getRandomValues(1).toString()
			const storeQuery = getQueryByName(queryName)
			const executeReturn = (aborted = false) => ({
				query: storeQuery.value,
				metadata: storeQuery.value?.metadata,
				errors: storeQuery.value?.errors,
				error: storeQuery.value?.errors?.[0],
				isSuccess: storeQuery.value?.isSuccess ?? false,
				isError: storeQuery.value?.isError ?? false,
				aborted,
			})

			// execute function
			const execute = async (
				newParams?: ParamMap,
				newRepositoryOptions?: Parameters<typeof repository.remove>[1],
			) => {
				newParams = newParams ?? (params ? { ...unref(params) } : {})
				newParams = { ...defaultParameters, ...newParams }
				const hashKey = hashParams(
					newParams,
					StoreRepositoryAction.remove,
				)
				// abort old request
				const oldHashKey = storeQuery.value?.storeHashes
					.values()
					?.next().value
				if (oldHashKey !== hashKey) {
					const oldStoreHash = getHash(oldHashKey)
					if (oldStoreHash) {
						oldStoreHash.abort?.()
					}
				}
				// create new request
				const repositoryRemoveOptions =
					newRepositoryOptions ?? unref(repositoryOptions)
				const { responsePromise, abort } = repository.remove(
					newParams,
					repositoryRemoveOptions,
				)
				setHash(hashKey, {
					queryName,
					params: newParams,
					action: StoreRepositoryAction.remove,
					status: StoreRepositoryStatus.loading,
					abort,
				})
				try {
					const { aborted } = await responsePromise
					if (aborted) {
						setHash(hashKey, {
							status: StoreRepositoryStatus.idle,
						})
						return executeReturn(true)
					}
					setHash(hashKey, {
						status: StoreRepositoryStatus.success,
					})
					// remove keys from store
					const keysToRemove = Array.isArray(
						newParams[keyProperty as string],
					)
						? newParams[keyProperty as string]
						: [newParams[keyProperty as string]]
					keysToRemove.forEach((key: string) => {
						storeItems.value.delete(key)
					})
				} catch (error) {
					setHash(hashKey, {
						status: StoreRepositoryStatus.error,
						error: error as Error,
					})
				}
				return executeReturn()
			}
			// execute immediately
			if (immediate) {
				execute()
			}
			// cleanup
			const cleanup = () => {
				disableQuery(queryName)
			}
			tryOnUnmounted(() => {
				cleanup()
			})
			return {
				query: storeQuery,
				isLoading: computed(() => storeQuery.value?.isLoading),
				isError: computed(() => storeQuery.value?.isError),
				isSuccess: computed(() => storeQuery.value?.isSuccess),
				errors: computed(() => storeQuery.value?.errors),
				error: computed(() => storeQuery.value?.errors?.[0]),
				execute,
				cleanup,
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
						type: Object as PropType<
							StoreRepositoryRemoveOptions<
								Parameters<typeof repository.remove>[1]
							>
						>,
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
