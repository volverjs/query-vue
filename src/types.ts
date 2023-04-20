import type { Ref } from 'vue'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ParamMap = Record<string, any>

export type StoreRepositoryOptions<Type> = {
	keyProperty?: keyof Type
	defaultPersistence?: number
	defaultDebounce?: number | Ref<number>
	hashFunction?: (str: string) => number
	cleanUpEvery?: number
}

export type StoreRepositoryHash = {
	keys?: unknown[]
	data?: unknown[]
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

export type StoreRepositorySubmitOptions<Type> = {
	name?: string
	keepAlive?: boolean
	immediate?: boolean
	executeWhen?: Ref<boolean> | ((item?: Type, params?: ParamMap) => boolean)
	autoExecute?: boolean
	autoExecuteDebounce?: number | Ref<number>
	autoExecuteOnWindowFocus?: boolean
	autoExecuteOnDocumentVisibility?: boolean
}

export type StoreRepositoryRemoveOptions = {
	immediate?: boolean
}
