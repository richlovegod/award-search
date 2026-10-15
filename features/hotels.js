// 飯店 (hotel award search through rooms.aero), Gino 2026-10-15. Pick a place (common Chinese city names are sent in
// English; anything else goes as typed, and rooms.aero geocodes it), a range of check-in dates at most 30 days apart,
// how many nights and which programs, plus an optional points ceiling. The Worker (worker/src/features/hotels.js)
// asks rooms.aero once: 1 call of its own 1,000 a day, not the flights quota. The page then sorts by points, value
// or cash with no further call. Measured with real replies on 2026-10-15: points and cash are per night (a 2-night
// search gives the nightly average), cash is in hundredths of currency_code (TWD and JPY too), and a place rooms.aero
// can't find gives no hotels rather than an error. Results stay in sessionStorage for an hour, so a revisit or the
// same search costs no call, and a search for fewer programs is cut from an all-programs result already here.
// The points ceiling (最多點數) is applied here, to the nightly price on the card, and not sent to rooms.aero: its
// docs call points "for the stay", and nobody has tested what its max_points does on a stay of 2 to 5 nights. So a
// new ceiling costs no call either.
(() => {
'use strict';

const PROGS = [   // rooms.aero source key, short name, the program's site
  ['hilton', 'Hilton', 'https://www.hilton.com'], ['hyatt', 'Hyatt', 'https://www.hyatt.com'], ['ihg', 'IHG', 'https://www.ihg.com'],
  ['marriott', 'Marriott', 'https://www.marriott.com'], ['choice', 'Choice', 'https://www.choicehotels.com'],
  ['wyndham', 'Wyndham', 'https://www.wyndhamhotels.com'], ['iprefer', 'I Prefer', 'https://preferredhotels.com'],
];
const PROG = Object.fromEntries(PROGS.map(([k, name, url]) => [k, { name, url }]));
// brand codes (rooms.aero Concepts page, 2026-09-10, plus codes seen in real replies on 2026-10-15); an unknown code
// shows nothing, since the hotel's name usually says it
const BRANDS = {
  hilton: { PY: 'Canopy', CH: 'Conrad', QQ: 'Curio', DT: 'DoubleTree', ES: 'Embassy Suites', GI: 'Hilton Garden Inn', GV: 'Grand Vacations', HP: 'Hampton',
    HI: 'Hilton', HT: 'Home2 Suites', HW: 'Homewood Suites', LX: 'SLH', UP: 'Tapestry', RU: 'Tru', WA: 'Waldorf Astoria' },
  hyatt: { alila: 'Alila', alua: 'Alua', andaz: 'Andaz', caption: 'Caption', centric: 'Hyatt Centric', destination: 'Destination by Hyatt', dream: 'Dream',
    dreams: 'Dreams', grand: 'Grand Hyatt', house: 'Hyatt House', hyatt: 'Hyatt', place: 'Hyatt Place', regency: 'Hyatt Regency', studios: 'Hyatt Studios',
    vacation: 'Hyatt Vacation Club', jdv: 'JdV by Hyatt', mr_mrs_smith: 'Mr & Mrs Smith', park: 'Park Hyatt', secrets: 'Secrets', sunscape: 'Sunscape',
    standard: 'The Standard', thompson: 'Thompson', unbound: 'Unbound Collection', urcove: 'UrCove', zilara: 'Zilara', ziva: 'Ziva', zoetry: 'Zoetry' },
  ihg: { CPAN: 'ANA Crowne Plaza', HIAN: 'ANA Holiday Inn', ICAN: 'ANA InterContinental', ATWL: 'Atwell Suites', AVID: 'avid hotels', CDLW: 'Candlewood Suites',
    HICP: 'Crowne Plaza', EVEN: 'EVEN Hotels', RNHR: 'Garner', HOLI: 'Holiday Inn', HIIS: 'Holiday Inn & Suites', HICV: 'Holiday Inn Club Vacations',
    HIEX: 'Holiday Inn Express', HEXS: 'Holiday Inn Express & Suites', HIRT: 'Holiday Inn Resort', INDG: 'Hotel Indigo', HLUX: 'HUALUXE', ICON: 'InterContinental',
    ICRT: 'InterContinental', KIKI: 'Kimpton', RGNT: 'Regent', GEMS: 'Ruby', SIXS: 'Six Senses', STAY: 'Staybridge Suites', VXVX: 'voco' },
  marriott: { AR: 'AC Hotels', AL: 'Aloft', AK: 'Autograph Collection', CY: 'Courtyard', DS: 'Design Hotels', EB: 'EDITION', FI: 'Fairfield', JW: 'JW Marriott',
    MD: 'Le Méridien', LC: 'Luxury Collection', MC: 'Marriott', MV: 'Marriott Vacation Club', MG: 'MGM Collection', RI: 'Residence Inn', RZ: 'Ritz-Carlton',
    SI: 'Sheraton', XR: 'St. Regis', TS: 'TownePlace Suites', WH: 'W Hotels', WI: 'Westin', TX: 'Tribute Portfolio', BR: 'Renaissance', OX: 'Moxy',
    FP: 'Four Points', XF: 'Four Points Flex', SH: 'SpringHill Suites', CM: 'citizenM' },
  wyndham: { AA: 'AmericInn', BU: 'Baymont', DI: 'Days Inn', DX: 'Dolce', BH: 'Hawthorn Suites', HJ: 'Howard Johnson', LQ: 'La Quinta', MT: 'Microtel',
    RA: 'Ramada', RE: 'Registry Collection', SE: 'Super 8', TQ: 'Trademark Collection', TL: 'Travelodge', WT: 'TRYP', WG: 'Wingate', WR: 'Wyndham', WHG: 'Wyndham Grand' },
};
// Chinese names sent in English (rooms.aero geocodes Chinese too, 花蓮 worked on 2026-10-15, but English is surer)
const PLACE_EN = {
  台北: 'Taipei', 新北: 'New Taipei', 桃園: 'Taoyuan', 台中: 'Taichung', 台南: 'Tainan', 高雄: 'Kaohsiung', 花蓮: 'Hualien', 宜蘭: 'Yilan', 墾丁: 'Kenting',
  日月潭: 'Sun Moon Lake', 澎湖: 'Penghu', 東京: 'Tokyo', 大阪: 'Osaka', 京都: 'Kyoto', 奈良: 'Nara', 神戶: 'Kobe', 橫濱: 'Yokohama', 箱根: 'Hakone',
  輕井澤: 'Karuizawa', 名古屋: 'Nagoya', 福岡: 'Fukuoka', 札幌: 'Sapporo', 北海道: 'Hokkaido', 沖繩: 'Okinawa', 那霸: 'Naha', 廣島: 'Hiroshima', 金澤: 'Kanazawa',
  首爾: 'Seoul', 釜山: 'Busan', 濟州: 'Jeju', 濟州島: 'Jeju', 香港: 'Hong Kong', 澳門: 'Macau', 上海: 'Shanghai', 北京: 'Beijing', 廈門: 'Xiamen',
  廣州: 'Guangzhou', 深圳: 'Shenzhen', 成都: 'Chengdu', 杭州: 'Hangzhou', 新加坡: 'Singapore', 曼谷: 'Bangkok', 普吉島: 'Phuket', 清邁: 'Chiang Mai',
  峇里島: 'Bali', 雅加達: 'Jakarta', 吉隆坡: 'Kuala Lumpur', 檳城: 'Penang', 蘭卡威: 'Langkawi', 馬尼拉: 'Manila', 宿霧: 'Cebu', 長灘島: 'Boracay',
  胡志明市: 'Ho Chi Minh City', 河內: 'Hanoi', 峴港: 'Da Nang', 富國島: 'Phu Quoc', 暹粒: 'Siem Reap', 馬爾地夫: 'Maldives', 杜拜: 'Dubai', 阿布達比: 'Abu Dhabi',
  杜哈: 'Doha', 伊斯坦堡: 'Istanbul', 西雅圖: 'Seattle', 溫哥華: 'Vancouver', 多倫多: 'Toronto', 舊金山: 'San Francisco', 洛杉磯: 'Los Angeles',
  聖地牙哥: 'San Diego', 拉斯維加斯: 'Las Vegas', 波特蘭: 'Portland', 紐約: 'New York', 波士頓: 'Boston', 芝加哥: 'Chicago', 華盛頓: 'Washington DC',
  邁阿密: 'Miami', 奧蘭多: 'Orlando', 檀香山: 'Honolulu', 夏威夷: 'Hawaii', 茂宜島: 'Maui', 可愛島: 'Kauai', 坎昆: 'Cancun', 倫敦: 'London', 巴黎: 'Paris',
  羅馬: 'Rome', 米蘭: 'Milan', 威尼斯: 'Venice', 佛羅倫斯: 'Florence', 巴塞隆納: 'Barcelona', 馬德里: 'Madrid', 里斯本: 'Lisbon', 阿姆斯特丹: 'Amsterdam',
  柏林: 'Berlin', 慕尼黑: 'Munich', 法蘭克福: 'Frankfurt', 蘇黎世: 'Zurich', 維也納: 'Vienna', 布拉格: 'Prague', 布達佩斯: 'Budapest', 雅典: 'Athens',
  都柏林: 'Dublin', 愛丁堡: 'Edinburgh', 哥本哈根: 'Copenhagen', 斯德哥爾摩: 'Stockholm', 奧斯陸: 'Oslo', 卑爾根: 'Bergen', 赫爾辛基: 'Helsinki',
  雷克雅維克: 'Reykjavik', 冰島: 'Iceland', 雪梨: 'Sydney', 墨爾本: 'Melbourne', 布里斯本: 'Brisbane', 黃金海岸: 'Gold Coast', 奧克蘭: 'Auckland', 皇后鎮: 'Queenstown',
};
const POPULAR = ['台北', '東京', '大阪', '京都', '札幌', '沖繩', '首爾', '香港', '新加坡', '曼谷', '峇里島', '西雅圖', '檀香山', '茂宜島'];
const RANGE_DAYS = 30, AHEAD_DAYS = 365, PAGE = 20, TAKE = 500, CACHE_MS = 3600 * 1000, CACHE_KEEP = 8;
const FORM_KEY = 'award-hotels-form', PLACES_KEY = 'award-hotels-places', SORT_KEY = 'award-hotels-sort', CACHE_PREFIX = 'award-h:';
const LOC_RE = /^[\p{L}\p{M}\d ,.'-]{1,60}$/u;   // what the Worker accepts
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/* ---------- pictures (picture-book style: ink #3E3A39 outlines, the site's fills) ---------- */
const MASCOT_G = '<path d="M20 3v6"/><circle cx="20" cy="3" r="1.5" fill="#3E3A39"/><rect x="6" y="9" width="28" height="24" rx="9" fill="#F2A497"/><circle cx="14.5" cy="19" r="4.2" fill="#F6D27A"/><circle cx="25.5" cy="19" r="4.2" fill="#F6D27A"/><path d="M16.5 27q3.5 3 7 0"/><path d="M11 38l3-5M29 38l-3-5"/>';
const win = (x, y, lit) => '<rect x="' + x + '" y="' + y + '" width="13" height="11" rx="3" fill="' + (lit ? '#F6D27A' : '#FFFCF6') + '"/>';
// a hotel at night: moon, the H sign, lit windows, the mascot arriving with a suitcase
const HERO = '<svg viewBox="0 0 320 96" xmlns="http://www.w3.org/2000/svg"><g fill="none" stroke="#3E3A39" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">' +
  '<g class="float"><path d="M291 11a13 13 0 1 0 12 21 10 10 0 0 1-12-21z" fill="#F6D27A"/></g>' +
  '<path d="M259 17v7M255.5 20.5h7M241 37v5M238.5 39.5h5" stroke-width="2.4"/>' +
  '<g class="drift"><path d="M92 36h24a8 8 0 0 0-3-15 10 10 0 0 0-19-2 7 7 0 0 0-2 17z" fill="#FFFCF6"/></g>' +
  '<path d="M0 84q40-14 80-4t80 2 80-6 80 4v16H0z" fill="#B9DAA5"/>' +
  '<rect x="136" y="26" width="78" height="60" rx="8" fill="#F2A497"/>' +
  '<rect x="153" y="11" width="44" height="17" rx="6" fill="#F6D27A"/><path d="M168 15.5v8M182 15.5v8M168 19.5h14" stroke-width="2.6"/>' +
  win(146, 36, 1) + win(168.5, 36, 0) + win(191, 36, 1) + win(146, 54, 0) + win(191, 54, 1) +
  '<path d="M166 86V76a9 9 0 0 1 18 0v10" fill="#A8D3E6"/>' +
  '<path d="M247 84v-9"/><g class="sway"><circle cx="247" cy="66" r="10" fill="#B9DAA5"/></g>' +
  '<g transform="translate(34 40)"><g class="float">' + MASCOT_G + '</g></g>' +
  '<g class="sway"><path d="M86 61v-4h12v4"/><rect x="77" y="61" width="30" height="20" rx="4" fill="#F6D27A"/><path d="M84 61v20M100 61v20" stroke-width="2.6"/></g>' +
  '</g></svg>';
// a bed, for the navigation
const ICON = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><g fill="none" stroke="#3E3A39" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"><path d="M3.5 5v15M20.5 13v7"/><rect x="3.5" y="12.5" width="17" height="5" rx="1.5" fill="#A8D3E6"/><rect x="6" y="8" width="6.5" height="4.5" rx="2" fill="#F6D27A"/></g></svg>';
// in place of a hotel photo that is missing or does not load
const PH = '<div class="hotels-ph" aria-hidden="true"><svg viewBox="0 0 40 40"><g fill="none" stroke="#3E3A39" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"><rect x="8" y="9" width="24" height="26" rx="4" fill="#F2A497"/><path d="M14 16h3M23 16h3M14 23h3M23 23h3"/><path d="M17 35v-6h6v6" fill="#A8D3E6"/></g></svg></div>';
const LENS = '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="#3E3A39" stroke-width="2.6" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6" fill="#FFFCF6"/><path d="M15 15l5 5"/></g></svg>';

/* ---------- small helpers ---------- */
const todayIso = () => isoDate(new Date());
const utcToday = () => new Date().toISOString().slice(0, 10);
const plus = (iso, k) => { const d = parseDate(iso); d.setDate(d.getDate() + k); return isoDate(d); };
const isDay = v => typeof v === 'string' && DAY_RE.test(v) && isoDate(parseDate(v)) === v;
const int = v => (Number.isFinite(+v) && +v > 0 ? Math.round(+v) : 0);
const str = v => (v == null ? '' : String(v));
const fmt = x => Number(x).toLocaleString('en-US');
const https = u => (/^https:\/\/[^\s"'<>]+$/i.test(u) ? u : '');
const nightsText = k => (k === 1 ? t('1 晚') : t('{0} 晚', k));
// what a phone keyboard adds: full-width commas and spaces, curly apostrophes
const tidy = s => str(s).normalize('NFC').replace(/[’‘`]/g, "'").replace(/[，、]/g, ', ').replace(/[\s　]+/g, ' ').replace(/ ,/g, ',').trim();
// the place as typed, and what goes to rooms.aero (台北市 and 臺北 count as 台北)
function placeOf(text) {
  const typed = tidy(text), key = typed.replace(/臺/g, '台').replace(/ /g, '');
  const en = PLACE_EN[key] || (/[市縣都府]$/.test(key) && PLACE_EN[key.slice(0, -1)]) || '';
  return { typed, send: en || typed, en };
}
// smaller photos where the hotel's image server takes a width (checked 2026-10-15: IHG's 950 KB original is 23 KB)
function thumb(u) {
  u = https(u);
  if (/^https:\/\/digital\.ihg\.com\/is\/image\/[^?#]+$/.test(u)) return u + '?wid=640';
  if (/^https:\/\/assets\.hyatt\.com\/[^?#]+$/.test(u)) return u + '?imwidth=640';
  if (/^https:\/\/cache\.marriott\.com\//.test(u)) return u.replace(/([?&]downsize=)\d+px/, '$1640px');
  return u;
}

/* ---------- state ---------- */
function defaults() { const d0 = todayIso(); return { loc: '', s: plus(d0, 30), e: plus(d0, 33), nights: 1, src: [], max: '' }; }
function loadForm() {
  const f = Object.assign(defaults(), load(FORM_KEY, {})), d0 = todayIso();
  if (!isDay(f.s) || !isDay(f.e) || f.e < d0) { const d = defaults(); f.s = d.s; f.e = d.e; }
  if (f.s < d0) f.s = d0;
  if (f.e < f.s) f.e = f.s;
  if (daysBetween(f.s, f.e) > RANGE_DAYS) f.e = plus(f.s, RANGE_DAYS);
  f.nights = [1, 2, 3, 4, 5].includes(+f.nights) ? +f.nights : 1;
  f.src = Array.isArray(f.src) ? PROGS.map(p => p[0]).filter(k => f.src.includes(k)) : [];
  if (f.src.length === PROGS.length) f.src = [];
  f.loc = typeof f.loc === 'string' ? f.loc.slice(0, 60) : '';
  f.max = str(f.max).replace(/\D/g, '').slice(0, 7);
  return f;
}
const HS = {
  f: loadForm(),
  res: null,      // { q, rows, more, at (ms), cached }
  err: null,      // { kind, info, retry }, worded by errMsg() when drawn
  busy: false, seq: 0, shown: PAGE,
  sort: ['points', 'value', 'cash'].includes(load(SORT_KEY, 'points')) ? load(SORT_KEY, 'points') : 'points',
  quota: null,    // rooms.aero for the whole key: { remaining, limit, at (ms) }
  me: null,       // this account today: { used, limit (null = none), reserve, at (ms) }
  asked: 0, who: '',
};
const saveForm = () => save(FORM_KEY, HS.f);
const BROKEN = new Set();   // photo addresses that failed to load (two Marriott photos in Taipei were 404 on 2026-10-15)

// the search to send, from the form
function queryOf(f) {
  const p = placeOf(f.loc);
  return { loc: p.send, typed: p.typed, s: f.s, e: f.e, nights: f.nights, src: f.src.slice(), max: f.max ? +f.max : 0 };
}
// the form's problem, or ''
function formProblem(f) {
  const p = placeOf(f.loc), d0 = todayIso();
  if (!p.send) return t('請輸入地點，例如 東京 或 Maui。');
  if (!LOC_RE.test(p.send) || !/[\p{L}\d]/u.test(p.send)) return t('地點只能用文字、數字、空格和 , . - \'，最多 60 個字。');
  if (!isDay(f.s) || !isDay(f.e)) return t('請選入住日期。');
  if (f.e < d0) return t('這些日期已經過了。');
  // west of UTC in the evening, the local today is already over in UTC, where rooms.aero counts days
  if (f.e < utcToday()) return t('rooms.aero 用 UTC 日期，這些入住日期在 UTC 已經過了。請把最晚入住改到明天或更晚。');
  if (f.e < f.s) return t('最晚入住不能早於最早入住。');
  if (f.s > plus(d0, AHEAD_DAYS) || f.e > plus(d0, AHEAD_DAYS)) return t('入住日期最多只能查到一年後。');
  if (daysBetween(f.s < d0 ? d0 : f.s, f.e) > RANGE_DAYS) return t('入住日期最多相隔 30 天，請縮短一點。');
  if (f.max && !(+f.max >= 1 && +f.max <= 9999999)) return t('請輸入每晚最多幾點，例如 50000，或留空。');
  return '';
}

/* ---------- cache (sessionStorage, an hour) ---------- */
const MEMO = new Map();
// the points ceiling is not part of the key: a result holds every hotel, and the ceiling is applied when drawn
const keyOf = q => CACHE_PREFIX + JSON.stringify([q.loc.toLowerCase(), q.s, q.e, q.nights, q.src.join(',') || 'all']);
function cacheGet(k) {
  let v = MEMO.get(k);
  if (!v) { try { v = JSON.parse(sessionStorage.getItem(k)); } catch {} }
  if (v && Array.isArray(v.rows) && Date.now() - v.at < CACHE_MS) { MEMO.set(k, v); return v; }
  return null;
}
function cacheSet(k, v) {
  MEMO.set(k, v);
  try {
    const old = [];
    for (let i = 0; i < sessionStorage.length; i++) { const x = sessionStorage.key(i); if (x && x.startsWith(CACHE_PREFIX) && x !== k) old.push(x); }
    if (old.length >= CACHE_KEEP) {
      old.map(x => { let at = 0; try { at = JSON.parse(sessionStorage.getItem(x)).at || 0; } catch {} return [x, at]; })
        .sort((a, b) => a[1] - b[1]).slice(0, old.length - CACHE_KEEP + 1).forEach(([x]) => sessionStorage.removeItem(x));
    }
    sessionStorage.setItem(k, JSON.stringify(v));
  } catch { /* full: memory still has it */ }
}
// this search without a call: the same one, or fewer programs cut from an all-programs result
function fromCache(q) {
  const hit = cacheGet(keyOf(q));
  if (hit) return hit;
  if (!q.src.length) return null;
  const all = cacheGet(keyOf(Object.assign({}, q, { src: [] })));
  if (!all || all.more) return null;
  const keep = new Set(q.src);
  return { rows: all.rows.filter(x => keep.has(x.src)), more: false, at: all.at };
}

/* ---------- rooms.aero rows, kept small ---------- */
function rowOf(r) {
  const h = (r && r.hotel) || {};
  return {
    id: str(h.id), src: str(h.source), prog: str(h.program), name: str(h.name), brand: str(h.brand), cat: str(h.award_category), city: str(h.city),
    img: thumb(str(h.image_url)), url: https(str(h.url)),
    std: int(r.lowest_award_standard), suite: int(r.lowest_award_suite), cs: int(r.lowest_cash_standard), cu: int(r.lowest_cash_suite),
    cur: /^[A-Z]{3}$/.test(r.currency_code) ? r.currency_code : '',
    sd: isDay(r.standard_date) ? r.standard_date : '', sn: int(r.standard_nights), ud: isDay(r.suite_date) ? r.suite_date : '', un: int(r.suite_nights),
    cpp: +r.cpp > 0 && +r.cpp < 1000 ? +r.cpp : 0, chk: Math.floor(Date.parse(r.last_checked_at || '') / 1000) || 0,
  };
}
function rowsOf(body) {
  const seen = new Set(), out = [];
  for (const r of body.data) {
    const x = rowOf(r);
    if (!x.id || seen.has(x.id) || !(x.std || x.suite)) continue;   // pages can overlap; a hotel with no award is no use
    seen.add(x.id);
    out.push(x);
  }
  return out;
}

/* ---------- the Worker ---------- */
const RETRY = new Set(['network', 'rooms_down', 'http', 'bad', 'server', 'internal_error', 'seats_aero_unavailable']);
// the Worker's own answers, made without a rooms.aero call; any other code came from rooms.aero
const OWN = new Set(['param', 'rooms_quota', 'rooms_reserve', 'rooms_down', 'auth', 'server', 'forbidden', 'not_found']);
// the words for an error, worked out each time it is drawn, so they follow a language switch
function errText(code, b, status, q) {
  switch (code) {
    case 'param': return t('地點或日期的格式不對。');
    case 'server': return t(ERR.server);
    case 'rooms_quota': return t('你今天的 {0} 次飯店額度用完了，{1}重置。', b.limit, resetText());
    case 'rooms_reserve': return t('今天 rooms.aero 的額度快用完了，剩下的先留給管理員，{0}重置。', resetText());
    case 'rooms_down': return t('連不上 rooms.aero，等一下再試。');
    case 'location_not_found': return t('rooms.aero 找不到這個地點，換個寫法試試，例如英文城市名。');
    case 'too_many_hotels': return t('這個地區的飯店太多（超過 500 間）。少選幾個計畫，或把地點寫得更精確。');
    case 'invalid_parameter': case 'missing_parameter': {
      // rooms.aero's message names the parameter. Its days are UTC days: in a US evening, a range ending on the
      // local today is already over there, so say that plainly.
      const why = typeof b.message === 'string' ? b.message.slice(0, 200) : '';
      const past = q && q.e < utcToday();
      return (past ? t('rooms.aero 用 UTC 日期，這些入住日期在 UTC 已經過了。請把最晚入住改到明天或更晚。') : t('搜尋條件的格式不對。')) + (why ? t('（rooms.aero 說：{0}）', why) : '');
    }
    case 'user_subscription_expired': return t('seats.aero 的 Pro 訂閱已經過期，續訂之後才查得到。');
    case 'bad_partner_key': case 'missing_partner_key': case 'bad_partner_token': case 'invalid_scope': return t('rooms.aero 不接受這把 API key，要到 seats.aero 重新產生一把。');
    case 'user_rate_limit_exceeded': return t('今天 rooms.aero 的 1,000 次額度用完了，{0}重置。', resetText());
    case 'not_found': return t('飯店搜尋還沒開通，要等管理員更新伺服器。');
    case 'forbidden': return t(ERR.forbidden);
    default: return t('rooms.aero 暫時有問題（HTTP {0}），等一下再試。', status);
  }
}
// a newer reading of rooms.aero's count wins
function setSiteQuota(remaining, limit, at) {
  if (HS.quota && HS.quota.at > at) return;
  HS.quota = { remaining, limit: limit || 1000, at };
}
async function fetchHotels(q) {
  const qs = new URLSearchParams({ location: q.loc, start_date: q.s, end_date: q.e, nights: String(q.nights), take: String(TAKE) });
  if (q.src.length) qs.set('source', q.src.join(','));   // no max_points: the page applies the ceiling itself
  let r;
  try {
    r = await fetch(RELAY + '/hotels/search?' + qs, { headers: { Authorization: 'Bearer ' + getToken() } });
  } catch {
    throw new ApiError('network', t('連不上伺服器，請檢查網路。'));
  }
  const left = r.headers.get('X-Rooms-RateLimit-Remaining'), fromRooms = left !== null && left !== '' && !isNaN(left);
  if (fromRooms) setSiteQuota(+left, +r.headers.get('X-Rooms-RateLimit-Limit') || 1000, Date.now());
  let body = null;
  try { body = await r.json(); } catch {}
  const code = !r.ok && body && typeof body.error === 'string' ? body.error : '';
  // the Worker's counting rule: a call rooms.aero answered counts, unless it was a 401, a 429 or a 5xx
  if ((r.ok || fromRooms || !OWN.has(code)) && r.status !== 401 && r.status !== 429 && r.status < 500) countMine();
  if (r.ok) {
    if (body && Array.isArray(body.data)) return body;
    throw new ApiError('bad', t('rooms.aero 回傳的資料看不懂，等一下再試。'));
  }
  if (code === 'auth') { logout(t(ERR.auth), false); throw new ApiError('auth', t(ERR.auth)); }
  if (code === 'rooms_quota' && Number.isFinite(body.used)) HS.me = Object.assign({}, HS.me, { used: body.used, limit: body.limit, at: Date.now() });
  const err = new ApiError(code || 'http', errText(code, body || {}, r.status, q));
  err.info = { code, body: body || {}, status: r.status, q };   // to word it again in another language
  throw err;
}
// the words for a failed search, in the current language
function errMsg(e) {
  if (!e) return '';
  if (e.info) return errText(e.info.code, e.info.body, e.info.status, e.info.q);
  if (e.kind === 'network') return t('連不上伺服器，請檢查網路。');
  return t('rooms.aero 回傳的資料看不懂，等一下再試。');   // 'bad', or a reply the page could not use
}
// one more call on this account's own meter (the Worker writes it at the same time)
function countMine() {
  if (HS.me) HS.me = Object.assign({}, HS.me, { used: (HS.me.at >= lastReset() ? HS.me.used : 0) + 1, at: Date.now() });
}
// GET /hotels/quota (no rooms.aero call), at most once a minute
async function loadQuota(force) {
  if (!force && Date.now() - HS.asked < 60000) return;
  HS.asked = Date.now();
  try {
    const r = await call('GET', '/hotels/quota');
    if (r.remaining != null && r.at) setSiteQuota(r.remaining, r.limit, r.at * 1000);
    if (r.me) HS.me = { used: r.me.used || 0, limit: r.me.limit, reserve: r.me.reserve, at: Date.now() };
    paintMeter();
  } catch { /* the meter is extra */ }
}

/* ---------- search ---------- */
async function search(force) {
  if (HS.busy) return;   // Enter in a field while a search is running
  const problem = formProblem(HS.f);
  const ferr = $('#hotels-ferr');
  if (ferr) ferr.textContent = problem;
  if (problem) return;
  if (HS.f.s < todayIso()) { HS.f.s = todayIso(); paintDates(); }
  const q = queryOf(HS.f);
  HS.err = null;
  HS.shown = PAGE;
  const hit = !force && fromCache(q);
  if (hit) {
    HS.res = { q, rows: hit.rows, more: hit.more, at: hit.at, cached: true };
    if (hit.rows.length) rememberPlace(q.typed);
    paintResults();
    toResults();
    return;
  }
  const seq = ++HS.seq;
  HS.busy = true;
  HS.res = null;
  paintBusy();
  paintResults();
  try {
    const body = await fetchHotels(q);
    if (seq !== HS.seq) return;
    // rooms.aero filters by program itself; the page checks again, so a chosen program is never mixed with others
    const entry = { rows: rowsOf(body).filter(x => !q.src.length || q.src.includes(x.src)), more: !!body.has_more, at: Date.now() };
    cacheSet(keyOf(q), entry);
    HS.res = Object.assign({ q, cached: false }, entry);
    if (entry.rows.length) rememberPlace(q.typed);   // a place with nothing found is not offered again
  } catch (err) {
    if (seq !== HS.seq || err.kind === 'auth') return;
    // kept as data (not words), so a language switch words it again
    const kind = err instanceof ApiError ? err.kind : 'bad';
    HS.err = { kind, info: err.info || null, retry: RETRY.has(kind) };
  } finally {
    if (seq === HS.seq) {
      HS.busy = false;
      paintBusy();
      paintResults();
      paintMeter();
      toResults();
    }
  }
}
const toResults = () => {
  const el = $('#hotels-results');
  if (!el || $('#view-hotels').hidden) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  // a screen reader hears what came back: the count, nothing found, or the problem
  const live = $('#hotels-live'), R = HS.res, k = R ? listed(R).length : 0;
  if (live) live.textContent = HS.err ? errMsg(HS.err) : !R ? '' : k === 1 ? t('找到 1 間飯店') : k ? t('找到 {0} 間飯店', k) : nothingText(R, placeLabel(R.q.typed));
};
// nothing to list: no hotels at all, or none at or under the points ceiling (place: ready to put in the text)
const nothingText = (R, place) => (R.rows.length ? t('{0}找到的飯店，每晚都超過 {1} 點。', place, fmt(R.q.max)) : t('{0}在這段日期沒有找到有點數房的飯店。', place));
function rememberPlace(typed) {
  if (!typed) return;
  const same = x => placeOf(x).send.toLowerCase() === placeOf(typed).send.toLowerCase();
  save(PLACES_KEY, [typed].concat(load(PLACES_KEY, []).filter(x => typeof x === 'string' && !same(x))).slice(0, 4));
}

/* ---------- drawing ---------- */
function placeChips() {
  const shown = [], seen = new Set();
  const add = (label, send) => { const k = send.toLowerCase(); if (!seen.has(k)) { seen.add(k); shown.push(label); } };
  // places searched lately (with hotels found) first, then the common ones
  for (const x of load(PLACES_KEY, [])) if (typeof x === 'string' && x) add(placeLabel(x), placeOf(x).send);
  for (const zh of POPULAR) add(LANG === 'en' ? PLACE_EN[zh] : zh, PLACE_EN[zh]);
  return shown.slice(0, 14).map(x => '<button type="button" class="mchip" data-place="' + esc(x) + '">' + esc(x) + '</button>').join('');
}
// the line under the place: what goes to rooms.aero when that differs from what was typed
function hintText() {
  const p = placeOf(HS.f.loc);
  return p.en && p.en !== p.typed ? t('用 {0} 搜尋', p.en) : t('城市、島嶼或地區都可以');
}
// a place on screen: in English, a Chinese name that has an English one
const placeLabel = typed => { const p = placeOf(typed); return LANG === 'en' && p.en ? p.en : p.typed; };
const dateField = (id, label, v) => '<div class="field df"><label for="' + id + '"><span>' + label + '</span><small id="' + id + 'y"></small></label>' +
  '<span class="dv" id="' + id + 'v"></span><input type="date" id="' + id + '" value="' + esc(v) + '"></div>';
function formHtml() {
  const f = HS.f;
  return '<form class="card hotels-form" id="hotels-form" novalidate autocomplete="off">' +
    '<div class="hero" aria-hidden="true">' + HERO + '</div>' +
    '<div class="field hotels-loc"><label for="hotels-loc">' + t('地點') + '</label>' +
      '<input id="hotels-loc" value="' + esc(f.loc) + '" maxlength="60" placeholder="' + t('例：東京、Kyoto、Maui') + '" autocapitalize="words" autocorrect="off" spellcheck="false" enterkeyhint="search">' +
      '<div class="names" id="hotels-hint">' + esc(hintText()) + '</div></div>' +
    '<div class="months hotels-places" role="group" aria-label="' + t('常用地點') + '">' + placeChips() + '</div>' +
    '<div class="dates hotels-dates">' + dateField('hotels-d1', t('最早入住'), f.s) + '<span class="to" aria-hidden="true">' + t('到') + '</span>' + dateField('hotels-d2', t('最晚入住'), f.e) + '</div>' +
    '<div class="lbl" id="hotels-nl">' + t('每次住幾晚') + '</div>' +
    '<div class="seg hotels-n5" role="radiogroup" aria-labelledby="hotels-nl">' +
      [1, 2, 3, 4, 5].map(k => '<button type="button" role="radio" data-n="' + k + '" aria-checked="' + (f.nights === k) + '" aria-label="' + esc(nightsText(k)) + '">' + k + '</button>').join('') + '</div>' +
    '<div class="lbl" id="hotels-pl">' + t('計畫') + '</div>' +
    '<div class="hotels-progs" role="group" aria-labelledby="hotels-pl">' +
      '<button type="button" class="chip" data-src="" aria-pressed="' + !f.src.length + '">' + t('全部') + '</button>' +
      PROGS.map(([k, name]) => '<button type="button" class="chip" data-src="' + k + '" aria-pressed="' + f.src.includes(k) + '">' + esc(name) + '</button>').join('') + '</div>' +
    '<div class="field hotels-max"><label for="hotels-max">' + t('最多點數（每晚）') + '</label>' +
      '<input id="hotels-max" value="' + esc(f.max) + '" inputmode="numeric" maxlength="7" placeholder="' + t('不限，例：50000') + '" autocomplete="off" enterkeyhint="search"></div>' +
    '<p class="ferr" id="hotels-ferr" role="alert"></p>' +
    '<button class="go" type="submit" id="hotels-go">' + LENS + '<span id="hotels-go-t">' + t('搜尋飯店') + '</span></button>' +
    '</form>';
}
function paintDates() {
  const d0 = todayIso(), last = plus(d0, AHEAD_DAYS);
  for (const [id, v] of [['hotels-d1', HS.f.s], ['hotels-d2', HS.f.e]]) {
    const el = $('#' + id);
    if (!el) return;
    el.value = v;
    $('#' + id + 'v').textContent = v ? shortDay(v) : t('選日期');
    $('#' + id + 'y').textContent = v ? parseDate(v).getFullYear() : '';
  }
  $('#hotels-d1').min = d0;
  $('#hotels-d1').max = last;
  $('#hotels-d2').min = [HS.f.s, d0, utcToday()].sort().pop();   // the latest of the three (UTC: see formProblem)
  const cap = plus(HS.f.s > d0 ? HS.f.s : d0, RANGE_DAYS);
  $('#hotels-d2').max = cap < last ? cap : last;
}
function paintBusy() {
  const b = $('#hotels-go');
  if (!b) return;
  b.disabled = HS.busy;
  $('#hotels-go-t').textContent = HS.busy ? t('搜尋中…') : t('搜尋飯店');
}
function meterHtml() {
  const q = HS.quota, me = HS.me;
  if (!q && !me) return '';
  const fresh = !!(q && q.remaining != null && q.at >= lastReset());
  const siteLim = (q && q.limit) || 1000, siteUsed = fresh ? Math.max(0, siteLim - q.remaining) : 0;
  const mine = !!(ME && ME.role !== 'owner' && me && me.limit != null);
  const used = mine ? (me.at >= lastReset() ? me.used : 0) : siteUsed, lim = mine ? me.limit : siteLim;
  const pct = lim ? Math.min(100, used / lim * 100) : 100;
  const head = mine ? t('你今天已用 {0}/{1} 次', fmt(used), fmt(lim)) : t('今天已用 {0}/{1} 次', fmt(used), fmt(lim));
  const note = mine ? (fresh && me.reserve != null ? t('整個網站今天還剩 {0} 次，剩 {1} 次時會先留給管理員。', fmt(q.remaining), fmt(me.reserve)) : '') + t('每次搜尋用 1 次，{0}重置。', resetText())
    : t('rooms.aero 的額度跟機票分開算，每次搜尋用 1 次，{0}重置。', resetText());
  return '<div class="hotels-meter' + (pct >= 90 ? ' bad' : pct >= 70 ? ' warn' : '') + '"><span class="hotels-mt">' + t('飯店額度') + '</span>' +
    '<b class="hotels-mv">' + head + '</b><span class="qbar" aria-hidden="true"><i style="width:' + (used ? Math.max(pct, 4) : 0) + '%"></i></span><small>' + note + '</small></div>';
}
const paintMeter = () => { const el = $('#hotels-meter'); if (el) el.innerHTML = meterHtml(); };

const mainPts = x => x.std || x.suite || 1e12;
// the hotels to list: the points ceiling is applied to the price on the card (standard, or the suite when that is all)
const listed = R => (R.q.max ? R.rows.filter(x => mainPts(x) <= R.q.max) : R.rows);
const cashOf = x => (x.cs ? x.cs : x.cu);
const cashUSD = x => { const c = cashOf(x); if (!c) return 1e12; const u = toUSD(c, x.cur || 'USD'); return u == null ? c / 100 : u; };
const SORTS = {
  points: (a, b) => mainPts(a) - mainPts(b) || b.cpp - a.cpp,
  value: (a, b) => (b.cpp || -1) - (a.cpp || -1) || mainPts(a) - mainPts(b),
  cash: (a, b) => cashUSD(a) - cashUSD(b) || mainPts(a) - mainPts(b),
};
function catText(x) {
  if (!x.cat) return '';
  if (x.src === 'wyndham' && /^\d{3,6}$/.test(x.cat)) return t('{0} 點等級', fmt(+x.cat));
  if ((x.src === 'hyatt' || x.src === 'choice') && /^[0-9A-F]{1,2}$/.test(x.cat)) return t('第 {0} 類', x.cat);
  return '';
}
const stayText = (d, k) => (d ? t('{0}入住，住 {1}', mdw(d), nightsText(k || HS.res.q.nights)) : '');
function cardHtml(x) {
  const P = PROG[x.src] || { name: x.prog || x.src, url: '' };
  const su = !x.std, pts = x.std || x.suite;
  const brand = (BRANDS[x.src] || {})[x.brand], cat = catText(x);
  const pic = x.img && !BROKEN.has(x.img) ? '<img class="hotels-img" src="' + esc(x.img) + '" alt="' + esc(x.name) + '" loading="lazy" decoding="async" referrerpolicy="no-referrer">' : PH;
  const meta = '<span class="tag">' + esc(x.prog || P.name) + '</span>' + (brand ? '<span>' + esc(brand) + '</span>' : '') + (cat ? '<span>' + esc(cat) + '</span>' : '') +
    (x.city ? '<span>' + esc(x.city) + '</span>' : '');
  const main = su ? t('套房：{0}', stayText(x.ud, x.un)) : t('標準房：{0}', stayText(x.sd, x.sn));
  // the suite as a second line; its date only when it differs (its nights are always the searched ones)
  const suite = !su && x.suite ? '<p class="hotels-line">' + (x.ud && x.ud !== x.sd ? t('套房 {0} 點／晚：{1}入住', n(fmt(x.suite)), mdw(x.ud)) : t('套房 {0} 點／晚', n(fmt(x.suite)))) + '</p>' : '';
  const cash = x.cs ? t('現金每晚 {0}', moneyHtml(x.cs, x.cur || 'USD')) : x.cu ? t('套房現金每晚 {0}', moneyHtml(x.cu, x.cur || 'USD')) : t('沒有現金價');
  const links = (x.url ? '<a class="btn" href="' + esc(x.url) + '" target="_blank" rel="noopener">' + t('看所有日期') + '</a>' : '') +
    (P.url ? '<a class="btn ghost" href="' + esc(P.url) + '" target="_blank" rel="noopener">' + t('到 {0} 官網訂位', esc(P.name)) + '</a>' : '');
  return '<article class="hotels-card" data-id="' + esc(x.id) + '" data-prog="' + esc(x.src) + '">' +
    '<div class="hotels-pic">' + pic + '<div class="hotels-key' + (su ? ' su' : '') + '"><i aria-hidden="true"></i><b>' + fmt(pts) + '</b><small>' + t('點／晚') + '</small></div></div>' +
    '<div class="hotels-info"><h3>' + esc(x.name) + '</h3><p class="hotels-meta">' + meta + '</p>' +
      '<p class="hotels-line">' + main + '</p>' + suite +
      '<p class="hotels-money"><span class="hotels-cash">' + cash + '</span>' + (x.cpp ? '<span class="hotels-cpp">' + t('每點 {0} 美分', x.cpp.toFixed(2)) + '</span>' : '') + '</p>' +
      (x.chk ? '<p class="hotels-chk">' + t('上次查價：{0}', since(x.chk)) + '</p>' : '') +
      '<div class="hotels-acts">' + links + '</div></div></article>';
}
function listHtml() {
  const R = HS.res, list = listed(R).slice().sort(SORTS[HS.sort]);
  let h = '<div class="hotels-list">' + list.slice(0, HS.shown).map(cardHtml).join('') + '</div>';
  const rest = list.length - HS.shown;
  if (rest > 0) h += '<button type="button" class="more-btn hotels-more" data-more="1">' + t('再顯示 {0} 間（還有 {1} 間）', Math.min(PAGE, rest), rest) + '</button>';
  return h;
}
function sortHtml() {
  return '<div class="sortbar hotels-sort">' + t('排序') + [['points', t('點數最少')], ['value', t('每點最值')], ['cash', t('現金最低')]]
    .map(([k, x]) => '<button type="button" class="chip" data-sort="' + k + '" aria-pressed="' + (HS.sort === k) + '">' + x + '</button>').join('') + dispSeg() + '</div>';
}
function paintResults() {
  const box = $('#hotels-results');
  if (!box) return;
  if (HS.busy) { box.innerHTML = '<div class="skel"></div><div class="skel"></div><div class="skel"></div>'; return; }
  if (HS.err) {
    box.innerHTML = '<div class="banner bad"><b>' + t('查不到') + '</b>' + esc(errMsg(HS.err)) +
      (HS.err.retry ? '<div class="acts"><button type="button" class="btn" data-act="retry">' + t('再試一次') + '</button></div>' : '') + '</div>';
    return;
  }
  const R = HS.res;
  if (!R) {
    box.innerHTML = '<p class="note0 hotels-start">' + t('選好地點和日期，按「搜尋飯店」。每次搜尋用 1 次飯店額度，同樣的搜尋一小時內再看不用額度。') + '</p>';
    return;
  }
  const q = R.q, rows = listed(R), over = R.rows.length - rows.length;
  const filters = (q.src.length ? t('，只看 {0}', q.src.map(k => PROG[k].name).join(t('、'))) : '') + (q.max ? t('，每晚最多 {0} 點', fmt(q.max)) : '');
  const place = esc(placeLabel(q.typed));
  const what = t('{0}：{1} 到 {2} 入住，住 {3}', place, n(md(q.s)), n(md(q.e)), nightsText(q.nights)) + esc(filters);
  if (!rows.length) {
    box.innerHTML = '<p class="hotels-sum">' + what + '</p><div class="empty">' + MASCOT + nothingText(R, place) + '<br>' +
      (over ? t('把每晚最多點數調高或清空，就看得到這些飯店。') : t('可以換個日期、住幾晚或計畫；地名也可以改用英文，例如 Kyoto。')) + '</div>' + cachedNote(R);
    return;
  }
  const chk = rows.map(x => x.chk).filter(Boolean);
  const fresh = [chk.length ? t('查價時間：最新 {0}，最舊 {1}', since(Math.max(...chk)), since(Math.min(...chk))) : '',
    over ? t('另有 {0} 間每晚超過 {1} 點，沒有列出', over, fmt(q.max)) : '', R.more ? t('結果很多，只列出最便宜的 {0} 間。', R.rows.length) : '']
    .filter(Boolean).join(t('。'));
  box.innerHTML = '<p class="hotels-sum">' + what + '<b class="hotels-count">' + (rows.length === 1 ? t('找到 1 間飯店') : t('找到 {0} 間飯店', rows.length)) + '</b></p>' +
    '<p class="hotels-pn">' + t('點數和現金都是每晚的價格，住超過 1 晚時是每晚的平均。') + '</p>' +
    '<p class="fresh">' + fresh + '</p>' + cachedNote(R) + sortHtml() + '<div id="hotels-list">' + listHtml() + '</div>' +
    '<p class="note">' + t('rooms.aero 的快取資料，可能已經過時。訂房前請先到飯店官網確認還有房，也確認價格。') + '</p>';
}
const cachedNote = R => (R.cached ? '<p class="fresh">' + t('這是 {0}的結果，沒有再用額度', since(Math.floor(R.at / 1000))) + '</p>' : '');
const paintList = () => { const el = $('#hotels-list'); if (el && HS.res) el.innerHTML = listHtml(); };

/* ---------- the page ---------- */
function show(m, body) {
  if (ME && ME.email !== HS.who) { HS.who = ME.email; HS.me = null; HS.asked = 0; }   // another account signed in
  // the last results for this form are drawn again from the cache, without a call
  if (!HS.res && !HS.busy && !HS.err && !formProblem(HS.f)) {
    const q = queryOf(HS.f), hit = fromCache(q);
    if (hit) HS.res = { q, rows: hit.rows, more: hit.more, at: hit.at, cached: true };
  }
  body.innerHTML = formHtml() + '<div id="hotels-meter">' + meterHtml() + '</div><section id="hotels-results"></section><p class="vh" id="hotels-live" aria-live="polite"></p>';
  paintDates();
  paintBusy();
  paintResults();
  loadQuota(false);
}

// a moved date keeps the range valid: at most 30 days, 最晚入住 never before 最早入住, nothing past a year ahead
// (the pickers' max says so too, but an iPhone's date wheel lets any date through)
function onDate(which, v) {
  const f = HS.f, d0 = todayIso(), last = plus(d0, AHEAD_DAYS), said = [];
  if (!isDay(v)) { paintDates(); return; }   // the picker's Clear: keep the old date
  if (v > last) { v = last; said.push(t('入住日期最多只能查到一年後，已改成 {0}', shortDay(last))); }
  if (which === 's') {
    const span = Math.max(0, Math.min(RANGE_DAYS, daysBetween(f.s, f.e)));
    f.s = v < d0 ? d0 : v;
    if (f.e < f.s || f.e > last || daysBetween(f.s, f.e) > RANGE_DAYS) {
      const e = plus(f.s, span);
      f.e = e > last ? last : e;
      said.push(t('{0}已跟著改成 {1}', t('最晚入住'), shortDay(f.e)));
    }
  } else {
    f.e = v;
    if (f.e < f.s) { f.e = f.s; said.push(t('{0}不能早於{1}，已改成 {2}', t('最晚入住'), t('最早入住'), shortDay(f.e))); }
    else if (daysBetween(f.s, f.e) > RANGE_DAYS) {
      f.s = plus(f.e, -RANGE_DAYS);
      if (f.s < d0) { f.s = d0; f.e = plus(d0, RANGE_DAYS); }
      said.push(t('{0}已跟著改成 {1}', t('最早入住'), shortDay(f.s)));
    }
  }
  if (said.length) toast(said.join(t('；')));
  saveForm();
  paintDates();
}
function pressSrc(k) {
  let set = new Set(HS.f.src);
  if (!k) set = new Set();             // 全部
  else if (set.has(k)) set.delete(k);  // from 全部, the first tap picks only that program
  else set.add(k);
  HS.f.src = set.size === PROGS.length ? [] : PROGS.map(p => p[0]).filter(x => set.has(x));
  saveForm();
  for (const b of $$('#hotels-body .hotels-progs [data-src]')) b.setAttribute('aria-pressed', String(b.dataset.src ? HS.f.src.includes(b.dataset.src) : !HS.f.src.length));
}

/* ---------- admin: each account's hotel calls today and its 改飯店上限 button ---------- */
// The core admin page draws the account rows; this adds, to each, a 飯店 line under the seats.aero one and a button
// beside 改機票上限 (none on the owner's own row, which has no cap). Rows are found by their 產生重設連結 button,
// which every row has. A redraw while /admin/rooms is on its way just gets the lines on the next call.
async function adminRows() {
  let a;
  try { a = await call('GET', '/admin/rooms'); } catch (e) { return; }   // a Worker without the route: nothing to add
  for (const x of a.users) {
    const reset = document.querySelector('#admin-body [data-reset="' + x.id + '"]');
    const row = reset && reset.closest('.rowi');
    if (!row || row.querySelector('.rooms-use')) continue;
    const line = t('飯店：') + (x.limit == null ? t('今天用了 {0} 次（不限）', x.used) : x.rooms_limit == null ? t('今天用了 {0} 次／上限 {1}（預設）', x.used, x.limit) : t('今天用了 {0} 次／上限 {1}', x.used, x.limit));
    const first = row.querySelector('.main small span');
    if (first) first.insertAdjacentHTML('afterend', '<span class="rooms-use">' + esc(line) + '</span>');
    const lim = row.querySelector('[data-limit]');
    if (lim && x.limit != null) lim.insertAdjacentHTML('afterend', '<button type="button" class="btn ghost" data-rlimit="' + x.id + '" data-cur="' + (x.rooms_limit ?? '') + '" data-def="' + a.default_limit + '">' + esc(t('改飯店上限')) + '</button>');
  }
}
document.addEventListener('click', async e => {
  const b = e.target.closest && e.target.closest('[data-rlimit]');
  if (!b) return;
  const def = +b.dataset.def || 100;
  const v = prompt(t('這個帳號每天最多可以搜尋幾次飯店（rooms.aero 額度）？') + '\n' + t('輸入 0 到 1000；留空 = 預設 {0} 次。', def), b.dataset.cur);
  if (v === null) return;
  const limit = v.trim() === '' ? null : Number(v.trim());
  if (limit !== null && !(Number.isInteger(limit) && limit >= 0 && limit <= 1000)) { toast(t('請輸入 0 到 1000 的整數，或留空')); return; }
  try {
    await call('POST', '/admin/users/' + b.dataset.rlimit + '/rooms-limit', { limit });
    toast(limit === null ? t('飯店上限已改回預設 {0} 次', def) : t('飯店每日上限已改成 {0} 次', limit));
    loadAdmin();
  } catch (err) { toast(err.message); }
});

addFeature({
  id: 'hotels',
  title: '飯店',
  route: '#/hotels',
  back: '#/',
  nav: { tab: 'hotels', order: 10, label: '飯店', icon: ICON },
  css: `
#view-hotels .vhead .back{position:relative}
#view-hotels .vhead .back::after{content:'';position:absolute;inset:-9px -2px}
.hotels-places .mchip::after{inset:-7px -2px}
.hotels-form .hero{margin-bottom:10px}
.hotels-loc,.hotels-max{cursor:text}
.hotels-loc input{font-size:19px}
.hotels-places{margin:8px 0 0}
.hotels-dates{margin-top:8px}
.hotels-form .lbl{margin:12px 0 6px}
.seg.hotels-n5{grid-template-columns:repeat(5,minmax(0,1fr))}
.seg.hotels-n5 button,html[lang=en] .seg.hotels-n5 button{min-height:42px;font-size:17px;font-variant-numeric:tabular-nums}
.hotels-progs{display:flex;flex-wrap:wrap;gap:8px 6px}
.hotels-progs .chip{min-height:40px;padding:2px 13px}
.hotels-max{margin-top:12px}
.hotels-form .ferr{margin:10px 0 0}
#hotels-meter:empty{display:none}
.hotels-meter{display:grid;grid-template-columns:auto minmax(0,1fr);align-items:baseline;gap:4px 10px;border:2px solid var(--ink);border-radius:14px;padding:6px 12px 8px;background:var(--paper);margin:0 0 14px}
.hotels-mt{font-size:13px;color:var(--ink2);white-space:nowrap}
.hotels-mv{font-size:15px;text-align:right;font-variant-numeric:tabular-nums}
.hotels-meter .qbar{grid-column:1/-1}
.hotels-meter small{grid-column:1/-1;font-size:12px;line-height:1.5;color:var(--ink2)}
.hotels-meter.warn .qbar i{background:var(--yellow)}
.hotels-meter.bad .qbar i{background:var(--coral)}
#hotels-results{scroll-margin-top:calc(var(--hh) + 6px)}
.hotels-start{margin:0 2px}
.hotels-sum{font-size:15px;margin:2px 0 0}
.hotels-count{display:block;font-size:20px;margin-top:2px}
.hotels-pn{font-size:13px;margin:8px 0 4px;padding:6px 12px;border:2px dashed var(--ink);border-radius:14px;background:var(--yellow-t)}
.hotels-sort{margin-top:10px}
.hotels-sort .chip{min-height:40px}
.hotels-sort .dseg button{position:relative}
.hotels-sort .dseg button::after{content:'';position:absolute;inset:-10px -2px}
.hotels-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px 14px;margin:12px 0 4px}
.hotels-card{min-width:0;border:var(--line);border-radius:var(--r);background:var(--paper);padding:8px 8px 12px}
.hotels-pic{position:relative;height:clamp(96px,30vw,150px);border:var(--line);border-radius:16px;background:var(--water-t)}
.hotels-img{display:block;width:100%;height:100%;object-fit:cover;border-radius:13px}
.hotels-ph{display:grid;place-items:center;height:100%}
.hotels-ph svg{width:56px;height:56px}
.hotels-key{position:absolute;left:12px;bottom:-19px;display:inline-flex;align-items:center;gap:6px;max-width:calc(100% - 24px);border:var(--line);border-radius:12px 999px 999px 12px;background:var(--yellow);padding:2px 15px 2px 9px;line-height:1.25;white-space:nowrap;transform:rotate(-2deg)}
.hotels-key i{flex:0 0 12px;width:12px;height:12px;border:2px solid var(--ink);border-radius:50%;background:var(--paper)}
.hotels-key b{font-size:22px;letter-spacing:-.2px;font-variant-numeric:tabular-nums}
.hotels-key small{font-size:12px}
.hotels-key.su{background:var(--coral-t)}
.hotels-info{padding:27px 4px 0}
.hotels-info h3{font-size:17px;line-height:1.35;margin:0 0 4px;overflow-wrap:anywhere}
.hotels-meta{display:flex;flex-wrap:wrap;align-items:center;gap:3px 10px;margin:0 0 6px;font-size:13px;color:var(--ink2)}
.hotels-meta .tag{color:var(--ink)}
.hotels-line{margin:3px 0 0;font-size:14px}
.hotels-money{display:flex;flex-wrap:wrap;align-items:baseline;gap:2px 14px;margin:6px 0 0;font-size:14px;font-variant-numeric:tabular-nums}
.hotels-money .fx{font-size:11px;color:var(--ink2);margin-left:4px}
.hotels-chk{margin:6px 0 0;font-size:12px;color:var(--ink2)}
.hotels-acts{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
.hotels-acts .btn{display:inline-flex;align-items:center;min-height:40px;font-size:14px}
.hotels-more{min-height:42px}
#hotels-body .banner .btn{display:inline-flex;align-items:center;min-height:40px}
@media (max-width:359px){.hotels-key b{font-size:20px}}
`,
  en: {
    '飯店': 'Hotels',
    '地點': 'Place',
    '例：東京、Kyoto、Maui': 'e.g. Tokyo, Kyoto, Maui',
    '用 {0} 搜尋': 'Searches for {0}',
    '城市、島嶼或地區都可以': 'A city, island or region',
    '常用地點': 'Popular places',
    '最早入住': 'Check-in from',
    '最晚入住': 'Check-in to',
    '每次住幾晚': 'Nights per stay',
    '1 晚': '1 night',
    '{0} 晚': '{0} nights',
    '計畫': 'Programs',
    '全部': 'All',
    '最多點數（每晚）': 'Max points a night',
    '不限，例：50000': 'No limit, e.g. 50000',
    '搜尋飯店': 'Search hotels',
    '飯店額度': 'Hotel quota',
    '今天已用 {0}/{1} 次': '{0} of {1} used today',
    '你今天已用 {0}/{1} 次': 'You used {0} of {1} today',
    'rooms.aero 的額度跟機票分開算，每次搜尋用 1 次，{0}重置。': 'rooms.aero has its own quota, separate from flights. Each search uses 1, and it resets {0}.',
    '整個網站今天還剩 {0} 次，剩 {1} 次時會先留給管理員。': 'The whole site has {0} left today, and the last {1} are kept for the owner. ',
    '每次搜尋用 1 次，{0}重置。': 'Each search uses 1, and it resets {0}.',
    '選好地點和日期，按「搜尋飯店」。每次搜尋用 1 次飯店額度，同樣的搜尋一小時內再看不用額度。': 'Pick a place and dates, then tap "Search hotels". Each search uses 1 call of the hotel quota, and the same search again within an hour uses none.',
    '{0}：{1} 到 {2} 入住，住 {3}': '{0}: check-in {1} to {2}, {3}',
    '，每晚最多 {0} 點': ', up to {0} points a night',
    '找到 1 間飯店': '1 hotel',
    '找到 {0} 間飯店': '{0} hotels',
    '點數和現金都是每晚的價格，住超過 1 晚時是每晚的平均。': 'Points and cash are per night. For longer stays they are the nightly average.',
    '查價時間：最新 {0}，最舊 {1}': 'Checked: newest {0}, oldest {1}',
    '結果很多，只列出最便宜的 {0} 間。': 'Many results: only the cheapest {0} are listed.',
    '這是 {0}的結果，沒有再用額度': 'Results from {0}, no quota used',
    '點數最少': 'Fewest points',
    '每點最值': 'Best value',
    '現金最低': 'Lowest cash',
    '點／晚': 'pts/night',
    '標準房：{0}': 'Standard room: {0}',
    '套房：{0}': 'Suite: {0}',
    '{0}入住，住 {1}': 'check-in {0}, {1}',
    '套房 {0} 點／晚': 'Suite {0} pts/night',
    '套房 {0} 點／晚：{1}入住': 'Suite {0} pts/night: check-in {1}',
    '現金每晚 {0}': 'Cash a night: {0}',
    '套房現金每晚 {0}': 'Suite cash a night: {0}',
    '沒有現金價': 'No cash rate',
    '每點 {0} 美分': '{0}¢ per point',
    '上次查價：{0}': 'Last checked {0}',
    '看所有日期': 'See all dates',
    '第 {0} 類': 'Category {0}',
    '{0} 點等級': '{0}-point tier',
    '再顯示 {0} 間（還有 {1} 間）': 'Show {0} more ({1} left)',
    '{0}在這段日期沒有找到有點數房的飯店。': 'No hotels with award rooms in {0} on these dates.',
    '可以換個日期、住幾晚或計畫；地名也可以改用英文，例如 Kyoto。': 'Try other dates, nights or programs, or write the place in English, such as Kyoto.',
    '{0}找到的飯店，每晚都超過 {1} 點。': 'Every hotel found in {0} costs more than {1} points a night.',
    '把每晚最多點數調高或清空，就看得到這些飯店。': 'Raise or clear the max points a night to see them.',
    '另有 {0} 間每晚超過 {1} 點，沒有列出': 'Not listed: {0} over {1} points a night',
    'rooms.aero 的快取資料，可能已經過時。訂房前請先到飯店官網確認還有房，也確認價格。': "This is rooms.aero's cached data and may be out of date. Check rooms and prices on the hotel's own site before you book.",
    '請輸入地點，例如 東京 或 Maui。': 'Enter a place, such as Tokyo or Maui.',
    '地點只能用文字、數字、空格和 , . - \'，最多 60 個字。': "A place can use only letters, digits, spaces and , . - ' (up to 60 characters).",
    '請選入住日期。': 'Pick the check-in dates.',
    '最晚入住不能早於最早入住。': "Check-in to can't be before Check-in from.",
    '入住日期最多相隔 30 天，請縮短一點。': 'Check-in dates can be 30 days apart at most. Please shorten the range.',
    '請輸入每晚最多幾點，例如 50000，或留空。': 'Enter the most points a night, such as 50000, or leave it blank.',
    '地點或日期的格式不對。': "The place or dates aren't in a valid format.",
    '你今天的 {0} 次飯店額度用完了，{1}重置。': "You've used all {0} of your hotel searches for today. The quota resets {1}.",
    '入住日期最多只能查到一年後。': 'Check-in dates can be at most a year ahead.',
    '入住日期最多只能查到一年後，已改成 {0}': 'Check-in dates can be at most a year ahead, so it is now {0}',
    'rooms.aero 用 UTC 日期，這些入住日期在 UTC 已經過了。請把最晚入住改到明天或更晚。': 'rooms.aero counts days in UTC, where these check-in dates have already passed. Set the last check-in date to tomorrow or later.',
    '（rooms.aero 說：{0}）': ' (rooms.aero says: {0})',
    '今天 rooms.aero 的額度快用完了，剩下的先留給管理員，{0}重置。': "The site's rooms.aero quota for today is almost used up, and the rest is kept for the owner. It resets {0}.",
    '連不上 rooms.aero，等一下再試。': "Can't reach rooms.aero. Try again in a moment.",
    'rooms.aero 找不到這個地點，換個寫法試試，例如英文城市名。': "rooms.aero can't find this place. Try writing it another way, such as the city's English name.",
    '這個地區的飯店太多（超過 500 間）。少選幾個計畫，或把地點寫得更精確。': 'This area has too many hotels (over 500). Pick fewer programs, or make the place more specific.',
    'rooms.aero 不接受這把 API key，要到 seats.aero 重新產生一把。': 'rooms.aero rejected the API key. Generate a new one on seats.aero.',
    '今天 rooms.aero 的 1,000 次額度用完了，{0}重置。': "Today's rooms.aero quota of 1,000 calls is used up. It resets {0}.",
    'rooms.aero 暫時有問題（HTTP {0}），等一下再試。': 'rooms.aero is having trouble (HTTP {0}). Try again in a moment.',
    'rooms.aero 回傳的資料看不懂，等一下再試。': "Couldn't read the data from rooms.aero. Try again in a moment.",
    '飯店搜尋還沒開通，要等管理員更新伺服器。': "Hotel search isn't switched on yet: the owner has to update the server.",
    '飯店：': "Hotels: ",
    '改飯店上限': "Change hotel limit",
    '這個帳號每天最多可以搜尋幾次飯店（rooms.aero 額度）？': "How many hotel searches (rooms.aero calls) can this account make per day?",
    '輸入 0 到 1000；留空 = 預設 {0} 次。': "Enter 0 to 1000, or leave blank for the default of {0}.",
    '飯店上限已改回預設 {0} 次': "Hotel limit back to the default of {0}",
    '飯店每日上限已改成 {0} 次': "Hotel daily limit set to {0}",
  },
  show,
  onAdminPage() { adminRows(); },
  // another account signed in: its own meter. Opening the site on #/hotels draws the page (and asks for the meter)
  // just before this runs, so the same account asks nothing more.
  onAuth() {
    const changed = !!ME && ME.email !== HS.who;
    if (changed) { HS.who = ME.email; HS.me = null; HS.asked = 0; }
    if (changed && !$('#view-hotels').hidden) loadQuota(true);
  },
  // for tests: the pure parts and the state
  _test: { placeOf, thumb, tidy, rowOf, queryOf, formProblem, keyOf, state: HS, SORTS, errText, errMsg, fetchHotels, RETRY, listed, onDate, search },
});

// every control is delegated on the page body, which stays while show() redraws its inside
const body = $('#hotels-body');
body.addEventListener('submit', e => {
  if (e.target.id !== 'hotels-form') return;
  e.preventDefault();
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();   // close the keyboard
  search(false);
});
body.addEventListener('click', e => {
  // a tap anywhere in the place or points box goes to its input, so the whole box is the target
  const fld = e.target.closest('.hotels-loc, .hotels-max');
  if (fld && e.target.tagName !== 'INPUT') { fld.querySelector('input').focus(); return; }
  const el = e.target.closest('button, input[type=date]');
  if (!el) return;
  if (el.type === 'date') { try { el.showPicker(); } catch {} return; }
  const d = el.dataset;
  if (d.place != null) {
    HS.f.loc = d.place;
    $('#hotels-loc').value = d.place;
    $('#hotels-hint').textContent = hintText();
    $('#hotels-ferr').textContent = '';
    saveForm();
  } else if (d.n) {
    HS.f.nights = +d.n;
    for (const b of $$('#hotels-body [data-n]')) b.setAttribute('aria-checked', String(b === el));
    saveForm();
  } else if (d.src != null && el.closest('.hotels-progs')) pressSrc(d.src);
  else if (d.sort) {
    HS.sort = d.sort;
    save(SORT_KEY, HS.sort);
    HS.shown = PAGE;
    for (const b of $$('#hotels-body [data-sort]')) b.setAttribute('aria-pressed', String(b === el));
    paintList();
  } else if (d.more) {
    // the button goes away with the redraw: focus moves to the first new hotel, so a keyboard or VoiceOver user
    // carries on from there instead of from the top of the page
    const from = HS.shown;
    HS.shown += PAGE;
    paintList();
    const h = $$('#hotels-list .hotels-card h3')[from];
    if (h) { h.tabIndex = -1; h.focus(); }
  }
  else if (d.act === 'retry') search(true);
  else if (d.disp) setTimeout(paintList, 0);   // after the page's own handler has switched the currency
});
body.addEventListener('input', e => {
  if (e.target.id === 'hotels-loc') {
    HS.f.loc = e.target.value.slice(0, 60);
    $('#hotels-hint').textContent = hintText();
    $('#hotels-ferr').textContent = '';
    saveForm();
  } else if (e.target.id === 'hotels-max') {
    HS.f.max = e.target.value.replace(/\D/g, '').slice(0, 7);
    $('#hotels-ferr').textContent = '';
    saveForm();
  }
});
body.addEventListener('change', e => {
  if (e.target.id === 'hotels-d1') onDate('s', e.target.value);
  else if (e.target.id === 'hotels-d2') onDate('e', e.target.value);
});
// a hotel photo that fails to load gives way to the drawing, and is not asked for again this visit
body.addEventListener('error', e => {
  const img = e.target;
  if (!img || !img.classList || !img.classList.contains('hotels-img')) return;
  BROKEN.add(img.getAttribute('src'));
  img.outerHTML = PH;
}, true);
})();
