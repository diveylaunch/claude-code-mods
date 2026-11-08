// Agents panel row: the whole row fills as the agent works, the mascot follows what it does.
// Pure functions: no engine calls, so the drawing can be checked outside Claude Code.
import { SPRITES, type Sprite } from './sprites.gen'

export const ROW_H = 50
export const TEAM_H = 26

export type Row = {
  id: string
  type: string
  description: string
  status: string
  startedAt: number
  endedAt?: number
  progress: number | null
  tokens: number
  memory: number
}
export type Words = { done: string; memory: string; team: (n: number) => string; failed: string }
export type Fmt = {
  xml: (s: string) => string
  fit: (s: string, size: number, w: number) => string
  tokens: (n: number) => string
  time: (ms: number) => string
  model: string
}

const FONT = "-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',sans-serif"
const TITLE_FONT = "ui-rounded,'SF Pro Rounded',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"
const HOT_MEMORY = 50
const HOT_TOKENS = 400_000
const JOY_MS = 3000
const SHIFT_MS = 20_000

const CSS = `.t{fill:#1f1f1f}.s{fill:#6b6b68}.g{fill:#2f7d4f}.h{fill:#b6532f}
@media (prefers-color-scheme: dark){.t{fill:#ececec}.s{fill:#a8a8a4}.g{fill:#6fbf8b}.h{fill:#e09a7f}}`

type Kind = 'check' | 'web' | 'read' | 'fix' | 'build' | 'art' | 'text' | 'think' | 'lead' | 'code'

const RULES: [Kind, RegExp][] = [
  ['lead', /\b(lead|orchestrat)|разда[её]т|команд[еу]/i],
  ['check', /review|verif|audit|\bqa\b|провер|ревью|сверя/i],
  ['web', /research|search|\bweb\b|browse|ищ[её]т|поиск|ресёрч|ресерч|сети/i],
  ['fix', /\bfix|debug|\bbug|чинит|ошибк|отлад/i],
  ['build', /\bbuild|compile|deploy|собира|сборк|деплой/i],
  ['art', /design|draw|image|cover|рису|обложк|макет|дизайн/i],
  ['read', /\bread|explor|inspect|читает|изуч|разбира/i],
  ['text', /\bwrit|\bdoc|\bpost|текст|пост|отч[её]т|статью/i],
  ['think', /\bplan|think|duma|план|дума/i],
]
const kindOf = (a: Row): Kind => RULES.find(([, re]) => re.test(`${a.type} ${a.description}`))?.[0] ?? 'code'

export const COLOR: Record<Kind, string> = {
  code: '#d97757', build: '#d97757', fix: '#d97757', lead: '#d97757',
  check: '#c9a35b', read: '#c9a35b', think: '#c9a35b',
  art: '#8fb573', text: '#8fb573',
  web: '#6fa8a0',
}
// Stickers by alwinecor (CC BY-NC-SA 4.0), see LICENSE-ART.
const POOL: Record<Kind, string[]> = {
  code: ['clone', 'cherry', 'clear'], build: ['loop'], fix: ['detached', 'notfound'], check: ['duck', 'right'], read: ['simple'],
  web: ['notfound', 'simple'], art: ['clear'], text: ['todo'], think: ['plan', 'ultrathink', 'proceed'], lead: ['subagents'],
}
const JOY: Record<Kind, string> = {
  code: 'passed', build: 'passed', fix: 'passed', lead: 'hello', check: 'right', read: 'passed', think: 'passed',
  art: 'passed', text: 'passed', web: 'passed',
}
const REST = ['sleep', 'coffee', 'fish']

const hash = (s: string): number => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7)
const pick = (names: string[], seed: number): string => {
  const live = names.filter(n => SPRITES[n])
  return live[Math.abs(seed) % live.length] ?? Object.keys(SPRITES)[0] ?? ''
}

export const spriteFor = (a: Row, at: number, isLast: boolean): string => {
  const kind = kindOf(a)
  if (a.status === 'running') return pick(POOL[kind], hash(a.id) + Math.floor(at / SHIFT_MS))
  if (a.status === 'failed') return 'leak'
  if (isLast) return 'offwork'
  if (a.endedAt && at - a.endedAt < JOY_MS) return JOY[kind]
  return pick(REST, hash(a.id))
}

