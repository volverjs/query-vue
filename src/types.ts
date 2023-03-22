import { type Ref } from 'vue'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ParamMap = Record<string, any>

export type StoreRepositoryOptions<Type> = {
	keyProperty?: keyof Type
	defaultPersistence?: number
	defaultThrottle?: number
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
	autoExecuteThrottle?: number
	autoExecuteOnWindowFocus?: boolean
	autoExecuteOnDocumentVisibility?: boolean
}

export type StoreRepositorySubmitOptions = {
	name?: string
	keepAlive?: boolean
	immediate?: boolean
	executeWhen?: Ref<boolean> | ((params?: ParamMap) => boolean)
	autoExecute?: boolean
	autoExecuteThrottle?: number
	autoExecuteOnWindowFocus?: boolean
	autoExecuteOnDocumentVisibility?: boolean
}
