# Second Desk

> A high-performance desktop file manager built with Rust and Tauri: lightweight, elegant, and fast.

## Overview

Second Desk is a modern Windows desktop file management tool built with **Rust + Tauri 2.x + Vue 3**. It follows a **drawer-style** interaction model: move the cursor to a screen edge or press a global hotkey to bring up a compact file drawer whenever you need it.

Unlike traditional desktop icon management, Second Desk keeps frequently used files inside a drawer panel that can appear on demand. It keeps the desktop clean without making file access slower. Whether you want to launch an app, open a document, or manage downloaded files, you can move the cursor to the screen edge or press the hotkey and finish the action in about one second.

### Why Second Desk?

- **Clean desktop** - Keep frequently used files in the drawer instead of scattering icons across the desktop.
- **Always nearby** - Trigger it from a screen edge or hotkey, then let it auto-hide when you are done.
- **Smart organization** - Detect file types automatically, with support for custom categories and virtual folders.
- **Highly configurable** - Adjust trigger behavior, themes, colors, blur, window size, and more.
- **Performance first** - A Rust backend keeps startup and file operations fast.

### Core Highlights

| Feature | Description |
| --- | --- |
| Fast startup | Cold start under 1 second, file scanning under 100ms |
| Smart trigger | Supports four screen-edge trigger directions and a global hotkey |
| Polished themes | Five color schemes, light/dark modes, and glass blur effects |
| Virtual groups | Drag icons together to create folder-like groups |
| Batch actions | Long-press to enter batch selection mode and move multiple files quickly |
| Fully adjustable | Window position, size, trigger delay, and auto-hide behavior are configurable |
| Lightweight | Designed for low memory usage and compact build size |
| Smart protection | Fullscreen detection, hotkey protection window, and drag detection |

---

## Usage

### Basic Operations

#### Show and Hide

| Action | Description |
| --- | --- |
| **Edge trigger** | Move the cursor to a screen edge, right side by default, and pause briefly to show the drawer |
| **Hotkey trigger** | Press `Ctrl+Shift+D`, customizable, to show or hide the drawer |
| **Auto-hide** | Hide automatically when the cursor leaves the window or when the window loses focus |
| **Tray icon** | Right-click the tray icon to open settings or quit the app |

#### File Operations

| Action | Description |
| --- | --- |
| **Click** | Open a file or application |
| **Right-click** | Open the context menu for actions such as open, rename, delete, and properties |
| **Drag** | Reorder files, or drag them into virtual folders or categories |
| **Favorite** | Click the star marker on a file to add it to favorites |
| **Search** | Type keywords in the search box to filter files in real time |

### Category System

Second Desk provides a flexible category system for organizing files.

#### Built-in Categories

- **All** - Shows all files in the current path.
- **Favorites** - Shows favorited files and virtual folders.
- **Apps** - Detects executable files such as `.exe`, `.lnk`, and `.url`.
- **Documents** - Detects document files such as `.doc`, `.pdf`, and `.txt`.
- **Media** - Detects images, videos, audio, and other media files.
- **Other** - Shows files that do not match the categories above.

#### Custom Categories

1. Click the **+** button beside the category bar.
2. Enter a category name and choose an icon.
3. Select the files to add to the category.
4. Confirm to create the category.

Custom categories support:

- Drag sorting
- Renaming and editing
- Right-click deletion

### Virtual Folders

Virtual folders work like folder groups on a phone launcher. They let you group multiple files together without moving the original files on disk.

#### Create a Virtual Folder

**Method 1: Drag to merge**

1. Drag a file icon.
2. Hover it over another file until the merge preview appears.
3. Release the cursor to create a virtual folder containing both files.

**Method 2: Batch selection**

1. Long-press any file for 500ms to enter batch selection mode.
2. Select multiple files.
3. Click **Create Folder** in the bottom action bar.

#### Manage Virtual Folders

- **Open** - Click a virtual folder to show its members.
- **Add member** - Drag a file onto the virtual folder icon.
- **Remove member** - Right-click a member in the popup list and choose remove from folder.
- **Rename** - Right-click the virtual folder and choose rename.
- **Delete** - Right-click the virtual folder and choose delete. This does not delete the real files.
- **Favorite** - Click the star icon on the virtual folder.

### Batch Selection Mode

Batch selection mode lets you work with multiple files at once, which is faster than dragging files one by one.

