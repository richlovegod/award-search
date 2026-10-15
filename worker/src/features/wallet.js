// 點數錢包 (points wallet), 2026-10-15: each account's own balances of the five bank and hotel currencies and of
// the airline programs, so the page can say which awards the account can already pay for. One D1 row per account
// (migrations/0009_wallet.sql); balances is a JSON object of key -> points that holds only keys with a balance.
//   GET /me/wallet   -> { balances: { amex: 96500, aeroplan: 20000 }, updated_at: <Unix seconds> | null }
//   PUT /me/wallet   { balances: { key: points } }: only the keys sent change, 0 removes one; answers like GET
// Keys: amex, chase, citi, capitalone, marriott and the program keys of lib.PROGRAM_NAME. Points: whole numbers
// from 0 to 100,000,000. At most 60 keys a request. Anything else is refused with 400 { error: 'param' }.
// Costs no seats.aero call and no KV write; a PUT is one D1 read and at most one write.
export const name = 'wallet';

export const BANK_KEYS = ['amex', 'chase', 'citi', 'capitalone', 'marriott'];
export const MAX_POINTS = 100000000;
export const MAX_KEYS = 60;

let KEYS = null;
const keysOf = lib => KEYS || (KEYS = new Set([...BANK_KEYS, ...Object.keys(lib.PROGRAM_NAME)]));
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

// the stored object, read defensively: only known keys with a valid count survive
export function readBalances(text, keys) {
  let o = null;
  try { o = JSON.parse(text || '{}'); } catch { o = null; }
  const out = {};
  if (o && typeof o === 'object' && !Array.isArray(o)) {
    for (const k of Object.keys(o)) {
      const v = o[k];
      if (keys.has(k) && Number.isInteger(v) && v > 0 && v <= MAX_POINTS) out[k] = v;
    }
  }
  return out;
}

// the changes in a PUT body ({ key: points }), or null when anything in it is outside the rules
export function cleanPatch(b, keys) {
  const p = b && own(b, 'balances') ? b.balances : null;
  if (!p || typeof p !== 'object' || Array.isArray(p)) return null;
  const list = Object.keys(p);
  if (list.length > MAX_KEYS) return null;
  const out = {};
  for (const k of list) {
    const v = p[k];
    if (!keys.has(k) || !Number.isInteger(v) || v < 0 || v > MAX_POINTS) return null;
    out[k] = v;
  }
  return out;
}

async function current(env, uid, keys) {
  const r = await env.DB.prepare('SELECT balances, updated_at FROM wallet WHERE user_id = ?').bind(uid).first();
  return r ? { balances: readBalances(r.balances, keys), updated_at: r.updated_at } : { balances: {}, updated_at: null };
}

async function getWallet({ env, s, h, lib }) {
  return lib.json(await current(env, s.id, keysOf(lib)), 200, h);
}

async function putWallet({ req, env, s, h, lib }) {
  const keys = keysOf(lib), patch = cleanPatch(await lib.readJson(req), keys);
  if (!patch) return lib.json({ error: 'param' }, 400, h);
  const cur = await current(env, s.id, keys), next = { ...cur.balances };
  for (const [k, v] of Object.entries(patch)) { if (v) next[k] = v; else delete next[k]; }
  const same = Object.keys(next).length === Object.keys(cur.balances).length && Object.keys(next).every(k => cur.balances[k] === next[k]);
  if (same) return lib.json(cur, 200, h);   // nothing changed: no write
  const t = lib.now();
  await env.DB.prepare('INSERT INTO wallet (user_id, balances, updated_at) VALUES (?, ?, ?) ' +
    'ON CONFLICT(user_id) DO UPDATE SET balances = excluded.balances, updated_at = excluded.updated_at')
    .bind(s.id, JSON.stringify(next), t).run();
  return lib.json({ balances: next, updated_at: t }, 200, h);
}

export const routes = [
  { method: 'GET', path: '/me/wallet', auth: 'user', handler: getWallet },
  { method: 'PUT', path: '/me/wallet', auth: 'user', handler: putWallet },
];

// run when an account is deleted (removeUser in ../index.js batches it with the account's other rows)
export function onDeleteUser(env, uid) {
  return env.DB.prepare('DELETE FROM wallet WHERE user_id = ?').bind(uid);
}
