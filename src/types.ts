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
	keepAlive?: boolean
	immediate?: boolean
	persistence?: number
	refetchOnWindowFocus?: boolean
	refetchOnDocumentVisibility?: boolean
	directory?: boolean
	when?: Ref<boolean> | ((params?: ParamMap) => boolean)
}

export type StoreRepositorySubmitOptions = {
	name?: string
	group?: boolean
	keepAlive?: boolean
	immediate?: boolean
	autoSubmit?: boolean
	autoSubmitThrottle?: number
	autoSubmitOnWindowFocus?: boolean
	autoSubmitOnDocumentVisibility?: boolean
	when?: Ref<boolean> | ((newItem?: unknown, params?: ParamMap) => boolean)
}
