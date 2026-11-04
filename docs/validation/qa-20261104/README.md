# 独立测试证据 2026-11-04

当前被测版本0.1.1；结论与复现见 [验收问题](验收问题.md)。测试工作未修改 `assets`、`tests` 或产品构建工具，新增内容是本目录的验收检查、报告、截图及当前验收/变更文档补充。

## 当前版证据

- `unit-0.1.1-report.json`：Vitest实际重跑18项通过。
- `extended-checks.cjs` / `extended-report.json`：独立规则夹具与隔离Cocos控制层，20项中18项通过、C07/C08两项失败；没有启动引擎或真实触控环境。夹具构造边界状态不算正常游玩通关。
- `build-release-0.1.1.log`：测试角色独立执行 `node tools/runtime.cjs release` 成功后的日志。
- `run-summary.json`：命令结果、运行时、源文件/发布包哈希、构建大小和许可核对。
- 文件名含 `0.1.1` 的截图，以及 `home-records-after-reload-320x568.jpg`、`settings-after-reload-320x568.jpg`、`landscape-844x390.jpg`、`portrait-still-paused-360x640.jpg` 均在加载0.1.1后取得。
- `browser-console.json`：内置浏览器会话观察到的异常，不能据此保证无失败网络请求或无引擎错误。

本轮当前版命令：

```text
node tools/runtime.cjs test --reporter=json --outputFile=docs/validation/qa-20261104/unit-0.1.1-report.json
node tools/runtime.cjs typecheck
node tools/runtime.cjs verify
node tools/runtime.cjs release
```

扩展检查使用 `tools/runtime.cjs` 已选择的现代Node可执行文件直接运行：

```text
C:/Users/1/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe docs/validation/qa-20261104/extended-checks.cjs
```

扩展检查当前应退出1，因为两项产品需求断言失败。不要以屏蔽失败断言的方式关闭问题。

最终清单检查：产品脚本、关卡和手写.meta与当前清单一致，Cocos许可源文件/发布文件哈希一致，源码映射为0。发布目录扫描时另有并行发布工作新增 `.nojekyll` 和 `version.json`，因此最终扫描为41文件、1982689字节，不把它写成首屏网络流量。本测试角色未执行发布。`tools/browser-qa.cjs` 在并行工作中加入目标URL/报告目录参数后与旧清单哈希不同，本轮没有运行该脚本；差异原样保留在复核摘要，不据此认定玩法源码漂移。

`summarize.cjs` 可重新生成清单与本次记录的命令结果摘要（不会重新执行测试）。本轮文档文件链接检查44处、缺失0；该检查不验证外部网址或全部标题锚点。

## 保留的0.1.0过程证据

本轮开始时版本为0.1.0，未删除其过程证据：`unit-report.json`、`build-release.log`、`build-sandbox-failed.log`，以及未列入上方当前版证据列表、文件名不含 `0.1.1` 的早期对局/失败/暂存/设置截图。不要将这些旧图直接标为0.1.1实际重跑。

当前验收记录和CHANGELOG补充前快照在 `docs/archive/v0.1.1-before-independent-qa-20261104`；开发者保留的0.1.0→0.1.1修复历史另见原归档。旧版的“通过”结论仅针对当时列出的检查，不覆盖本轮新增需求检查。
