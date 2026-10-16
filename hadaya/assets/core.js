/* ================================================================
   الإعدادات الافتراضية — كلها تتغير بعدين من لوحة التحكم
   ================================================================ */
const DEFAULTS = {
  store: 'غين للتقنية',
  title: 'امسح الكود',
  titleAccent: 'واكسب هديتك',
  subtitle: 'صوّر أي كود بكاميرا جوالك، اكتب اسمك ورقمك، وجرّب حظك.',
  server: 'https://ntfy.sh',   // خادم ربط مجاني بين الأجهزة، تقدر تحط خادم ntfy خاص بيك
  pageURL: '',                 // رابط فولدر الموقع بعد الرفع (لو فاضي بياخد الرابط الحالي)
  liveCodes: 28,
  revealSeconds: 11,
  onePerPhone: true,           // محاولة واحدة بس لكل رقم جوال في الحملة (كسب أو حظ أوفر)
  loseChance: 20,              // نسبة «حظ أوفر المرة القادمة» % — أكواد من غير هدية
  // الاسم | الأيقونة | الكمية | نسبة الفوز %
  prizes: [
    ['سماعة لاسلكية','headphones',10,4], ['سبيكر بلوتوث','speaker',8,4], ['يد تحكم ألعاب','gamepad',4,2],
    ['ساعة ذكية','watch',5,2], ['باور بانك 20 ألف','powerbank',12,6], ['شاحن سريع 20 واط','charger',30,14],
    ['كفر جوال','case',40,18], ['كيبل شحن','cable',45,20], ['خصم 10% على مشترياتك','tag',20,10],
  ],
};
const SALT = 'hadaya-v3';
const LOSE = 'nil';            // prize id of a "better luck next time" code
const KEY = 'hadaya-v3';

