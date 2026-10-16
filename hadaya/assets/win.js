/* ================================================================
   صفحة العميل — opens on the customer's phone after scanning
   ================================================================ */
(function win(){
  const app = document.getElementById('app');
  const params = new URLSearchParams(location.search);
  const g = params.get('g'), topic = params.get('t') || '', server = params.get('s') || DEFAULTS.server;
  const st0 = Engine.load();
  const store = st0 && st0.topic === topic ? st0.cfg.store : DEFAULTS.store;
  const parsed = parseG(g, topic);

  const shell = inner => { app.innerHTML = `<main class="phone"><canvas class="confetti"></canvas><section class="pc">${brandHTML(store)}${inner}</section></main>`; };
  if (!parsed){ shell(`<h1>الكود ده <em>مش شغال</em></h1><p>صوّر كود من شاشة المحل مباشرة. الأكواد بتتجدد كل شوية.</p>`); return; }
  if (!window.crypto || !crypto.subtle){ shell(`<h1>افتح الرابط <em>من المتصفح</em></h1><p>الصفحة دي محتاجة متصفح حديث (كروم أو سفاري).</p>`); return; }

  const memoKey = 'hd-claim-' + parsed.n;
  const read = k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

  const showWon = (prize, who, phone) => {
    shell(`
      ${giftHTML(prize, 'open')}
      <h1>مبروووك يا ${esc(firstName(who))}! <em>الهدية ليك</em></h1>
      <div class="ticket">
        <span class="lbl">هديتك</span><span class="pn">${esc(prize.name)}</span>
        <hr>
        <div class="who"><span>${ui('user')}${esc(who)}</span><span class="mono">${esc(phone)}</span></div>
        <span class="t">${new Date().toLocaleString('ar-EG', { dateStyle:'medium', timeStyle:'short' })} · مرجع ${esc(codeOf(parsed.n))}</span>
      </div>
      <p>روح للكاشير وقوله رقم جوالك، وهو هيسلمك هديتك.</p>
      <span class="pill ok">${ui('check')}هديتك ظهرت على شاشة المحل</span>`);
    confetti($('.confetti', app), 900);
  };
  const showLose = who => {
    shell(`
      <div class="gift open empty"><div class="prize-pop">${ui('heart')}</div><div class="base"></div><div class="lid"></div></div>
      <h1>حظ أوفر <em>المرة القادمة</em></h1>
      <p>المرة دي الصندوق كان فاضي يا ${esc(firstName(who))}، بس لسه فيه هدايا كتير. شكرًا إنك شاركت معانا في ${esc(store)}!</p>
      <span class="pill">${ui('heart')}تابع عروضنا الجاية</span>`);
  };
  const reasons = {
    used:    ['الكود ده <em>اتفتح قبلك</em>', 'حد سبقك على الكود ده. صوّر كود تاني من الشاشة، لسه فيه هدايا كتير.'],
    expired: ['الكود ده <em>خلص</em>', 'الهدية بتاعة الكود ده خلصت أو الكود اتغير. صوّر كود تاني من الشاشة.'],
    phone:   ['الرقم ده <em>شارك قبل كده</em>', 'كل رقم جوال ليه محاولة واحدة في الحملة دي. شكرًا لمشاركتك!'],
    details: ['البيانات <em>ناقصة</em>', 'اكتب اسمك ورقم جوالك صح وجرّب تاني.'],
    invalid: ['الكود ده <em>مش شغال</em>', 'صوّر كود من شاشة المحل مباشرة.'],
  };
  const showFail = reason => { const [h, p] = reasons[reason] || reasons.invalid; shell(`<h1>${h}</h1><p>${p}</p>`); };

  const memo = read(memoKey);
  if (memo){ memo.lose ? showLose(memo.who) : memo.ok ? showWon(memo.prize, memo.who, memo.phone) : showFail(memo.reason); return; }

  /* -- connect to the store screen and fetch its public key -- */
  let key = null, acked = false, scanned = false, waiter = null;
  const link = makeLink(server, topic, msg => {
    if (msg.type === 'key' && msg.pub) key = { kid: msg.kid, pub: msg.pub };
    if (msg.type === 'ack' && msg.n === parsed.n && waiter) waiter(msg);
  }, on => { if (on && !scanned){ scanned = true; link.send({ type:'scan', g }); } });
  setTimeout(() => { if (!scanned){ scanned = true; link.send({ type:'scan', g }); } }, 1500);
  link.poll('12h').then(msgs => { const k = msgs.filter(m => m.type === 'key' && m.pub).pop(); if (k && !key) key = { kid: k.kid, pub: k.pub }; if (!key) link.send({ type:'need-key' }); });
  const waitKey = ms => new Promise(res => { const t0 = Date.now(); (function chk(){ if (key) return res(key); if (Date.now() - t0 > ms) return res(null); setTimeout(chk, 250); })(); });

  /* -- the form -- */
  const saved = read('hd-me') || {};
  shell(`
    <h1>لقيت <em>هدية!</em></h1>
    ${giftHTML({ icon:'gift' }, 'wobble')}
    <form class="pf" id="pf" novalidate>
      <label class="field">الاسم
        <span class="in-ic">${ui('user')}<input class="in big" id="nm" name="name" autocomplete="name" maxlength="40" placeholder="اسمك" value="${esc(saved.name || '')}" required></span>
      </label>
      <label class="field">رقم الجوال
        <span class="in-ic">${ui('phone')}<input class="in big" id="ph" name="tel" type="tel" inputmode="tel" autocomplete="tel" maxlength="18" dir="ltr" placeholder="05xxxxxxxx" value="${esc(saved.phone || '')}" required></span>
      </label>
      <p class="err" id="err" role="alert"></p>
      <button class="btn big" id="open" type="submit">${ui('hand')} افتح الهدية</button>
      <p class="fine">${ui('lock')}بياناتك بتتبعت مشفّرة للمحل بس، عشان يسلمك الهدية.</p>
    </form>`);

  const busyView = text => { $('#pf').innerHTML = `<span class="pill wait"><span class="spin"></span><span>${esc(text)}</span></span>`; };
  async function claim(name, phone, retried){
    const k = await waitKey(8000);
    if (!k) return offline(name, phone);
    let enc; try { enc = await seal(k.pub, { name, phone }); } catch { return offline(name, phone); }
    const ack = await new Promise(res => { waiter = res; link.send({ type:'claim', g, kid:k.kid, enc }); setTimeout(() => res(null), 12000); });
    waiter = null;
    if (!ack) return offline(name, phone);
    if (!ack.ok && ack.reason === 'key' && !retried){ key = null; link.send({ type:'need-key' }); return claim(name, phone, true); }
    acked = true;
    write(memoKey, ack.ok && ack.lose ? { ok:true, lose:true, who:name } : ack.ok ? { ok:true, prize:ack.prize, who:name, phone } : { ok:false, reason:ack.reason });
    setTimeout(() => ack.ok && ack.lose ? showLose(name) : ack.ok ? showWon(ack.prize, name, phone) : showFail(ack.reason), 700);
  }
  function offline(name, phone){
    shell(`<h1>مش قادرين <em>نوصل للشاشة</em></h1><p>اتأكد إن النت شغال عندك وجرّب تاني. الكود لسه متاح لحد ما حد يفتحه.</p>
      <button class="btn big" id="retry" type="button">جرّب تاني</button>`);
    $('#retry').onclick = () => { shell(`<h1>بنحاول <em>تاني...</em></h1>${giftHTML({ icon:'gift' }, 'shake')}<form class="pf" id="pf"></form>`); busyView('بنوصل للشاشة...'); claim(name, phone); };
  }
  $('#pf').addEventListener('submit', e => {
    e.preventDefault();
    const name = $('#nm').value.trim().replace(/\s+/g, ' '), phone = normPhone($('#ph').value);
    const err = $('#err');
    if (name.length < 2){ err.textContent = 'اكتب اسمك عشان نعرف نسلمك الهدية.'; $('#nm').focus(); return; }
    if (!validPhone(phone)){ err.textContent = 'رقم الجوال مش مظبوط. اكتبه بالأرقام، من 8 لـ 15 رقم.'; $('#ph').focus(); return; }
    write('hd-me', { name, phone });
    $('.gift', app).className = 'gift shake';
    busyView('بنفتح هديتك...');
    claim(name, phone);
  });
})();
