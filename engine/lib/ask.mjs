// Tiny interactive prompt helpers (no dependencies). With --yes every question takes its default,
// so agents and CI can run the wizards non-interactively.

import readline from 'node:readline';
import { stdin, stdout } from 'node:process';

export const YES = process.argv.includes('--yes') || process.argv.includes('-y');
// Line queue instead of readline/promises: works the same with a keyboard and with piped
// input (readline/promises drops lines that arrive before question() is called).
let rl = null, ended = false;
const lines = [], waiters = [];
function io() {
  if (rl) return rl;
  rl = readline.createInterface({ input: stdin, terminal: false });
  rl.on('line', (l) => (waiters.length ? waiters.shift()(l) : lines.push(l)));
  rl.on('close', () => { ended = true; while (waiters.length) waiters.shift()(''); });
  return rl;
}
const nextLine = () => (lines.length ? Promise.resolve(lines.shift()) : ended ? Promise.resolve('') : new Promise((r) => waiters.push(r)));
const ask = async (prompt) => { io(); stdout.write(prompt); const l = await nextLine(); if (!stdin.isTTY) stdout.write('\n'); return l; };
export const close = () => { rl?.close(); rl = null; };

const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;
export const title = (s) => console.log(`\n${bold('── ' + s + ' ' + '─'.repeat(Math.max(0, 60 - s.length)))}`);
export const note = (s) => console.log(dim(s));

/** Free text. */
export async function text(q, def = '') {
  if (YES) return def;
  const a = (await ask(`${q}${def !== '' ? dim(` [${def}]`) : ''}: `)).trim();
  return a === '' ? def : a;
}

/** Number with optional bounds. */
export async function number(q, def, { min = -Infinity, max = Infinity } = {}) {
  for (;;) {
    const a = await text(q, String(def));
    const n = Number(a.replace(',', '.'));
    if (Number.isFinite(n) && n >= min && n <= max) return n;
    console.log(`  → escribe un número entre ${min} y ${max}`);
  }
}

/** Yes/no. */
export async function yesno(q, def = true) {
  const a = (await text(`${q} (s/n)`, def ? 's' : 'n')).toLowerCase();
  return ['s', 'si', 'sí', 'y', 'yes', '1', 'true'].includes(a);
}

/** Pick one of options [{value, label, hint?}] by number or value. Returns value. */
export async function choose(q, options, def) {
  if (YES) return def ?? options[0].value;
  console.log(q);
  options.forEach((o, i) => console.log(`  ${String(i + 1).padStart(2)}) ${o.label}${o.hint ? dim('  — ' + o.hint) : ''}${o.value === def ? dim('  (actual)') : ''}`));
  for (;;) {
    const di = Math.max(0, options.findIndex((o) => o.value === def)) + 1;
    const a = await text('  elige', String(di));
    const i = Number(a);
    if (Number.isInteger(i) && i >= 1 && i <= options.length) return options[i - 1].value;
    const m = options.find((o) => String(o.value) === a);
    if (m) return m.value;
    console.log('  → número de la lista');
  }
}

/** Hex colour #rrggbb. */
export async function color(q, def) {
  for (;;) {
    const a = await text(q, def);
    if (/^#[0-9a-f]{6}$/i.test(a)) return a.toLowerCase();
    if (/^#[0-9a-f]{3}$/i.test(a)) return ('#' + a.slice(1).split('').map((c) => c + c).join('')).toLowerCase();
    console.log('  → formato #rrggbb');
  }
}

export const slugify = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
