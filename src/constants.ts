export const StoreRepositoryStatus = {
	loading: 'loading',
	error: 'error',
	success: 'success',
	idle: 'idle',
} as const

export type StoreRepositoryStatus =
	(typeof StoreRepositoryStatus)[keyof typeof StoreRepositoryStatus]

export const StoreRepositoryAction = {
	read: 'read',
	create: 'create',
	update: 'update',
	remove: 'remove',
} as const

export type StoreRepositoryAction =
	(typeof StoreRepositoryAction)[keyof typeof StoreRepositoryAction]
