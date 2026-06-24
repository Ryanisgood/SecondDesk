# Second Desk / 第二桌面

Second Desk is a lightweight Windows file drawer built with Tauri, Rust, Vue 3, and TypeScript. It keeps frequently used files, folders, shortcuts, and virtual groups one edge gesture or hotkey away without filling the desktop with icons.

第二桌面是一款基于 Tauri、Rust、Vue 3 和 TypeScript 构建的轻量级 Windows 桌面文件抽屉。它可以把常用文件、文件夹、快捷方式和虚拟分组收纳到屏幕边缘，通过边缘触发或快捷键快速呼出，让桌面保持简洁。

## Highlights / 核心亮点

- Edge-triggered drawer that appears from the side of the screen and hides when it is no longer needed.
- 屏幕边缘触发的抽屉面板，用时呼出，用完隐藏，不长期占用桌面空间。
- Virtual folders for grouping files across locations without moving the original files.
- 虚拟文件夹可跨目录组织文件，不移动原始文件位置。
- Fast search and command input for files, paths, websites, and common Windows tools.
- 支持文件、路径、网站和常用 Windows 工具的快速搜索与命令输入。
- Custom categories, favorites, grid/list views, icon sizing, themes, blur intensity, and window behavior.
- 支持自定义分类、收藏、网格/列表视图、图标尺寸、主题、毛玻璃强度和窗口行为配置。
- Native Windows packaging with signed updater artifacts generated through GitHub Releases.
- 通过 GitHub Releases 生成 Windows 安装包和带签名的自动更新产物。

## Requirements / 环境要求

- Windows 10 or Windows 11 / Windows 10 或 Windows 11
- Node.js 18+
- Bun 1.0+
- Rust stable / Rust 稳定版

## Development / 开发

Install dependencies / 安装依赖：

```bash
bun install
```

Run the app in development mode / 启动开发模式：

```bash
bun run tauri:dev
```

Build a production package / 构建生产安装包：

```bash
bun run tauri:build
```

Run the frontend build check / 运行前端构建检查：

```bash
npm run build
```

Run the translation coverage check / 检查多语言覆盖：

```bash
npm run i18n:check
```

## Project Structure / 项目结构

```text
SecondDesk/
|-- src/                 # Vue 3 frontend / Vue 3 前端
|   |-- components/      # UI components / UI 组件
|   |-- composables/     # Reusable composition functions / 组合式函数
|   |-- config/          # Frontend configuration / 前端配置
|   |-- i18n/            # English and Chinese localization / 中英文多语言
|   |-- stores/          # Pinia stores / Pinia 状态管理
|   `-- styles/          # Shared styles / 公共样式
|-- src-tauri/           # Rust and Tauri application shell / Rust 与 Tauri 壳层
|   |-- src/             # Commands, core logic, and app bootstrap / 命令、核心逻辑和启动入口
|   |-- capabilities/    # Tauri permissions / Tauri 权限配置
|   |-- icons/           # App and installer artwork / 应用与安装器图标
|   |-- Cargo.toml       # Rust package metadata / Rust 包元数据
|   `-- tauri.conf.json  # Tauri build, bundle, and updater config / Tauri 构建、打包和更新配置
|-- package.json         # Frontend scripts and dependencies / 前端脚本与依赖
`-- vite.config.ts       # Vite configuration / Vite 配置
```

## Updating and Releases / 更新与发布

Release builds are created by pushing a version tag such as `v1.3.2`. The GitHub Actions release workflow builds the Windows installers, uploads updater signatures, and publishes `latest.json` for the Tauri updater.

发布版本通过推送类似 `v1.3.2` 的 tag 触发。GitHub Actions 会构建 Windows 安装包、上传更新签名，并发布 Tauri updater 使用的 `latest.json`。

Keep these version fields in sync before tagging a release / 打 tag 前需要同步这些版本字段：

- `package.json`
- `package-lock.json`
- `src-tauri/Cargo.toml`
- `src-tauri/Cargo.lock`
- `src-tauri/tauri.conf.json`

The updater compares the installed Tauri app version with the version published in `latest.json`, so a release tag alone is not enough.

更新器会比较本机安装的 Tauri 应用版本和 `latest.json` 中的线上版本，所以只改 tag 不够，应用内部版本也必须同步。

## License / 许可证

GPL-3.0
