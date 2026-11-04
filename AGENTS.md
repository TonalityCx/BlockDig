# BlockDig project instructions

- This version is a portrait mobile web game using Cocos Creator 3.8.8 and TypeScript.
- Do not implement WeChat integration, remote hosting, accounts or online services without a new user request.
- Keep development local. Do not create a remote repository or commit/push until the user has accepted this version and requested the Git step.
- Product direction and requirements live in `docs/产品需求文档.md`; technical architecture lives in `docs/技术方案.md`.
- Every behavior change must update the relevant current document, `docs/CHANGELOG.md`, and the actual validation status in `docs/验收记录.md`.
- Preserve previous documentation versions under `docs/archive`; never mark tests or physical-device checks passed without evidence.
- Keep gameplay rules in `assets/scripts/core` independent of Cocos and browser APIs. UI consumes model state and events.
- Use fixed seeds and `docs/validation/first-mine-witness.json` for deterministic regression checks after changing rules or terrain.
- Run meaningful rule tests, TypeScript checks and the Web Mobile build after relevant changes. Use browser QA for visual or touch changes.
- Avoid changing the machine's system Node.js installation. `tools/runtime.cjs` selects the modern runtime already available on this machine.
- Do not overwrite hand-authored `.meta` UUIDs. Keep generated Cocos metadata in the source project; exclude generated `temp`, `library`, `build`, `node_modules` and local profiles from a future repository.
