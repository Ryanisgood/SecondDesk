// 智能 URL 检测器
import type { URLDetectionResult } from '../types/search'

// URL 检测模式
const URL_PATTERNS = {
  // 完整 URL（带协议）
  fullURL: /^(https?|ftp|file):\/\/.+/i,

  // www 开头
  www: /^www\./i,

  // localhost
  localhost: /^localhost(:\d+)?(\/.*)?$/i,

  // IP 地址（IPv4）
  ipv4: /^(\d{1,3}\.){3}\d{1,3}(:\d+)?(\/.*)?$/,

  // 域名格式（包含 . 和有效 TLD）
  // 支持：example.com, site.org/path, domain.com:8080, sub.domain.com 等
  domain: /^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}(:\d+)?(\/.*)?$/i,
}

// 常见顶级域名（用于提高识别准确度）
const COMMON_TLDS = [
  // 通用顶级域名
  'com', 'org', 'net', 'edu', 'gov', 'mil', 'int',
  'io', 'ai', 'app', 'dev', 'tech', 'cloud',

  // 国家/地区顶级域名
  'cn', 'us', 'uk', 'jp', 'kr', 'de', 'fr', 'ca', 'au',
  'co', 'it', 'nl', 'ru', 'br', 'in', 'mx', 'es', 'se',

  // 新顶级域名
  'xyz', 'top', 'site', 'online', 'store', 'blog', 'news',
]

/**
 * 从 URL/域名中提取顶级域名
 */
function extractTLD(input: string): string {
  // 移除协议
  let domain = input.replace(/^(https?|ftp|file):\/\//i, '')

  // 移除端口和路径
  domain = domain.split(':')[0].split('/')[0]

  // 提取 TLD
  const parts = domain.split('.')
  if (parts.length < 2) return ''

  return parts[parts.length - 1].toLowerCase()
}

/**
 * 从 URL 中提取协议
 */
function extractProtocol(url: string): string | undefined {
  const match = url.match(/^([a-z]+):\/\//i)
  return match ? match[1].toLowerCase() : undefined
}

/**
 * 验证 IP 地址格式是否合法
 */
function isValidIPv4(ip: string): boolean {
  const parts = ip.split('.')
  if (parts.length !== 4) return false

  return parts.every(part => {
    const num = parseInt(part, 10)
    return num >= 0 && num <= 255 && part === num.toString()
  })
}

/**
 * 检测输入是否为 URL
 */
export function detectURL(input: string): URLDetectionResult {
  const trimmed = input.trim()

  if (!trimmed) {
    return { isURL: false }
  }

  // 1. 检测完整 URL（带协议）
  if (URL_PATTERNS.fullURL.test(trimmed)) {
    return {
      isURL: true,
      protocol: extractProtocol(trimmed),
      normalized: trimmed,
      confidence: 1.0,
    }
  }

  // 2. 检测 www 开头
  if (URL_PATTERNS.www.test(trimmed)) {
    return {
      isURL: true,
      protocol: 'https',
      normalized: `https://${trimmed}`,
      confidence: 0.95,
    }
  }

  // 3. 检测 localhost
  if (URL_PATTERNS.localhost.test(trimmed)) {
    return {
      isURL: true,
      protocol: 'http',
      normalized: `http://${trimmed}`,
      confidence: 1.0,
    }
  }

  // 4. 检测 IP 地址
  if (URL_PATTERNS.ipv4.test(trimmed)) {
    const ipPart = trimmed.split(':')[0].split('/')[0]
    if (isValidIPv4(ipPart)) {
      return {
        isURL: true,
        protocol: 'http',
        normalized: `http://${trimmed}`,
        confidence: 0.9,
      }
    }
  }

  // 5. 检测域名格式
  if (URL_PATTERNS.domain.test(trimmed)) {
    const tld = extractTLD(trimmed)

    // 检查是否为常见 TLD
    if (COMMON_TLDS.includes(tld)) {
      return {
        isURL: true,
        protocol: 'https',
        normalized: `https://${trimmed}`,
        confidence: 0.85,
      }
    }

    // TLD 不在常见列表中，但格式正确，给予较低置信度
    if (tld.length >= 2) {
      return {
        isURL: true,
        protocol: 'https',
        normalized: `https://${trimmed}`,
        confidence: 0.6,
      }
    }
  }

  return { isURL: false }
}

/**
 * 快速判断是否为 URL（不返回详细信息）
 */
export function isValidURL(input: string): boolean {
  const result = detectURL(input)
  return result.isURL && (result.confidence ?? 0) >= 0.7
}

/**
 * 标准化 URL（添加协议等）
 */
export function normalizeURL(input: string): string {
  const result = detectURL(input)
  return result.normalized ?? input
}