const ICONS = {
  headphones:['سماعة','<path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="14" width="4.5" height="6.5" rx="1.6"/><rect x="16.5" y="14" width="4.5" height="6.5" rx="1.6"/>'],
  speaker:['سبيكر','<rect x="7" y="2.5" width="10" height="19" rx="3"/><circle cx="12" cy="14.5" r="3.2"/><circle cx="12" cy="7" r="1.2"/>'],
  gamepad:['يد تحكم','<path d="M7 8h10a4 4 0 0 1 4 4.5l-.6 4a2.5 2.5 0 0 1-4.4 1.2L14.5 16h-5L8 17.7a2.5 2.5 0 0 1-4.4-1.2l-.6-4A4 4 0 0 1 7 8z"/><path d="M8 10.8v3.4M6.3 12.5h3.4"/><circle cx="15.5" cy="11.5" r=".9"/><circle cx="17.5" cy="13.5" r=".9"/>'],
  watch:['ساعة','<rect x="6" y="6" width="12" height="12" rx="3"/><path d="M9 6l1-3.5h4L15 6M9 18l1 3.5h4l1-3.5"/><path d="M12 9.5V12l1.8 1.2"/>'],
  powerbank:['باور بانك','<rect x="6" y="3" width="12" height="18" rx="2.5"/><path d="M12.8 7.5l-2.8 4.5h4l-2.8 4.5"/>'],
  charger:['شاحن','<rect x="6" y="9" width="12" height="11" rx="2.5"/><path d="M9.5 9V4M14.5 9V4M12 13v3"/>'],
  case:['كفر','<rect x="6" y="2.5" width="12" height="19" rx="3"/><rect x="8.3" y="4.8" width="4.2" height="4.2" rx="1.3"/>'],
  cable:['كيبل','<path d="M9 2.5v3.5M13 2.5v3.5"/><rect x="7.5" y="6" width="7" height="5.5" rx="1.2"/><path d="M11 11.5v3a4.5 4.5 0 0 0 4.5 4.5H21"/>'],
  tag:['خصم','<path d="M3.5 12.5l8-8H20v8.5l-8 8z"/><circle cx="16" cy="8" r="1.4"/><path d="M9.5 15.5l4-4"/>'],
  gift:['هدية','<rect x="3.5" y="8" width="17" height="4" rx="1"/><path d="M5 12v8h14v-8M12 8v12M12 8c-1.5-3-5-4-5.5-2S9 8 12 8zm0 0c1.5-3 5-4 5.5-2S15 8 12 8z"/>'],
  cup:['كوب','<path d="M5 8h11v6a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z"/><path d="M16 10h1.5a2.5 2.5 0 0 1 0 5H16M8 3.5v2M11 3v2.5M14 3.5v2"/>'],
};
const UI = {
  heart:'<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 7.5 2.8C19.5 15.4 12 20 12 20z"/>',
  scan:'<path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16M4 12h16"/>',
  expand:'<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  tv:'<rect x="3" y="4.5" width="18" height="12" rx="2"/><path d="M8 20h8M12 16.5V20"/>',
  check:'<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  trash:'<path d="M4.5 7h15M10 11v6M14 11v6M6 7l1 12.5h10L18 7M9 7V4.5h6V7"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  copy:'<rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M15.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5"/>',
  hand:'<path d="M7 11V6.5a1.5 1.5 0 0 1 3 0V11M10 10V4.5a1.5 1.5 0 0 1 3 0V10M13 10.5V5.5a1.5 1.5 0 0 1 3 0V12M16 9.5a1.5 1.5 0 0 1 3 0V14a7 7 0 0 1-7 7h-.5a6.5 6.5 0 0 1-5.4-2.9L3.6 14.5a1.6 1.6 0 0 1 2.5-2L7 13.5"/>',
  clock:'<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  user:'<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/>',
  phone:'<path d="M6.5 3.5h3l1.5 4-2 1.5a11 11 0 0 0 6 6l1.5-2 4 1.5v3a2 2 0 0 1-2 2A16.5 16.5 0 0 1 4.5 5.5a2 2 0 0 1 2-2z"/>',
  download:'<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19.5h14"/>',
  lock:'<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
};
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const svg = (paths, cls='ic') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
const pIcon = p => p && p.img ? `<img src="${esc(p.img)}" alt="">` : svg((ICONS[p && p.icon] || ICONS.gift)[1], '');
const ui = k => svg(UI[k] || ICONS[k][1]);
const $ = (sel, root=document) => root.querySelector(sel);
const fmt = n => Number(n || 0).toLocaleString('en');
const timeAgo = t => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'دلوقتي' : m < 60 ? `من ${m} د` : `من ${Math.round(m/60)} س`; };
const clock = t => new Date(t).toLocaleTimeString('ar-EG', { hour:'numeric', minute:'2-digit' });
const brandHTML = name => `<div class="brand"><span class="mark initial">${esc((name || 'غ').trim().charAt(0))}</span><b>${esc(name)}</b></div>`;
const giftHTML = (prize, cls='') => `<div class="gift ${cls}"><div class="prize-pop">${pIcon(prize)}</div><div class="base"></div><div class="lid"></div></div>`;
const firstName = n => String(n || '').trim().split(/\s+/)[0] || '';

/* ---------- phone numbers ---------- */
const normPhone = v => String(v || '').replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '');
const validPhone = v => { const d = normPhone(v).replace('+', ''); return d.length >= 8 && d.length <= 15; };
const maskPhone = v => { const d = normPhone(v); return d.length < 6 ? d : d.slice(0, 3) + '•'.repeat(Math.max(2, d.length - 5)) + d.slice(-2); };

/* ---------- ids & codes ---------- */
const ALPH = 'abcdefghijkmnpqrstuvwxyz23456789';
const rand = n => Array.from(crypto.getRandomValues(new Uint8Array(n)), b => ALPH[b % 32]).join('');
function hash(str){ let h = 2166136261; for (let i=0;i<str.length;i++){ h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return (h>>>0).toString(36); }
const sign = (pid, n, topic) => hash(`${pid}|${n}|${topic}|${SALT}`).slice(0,3);
const makeG = (pid, topic) => { const n = rand(6); return `${pid}-${n}-${sign(pid,n,topic)}`; };
function parseG(g, topic){
  const m = /^([a-z0-9]{3})-([a-z0-9]{6})-([a-z0-9]{1,3})$/.exec(g || '');
  return m && sign(m[1], m[2], topic) === m[3] ? { pid:m[1], n:m[2] } : null;
}
const codeOf = n => 'GF-' + n.toUpperCase();

/* ---------- crypto: customer details travel sealed to the screen ---------- */
const b64 = buf => { let s = ''; new Uint8Array(buf).forEach(b => s += String.fromCharCode(b)); return btoa(s); };
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const RSA = { name:'RSA-OAEP', hash:'SHA-256' };
async function genKeys(){
  const k = await crypto.subtle.generateKey(Object.assign({ modulusLength:2048, publicExponent:new Uint8Array([1,0,1]) }, RSA), true, ['encrypt','decrypt']);
  const pub = await crypto.subtle.exportKey('jwk', k.publicKey), priv = await crypto.subtle.exportKey('jwk', k.privateKey);
  return { pub: { kty:pub.kty, n:pub.n, e:pub.e, alg:pub.alg }, priv, kid: hash(pub.n).slice(0, 6) };
}
async function seal(pub, obj){
  const key = await crypto.subtle.importKey('jwk', Object.assign({ ext:true, key_ops:['encrypt'] }, pub), RSA, false, ['encrypt']);
  return b64(await crypto.subtle.encrypt({ name:'RSA-OAEP' }, key, new TextEncoder().encode(JSON.stringify(obj))));
}
async function unseal(priv, s){
  const key = await crypto.subtle.importKey('jwk', priv, RSA, false, ['decrypt']);
  return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({ name:'RSA-OAEP' }, key, unb64(s))));
}

