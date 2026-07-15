#!/usr/bin/env node
// Замена `pnpm audit`: npm навсегда отключил старые аудит-эндпоинты
// (/-/npm/v1/security/audits и .../quick теперь отвечают 410), а pnpm
// (включая 10.30.2) ещё не перешёл на новый. Скрипт делает то же самое
// напрямую: собирает все пакеты из pnpm-lock.yaml, спрашивает bulk-эндпоинт
// advisories (им пользуется сам npm audit начиная с npm 7) и падает только
// на уязвимостях с severity не ниже --audit-level (по умолчанию critical);
// high/moderate печатаются в лог, но сборку не рушат.
//
// Запуск: node scripts/audit.mjs [--audit-level=critical]

import { readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const BULK_URL = 'https://registry.npmjs.org/-/npm/v1/security/advisories/bulk'
const SEVERITY_ORDER = ['info', 'low', 'moderate', 'high', 'critical']

const levelArg = process.argv.find(arg => arg.startsWith('--audit-level='))
const auditLevel = levelArg ? levelArg.split('=')[1] : 'critical'
if (!SEVERITY_ORDER.includes(auditLevel)) {
  console.error(`Неизвестный --audit-level=${auditLevel}; допустимо: ${SEVERITY_ORDER.join(', ')}`)
  process.exit(2)
}
const failFrom = SEVERITY_ORDER.indexOf(auditLevel)

// --- Собираем name -> [versions] из pnpm-lock.yaml (lockfileVersion 9) ---
// Ключи секции packages: двухпробельный отступ, опциональные кавычки,
// `name@version:` / `'@scope/name@version':`. YAML-парсер не нужен.
const lockPath = path.resolve(process.cwd(), 'pnpm-lock.yaml')
const lock = readFileSync(lockPath, 'utf8')

const packagesSection = lock.split(/^packages:\s*$/m)[1]?.split(/^\S/m)[0]
if (!packagesSection) {
  console.error('Не нашёл секцию packages: в pnpm-lock.yaml')
  process.exit(2)
}

const versionsByName = new Map()
for (const line of packagesSection.split('\n')) {
  const match = line.match(/^ {2}'?(@?[^'\s]+?)@([^'@\s(]+)'?:\s*$/)
  if (!match)
    continue

  const [, name, version] = match
  if (!versionsByName.has(name))
    versionsByName.set(name, new Set())
  versionsByName.get(name).add(version)
}

if (versionsByName.size === 0) {
  console.error('Из pnpm-lock.yaml не извлеклось ни одного пакета — формат изменился?')
  process.exit(2)
}

const body = {}
for (const [name, versions] of versionsByName)
  body[name] = [...versions]

console.log(`Проверяем ${versionsByName.size} пакетов через bulk advisory endpoint...`)

const response = await fetch(BULK_URL, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
})
if (!response.ok) {
  console.error(`Bulk advisory endpoint ответил ${response.status}: ${await response.text()}`)
  process.exit(2)
}

const advisoriesByPackage = await response.json()

const counts = Object.fromEntries(SEVERITY_ORDER.map(severity => [severity, 0]))
const blocking = []
for (const [name, advisories] of Object.entries(advisoriesByPackage)) {
  for (const advisory of advisories) {
    const severity = SEVERITY_ORDER.includes(advisory.severity) ? advisory.severity : 'info'
    counts[severity]++

    const line = `[${severity}] ${name} ${advisory.vulnerable_versions}: ${advisory.title} (${advisory.url})`
    // High и выше — всегда в лог, чтобы были на виду (как раньше у pnpm audit).
    if (SEVERITY_ORDER.indexOf(severity) >= SEVERITY_ORDER.indexOf('high'))
      console.log(line)

    if (SEVERITY_ORDER.indexOf(severity) >= failFrom)
      blocking.push(line)
  }
}

const summary = SEVERITY_ORDER
  .filter(severity => counts[severity] > 0)
  .map(severity => `${severity}: ${counts[severity]}`)
  .join(', ')
console.log(summary ? `Найдено advisories — ${summary}` : 'Уязвимостей не найдено.')

if (blocking.length > 0) {
  console.error(`\n${blocking.length} advisory уровня ${auditLevel}+ — сборка блокируется.`)
  process.exit(1)
}