// The row is redrawn every second, so the strip starts from the clock's phase and never jumps.
const sprite = (name: string, at: number, x: number, y: number, W: number, H: number, cls: string): string => {
  const s: Sprite | undefined = SPRITES[name]
  if (!s) return ''
  const delay = at % s.ms
  return `<style>@keyframes ${cls}{to{transform:translateY(-${s.n * s.h}px)}}.${cls}{animation:${cls} ${s.ms}ms steps(${s.n}) infinite;animation-delay:-${delay}ms}@media (prefers-reduced-motion: reduce){.${cls}{animation:none}}</style><svg x="${x}" y="${y}" width="${W}" height="${H}" viewBox="0 0 ${s.w} ${s.h}" preserveAspectRatio="xMidYMax meet" shape-rendering="crispEdges"><clipPath id="${cls}c"><rect width="${s.w}" height="${s.h}"/></clipPath><g clip-path="url(#${cls}c)">${s.stat}<g class="${cls}">${s.strip}</g></g></svg>`
}

// «делает: X» → «сделал: X». Other languages keep the title; the green word says it is done.
export const pastTitle = (t: string): string =>
  t.replace(/^делает:/i, 'сделал:').replace(/^проверяет:/i, 'проверил:').replace(/^ищет:/i, 'нашёл:').replace(/^раздаёт:/i, 'раздал:')
    .replace(/^пишет:/i, 'написал:').replace(/^читает:/i, 'прочитал:').replace(/^чинит:/i, 'починил:').replace(/^думает:/i, 'подумал:').replace(/^планирует:/i, 'спланировал:')

export const rowSvg = (W: number, a: Row, at: number, w: Words, f: Fmt, ctx: { isLast: boolean; isTop: boolean }): string => {
  const running = a.status === 'running'
  const kind = kindOf(a)
  const fillW = running && a.progress !== null ? Math.round(W * a.progress) : running ? Math.round((W * a.memory) / 100) : 0
  const fill = a.progress === null ? '#8e8e8a' : COLOR[kind]
  const elapsedMs = (a.endedAt ?? at) - a.startedAt
  const right = running
    ? `${a.progress === null ? '' : `${Math.round(a.progress * 100)}% · `}${f.time(elapsedMs)}`
    : `${a.status === 'failed' ? w.failed : w.done} · ${f.time(elapsedMs)}`
  const rightCls = running ? 's' : a.status === 'failed' ? 'h' : 'g'
  const rightW = right.length * 6.4 + 8
  const title = f.fit(running ? a.description || a.type : pastTitle(a.description || a.type), 13, W - 54 - rightW - 8)
  const hotTok = ctx.isTop || a.tokens >= HOT_TOKENS
  const hotMem = a.memory >= HOT_MEMORY
  const lead = f.fit(`${a.type} · ${f.model} · `, 11, W - 54 - 150)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${ROW_H}" viewBox="0 0 ${W} ${ROW_H}"><style>${CSS}</style>
${fillW ? `<rect x="0" y="2" width="${fillW}" height="${ROW_H - 4}" rx="6" fill="${fill}" fill-opacity=".09"/>` : ''}
${sprite(spriteFor(a, at, ctx.isLast), at, 6, 7, 42, 36, `f${Math.abs(hash(a.id))}`)}
<text class="t" x="54" y="21" font-family="${TITLE_FONT}" font-size="13" font-weight="600">${f.xml(title)}</text>
<text class="${rightCls}" x="${W - 8}" y="21" text-anchor="end" font-family="${FONT}" font-size="11" font-variant-numeric="tabular-nums">${f.xml(right)}</text>
<text class="s" x="54" y="38" font-family="${FONT}" font-size="11" font-variant-numeric="tabular-nums">${f.xml(lead)}<tspan class="${hotTok ? 'h' : 's'}">${f.tokens(a.tokens)}</tspan> · <tspan class="${hotMem ? 'h' : 's'}">${f.xml(w.memory)} ${a.memory}%</tspan></text>
</svg>`
}

export const teamValue = (rows: Row[]): number | null => {
  const known = rows.filter(r => r.progress !== null)
  return known.length ? Math.round((known.reduce((s, r) => s + (r.progress ?? 0), 0) / known.length) * 100) : null
}

export const teamSvg = (W: number, value: number, w: Words, f: Fmt): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${TEAM_H}" viewBox="0 0 ${W} ${TEAM_H}"><style>${CSS}</style><text class="s" x="0" y="12" font-family="${FONT}" font-size="11">${f.xml(w.team(value))}</text><rect x="0" y="19" width="${W}" height="2" rx="1" fill="#8e8e8a" fill-opacity=".25"/><rect x="0" y="19" width="${Math.round((W * value) / 100)}" height="2" rx="1" fill="#8e8e8a"/></svg>`

export const summarySvg = (W: number, text: string, xml: Fmt['xml'], fit: Fmt['fit']): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="22" viewBox="0 0 ${W} 22"><style>${CSS}</style><text class="s" x="0" y="15" font-family="${FONT}" font-size="12" font-variant-numeric="tabular-nums">${xml(fit(text, 12, W))}</text></svg>`