/* ================================================================
   ENGINE — the codes screen is the source of truth. The dashboard
   edits the same record when it runs in the same browser, and
   sends commands to the screen when it runs on another device.
   ================================================================ */
let memory = null;
const Engine = {
  load(){ try { const v = localStorage.getItem(KEY); if (v) return JSON.parse(v); } catch {} return memory && JSON.parse(JSON.stringify(memory)); },
  save(s){ memory = s; try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {} },
  fresh(){
    return { v:3, topic:'gh-' + rand(10), key: rand(18), keys:null, keyAt:0,
      cfg: Object.assign({}, DEFAULTS, { prizes: DEFAULTS.prizes.map(([name, icon, n, chance]) => ({ id: rand(3), name, icon, img:'', total:n, left:n, chance })) }),
      live:[], used:[], winners:[], tries:[], scans:[] };
  },
  init(){
    let s = this.load(); if (!s || s.v !== 3) s = this.fresh();
    const total = s.cfg.prizes.reduce((a, p) => a + (+p.total || 0), 0) || 1;   // older records: start from the stock share
    s.cfg.prizes.forEach(p => { if (p.chance == null) p.chance = Math.round((+p.total || 0) / total * 1000) / 10; });
    if (s.cfg.loseChance == null) s.cfg.loseChance = DEFAULTS.loseChance;
    s.tries = s.tries || [];
    topUp(s); this.save(s); return s;
  },
  mutate(fn){ const s = this.load() || this.init(); const r = fn(s); this.save(s); return [s, r]; },
};
const prizeById = (s, id) => s.cfg.prizes.find(p => p.id === id);
const totals = s => {
  const total = s.cfg.prizes.reduce((a, p) => a + (+p.total || 0), 0), left = s.cfg.prizes.reduce((a, p) => a + Math.max(0, +p.left || 0), 0);
  const won = s.winners.length, redeemed = s.winners.filter(w => w.redeemedAt).length;
  return { total, left, won, redeemed, pending: won - redeemed, lost: (s.tries || []).length };
};
function topUp(s){
  const used = new Set(s.used);
  const eff = effChances(s.cfg.prizes, s.cfg.loseChance), sum = Object.values(eff).reduce((a, b) => a + b, 0);
  s.live = s.live.filter(g => { const p = parseG(g, s.topic); if (!p || used.has(p.n)) return false; if (p.pid === LOSE) return eff[LOSE] > 0; const pr = prizeById(s, p.pid); return pr && pr.left > 0; });
  while (sum > 0 && s.live.length < s.cfg.liveCodes){
    let r = Math.random() * sum, pick = null;
    for (const p of s.cfg.prizes.concat({ id:LOSE })){ r -= eff[p.id] || 0; if (r < 0){ pick = p; break; } }
    pick = pick || s.cfg.prizes.find(p => eff[p.id] > 0); if (!pick) break;
    s.live.push(makeG(pick.id, s.topic));
  }
}
/* the real chance of each outcome right now, in percent: the owner's percentages,
   rescaled over the prizes that still have stock, plus "better luck next time" (LOSE).
   If no prize percentages are set, stock shares the part that is not LOSE.
   When every prize is gone there are no codes at all. */
