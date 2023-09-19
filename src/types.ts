import type { Ref } from 'vue'
import type { StoreRepositoryMethod, StoreRepositoryStatus } from './constants'

export type ParamMap<T extends string | number | symbol = string> = Record<
	T,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	any
>

export type StoreRepositoryOptions<T> = {
	keyProperty?: keyof T
	defaultPersistence?: number
	defaultDebounce?: number | Ref<number>
	defaultParameters?: ParamMap
	hashFunction?: (str: string) => number
	cleanUpEvery?: number
}

export type StoreRepositoryHash<T = unknown> = {
	keys?: T[]
	data?: T[]
	error?: Error
	metadata?: ParamMap
	abort?: (reason?: string) => void
	timestamp: number
	params: ParamMap
	storeQueries: Set<string>
	status: StoreRepositoryStatus
	directory: boolean
	method: StoreRepositoryMethod
}

export type StoreRepositoryQuery = {
	storeHashes: Set<string>
	enabled: boolean
}

export type StoreRepositoryReadOptions = {
	name?: string
	group?: boolean
	directory?: boolean
	keepAlive?: boolean
	immediate?: boolean
	persistence?: number
	executeWhen?: Ref<boolean> | ((params?: ParamMap) => boolean)
	autoExecute?: boolean
	autoExecuteDebounce?: number | Ref<number>
	autoExecuteOnWindowFocus?: boolean
	autoExecuteOnDocumentVisibility?: boolean
}

export type StoreRepositorySubmitOptions<T> = {
	name?: string
	keepAlive?: boolean
	immediate?: boolean
	executeWhen?: Ref<boolean> | ((item?: T, params?: ParamMap) => boolean)
	autoExecute?: boolean
	autoExecuteDebounce?: number | Ref<number>
	autoExecuteOnWindowFocus?: boolean
	autoExecuteOnDocumentVisibility?: boolean
}

export type StoreRepositoryRemoveOptions = {
	name?: string
	immediate?: boolean
}
