/**
 * UI 图标路径辅助函数
 * 用于获取 src/assets 目录下的图标路径
 */

/**
 * 获取 assets 目录下的图标路径
 * @param name 图标文件名（不含扩展名）
 * @returns 图标 URL
 */
export function getIconPath(name: string): string {
  return new URL(`../assets/${name}.png`, import.meta.url).href
}

/**
 * 图标名称常量，用于类型安全和代码提示
 */
export const IconNames = {
  // 应用相关
  appLogo: 'app-logo',
  window: 'window',

  // 文件操作
  openFolder: 'open-folder',
  file: 'file',
  delete: 'delete',
  pencil: 'pencil',
  export: 'export',
  refresh: 'refresh',
  link: 'link',

  // 设置相关
  gear: 'gear',
  themes: 'themes',
  lightBulb: 'light-bulb',
  databaseManagement: 'database-management',

  // 视图模式
  grid: 'grid',
  list: 'list',

  // 主题
  sun: 'sun',
  moon: 'moon',

  // 文件类型
  videoMarketing: 'video-marketing',
  music: 'music',
  image: 'image',
  googleDocs: 'google-docs',
  excel: 'excel',
  ppt: 'ppt',
  stackOfBooks: 'stack-of-books',
  zip: 'zip',
  worldwide: 'worldwide',
  box: 'box',
  apps: 'apps',

  // 状态图标
  check: 'check',
  close: 'close',
  faq: 'faq',
  message: 'message',
  empty: 'empty',
  location: 'location',
  tags: 'tags',
  info: 'info',
} as const

/**
 * 图标类型
 */
export type IconName = typeof IconNames[keyof typeof IconNames]

/**
 * 获取图标路径的快捷方法
 */
export const icons = {
  appLogo: () => getIconPath(IconNames.appLogo),
  window: () => getIconPath(IconNames.window),
  openFolder: () => getIconPath(IconNames.openFolder),
  file: () => getIconPath(IconNames.file),
  delete: () => getIconPath(IconNames.delete),
  pencil: () => getIconPath(IconNames.pencil),
  export: () => getIconPath(IconNames.export),
  refresh: () => getIconPath(IconNames.refresh),
  link: () => getIconPath(IconNames.link),
  gear: () => getIconPath(IconNames.gear),
  themes: () => getIconPath(IconNames.themes),
  lightBulb: () => getIconPath(IconNames.lightBulb),
  databaseManagement: () => getIconPath(IconNames.databaseManagement),
  grid: () => getIconPath(IconNames.grid),
  list: () => getIconPath(IconNames.list),
  sun: () => getIconPath(IconNames.sun),
  moon: () => getIconPath(IconNames.moon),
  videoMarketing: () => getIconPath(IconNames.videoMarketing),
  music: () => getIconPath(IconNames.music),
  image: () => getIconPath(IconNames.image),
  googleDocs: () => getIconPath(IconNames.googleDocs),
  excel: () => getIconPath(IconNames.excel),
  ppt: () => getIconPath(IconNames.ppt),
  stackOfBooks: () => getIconPath(IconNames.stackOfBooks),
  zip: () => getIconPath(IconNames.zip),
  worldwide: () => getIconPath(IconNames.worldwide),
  box: () => getIconPath(IconNames.box),
  apps: () => getIconPath(IconNames.apps),
  check: () => getIconPath(IconNames.check),
  close: () => getIconPath(IconNames.close),
  faq: () => getIconPath(IconNames.faq),
  message: () => getIconPath(IconNames.message),
  empty: () => getIconPath(IconNames.empty),
  location: () => getIconPath(IconNames.location),
  tags: () => getIconPath(IconNames.tags),
  info: () => getIconPath(IconNames.info),
} as const