function effChances(prizes, loseChance){
  const active = prizes.filter(p => p.left > 0), lose = active.length ? Math.min(100, Math.max(0, +loseChance || 0)) : 0;
  let w = p => Math.max(0, +p.chance || 0), sum = active.reduce((a, p) => a + w(p), 0);
  if (sum <= 0 && active.length){ const stock = active.reduce((a, p) => a + p.left, 0); w = p => p.left / stock * Math.max(0, 100 - lose); sum = active.reduce((a, p) => a + w(p), 0); }
  const all = sum + lose, out = {};
  prizes.forEach(p => out[p.id] = all > 0 && p.left > 0 ? w(p) / all * 100 : 0);
  out[LOSE] = all > 0 ? lose / all * 100 : 0;
  return out;
}
function opClaim(s, g, cust){
  const p = parseG(g, s.topic);
  if (!p) return { ok:false, reason:'invalid' };
  const lose = p.pid === LOSE, pr = lose ? null : prizeById(s, p.pid);
  const prev = s.winners.find(w => w.n === p.n), prevTry = (s.tries || []).find(t => t.n === p.n);
  if (prev && prev.phone === normPhone(cust.phone)) return { ok:true, repeat:true, n:p.n, winner:prev, prize:{ name:prev.name, icon:prev.icon, img:prev.img } };
  if (prevTry && prevTry.phone === normPhone(cust.phone)) return { ok:true, repeat:true, lose:true, n:p.n, attempt:prevTry };
  if (s.used.includes(p.n)) return { ok:false, reason:'used', n:p.n };
  if (!s.live.includes(g) || (!lose && (!pr || pr.left <= 0))) return { ok:false, reason:'expired', n:p.n };
  const phone = normPhone(cust.phone), who = String(cust.name || '').trim().slice(0, 40);
  if (!who || !validPhone(phone)) return { ok:false, reason:'details', n:p.n };
  if (s.cfg.onePerPhone && (s.winners.some(w => w.phone === phone) || (s.tries || []).some(t => t.phone === phone))) return { ok:false, reason:'phone', n:p.n };
  s.used.push(p.n); if (s.used.length > 4000) s.used = s.used.slice(-4000);
  s.live = s.live.filter(x => x !== g);
  if (lose){
    const t = { n:p.n, who, phone, at:Date.now() };
    s.tries = s.tries || []; s.tries.unshift(t); if (s.tries.length > 5000) s.tries.length = 5000;
    topUp(s);
    return { ok:true, lose:true, n:p.n, attempt:t };
  }
  pr.left--;
  const w = { n:p.n, code:codeOf(p.n), pid:pr.id, name:pr.name, icon:pr.icon, img:pr.img, who, phone, at:Date.now(), redeemedAt:null };
  s.winners.unshift(w); if (s.winners.length > 5000) s.winners.length = 5000;
  topUp(s);
  return { ok:true, n:p.n, winner:w, prize:{ name:pr.name, icon:pr.icon, img:pr.img } };
}
/* find by phone number or by the short reference code */
function opFind(s, q){
  const raw = String(q || '').trim(), digits = normPhone(raw).replace('+', '');
  if (digits.length >= 6 && /^[\s+()\-\d٠-٩۰-۹]+$/.test(raw)){
    const tail = d => d.replace('+', '').slice(-9);
    const hits = s.winners.filter(w => tail(w.phone) === tail(digits));
    if (hits.length) return { found:true, list:hits.slice(0, 10) };
    const tried = (s.tries || []).find(t => tail(t.phone) === tail(digits));
    return tried ? { found:false, tried } : { found:false };
  }
  const code = raw.toUpperCase().replace(/\s+/g, '').replace(/^GF-?/, '');
  const w = code && s.winners.find(x => x.n.toUpperCase() === code);
  return w ? { found:true, list:[w] } : { found:false };
}
function opRedeem(s, n){
  const w = s.winners.find(x => x.n === n);
  if (!w) return { found:false };
  if (w.redeemedAt) return { found:true, already:true, list:[w] };
  w.redeemedAt = Date.now(); return { found:true, already:false, list:[w] };
}
function opConfig(s, cfg){
  const before = JSON.stringify(effChances(s.cfg.prizes, s.cfg.loseChance));
  s.cfg = Object.assign({}, s.cfg, cfg, { prizes: (cfg.prizes || s.cfg.prizes).map(p => ({ id: /^[a-z0-9]{3}$/.test(p.id || '') ? p.id : rand(3), name: String(p.name || 'هدية').slice(0,60),
    icon: ICONS[p.icon] ? p.icon : 'gift', img: /^https:\/\//.test(p.img || '') ? p.img : '', total: Math.max(0, parseInt(p.total) || 0), left: Math.max(0, parseInt(p.left) || 0),
    chance: Math.min(100, Math.max(0, Math.round((parseFloat(p.chance) || 0) * 10) / 10)) })) });
  s.cfg.loseChance = Math.min(100, Math.max(0, Math.round((parseFloat(s.cfg.loseChance) || 0) * 10) / 10));
  if (JSON.stringify(effChances(s.cfg.prizes, s.cfg.loseChance)) !== before) s.live = [];   // new odds: redraw every code on the screen
  s.cfg.liveCodes = Math.min(60, Math.max(4, parseInt(s.cfg.liveCodes) || DEFAULTS.liveCodes));
  s.cfg.revealSeconds = Math.min(40, Math.max(4, parseInt(s.cfg.revealSeconds) || DEFAULTS.revealSeconds));
  s.cfg.onePerPhone = !!s.cfg.onePerPhone;
  topUp(s); return { ok:true };
}
function opNewCampaign(s){ s.cfg.prizes.forEach(p => p.left = p.total); s.winners = []; s.tries = []; s.used = []; s.live = []; s.scans = []; topUp(s); return { ok:true }; }
function hourly(s){
  const now = Date.now(), H = 3600000, start = Math.floor(now / H) * H - 11 * H;
  const bins = Array.from({ length:12 }, (_, i) => ({ t: start + i * H, wins:0, scans:0 }));
  for (const w of s.winners){ const i = Math.floor((w.at - start) / H); if (i < 0) break; if (i < 12) bins[i].wins++; }
  for (const t of s.scans){ const i = Math.floor((t - start) / H); if (i >= 0 && i < 12) bins[i].scans++; }
  return bins;
}
const slimWinner = w => ({ n:w.n, pid:w.pid, name:w.name, icon:w.icon, who:w.who, phone:w.phone, at:w.at, redeemedAt:w.redeemedAt });
const snapshot = s => ({ stats:totals(s), winners:s.winners.slice(0, 10).map(slimWinner), hours:hourly(s).map(h => [h.t, h.wins, h.scans]), at:Date.now() });

