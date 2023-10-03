import type { Ref } from 'vue'
import type { StoreRepositoryAction, StoreRepositoryStatus } from './constants'

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
	action: StoreRepositoryAction
}

export type StoreRepositoryQuery = {
	storeHashes: Set<string>
	enabled: boolean
}

export type StoreRepositoryReadOptions<
	RepositoryReadOptions = Record<string, unknown>,
> = {
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
	repositoryOptions?: RepositoryReadOptions
}

export type StoreRepositorySubmitOptions<
	T,
	RepositorySubmitOptions = Record<string, unknown>,
> = {
	name?: string
	keepAlive?: boolean
	immediate?: boolean
	executeWhen?:
		| Ref<boolean>
		| ((payload?: T | T[], params?: ParamMap) => boolean)
	autoExecute?: boolean
	autoExecuteDebounce?: number | Ref<number>
	autoExecuteOnWindowFocus?: boolean
	autoExecuteOnDocumentVisibility?: boolean
	action?: StoreRepositoryAction
	repositoryOptions?: RepositorySubmitOptions
}

export type StoreRepositoryRemoveOptions<
	RepositoryRemoveOptions = Record<string, unknown>,
> = {
	name?: string
	immediate?: boolean
	repositoryOptions?: RepositoryRemoveOptions
}
