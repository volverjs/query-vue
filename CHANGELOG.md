# Changelog

All notable changes to this project will be documented in this file.

# [2.0.0] - 2023-10-03

### Changed

- `@volverjs/data@2.x.x` support;
- Hash `method` is now `action`;

### Added

- `submit()` support for multiple items.
- `repositoryOptions` for all methods;

# [1.0.3] - 2023-10-03

### Added

- `defaultParameters` on `StoreRepositoryOptions`

### Fix

- Status and method are properties of hash;
- `submit()` params clone;
- `submit()` action type check.

## [1.0.2] - 2023-05-15

### Fix

- Require `node:crypto` only in node environment.

## [1.0.1] - 2023-05-15

### Added

- `ReadProvider`, `SubmitProvider` and `RemoveProvider` components;
- `immediate` option to `remove()` action;
- Read `execute()` function can be forced with `force` option.

### Fix

- Read key check is not needed with directory structure;
- - All `execute()` functions return the same values;
- `isLoading` keep `true` on request update (abort and retry);
- An empty response is allowed in `read()` action.

## [1.0.0] - 2023-04-12

### Added

- Doc example with `useRepositoryHttp()`.

### Change

- Use new `@volverjs/data` version `1.0.0`.

## [0.0.3] - 2023-03-27

### Fix

- The `execute()` function has the same output in the `read` and `submit` actions.

## [0.0.2] - 2023-03-24

### Added

- `remove()` action and tests.

### Change

- `refetch()` to `execute()`.

### Fix

- `immediate` not use debounce timeout.

## 0.0.1 - 2023-03-21

### Added

- `defineStoreRepository` a function to create a store repository;
- `read` and `submit` actions;
- `getQueryByName` and `getItemByKey` getters.

[1.0.3]: https://github.com/volverjs/query-vue/compare/v1.0.2...v1.0.3
[1.0.2]: https://github.com/volverjs/query-vue/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/volverjs/query-vue/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/volverjs/query-vue/compare/v0.0.3...v1.0.0
[0.0.3]: https://github.com/volverjs/query-vue/compare/v0.0.2...v0.0.3
[0.0.2]: https://github.com/volverjs/query-vue/compare/v0.0.1...v0.0.2
