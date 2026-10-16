/* ================================================================
   لوحة التحكم — for the owner and the cashier
   ================================================================ */
(async function dashboard(){
  const app = document.getElementById('app');
  const params = new URLSearchParams(location.search);
  const pair = (params.get('pair') || '').split('~');
  const local0 = Engine.load();
  const remote = !!(pair[0] && pair[1] && !(local0 && local0.topic === pair[0]));
  if (!window.crypto || !crypto.subtle){ app.innerHTML = '<p class="fatal">لوحة التحكم لازم تتفتح من رابط https.</p>'; return; }

  let s = remote ? null : Engine.init();
  const topic = remote ? pair[0] : s.topic, pairKey = remote ? pair[1] : s.key;
  const server = remote ? (params.get('s') || DEFAULTS.server) : s.cfg.server;
  const cacheKey = 'hd-remote-' + topic;
  const cache = remote ? (() => { try { return JSON.parse(localStorage.getItem(cacheKey)) || {}; } catch { return {}; } })() : null;
  let cfg = remote ? cache.cfg || null : s.cfg;
  let snap = remote ? cache.snap || null : snapshot(s);
  let rWinners = remote ? (cache.winners || []) : null;   // winners this device has seen from the screen
  let draft = null, loseDraft = null, filter = 'all', query = '', lastSeen = 0, sDirty = false;
  const pending = new Map();
  const saveCache = () => { if (!remote) return; try { localStorage.setItem(cacheKey, JSON.stringify({ cfg, snap, winners: rWinners.slice(0, 500) })); } catch {} };
  const mergeWinners = list => { const by = new Map(rWinners.map(w => [w.n, w])); list.forEach(w => by.set(w.n, Object.assign({}, by.get(w.n), w))); rWinners = [...by.values()].sort((a, b) => b.at - a.at); };

  app.innerHTML = `
  <main class="dash"><div class="wrap">
    <header class="topbar">
      <div class="brand"><span class="mark initial" id="dMark">غ</span><div><b id="dStore"></b><small>لوحة التحكم</small></div></div>
      <div class="acts">
        <span class="pill off" id="tvPill"><span class="dot"></span><span>الشاشة: جارٍ الفحص</span></span>
        ${remote ? '' : `<a class="btn" href="index.html" target="_blank" rel="noopener">${ui('tv')} افتح شاشة الأكواد</a>`}
      </div>
    </header>

    <section class="kpis" id="kpis" aria-label="ملخص"></section>

    <section class="grid2">
      <div class="card">
        <div class="card-h"><div><h2>تسليم هدية</h2><p>اكتب رقم جوال العميل</p></div></div>
        <form class="redeem-form" id="rForm" autocomplete="off">
          <input class="in code" id="rQ" type="search" inputmode="tel" placeholder="05xxxxxxxx" aria-label="رقم جوال العميل أو رقم المرجع">
          <button class="btn" type="submit">دوّر</button>
        </form>
        <div class="result empty" id="rOut">هيظهر هنا اسم العميل وهديته، وهل استلمها قبل كده.</div>
      </div>
      <div class="card">
        <div class="card-h"><div><h2>الهدايا اللي اتكسبت</h2><p>عدد الفائزين في كل ساعة، آخر 12 ساعة</p></div><span class="pill" id="todayPill"></span></div>
        <div class="chart" id="chart"><div class="tip" id="tip"></div></div>
      </div>
    </section>

    <section class="card">
      <div class="card-h"><div><h2>سجل الفائزين</h2><p id="wNote"></p></div>
        <div class="filters">
          <button class="chipf" data-f="all" aria-pressed="true" type="button">الكل</button>
          <button class="chipf" data-f="pending" aria-pressed="false" type="button">مستني الاستلام</button>
          <button class="chipf" data-f="done" aria-pressed="false" type="button">اتسلمت</button>
          <input class="in search" id="wSearch" type="search" placeholder="ابحث بالاسم أو الرقم أو الهدية" aria-label="بحث">
          ${remote ? '' : `<button class="btn soft" id="csv" type="button">${ui('download')} تصدير Excel</button>`}
        </div></div>
      <div class="tbl-wrap"><table>
        <thead><tr><th>الوقت</th><th>العميل</th><th>الجوال</th><th>الهدية</th><th>الحالة</th><th></th></tr></thead>
        <tbody id="wBody"></tbody>
      </table></div>
    </section>

    <section class="card">
      <div class="card-h"><div><h2>الهدايا والكميات</h2><p>حط نسبة فوز لكل هدية. لما هدية تخلص، نسبتها بتتوزع على الباقي</p></div>
        <button class="btn soft" id="addP" type="button">${ui('plus')} إضافة هدية</button></div>
      <div class="tbl-wrap"><table>
        <thead><tr><th>الهدية</th><th>الأيقونة</th><th>الكمية الكلية</th><th>المتبقي</th><th>نسبة الفوز</th><th>الحالة</th><th></th></tr></thead>
        <tbody id="pBody"></tbody>
      </table></div>
      <div class="odds" id="pSum"></div>
      <div class="savebar"><span class="dirty" id="pDirty"></span><button class="btn" id="saveP" type="button" disabled>حفظ وتحديث الشاشة</button></div>
    </section>

    <section class="card">
      <div class="card-h"><div><h2>إعدادات الشاشة</h2><p>النصوص اللي بتظهر للعملاء وقواعد الحملة</p></div></div>
      <form id="sForm" class="form-grid">
        <label class="field">اسم المتجر<input class="in" id="sStore"></label>
        <label class="field">العنوان<input class="in" id="sTitle"></label>
        <label class="field">العنوان (السطر الملوّن)<input class="in" id="sAccent"></label>
        <label class="field">الوصف<input class="in" id="sSub"></label>
        <label class="field">عدد الأكواد على الشاشة<input class="in" id="sCodes" type="number" min="4" max="60" inputmode="numeric"></label>
        <label class="field">مدة شاشة الفوز (ثانية)<input class="in" id="sSecs" type="number" min="4" max="40" inputmode="numeric"></label>
        <label class="field">رابط الموقع بعد الرفع<input class="in" id="sUrl" dir="ltr" placeholder="https://..."></label>
        <label class="field">خادم الربط<input class="in" id="sServer" dir="ltr"></label>
        <label class="check"><input type="checkbox" id="sOne"><span>محاولة واحدة بس لكل رقم جوال (كسب أو حظ أوفر)</span></label>
      </form>
      <div class="savebar"><span class="dirty" id="sDirty"></span><button class="btn" id="saveS" type="button" disabled>حفظ الإعدادات</button></div>
      ${remote ? '' : `
      <div class="field">رابط لوحة التحكم لموبايل الكاشير
        <div class="copyrow"><input class="in" id="pairUrl" readonly aria-label="رابط لوحة التحكم"><button class="btn soft" id="copyPair" type="button">${ui('copy')} نسخ</button></div>
      </div>
      <p class="help">الرابط ده فيه مفتاح خاص بالمحل، ابعته للكاشير بس. شاشة الأكواد لازم تكون مفتوحة عشان الكاشير يسلّم من جهاز تاني.</p>
      <div class="savebar"><p class="help">حملة جديدة: ترجّع كل الكميات لأولها وتمسح سجل الفائزين.</p><button class="btn danger" id="campaign" type="button">بدء حملة جديدة</button></div>`}
    </section>
  </div></main>
  <div class="flash" id="flash" role="status"></div>`;

  let flashT = 0;
  const flash = t => { const f = $('#flash'); f.textContent = t; f.classList.add('show'); clearTimeout(flashT); flashT = setTimeout(() => f.classList.remove('show'), 2600); };

  /* -- talking to the screen -- */
  const adm = await secureLink(server, topic, pairKey, (msg, via) => {
    if (remote && via !== 'net') return;
    if (['beat', 'snap', 'reply', 'cfg'].includes(msg.type)){ lastSeen = Date.now(); paintTv(); }
    if (!remote) return;
    if (msg.type === 'snap'){ snap = msg.snap; mergeWinners(snap.winners); saveCache(); paintAll(); }
    if (msg.type === 'cfg'){ cfg = msg.cfg; saveCache(); paintAll(); }
    if (msg.type === 'reply' && pending.has(msg.rid)){ pending.get(msg.rid)(msg.r || {}); pending.delete(msg.rid); }
  });
  function cmd(op, extra={}){
    if (!remote){
      let r = { ok:true };
      if (op === 'config') [s, r] = Engine.mutate(st => opConfig(st, extra.cfg));
      else if (op === 'redeem') [s, r] = Engine.mutate(st => opRedeem(st, extra.n));
      else if (op === 'find') r = opFind(s = Engine.load(), extra.q);
      else if (op === 'campaign') [s, r] = Engine.mutate(opNewCampaign);
      cfg = s.cfg; snap = snapshot(s); paintAll(); return Promise.resolve(r);
    }
    return new Promise(res => { const rid = rand(8); pending.set(rid, res); adm.send(Object.assign({ type:'cmd', op, rid }, extra));
      setTimeout(() => { if (pending.has(rid)){ pending.delete(rid); res({ timeout:true }); } }, 10000); });
  }
  const allWinners = () => remote ? rWinners : (s ? s.winners : []);

  /* -- paint -- */
  function paintTv(){
    const on = Date.now() - lastSeen < (remote ? 4 * 60e3 : 40000), p = $('#tvPill');
    p.className = 'pill ' + (on ? 'on' : 'off');
    p.lastElementChild.textContent = on ? 'الشاشة شغالة' : lastSeen ? `آخر ظهور للشاشة ${timeAgo(lastSeen)}` : 'الشاشة مش مفتوحة';
  }
  function paintKpis(){
    const t = snap.stats;
    const k = (icon, label, v, sub) => `<div class="kpi"><span class="k">${ui(icon)}${label}</span><span class="v">${v}</span><span class="s">${sub}</span></div>`;
    $('#kpis').innerHTML =
      k('gift', 'هدايا متبقية', fmt(t.left), `من ${fmt(t.total)} هدية`) +
      k('heart', 'اتكسبت', fmt(t.won), `${t.total ? Math.round(t.won / t.total * 100) + '% من الهدايا' : '—'}${t.lost ? ` · ${fmt(t.lost)} حظ أوفر` : ''}`) +
      k('check', 'اتسلمت', fmt(t.redeemed), 'استلمها أصحابها') +
      k('clock', 'مستنية الاستلام', fmt(t.pending), t.pending ? 'أصحابها لسه ما جوش' : 'كله اتسلم');
  }
  function paintChart(){
    const box = $('#chart'), hours = snap.hours.map(h => Array.isArray(h) ? { t:h[0], wins:h[1], scans:h[2] } : h);
    const Wc = Math.max(280, box.clientWidth), Hc = 220, padT = 20, padB = 28, padR = 30;
    const max = Math.max(4, ...hours.map(h => h.wins)), nice = Math.ceil(max / 4) * 4;
    const slot = (Wc - padR - 4) / hours.length, bw = Math.min(24, slot * .55), y = v => padT + (Hc - padT - padB) * (1 - v / nice);
    const xAt = i => Wc - padR - slot * i - slot / 2;   // RTL: oldest hour on the right
    $('#todayPill').textContent = `${fmt(hours.reduce((a, h) => a + h.wins, 0))} فائز في 12 ساعة`;
    let g = '';
    for (let i = 0; i <= 4; i++){ const v = nice / 4 * i, yy = y(v);
      g += `<line x1="0" x2="${Wc - padR}" y1="${yy}" y2="${yy}" stroke="rgba(170,190,255,${i ? .09 : .26})" stroke-width="1"/><text x="${Wc - padR + 8}" y="${yy + 4}" fill="#6f7a9e" font-size="11" text-anchor="start" font-family="Alexandria">${fmt(v)}</text>`; }
    const peak = hours.reduce((m, h, i) => h.wins >= hours[m].wins ? i : m, 0);
    hours.forEach((h, i) => {
      const cx = xAt(i), top = y(h.wins), hgt = Hc - padB - top, r = Math.min(4, hgt / 2);
      if (h.wins > 0) g += `<path d="M${cx - bw/2} ${Hc - padB}V${top + r}q0 -${r} ${r} -${r}h${bw - 2*r}q${r} 0 ${r} ${r}V${Hc - padB}z" fill="#ffb547"/>`;
      if (i === peak && h.wins > 0) g += `<text x="${cx}" y="${top - 7}" fill="#eef1fb" font-size="12" text-anchor="middle" font-family="Alexandria" font-weight="600">${h.wins}</text>`;
      if ((hours.length - 1 - i) % 3 === 0) g += `<text x="${cx}" y="${Hc - 8}" fill="#6f7a9e" font-size="11" text-anchor="middle" font-family="Alexandria">${i === hours.length - 1 ? 'الساعة دي' : new Date(h.t).toLocaleTimeString('ar-EG', { hour:'numeric' })}</text>`;
      g += `<rect class="hit" data-i="${i}" x="${cx - slot/2}" y="${padT}" width="${slot}" height="${Hc - padT - padB}" fill="transparent"/>`;
    });
    const old = $('svg', box); old && old.remove();
    box.insertAdjacentHTML('afterbegin', `<svg viewBox="0 0 ${Wc} ${Hc}" role="img" aria-label="عدد الفائزين في كل ساعة">${g}</svg>`);
    const tip = $('#tip');
    box.querySelectorAll('.hit').forEach(r => {
      r.addEventListener('pointerenter', () => { const i = +r.dataset.i, h = hours[i];
        tip.innerHTML = `<b>${fmt(h.wins)} فائز</b>${new Date(h.t).toLocaleTimeString('ar-EG', { hour:'numeric', minute:'2-digit' })} · ${fmt(h.scans)} مرة مسح`;
        tip.style.left = (xAt(i) / Wc * box.clientWidth) + 'px'; tip.style.top = Math.max(30, y(h.wins)) + 'px'; tip.style.opacity = 1; r.setAttribute('fill', 'rgba(255,255,255,.04)'); });
      r.addEventListener('pointerleave', () => { tip.style.opacity = 0; r.setAttribute('fill', 'transparent'); });
    });
  }
  const iconOptions = sel => Object.entries(ICONS).map(([k, v]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${v[0]}</option>`).join('');
  function paintPrizes(){
    const rows = draft || cfg.prizes;
    $('#pBody').innerHTML = rows.length ? rows.map((p, i) => `<tr data-i="${i}">
      <td><div class="pcell"><span class="tl">${pIcon(p)}</span><input class="in" data-k="name" value="${esc(p.name)}" aria-label="اسم الهدية"></div></td>
      <td><select class="in" data-k="icon" aria-label="الأيقونة">${iconOptions(p.icon)}</select></td>
      <td><input class="in" data-k="total" type="number" min="0" inputmode="numeric" value="${p.total}" style="width:90px" aria-label="الكمية الكلية"></td>
      <td><input class="in" data-k="left" type="number" min="0" inputmode="numeric" value="${p.left}" style="width:90px" aria-label="المتبقي"></td>
      <td><div class="chance"><span class="pct"><input class="in" data-k="chance" type="number" min="0" max="100" step="0.5" inputmode="decimal" value="${p.chance ?? 0}" aria-label="نسبة الفوز بـ ${esc(p.name)}"><b>%</b></span><small data-eff="${i}"></small></div></td>
      <td><div class="stockbar"><div class="bar"><i style="width:${p.total ? Math.min(100, p.left / p.total * 100) : 0}%"></i></div><small>${p.left > 0 ? `${fmt(p.left)} من ${fmt(p.total)}` : 'خلصت'}</small></div></td>
      <td><button class="iconbtn" data-del="${i}" type="button" aria-label="حذف ${esc(p.name)}">${ui('trash')}</button></td></tr>`).join('')
      : `<tr class="empty-row"><td colspan="7">مفيش هدايا. اضغط «إضافة هدية» عشان تبدأ.</td></tr>`;
    $('#pBody').insertAdjacentHTML('beforeend', `<tr class="odds-lose" data-lose="1">
      <td><div class="pcell"><span class="tl">${ui('heart')}</span><b>حظ أوفر المرة القادمة</b></div></td>
      <td colspan="3"><small style="color:var(--faint)">كود من غير هدية. العميل بيشوف رسالة لطيفة، ومفيش كمية بتخلص.</small></td>
      <td><div class="chance"><span class="pct"><input class="in" data-k="lose" type="number" min="0" max="100" step="0.5" inputmode="decimal" value="${loseDraft ?? cfg.loseChance ?? 0}" aria-label="نسبة حظ أوفر المرة القادمة"><b>%</b></span><small data-eff="lose"></small></div></td>
      <td><small style="color:var(--faint)">${fmt(snap && snap.stats ? snap.stats.lost : 0)} محاولة لحد دلوقتي</small></td><td></td></tr>`);
    paintOdds();
    const dirty = draft || loseDraft != null;
    $('#pDirty').textContent = dirty ? 'فيه تغييرات لسه ما اتحفظتش' : '';
    $('#saveP').disabled = !dirty || (draft && !draft.length);
  }
  /* the percentages the owner typed, and what each prize really gets after rescaling */
  function paintOdds(){
    const rows = (draft || cfg.prizes).map((p, i) => Object.assign({}, p, { id: p.id || 'new' + i }));
    const lose = Math.max(0, +(loseDraft ?? cfg.loseChance) || 0);
    const eff = effChances(rows, lose), sum = rows.reduce((a, p) => a + (p.left > 0 ? Math.max(0, +p.chance || 0) : 0), 0) + lose;
    const pct = v => `الفعلي ${v.toFixed(1).replace(/\.0$/, '')}%`;
    rows.forEach((p, i) => { const el = $(`[data-eff="${i}"]`); if (el) el.textContent = p.left > 0 ? pct(eff[p.id]) : 'خلصت، نسبتها اتوزعت'; });
    const le = $('[data-eff="lose"]'); if (le) le.textContent = pct(eff[LOSE]);
    const r = Math.round(sum * 10) / 10, box = $('#pSum');
    box.className = 'odds ' + (Math.abs(r - 100) < .05 ? 'ok' : 'warn');
    box.innerHTML = Math.abs(r - 100) < .05
      ? `${ui('check')}<span>مجموع النسب <b>100%</b>${lose ? `، منها <b>${fmt(lose)}%</b> حظ أوفر` : ''}. كل كود على الشاشة بيتسحب على النسب دي.</span>`
      : r === 0 ? `${ui('clock')}<span>مفيش نسب متحددة، فالأكواد بتتوزع حسب الكمية المتبقية من كل هدية.</span>`
      : `${ui('clock')}<span>مجموع النسب <b>${fmt(r)}%</b> مش 100%. هنوزّع الأكواد بنفس النسبة بين الهدايا، والنسبة الفعلية مكتوبة تحت كل خانة.</span>`;
  }
  const statusPill = w => w.redeemedAt ? `<span class="pill ok">${ui('check')}اتسلمت ${clock(w.redeemedAt)}</span>` : `<span class="pill wait">مستنية</span>`;
  function paintWinners(){
    const q = query.trim().toLowerCase(), qd = normPhone(query).replace('+', '');
    const all = allWinners();
    const list = all.filter(w => (filter === 'all' || (filter === 'done' ? w.redeemedAt : !w.redeemedAt)) &&
      (!q || (w.who || '').toLowerCase().includes(q) || w.name.toLowerCase().includes(q) || (qd.length >= 3 && (w.phone || '').includes(qd)))).slice(0, 300);
    $('#wNote').textContent = remote ? `${fmt(all.length)} فائز وصلوا للجهاز ده من الشاشة` : `${fmt(all.length)} فائز في الحملة دي`;
    $('#wBody').innerHTML = list.length ? list.map(w => `<tr>
      <td class="num">${clock(w.at)}<br><small style="color:var(--faint)">${new Date(w.at).toLocaleDateString('ar-EG', { day:'numeric', month:'short' })}</small></td>
      <td><b>${esc(w.who)}</b></td>
      <td><span class="mono">${esc(w.phone)}</span></td>
      <td><div class="pcell"><span class="tl">${pIcon(w)}</span>${esc(w.name)}</div></td>
      <td>${statusPill(w)}</td>
      <td>${w.redeemedAt ? '' : `<button class="btn soft" data-redeem="${esc(w.n)}" type="button">تسليم</button>`}</td></tr>`).join('')
      : `<tr class="empty-row"><td colspan="6">${all.length ? 'مفيش نتايج بالبحث ده' : 'لسه مفيش فائزين. أول ما حد يفتح هدية هيظهر هنا.'}</td></tr>`;
  }
  function paintSettings(force){
    if (sDirty && !force) return;
    $('#sStore').value = cfg.store; $('#sTitle').value = cfg.title; $('#sAccent').value = cfg.titleAccent; $('#sSub').value = cfg.subtitle;
    $('#sCodes').value = cfg.liveCodes; $('#sSecs').value = cfg.revealSeconds; $('#sUrl').value = cfg.pageURL; $('#sServer').value = cfg.server; $('#sOne').checked = cfg.onePerPhone !== false;
    $('#sUrl').placeholder = location.href.replace(/[?#].*$/, '').replace(/[^/]*$/, '');
    const pu = $('#pairUrl');
    if (pu){ const folder = (cfg.pageURL || location.href).replace(/[?#].*$/, '').replace(/[^/]*$/, '');
      pu.value = `${folder}dashboard.html?pair=${s.topic}~${s.key}` + (cfg.server !== DEFAULTS.server ? `&s=${encodeURIComponent(cfg.server)}` : ''); }
    $('#sDirty').textContent = ''; $('#saveS').disabled = true;
  }
  function paintAll(){
    if (!snap || !cfg){ $('#kpis').innerHTML = `<div class="kpi" style="grid-column:1/-1"><span class="k">${ui('tv')}بنستنى الشاشة</span><span class="s">اتأكد إن شاشة الأكواد مفتوحة في المحل ومتصلة بالنت. البيانات هتظهر هنا لوحدها.</span></div>`; return; }
    $('#dStore').textContent = cfg.store; $('#dMark').textContent = cfg.store.trim().charAt(0);
    document.title = `لوحة تحكم ${cfg.store}`;
    paintKpis(); paintChart(); if (!draft) paintPrizes(); paintWinners(); paintSettings();
  }

  /* -- redeem: find by phone, then confirm -- */
  async function find(q){
    const out = $('#rOut'); out.className = 'result'; out.innerHTML = `<span class="pill wait"><span class="spin"></span>بندوّر...</span>`;
    const r = await cmd('find', { q });
    if (r.timeout) return out.innerHTML = `<span class="pill bad">الشاشة ما ردتش</span><span class="meta">اتأكد إن شاشة الأكواد مفتوحة ومتصلة بالنت، وجرّب تاني.</span>`;
    if (!r.found && r.tried) return out.innerHTML = `<span class="pill">${ui('heart')}حظ أوفر</span><span class="meta"><b>${esc(r.tried.who)}</b> جرّب الساعة ${clock(r.tried.at)} والكود كان من غير هدية، فمفيش حاجة تتسلم.</span>`;
    if (!r.found) return out.innerHTML = `<span class="pill bad">مفيش هدية بالرقم ده</span><span class="meta">راجع الرقم مع العميل، أو اطلب منه يوريك صفحة الهدية على جواله.</span>`;
    if (remote) mergeWinners(r.list.map(slimWinner));
    out.innerHTML = r.list.map(w => `<div class="hit-row">
      <div class="row"><span class="tl">${pIcon(w)}</span><div><div class="nm">${esc(w.name)}</div><div class="meta"><b>${esc(w.who)}</b> · <span class="mono">${esc(w.phone)}</span> · كسبها ${clock(w.at)}</div></div></div>
      <div class="hit-act">${w.redeemedAt ? `<span class="pill bad">اتسلمت قبل كده الساعة ${clock(w.redeemedAt)}</span>` : `<button class="btn" data-confirm="${esc(w.n)}" type="button">${ui('check')} تأكيد التسليم</button>`}</div></div>`).join('');
  }
  async function redeem(n){
    const r = await cmd('redeem', { n });
    if (r.timeout) return flash('الشاشة ما ردتش، جرّب تاني');
    if (!r.found) return flash('الهدية دي مش موجودة');
    if (remote){ mergeWinners(r.list.map(slimWinner)); saveCache(); paintWinners(); }
    flash(r.already ? 'الهدية دي اتسلمت قبل كده' : `اتسجل تسليم الهدية لـ ${firstName(r.list[0].who)}`);
    const out = $('#rOut'), btn = out.querySelector(`[data-confirm="${n}"]`);
    if (btn) btn.outerHTML = `<span class="pill ok">${ui('check')}تم التسليم</span>`;
  }
  $('#rForm').addEventListener('submit', e => { e.preventDefault(); const v = $('#rQ').value; if (v.trim()) find(v); });
  $('#rOut').addEventListener('click', e => { const b = e.target.closest('[data-confirm]'); if (b){ b.disabled = true; redeem(b.dataset.confirm); } });
  $('#wBody').addEventListener('click', e => { const b = e.target.closest('[data-redeem]'); if (b){ b.disabled = true; redeem(b.dataset.redeem); } });

  /* -- prizes editor -- */
  const ensureDraft = () => { if (!draft) draft = JSON.parse(JSON.stringify(cfg.prizes)); };
  $('#pBody').addEventListener('input', e => {
    const tr = e.target.closest('tr'), k = e.target.dataset.k; if (!tr || !k || !cfg) return;
    if (k === 'lose'){ loseDraft = Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)); paintOdds(); $('#pDirty').textContent = 'فيه تغييرات لسه ما اتحفظتش'; $('#saveP').disabled = false; return; }
    ensureDraft();
    const p = draft[+tr.dataset.i];
    p[k] = (k === 'total' || k === 'left') ? Math.max(0, parseInt(e.target.value) || 0) : k === 'chance' ? Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)) : e.target.value;
    if (k === 'chance' || k === 'left') paintOdds();
    if (k === 'icon') tr.querySelector('.tl').innerHTML = pIcon(p);
    $('#pDirty').textContent = 'فيه تغييرات لسه ما اتحفظتش'; $('#saveP').disabled = false;
  });
  $('#pBody').addEventListener('click', e => { const b = e.target.closest('[data-del]'); if (!b) return; ensureDraft(); draft.splice(+b.dataset.del, 1); paintPrizes(); });
  $('#addP').onclick = () => { if (!cfg) return; ensureDraft(); draft.push({ id:'', name:'هدية جديدة', icon:'gift', img:'', total:10, left:10, chance:5 }); paintPrizes(); const ins = $('#pBody').querySelectorAll('input[data-k="name"]'); ins[ins.length - 1].select(); };
  $('#saveP').onclick = async () => {
    if ((!draft && loseDraft == null) || (draft && !draft.length)) return; $('#saveP').disabled = true;
    const next = {}; if (draft) next.prizes = draft; if (loseDraft != null) next.loseChance = loseDraft;
    const r = await cmd('config', { cfg: next });
    if (r && r.timeout){ flash('الشاشة ما ردتش، جرّب تاني'); $('#saveP').disabled = false; return; }
    draft = null; loseDraft = null; flash('اتحفظت النسب والشاشة اتحدثت'); paintPrizes();
  };

  /* -- settings -- */
  $('#sForm').addEventListener('input', () => { sDirty = true; $('#sDirty').textContent = 'فيه تغييرات لسه ما اتحفظتش'; $('#saveS').disabled = false; });
  $('#sForm').addEventListener('submit', e => e.preventDefault());
  $('#saveS').onclick = async () => {
    const next = { store: $('#sStore').value.trim() || DEFAULTS.store, title: $('#sTitle').value.trim(), titleAccent: $('#sAccent').value.trim(), subtitle: $('#sSub').value.trim(),
      liveCodes: $('#sCodes').value, revealSeconds: $('#sSecs').value, pageURL: $('#sUrl').value.trim(), server: $('#sServer').value.trim() || DEFAULTS.server, onePerPhone: $('#sOne').checked };
    const r = await cmd('config', { cfg: next });
    if (r && r.timeout){ flash('الشاشة ما ردتش، جرّب تاني'); return; }
    sDirty = false; flash('اتحفظت الإعدادات'); paintSettings(true);
  };
  if (!remote){
    $('#copyPair').onclick = async () => { const i = $('#pairUrl'); try { await navigator.clipboard.writeText(i.value); flash('اتنسخ الرابط'); } catch { i.select(); flash('الرابط متحدد، انسخه يدوي'); } };
    let armT = 0;
    $('#campaign').onclick = async e => {
      const b = e.currentTarget;
      if (!b.classList.contains('armed')){ b.classList.add('armed'); b.textContent = 'متأكد؟ اضغط تاني للتأكيد'; armT = setTimeout(() => { b.classList.remove('armed'); b.textContent = 'بدء حملة جديدة'; }, 4000); return; }
      clearTimeout(armT); b.classList.remove('armed'); b.textContent = 'بدء حملة جديدة';
      await cmd('campaign'); flash('بدأت حملة جديدة');
    };
    $('#csv').onclick = () => {
      const rows = [['الوقت', 'العميل', 'الجوال', 'الهدية', 'الحالة', 'وقت التسليم', 'المرجع']].concat(s.winners.map(w =>
        [new Date(w.at).toLocaleString('ar-EG'), w.who, "'" + w.phone, w.name, w.redeemedAt ? 'اتسلمت' : 'مستنية', w.redeemedAt ? new Date(w.redeemedAt).toLocaleString('ar-EG') : '', codeOf(w.n)]));
      const csv = '﻿' + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type:'text/csv;charset=utf-8' }));
      a.download = `الفائزين-${new Date().toISOString().slice(0, 10)}.csv`; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    };
  }
  document.querySelectorAll('.chipf').forEach(c => c.onclick = () => { filter = c.dataset.f; document.querySelectorAll('.chipf').forEach(x => x.setAttribute('aria-pressed', x === c)); paintWinners(); });
  $('#wSearch').addEventListener('input', e => { query = e.target.value; paintWinners(); });

  /* -- live updates -- */
  if (!remote) addEventListener('storage', e => { if (e.key === KEY){ s = Engine.load() || s; cfg = s.cfg; snap = snapshot(s); paintAll(); } });
  new ResizeObserver(() => snap && paintChart()).observe($('#chart'));
  setInterval(() => { paintTv(); if (!remote && s){ snap = snapshot(s); paintKpis(); paintChart(); } }, 20000);
  if (remote){ const ping = () => adm.send({ type:'cmd', op:'ping', rid: rand(8) }); setTimeout(ping, 600); setInterval(ping, 3 * 60e3); }
  paintAll(); paintTv();
})();
