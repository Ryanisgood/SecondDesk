## v1.3.3 - Run as administrator

### New

- Added a file context-menu action to run supported Windows launch targets as administrator.
- The new action appears for `.exe`, `.lnk`, `.msi`, `.bat`, `.cmd`, and `.ps1` files.
- Added backend validation before triggering the Windows UAC prompt.

### 中文说明

- 新增文件右键菜单「以管理员身份运行」。
- 该操作仅对 `.exe`、`.lnk`、`.msi`、`.bat`、`.cmd`、`.ps1` 文件显示。
- 后端在触发 Windows UAC 前会再次校验文件类型。

---

## v1.3.2 - Version metadata and bilingual documentation

### Fixes

- Synchronized the application version metadata with the release tag so the updater no longer treats the latest installed build as an older version.
- Updated package and installer descriptions to include both English and Chinese text.
- Added a bilingual README for GitHub users and contributors.

### 中文说明

- 已将应用内部版本元数据与发布 tag 同步，避免刚安装最新版后仍被更新器判断为旧版本。
- 已将项目描述和安装包描述改为中英文双语。
- 已补充 GitHub README 的中英文双语说明。

---

## v1.3.2 - 版本元数据与双语文档

### 修复

- 同步应用内部版本号和 release tag，修复最新版仍提示更新的问题。
- 项目描述、安装包描述改为中英文双语展示。
- README 改为中英文双语版本。
