import type { FileItem } from '../stores/files'
import { convertFileSrc } from '@tauri-apps/api/core'

// 导入所有图标资源
import iconDir from '../assets/file_icos/dir.png'
import iconExe from '../assets/file_icos/exe.png'
import iconBat from '../assets/file_icos/bat.png'
import iconTxt from '../assets/file_icos/txt.png'
import iconDoc from '../assets/file_icos/doc.png'
import iconDocx from '../assets/file_icos/docx.png'
import iconXls from '../assets/file_icos/xls.png'
import iconXlsx from '../assets/file_icos/xlsx.png'
import iconPptx from '../assets/file_icos/pptx.png'
import iconPdf from '../assets/file_icos/pdf.png'
import iconHtml from '../assets/file_icos/html.png'
import iconHtm from '../assets/file_icos/htm.png'
import iconCss from '../assets/file_icos/css.png'
import iconJs from '../assets/file_icos/js.png'
import iconJson from '../assets/file_icos/JSON.png'
import iconImage from '../assets/file_icos/image.png'
import iconMp3 from '../assets/file_icos/mp3.png'
import iconWav from '../assets/file_icos/wav.png'
import iconM4a from '../assets/file_icos/m4a.png'
import iconMp4 from '../assets/file_icos/mp4.png'
import iconMkv from '../assets/file_icos/mkv.png'
import iconZip from '../assets/file_icos/zip.png'
import iconScript from '../assets/file_icos/script.png'
import iconUnknown from '../assets/file_icos/unkonw.png'

/**
 * 文件类型到图标的映射表
 */
const ICON_MAP: Record<string, string> = {
  // 文件夹
  dir: iconDir,

  // 可执行文件
  exe: iconExe,
  msi: iconExe,
  bat: iconBat,

  // 文档
  txt: iconTxt,
  md: iconTxt,
  log: iconTxt,

  doc: iconDoc,
  docx: iconDocx,

  xls: iconXls,
  xlsx: iconXlsx,

  ppt: iconPptx,
  pptx: iconPptx,

  pdf: iconPdf,

  // Web 文件
  html: iconHtml,
  htm: iconHtm,
  css: iconCss,
  js: iconJs,
  ts: iconJs,
  jsx: iconJs,
  tsx: iconJs,
  vue: iconHtml,

  json: iconJson,
  xml: iconJson,

  // 图片
  jpg: iconImage,
  jpeg: iconImage,
  png: iconImage,
  gif: iconImage,
  bmp: iconImage,
  webp: iconImage,
  svg: iconImage,
  ico: iconImage,

  // 音频
  mp3: iconMp3,
  wav: iconWav,
  flac: iconMp3,
  m4a: iconM4a,
  aac: iconMp3,
  ogg: iconMp3,

  // 视频
  mp4: iconMp4,
  mkv: iconMkv,
  avi: iconMp4,
  mov: iconMp4,
  wmv: iconMp4,
  flv: iconMp4,

  // 压缩包
  zip: iconZip,
  rar: iconZip,
  '7z': iconZip,
  tar: iconZip,
  gz: iconZip,

  // 脚本和代码
  py: iconScript,
  rb: iconScript,
  sh: iconScript,
  ps1: iconScript,

  // 其他
  lnk: iconExe, // 快捷方式
  url: iconHtml, // 网页快捷方式
  ini: iconTxt, // 配置文件
  cfg: iconTxt,
  conf: iconTxt,
}

/**
 * 默认未知文件图标
 */
const DEFAULT_ICON = iconUnknown

/**
 * 根据文件类型获取图标路径
 */
export function getFileIcon(file: FileItem): string {
  // 优先使用文件的 ico 字段（缓存文件路径）
  if (file.ico && file.ico.trim()) {
    // 检测是否是 Windows 绝对路径，使用 asset 协议加载
    if (/^[A-Za-z]:[\\/]/.test(file.ico)) {
      return convertFileSrc(file.ico)
    }
    return file.ico
  }

  // 如果是文件夹
  if (file.fType === 'dir') {
    return ICON_MAP.dir
  }

  // 根据文件扩展名匹配
  const ext = file.fileType.toLowerCase()

  return ICON_MAP[ext] || DEFAULT_ICON
}

/**
 * 根据文件类型获取图标路径（简化版本，仅用扩展名）
 */
export function getIconByExtension(ext: string, isDir: boolean = false): string {
  if (isDir) {
    return ICON_MAP.dir
  }

  const lowerExt = ext.toLowerCase().replace('.', '')
  return ICON_MAP[lowerExt] || DEFAULT_ICON
}

/**
 * 预加载所有图标
 */
export function preloadIcons() {
  const icons = new Set(Object.values(ICON_MAP))
  icons.add(DEFAULT_ICON)

  icons.forEach(src => {
    const img = new Image()
    img.src = src
  })
}

/**
 * 获取所有可用的图标路径
 */
export function getAllIcons(): string[] {
  return Array.from(new Set([...Object.values(ICON_MAP), DEFAULT_ICON]))
}
