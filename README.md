# 方块深掘

手机浏览器中的竖屏方块挖掘游戏。摆放七种方块，补齐岩层缺口，收集铜矿与水晶，向下推进30米。

当前版本：0.1.1，第一版本地试玩与验收。

用户已授权发布GitHub Pages，部署状态和公网试玩入口见 [验收记录](docs/验收记录.md)。后续发布使用现代Node运行 `tools/publish-pages.cjs`，要求已提交源码并完成本机正式构建；网页文件独立放在gh-pages分支。

## 本机启动

项目位于 `E:\BlockDig`，Cocos Creator 3.8.8 位于 `E:\Cocos\Creator\3.8.8`。

已有构建时，双击根目录的 `启动试玩.cmd`，在浏览器打开命令窗口中的 Local 地址。手机与电脑连接同一局域网后，使用对应的 Phone 地址访问。服务默认端口为4173，避开Cocos编辑器的预览端口。若已有服务占用端口，直接访问已启动的地址，避免重复启动。

也可以在项目根目录执行：

```powershell
pnpm serve
```

源码修改后，先双击 `构建网页版.cmd`，或执行：

```powershell
pnpm build
```

首次安装依赖使用 `pnpm install --ignore-scripts`。本机的系统 Node.js 为14，项目工具会优先使用已存在的 Codex Node.js 24运行时，不修改系统版本。其他电脑推荐 Node.js 20或更新版本；可用环境变量 `BLOCKDIG_NODE` 指定运行时，`COCOS_CREATOR` 指定编辑器入口。

## 操作

- 手机：底部左移、软降、右移、旋转、暂存和落底按钮；方向与软降支持按住；可一只手指移动、另一只旋转。
- 电脑辅助操作：方向键移动与旋转，空格落底，C或Shift暂存，Esc暂停或继续；二次确认页按Esc取消并保持暂停。
- 点击落底立即锁定；清除普通行只得分，清除岩层才增加深度。
- 切出页面自动暂停，继续时倒计时三秒。刷新会结束当前局。

## 检查

```powershell
pnpm test
pnpm typecheck
pnpm verify:level
pnpm build
```

也可以双击 `运行测试.cmd`。`pnpm solve:level` 会重新搜索并覆盖当前关卡的验证操作记录，只在关卡或规则调整时使用。

浏览器自动化位于 `tools/browser-qa.cjs`，使用已安装的Chrome和可用的Playwright。若使用Codex环境中的Playwright，可直接以现代Node运行该脚本；在其他环境先自行安装对应的测试依赖。浏览器脚本只访问本地地址，不发布或上传项目。

## 目录

| 路径 | 内容 |
| --- | --- |
| `assets/scripts/core` | 不依赖引擎的游戏规则 |
| `assets/scripts/Game.ts` | Cocos界面、输入与对局编排 |
| `assets/scripts/services` | 本机纪录与设置 |
| `assets/resources/levels` | 地层、矿石与难度配置 |
| `assets/resources/audio` | 项目生成的短音效 |
| `assets/scenes` | 游戏启动场景 |
| `tests` | 规则与存储测试 |
| `tools` | 构建、预览和验证工具 |
| `docs` | 当前文档、版本记录、历史归档和验证证据 |
| `build/web-mobile` | 可静态托管的网页构建产物 |

完整文档入口见 [docs/README.md](docs/README.md)。当前只进行本地开发与测试，验收后再整理Git仓库。
