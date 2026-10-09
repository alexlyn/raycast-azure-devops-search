# Azure DevOps Search Changelog

## [Raycast 2.x Compatibility] - 2026-10-09

- Upgrade `@raycast/api` to 2.x for Raycast 2.x
- Update toolchain: React 19, TypeScript 5, Node 22 types, ESLint 9 with `@raycast/eslint-config`
- Bump `axios` to 1.x, remove unused `node-fetch` dependency
- Remove unused code and fix lint issues

## [Initial Version] - 2022-08-08

- Work item search
  - Search by assignee with @. For example @alex.
  - Search by work item type with #. For example #bug
- Query search
- Use the following actions on found entities:
  - Open in browser
  - Copy URL
  - Copy markdown link
  - Copy HTML link