#### Enter Batch Selection Mode

- **Long-press trigger** - Hold any file icon for 500ms to enter batch selection mode.

#### Batch Actions

After entering batch mode, an action bar appears at the bottom:

| Button | Function |
| --- | --- |
| **Select All** | Select all currently visible files |
| **Move to...** | Add selected items to a category or virtual folder |
| **Create Category** | Create a new category from selected files |
| **Create Folder** | Create a virtual folder from selected files; requires at least two items |
| **Cancel** | Exit batch selection mode |

#### Move to a Target

After clicking **Move to...**, a target selector appears:

- **Category tab** - Shows all custom categories. Click one to add selected files.
- **Virtual folder tab** - Shows virtual folders in the current path.

### View Switching

#### Display Modes

- **Grid view** - Shows files in an icon grid, the default layout.
- **List view** - Shows files in a compact list.

#### Icon Size

- **Small** - Better when many files are visible.
- **Medium** - Default size with balanced density.
- **Large** - Better for touchscreens or when larger icons are preferred.

### Themes and Appearance

#### Color Schemes

Second Desk includes five preset color schemes:

- **Blue** - Classic and stable.
- **Green** - Fresh and natural.
- **Purple** - Elegant and expressive.
- **Amber** - Warm and energetic.
- **Pink** - Soft and friendly.

#### Color Modes

- **Light mode** - Bright background for daytime use.
- **Dark mode** - Dark background to reduce eye strain.
- **Follow system** - Automatically follows the system theme.

#### Glass Blur Effects

- **Standard** - Balanced blur and transparency.
- **Subtle** - Light blur with more transparency.
- **Enhanced** - Stronger blur for a richer glass effect.
- **Minimal** - Almost transparent and low profile.
- **Custom** - Manually adjust blur, saturation, and transparency.

#### Custom Background

You can set a custom image as the drawer background to personalize the interface.

### Window Settings

#### Edge Trigger

- **Trigger direction** - Choose the top, bottom, left, or right screen edge.
- **Trigger delay** - Choose how long the cursor must stay at the edge before opening the drawer, from 100ms to 1000ms.
- **Trigger area** - Adjust the size of the sensitive edge area.

#### Auto-hide

- **Hide when mouse leaves** - Hide the drawer when the cursor leaves the window.
- **Hide on focus loss** - Hide the drawer when another window is clicked.
- **Hide delay** - Set the delay before the drawer hides.

#### Window Adjustment

- **Adjustment mode** - Enter adjustment mode to drag and resize the window.
- **Animation speed** - Set the show/hide animation duration from 100ms to 500ms.

### Hotkeys

| Hotkey | Function |
| --- | --- |
| `Ctrl+Shift+D` | Show or hide the drawer, customizable |
| `Esc` | Exit batch mode or close a popup |
| `Ctrl+F` | Focus the search box |
| `Enter` | Execute search or selected suggestion |
| `Up` / `Down` | Navigate the suggestion list |
| `Tab` | Complete the selected suggestion |

Hotkeys are customizable from the settings panel. Click the hotkey input and press a new key combination to record it.

### Smart Search

The top search box supports file search and multiple smart input modes.

#### File Search Mode

Type a file name directly:

```text
project-report.docx  # Search files whose names contain the keywords
.pdf                 # Search all PDF files
```

#### Command Mode

**System apps**, either with a `>` prefix or direct command input:

```text
>calc                # Open Calculator
>notepad             # Open Notepad
cmd                  # Open Command Prompt, prefix not required
ps                   # Open PowerShell, prefix not required
ps+args              # Open PowerShell and run a command
cmd+args             # Open Command Prompt and run a command
```

Supported system commands include `calc`, `notepad`, `explorer`, `taskmgr`, `mspaint`, `control`, `regedit`, and `msconfig`.

**Web search**, direct input without a prefix:

```text
bd                   # Open Baidu
bd programming       # Search Baidu for "programming"
gg React             # Search Google for "React"
bing AI              # Search Bing for "AI"
```

#### Navigation Mode

**Open a web page**, with automatic URL detection:

```text
https://github.com   # Full URL
www.google.com       # www-prefixed domain
github.com           # Domain name
localhost:3000       # Local service
```

**Jump to system folders**, supporting Chinese and English aliases:

```text
downloads            # Open Downloads in File Explorer
documents            # Open Documents in File Explorer
desktop              # Open Desktop in File Explorer
pictures             # Open Pictures in File Explorer
music                # Open Music in File Explorer
videos               # Open Videos in File Explorer
```

**Open any path**:

```text
C:\Windows           # Open the Windows directory in File Explorer
D:\Projects          # Open another drive path
```

#### Tips

- The search box automatically detects the input type and shows the corresponding icon on the left:
  - Search mode, default
  - Command mode, blue
  - Navigation mode, green
- Suggestions update in real time. Use `Up` and `Down` to select one, then press `Enter`.
- Search engine commands show dynamic hints: without arguments they open the homepage; with arguments they search for the keyword.
- Operations are recorded in history for quick repeat access.

---

## Tech Stack

### Backend: Rust

- **Tauri 2.x** - Cross-platform desktop application framework.
- **tokio** - Async runtime.
- **rayon** - Data parallelism.
- **windows-rs** - Windows API bindings.
- **dashmap** - Concurrent hash map.

### Frontend: Web

- **Vue 3 + TypeScript** - Reactive UI framework.
- **Vite** - Fast build tooling.
- **Pinia** - State management.
- **VueUse** - Composition utilities.

---

## Quick Start

### Requirements

- Node.js 18+
- Bun 1.0+
- Rust 1.70+
- Windows 10/11

### Install Dependencies

```bash
bun install
```

Rust dependencies are downloaded automatically during the first run.

### Development Mode

```bash
bun run tauri:dev
```

### Production Build

```bash
bun run tauri:build
```

---

## Project Structure

```text
SecondDesk/
|-- src/                    # Vue 3 frontend code
|   |-- components/         # Components
|   |-- composables/        # Composition functions
|   |-- config/             # Configuration files
|   |-- stores/             # Pinia stores
|   |-- styles/             # Styles
|   |-- App.vue             # Root component
|   `-- main.ts             # Entry file
|
|-- src-tauri/              # Rust backend code
|   |-- src/
|   |   |-- commands/       # Tauri commands
|   |   |-- core/           # Core logic
|   |   |-- utils/          # Utility functions
|   |   |-- main.rs         # Main program
|   |   `-- lib.rs          # Library entry
|   |-- Cargo.toml          # Rust configuration
|   `-- tauri.conf.json     # Tauri configuration
|
|-- package.json            # Frontend configuration
|-- vite.config.ts          # Vite configuration
`-- tsconfig.json           # TypeScript configuration
```

---

## Performance Targets

| Metric | Target | Description |
| --- | --- | --- |
| Cold start | <1 second | From launch to usable |
| File scanning | <100ms | Around 100 files |
| Icon loading | <50ms | Per icon |
| Memory usage | <300MB | Normal use |
| Window animation | 60fps | Smooth animation |
| Binary size | <50MB | Installer size target |

---

## Inspiration

This project is inspired by [EasyDesktop](https://gitee.com/codevicent/easy-desktop) by [@VicentXuan](https://gitee.com/codevicent). Second Desk is a full rebuild based on that idea.

Thanks to the original author for the concept and inspiration.

---

## Roadmap

### Completed

- [x] Basic file management: scan, open, rename, delete
- [x] Grid/list view switching
- [x] Icon size adjustment
- [x] Real-time search
- [x] Category management
- [x] Virtual folders: drag creation, favorites, sorting
- [x] Batch selection mode
- [x] Theme system: five color schemes plus light/dark modes
- [x] Glass blur effects: presets plus custom settings
- [x] Custom background image
- [x] Edge trigger system: four directions
- [x] Global hotkey
- [x] Auto-hide modes
- [x] Fullscreen app detection
- [x] Window position and size adjustment
- [x] Settings panel

### Planned

- [ ] Onboarding flow
- [ ] Recent access history
- [ ] Access frequency statistics
- [ ] Automatic updates
- [ ] Fuzzy search with pinyin, initials, and keyword matching
- [ ] Web search shortcuts
- [ ] Quick path opening from text input
- [ ] Shortcut commands for common apps
- [ ] PowerShell command execution
- [ ] Web search integration

---

## License

GPL-3.0

## Contributing

Issues and pull requests are welcome.

---

## Known Issues

> Known issues in the current version are planned for later investigation and fixes.

- Auto-hide may require a manual trigger before it recovers. The root cause needs further investigation before changing the behavior.
