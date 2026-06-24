import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const root = process.cwd()
const srcRoot = join(root, 'src')
const allowedHanFiles = new Set([
  'src/i18n/index.ts',
  'src/utils/searchParser.ts',
])

function walk(dir) {
  const result = []
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    const stat = statSync(path)
    if (stat.isDirectory()) {
      result.push(...walk(path))
    } else if (/\.(ts|vue)$/.test(entry)) {
      result.push(path)
    }
  }
  return result
}

function stripNonRuntimeText(source, file) {
  let text = source
  if (file.endsWith('.vue')) {
    text = text.replace(/<style[\s\S]*?<\/style>/gi, '')
  }
  text = text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
    .replace(/<!--[\s\S]*?-->/g, '')
  return text
}

const failures = []

for (const file of walk(srcRoot)) {
  const rel = relative(root, file).replaceAll('\\', '/')
  if (allowedHanFiles.has(rel)) continue

  const stripped = stripNonRuntimeText(readFileSync(file, 'utf8'), rel)
  const lines = stripped.split(/\r?\n/)
  lines.forEach((line, index) => {
    if (/\bconsole\.(debug|error|info|log|warn)\b/.test(line)) return
    if (/\b(aliases|keywords)\s*:/.test(line)) return
    if (/[\p{Script=Han}]/u.test(line)) {
      failures.push(`${rel}:${index + 1}: ${line.trim()}`)
    }
  })
}

if (failures.length > 0) {
  console.error('Found non-localized Chinese runtime text:')
  for (const failure of failures.slice(0, 200)) {
    console.error(`  ${failure}`)
  }
  if (failures.length > 200) {
    console.error(`  ...and ${failures.length - 200} more`)
  }
  process.exit(1)
}

console.log('i18n check passed')
