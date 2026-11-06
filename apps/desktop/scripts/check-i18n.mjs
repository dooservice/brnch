/**
 * Every translation in the app resolves in every language.
 *
 * i18next shows the key itself when a line is missing, and nothing fails: the screen just says
 * `review.approve`. This reads the English catalog as the reference and checks two things.
 *
 * 1. Each `t('key')` in a component that uses a single `useTranslation('namespace')` exists in
 *    that namespace (or in `common`, the default one).
 * 2. Every other language has exactly the keys English has, no fewer and no more.
 *
 * The catalogs live in `locales/<language>/<namespace>.json`, inside this repository.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const LOCALES = 'locales'
const SOURCE = 'src'
const FALLBACK = 'common'
const REFERENCE = 'en'

const languages = readdirSync(LOCALES).filter(name => statSync(join(LOCALES, name)).isDirectory())

function load(language) {
  const directory = join(LOCALES, language)
  return Object.fromEntries(
    readdirSync(directory)
      .filter(name => name.endsWith('.json'))
      .map(name => [name.replace('.json', ''), JSON.parse(readFileSync(join(directory, name), 'utf8'))]),
  )
}

/** Every dotted path to a text, with plural suffixes folded into their base key. */
function keysOf(node, prefix = '') {
  if (typeof node === 'string') return [prefix]
  return Object.entries(node).flatMap(([key, value]) => {
    const folded = key.replace(/_(zero|one|two|few|many|other)$/, '')
    return keysOf(value, prefix === '' ? folded : `${prefix}.${folded}`)
  })
}

const catalogs = Object.fromEntries(languages.map(language => [language, load(language)]))
const problems = []

for (const language of languages) {
  if (language === REFERENCE) continue
  for (const namespace of new Set([...Object.keys(catalogs[REFERENCE]), ...Object.keys(catalogs[language])])) {
    const expected = new Set(keysOf(catalogs[REFERENCE][namespace] ?? {}))
    const actual = new Set(keysOf(catalogs[language][namespace] ?? {}))
    for (const key of expected) if (!actual.has(key)) problems.push(`${language}:${namespace}  falta ${key}`)
    for (const key of actual) if (!expected.has(key)) problems.push(`${language}:${namespace}  sobra ${key}`)
  }
}

function has(namespace, key) {
  const present = new Set(keysOf(catalogs[REFERENCE][namespace] ?? {}))
  return present.has(key)
}

function* files(directory) {
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry)
    if (statSync(path).isDirectory()) yield* files(path)
    else if (path.endsWith('.tsx') && !path.endsWith('.test.tsx')) yield path
  }
}

for (const path of files(SOURCE)) {
  const source = readFileSync(path, 'utf8')
  const namespaces = [...new Set([...source.matchAll(/useTranslation\('([a-z_]+)'\)/g)].map(match => match[1]))]
  if (namespaces.length !== 1) continue
  // A key built at run time, such as `status.${state}`, cannot be checked here; its prefix is.
  for (const [, key, tail] of source.matchAll(/\bt\('([a-zA-Z0-9_.]+)'([^)]{0,80})/g)) {
    if (tail.includes('ns:')) continue
    if (has(namespaces[0], key) || has(FALLBACK, key)) continue
    problems.push(`${path}  ${namespaces[0]}:${key}`)
  }
}

if (problems.length > 0) {
  console.error('Problemas de traducción:\n')
  for (const line of [...new Set(problems)].sort()) console.error(`  ${line}`)
  process.exit(1)
}

console.log('Todas las claves de traducción existen en todos los idiomas.')