/* ---------- transport: ntfy relay + same-browser channel ---------- */
function makeLink(server, topic, onMsg, onStatus){
  const seen = new Set(); let closed = false, es = null, open = false, lastId = '', downAt = 0, retryT = 0;
  const deliver = (o, via) => { if (closed || !o || !o.mid || seen.has(o.mid)) return; seen.add(o.mid); if (seen.size > 2000) seen.clear(); onMsg(o, via); };
  let bc = null; try { bc = new BroadcastChannel('hd-' + topic); bc.onmessage = e => deliver(e.data, 'local'); } catch {}
  const base = String(server || DEFAULTS.server).replace(/\/$/, ''), path = `${base}/${encodeURIComponent(topic)}`;
  const status = on => { if (open !== on){ open = on; onStatus && onStatus(on); } };
  function connect(){
    if (closed) return;
    try { es && es.close(); } catch {}
    const since = lastId || (downAt ? Math.floor(downAt / 1000) : 0);
    try { es = new EventSource(`${path}/sse` + (since ? `?since=${since}` : '')); } catch { status(false); return; }
    es.onmessage = e => { try { const d = JSON.parse(e.data); if (d.event === 'open') status(true); else if (d.event === 'message' && d.message){ lastId = d.id || lastId; deliver(JSON.parse(d.message), 'net'); } } catch {} };
    es.onopen = () => status(true);
    es.onerror = () => { status(false); if (!downAt) downAt = Date.now(); try { es.close(); } catch {} clearTimeout(retryT); retryT = setTimeout(() => { connect(); }, 4000); };
  }
  connect();
  const ok = () => { downAt = 0; };
  addEventListener('online', connect);
  return {
    get online(){ return open; },
    send(o, opts={}){ o.mid = o.mid || rand(10); seen.add(o.mid); try { bc && bc.postMessage(o); } catch {}
      if (opts.local) return Promise.resolve(true);
      return fetch(path, { method:'POST', body: JSON.stringify(o) }).then(r => { ok(); return r.ok; }).catch(() => false); },
    poll(since){ return fetch(`${path}/json?poll=1&since=${since}`).then(r => r.ok ? r.text() : '').then(t => t.split('\n').filter(Boolean).map(l => { try { const d = JSON.parse(l); return d.event === 'message' && d.message ? JSON.parse(d.message) : null; } catch { return null; } }).filter(Boolean)).catch(() => []); },
    close(){ closed = true; clearTimeout(retryT); removeEventListener('online', connect); try { es && es.close(); } catch {} try { bc && bc.close(); } catch {} },
  };
}
/* admin channel: topic name and every message are derived from / sealed with the private pairing key */
async function secureLink(server, topic, pairKey, onMsg, onStatus){
  const raw = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('hd-admin|' + pairKey));
  const hex = [...new Uint8Array(raw)].map(b => b.toString(16).padStart(2, '0')).join('');
  const aes = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt','decrypt']);
  const link = makeLink(server, `${topic}-a${hex.slice(0, 16)}`, async (o, via) => {
    if (o.type !== 'sealed') return;
    try { const pt = await crypto.subtle.decrypt({ name:'AES-GCM', iv: unb64(o.iv) }, aes, unb64(o.ct)); onMsg(JSON.parse(new TextDecoder().decode(pt)), via); } catch {}
  }, onStatus);
  return {
    get online(){ return link.online; },
    async send(msg, opts){ const iv = crypto.getRandomValues(new Uint8Array(12)); const ct = await crypto.subtle.encrypt({ name:'AES-GCM', iv }, aes, new TextEncoder().encode(JSON.stringify(msg))); return link.send({ type:'sealed', iv:b64(iv), ct:b64(ct) }, opts); },
    close(){ link.close(); },
  };
}

