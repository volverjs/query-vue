import type { Ref } from 'vue'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ParamMap = Record<string, any>

export type StoreRepositoryOptions<T> = {
	keyProperty?: keyof T
	defaultPersistence?: number
	defaultDebounce?: number | Ref<number>
	hashFunction?: (str: string) => number
	cleanUpEvery?: number
}

export type StoreRepositoryHash<T = unknown> = {
	keys?: T[]
	data?: T[]
	metadata?: ParamMap
	timestamp: number
	params: ParamMap
	storeQueries: Set<string>
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
	immediate?: boolean
}
