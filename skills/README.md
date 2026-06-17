# @volverjs/query-vue — Claude Code skills

This repository ships an installable [Claude Code](https://docs.claude.com/en/docs/claude-code)
plugin that helps agents integrate `@volverjs/query-vue` into a Vue 3 application.

## Available skills

| Skill | Invoke | What it does |
| ----- | ------ | ------------ |
| [`volverjs-query-vue`](./volverjs-query-vue/SKILL.md) | `/volverjs-query-vue:volverjs-query-vue` (auto-loads on relevant requests) | Guides store scaffolding with `defineStoreRepository`, the `read` → `submit` → `remove` actions and their options (autoExecute, group, directory, executeWhen, persistence, keepAlive…), the `ReadProvider`/`SubmitProvider`/`RemoveProvider` components, the caching/normalized-item-cache model, error handling, cleanup and best practices. |

## Install

The repo is its own plugin marketplace. From Claude Code:

```text
/plugin marketplace add volverjs/query-vue
/plugin install volverjs-query-vue@volverjs-query-vue
```

The skill then loads automatically when you ask things like "fetch products in my
Vue app with @volverjs/query-vue" or "wire up a store repository with read and submit".

## Manual install (without the plugin manager)

Copy the skill into your project or user skills directory:

```bash
# project-local
cp -r skills/volverjs-query-vue .claude/skills/volverjs-query-vue
# or user-wide
cp -r skills/volverjs-query-vue ~/.claude/skills/volverjs-query-vue
```

## Layout

```text
.claude-plugin/
  plugin.json        # plugin manifest
  marketplace.json   # marketplace catalog (the repo hosts itself)
skills/
  volverjs-query-vue/
    SKILL.md         # the skill
    references/      # store-setup, read, submit, remove
```