/* ---------- sound & confetti ---------- */
let audio = null;
addEventListener('pointerdown', () => { try { audio = audio || new (window.AudioContext || window.webkitAudioContext)(); audio.resume(); } catch {} });
function chime(){
  if (!audio) return; const t0 = audio.currentTime;
  [659.25, 783.99, 987.77, 1318.5].forEach((f, k) => { const o = audio.createOscillator(), g = audio.createGain(); o.type = 'sine'; o.frequency.value = f;
    g.gain.setValueAtTime(0, t0 + k*.12); g.gain.linearRampToValueAtTime(.16, t0 + k*.12 + .02); g.gain.exponentialRampToValueAtTime(.001, t0 + k*.12 + .9);
    o.connect(g).connect(audio.destination); o.start(t0 + k*.12); o.stop(t0 + k*.12 + 1); });
}
function confetti(canvas, delay=500){
  if (!canvas || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  setTimeout(() => {
    if (!canvas.isConnected) return;
    const ctx = canvas.getContext('2d'), dpr = Math.min(devicePixelRatio || 1, 2);
    const W = canvas.width = canvas.clientWidth * dpr, H = canvas.height = canvas.clientHeight * dpr;
    const cols = ['#ffb547','#ff6f61','#fff6e6','#ffd88a','#47d99b'];
    const ps = Array.from({ length:160 }, () => ({ x: W/2 + (Math.random()-.5)*W*.12, y: H*.45, vx:(Math.random()-.5)*18*dpr, vy:(-Math.random()*17-6)*dpr, r:(Math.random()*6+4)*dpr, a:Math.random()*6, va:(Math.random()-.5)*.3, c:cols[Math.random()*cols.length|0], round: Math.random() < .3 }));
    const t0 = performance.now();
    (function f(t){ ctx.clearRect(0,0,W,H);
      for (const p of ps){ p.vy += .36*dpr; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.a += p.va; ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.a); ctx.fillStyle = p.c;
        if (p.round){ ctx.beginPath(); ctx.arc(0,0,p.r/2.4,0,7); ctx.fill(); } else ctx.fillRect(-p.r/2,-p.r/4,p.r,p.r/2); ctx.restore(); }
      if (t - t0 < 4200 && canvas.isConnected) requestAnimationFrame(f); else ctx.clearRect(0,0,W,H); })(t0);
  }, delay);
}
