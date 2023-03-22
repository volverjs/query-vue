export const StoreRepositoryStatus = {
	loading: 'loading',
	error: 'error',
	success: 'success',
	idle: 'idle',
} as const

export type StoreRepositoryStatus =
	(typeof StoreRepositoryStatus)[keyof typeof StoreRepositoryStatus]
