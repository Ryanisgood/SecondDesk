# 混合模式智能搜索框 - 使用说明

## 功能概述

SecondDesk 现在配备了强大的混合模式智能搜索框，支持：

### 1. 命令执行模式 ⚡

在搜索框中输入 `>` 或 `cmd:` 前缀来执行命令：

```
>calc              # 打开计算器
>notepad           # 打开记事本
>powershell        # 打开 PowerShell
>cmd               # 打开命令提示符
>explorer          # 打开资源管理器
>taskmgr           # 打开任务管理器
```

**支持的内置命令：**
- `calc` / `calculator` - 计算器
- `cmd` - 命令提示符
- `powershell` / `ps` - PowerShell
- `notepad` - 记事本
- `explorer` - 文件资源管理器
- `taskmgr` - 任务管理器
- `mspaint` / `paint` - 画图
- `control` - 控制面板
- `regedit` - 注册表编辑器
- `msconfig` - 系统配置

### 2. 智能 URL 导航 🌐

直接输入 URL，自动识别并打开浏览器：

```
https://www.google.com     # 完整 URL
www.github.com             # www 前缀
google.com                 # 域名
192.168.1.1                # IP 地址
localhost:3000             # 本地服务
example.com/path?q=test    # 带路径和参数
```

**支持的 URL 格式：**
- 完整协议：`http://`, `https://`, `ftp://`, `file://`
- 省略协议：`www.example.com`, `github.com`
- IP 地址：`192.168.1.1`, `127.0.0.1:8080`
- Localhost：`localhost`, `localhost:3000`

### 3. 快速文件夹导航 📁

#### 3.1 路径跳转

```
C:\Windows                 # Windows 绝对路径
D:\Projects                # 其他盘符
\\server\share             # UNC 网络路径
```

#### 3.2 系统文件夹快捷词（支持中英文）

```
desktop / 桌面             # 跳转到桌面
downloads / 下载           # 跳转到下载文件夹
documents / 文档           # 跳转到文档文件夹
pictures / 图片            # 跳转到图片文件夹
music / 音乐               # 跳转到音乐文件夹
videos / 视频              # 跳转到视频文件夹
home / 主文件夹            # 跳转到用户主目录
```

### 4. 文件搜索模式 🔍

输入任何文本进行文件名搜索：

```
example.txt               # 搜索包含 "example.txt" 的文件
项目                      # 搜索包含 "项目" 的文件
.pdf                      # 搜索 PDF 文件
```

## 使用技巧

### 键盘快捷键

- `Enter` - 执行当前选中的建议或默认操作
- `Esc` - 清空搜索或关闭建议菜单
- `↑` / `↓` - 导航建议列表
- `Tab` - 自动补全当前选中的建议

### 模式识别

搜索框会自动识别输入类型：

- **命令模式**（蓝色图标 ⚡）：以 `>` 开头
- **导航模式**（绿色图标 🌐）：URL、路径或系统文件夹
- **搜索模式**（默认图标 🔍）：普通文本

### 智能建议

搜索框会根据输入内容实时显示相关建议：

- **命令模式**：显示匹配的命令列表
- **导航模式**：显示导航目标确认
- **搜索模式**：显示匹配的文件列表
- **历史记录**：显示最近使用的搜索

## 示例场景

### 场景 1：快速打开应用

```
>calc              # 按 Enter 打开计算器
>notepad           # 按 Enter 打开记事本
```

### 场景 2：访问网站

```
github.com         # 按 Enter 用默认浏览器打开
```

### 场景 3：跳转文件夹

```
downloads          # 按 Enter 跳转到下载文件夹
C:\Windows         # 按 Enter 跳转到 Windows 目录
```

### 场景 4：搜索文件

```
报告.docx          # 自动搜索匹配的文件
.pdf               # 搜索所有 PDF 文件
```

## 技术实现

### 前端架构

```
src/
├── types/
│   └── search.ts                    # 搜索相关类型定义
├── utils/
│   ├── urlDetector.ts               # 智能 URL 检测器
│   ├── searchParser.ts              # 输入解析器
│   ├── commandRegistry.ts           # 命令注册表
│   └── navigationHandler.ts         # 导航处理器
├── stores/
│   └── search.ts                    # 搜索状态管理
└── components/
    ├── SearchBox.vue                # 智能搜索框组件
    └── SearchSuggestions.vue        # 建议菜单组件
```

### 后端支持

新增 Tauri 命令：

- `get_known_folder(folder: String)` - 获取系统文件夹路径
  - 支持：Desktop, Downloads, Documents, Pictures, Music, Videos, UserProfile

### URL 检测算法

智能 URL 检测支持多种格式，具有置信度评分系统：

1. **完整 URL**（置信度 1.0）：`https://example.com`
2. **www 前缀**（置信度 0.95）：`www.example.com`
3. **Localhost**（置信度 1.0）：`localhost:3000`
4. **有效 IP**（置信度 0.9）：`192.168.1.1`
5. **常见 TLD 域名**（置信度 0.85）：`example.com`

## 扩展开发

### 添加自定义命令

在 `src/utils/commandRegistry.ts` 中注册新命令：

```typescript
registerCommand({
  id: 'my-command',
  name: '我的命令',
  description: '命令描述',
  aliases: ['alias1', 'alias2'],
  icon: '🎯',
  category: 'custom',
  execute: async () => {
    // 执行逻辑
  },
})
```

### 添加新的系统文件夹

1. 在 `src/utils/searchParser.ts` 的 `SYSTEM_FOLDERS` 中添加快捷词
2. 在 `src-tauri/src/utils/known_folders.rs` 的 `get_known_folder` 中添加对应的 Windows FOLDERID

## 已知限制

- 仅支持 Windows 平台
- 系统文件夹快捷词需要预定义
- 命令执行需要相应的系统应用已安装

## 未来改进方向

- [ ] 支持带参数的命令执行
- [ ] 用户自定义命令界面
- [ ] 命令导入/导出功能
- [ ] AI 智能建议
- [ ] 自然语言理解
- [ ] 远程搜索支持
