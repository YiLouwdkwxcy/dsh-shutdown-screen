# dsh-shutdown-screen v0.2.1

给 DeepSeek Harness（DSH）Web 界面的「关闭动画」插件。本版本是 0.2.1，修复了 0.2.0 里最影响使用的几个问题。

## 版本说明

### 修复

- **快捷键 / 侧栏按钮第一次按没反应、刷新后才生效**：根因是开启动画结束后启动插件仍保留
  `__DSH_STARTUP_RUNNING__ = true`（它只补 `__DSH_STARTUP_FINISHED__` 标记），关闭动画因此误判
  「开启动画还在进行」，把触发请求放进队列等一个永远不会来的结束。现在以 `__DSH_STARTUP_FINISHED__`
  优先判定；按键监听也改为脚本加载即绑定（`window` + `document` 捕获），一次触发就出画面。
  开启动画期间按下的快捷键会排队，等动画结束后自动播放。
- **结束语与结束画面恢复**：跳过和正常播完都先淡出视频、显示结束画面（品牌 / 身份 / 机构文案 /
  结束框），并播放 TTS 结束语，然后再关闭窗口，不再「播完就没了」。
- **跳过 / 播完统一静默关闭，无黑幕白幕**：删除了 `about:blank` 空白页兜底。`window.close()` 被
  浏览器拒绝时，由本机 Host 调用 Windows 窗口消息 `WM_SYSCOMMAND / SC_CLOSE`，等价于用虚拟鼠标
  点一下窗口右上角的 ×，直接关闭浏览器窗口；两种方式都失败才停一行「请按 Ctrl+W」提示。
  全程没有确认框、没有黑幕 / 白幕。
- 新增 `POST /dsh-shutdown/close-window`（仅 Windows）与 `lib/close-window.ps1`。

### 沿用 0.2.0 的能力

- 打开媒体目录、中英文视频文件名、单键快捷键、音量增益（100%–300%）、无蒙板 / 无点击播放层。

## 兼容性

- **DSH**：0.2.x Web profile；验证环境为 DSH `0.2.2-rc.1` + `dsh-startup-screen` `1.2.0` 并存。
- **Node.js**：>= 20（跟随 DSH 自身要求）。
- **自动关闭浏览器窗口**：仅 Windows 生效（通过窗口消息模拟点 ×）。macOS / Linux 会回退为
  「结束画面 + 按 Ctrl+W」提示。
- **DSH 桌面端（DSH Desktop）**：本版本未在桌面端实测；Web 端完整支持。详见仓库
  [DESKTOP.md](https://github.com/YiLouwdkwxcy/dsh-shutdown-screen/blob/main/DESKTOP.md)。
- **配置兼容**：与 0.2.0 / 0.1.0 完全兼容（无新增配置字段），升级后不需要迁移。

## 下载与安装

### 方式一：本 Release 附件（tgz）

1. 下载附件 `dsh-shutdown-screen-0.2.1.tgz`。
2. 安装到 web profile：

   ```bash
   node "$(npm root -g)/@deepseek-ai/dsh/lib/bin.js" plugin --profile web add ./dsh-shutdown-screen-0.2.1.tgz
   ```

   如果 PATH 里的 `dsh` 可用，也可以：

   ```bash
   dsh plugin --profile web add ./dsh-shutdown-screen-0.2.1.tgz
   ```

3. **重启 DSH Web**（Host 半侧新增了路由，需要重载进程；只刷新页面不够），再打开
   `http://127.0.0.1:3080`。

### 方式二：npm（发布后）

```bash
dsh plugin --profile web add dsh-shutdown-screen@0.2.1
```

> npm 版本是 DSH 插件管理器「检查更新」能够识别的安装来源；本地 tgz 安装没有更新入口。

## 放视频

```text
Windows:       C:\Users\<你>\.dsh\dsh-shutdown\closing.mp4
macOS / Linux: ~/.dsh/dsh-shutdown/closing.mp4
```

打开「设置 → 关闭动画 → 视频 → 打开媒体目录」，把视频拖进去，点「刷新列表」选中即可；
支持中文 / 英文文件名，`mp4 / webm / m4v` 均可，也可以设置播放区间。

## 使用

1. 设置页左侧会多出 **关闭动画**；侧栏底部、设置按钮上方多出 **电源按钮**。
2. 点电源按钮，或按快捷键（默认 `Alt + Shift + Q`，可在设置页改成组合键或单键）。
3. 全屏播放视频；可点右上角 `SKIP` 或按 `Esc` 跳过。
4. 播完 / 跳过 → 显示结束画面 + 播放结束语 → 静默关闭浏览器窗口（Windows）；失败时提示 `Ctrl+W`。
5. 想先看效果：设置页「立即预览」，预览不会真的关页。

## 升级

- 用新版本 tgz 或 npm 版本覆盖安装同一个 profile 即可，配置 `~/.dsh/dsh-shutdown.json` 会复用。
- 升级后需要重启 DSH Web（Host 半侧改动）；只改样式 / 运行时的版本刷新页面即可。

## 校验

- 单测：`node test/smoke-host.mjs` → **102/102 通过**
- 语法：`node --check lib/index.js lib/closing.js lib/client.js`
- Release 附件 `dsh-shutdown-screen-0.2.1.tgz` 校验信息：

```text
文件大小: 46,000 字节
SHA-256 : e1c466bf6222d2dc424a87d8ff74b57aedd8d09499c10c68ba70167a58d60cc0
```

Windows 下可核对：`Get-FileHash .\dsh-shutdown-screen-0.2.1.tgz -Algorithm SHA256`；
macOS / Linux：`sha256sum dsh-shutdown-screen-0.2.1.tgz`。
