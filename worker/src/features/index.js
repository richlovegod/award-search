// Feature modules for award-relay (2026-10-15): one file per feature, listed here. The router in ../index.js asks
// each module, in this order, before answering 404, and the crons call their hooks. A module exports any of:
//
//   routes: [{ method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: '/exact' or /^\/regex\/(\d+)$/,
//              auth: 'public' | 'user' | 'owner', handler: async ({ req, env, ctx, s, url, h, m, lib }) => Response }]
//     auth 'public' runs before the session check (s is null); 'user' needs a signed-in account; 'owner' also
//     needs role owner. m is the RegExp match (or null for an exact path). Answer with lib.json(body, status, h).
//   hourly: async ({ env, ctx, lib, at }) => any      the "5 * * * *" cron; at = the run's time in Unix seconds
//   onAlertHit: async ({ env, ctx, lib, alert, fresh }) => void      after an alert emailed new or cheaper awards
//   onDeleteUser: (env, uid) => D1 prepared statement or array of them, run when an account is deleted
//
// lib is the shared toolbox built in ../index.js (json, readJson, budgetCheck, spend, sendMail...).
// Keep each hook light: the free plan gives a cron run 10 ms of CPU, and a request about the same.
import * as f_release from './release.js';
import * as f_wallet from './wallet.js';
import * as f_bonuses from './bonuses.js';
import * as f_explore from './explore.js';
import * as f_hotels from './hotels.js';
import * as f_push from './push.js';
import * as f_digest from './digest.js';
import * as f_usage from './usage.js';
export const FEATURES = [f_release, f_wallet, f_bonuses, f_explore, f_hotels, f_push, f_digest, f_usage];
