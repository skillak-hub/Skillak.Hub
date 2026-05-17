/* ═══════════════════════════════════════════════════════════════
   meet-session.js  v9.0 — Skillak × Google Meet (Embedded)
   - Meet embedded in iframe INSIDE the platform
   - Draggable floating timer
   - Firestore-synced timer (same for both users)
   - Session persistence across enter/exit
   - Auto-end Meet link after session expires
   ═══════════════════════════════════════════════════════════════ */
'use strict';

(function () {
  if (window.__skillakMeetBridgeLoaded) return;
  window.__skillakMeetBridgeLoaded = true;

  const HOUR_MS    = 60 * 60 * 1000;
  const CREATE_URL = '/api/meet/create';
  const END_URL    = '/api/meet/end';

  let countdownTimer = null;
  let autoEndLocked  = false;

  const $  = (id) => document.getElementById(id);
  const db = () => window.db || null;
  const CU = () => window.CU || null;
  const CP = () => window.CP || null;

  function esc(s) {
    return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  /* ── Safe toast ── */
  function toast(msg, kind) {
    kind = kind || 'inf';
    try {
      var t = document.getElementById('toast');
      if (t) {
        t.textContent = msg;
        t.className = 'toast '+(kind==='suc'?'suc':kind==='err'?'err':'inf')+' show';
        clearTimeout(window.__toastTmr);
        window.__toastTmr = setTimeout(function(){ t.classList.remove('show'); }, 3500);
        return;
      }
    } catch(_) {}
    try {
      var fb = document.createElement('div');
      fb.textContent = msg;
      fb.style.cssText = 'position:fixed;bottom:28px;left:50%;transform:translateX(-50%);'+
        'background:'+(kind==='err'?'#dc2626':kind==='suc'?'#059669':'#0d6e75')+';'+
        'color:#fff;padding:11px 24px;border-radius:14px;font-size:.9rem;z-index:99999;'+
        'box-shadow:0 4px 24px rgba(0,0,0,.35);font-family:Cairo,sans-serif;'+
        'max-width:90vw;text-align:center;pointer-events:none;direction:rtl';
      document.body.appendChild(fb);
      setTimeout(function(){ if(fb.isConnected) fb.remove(); }, 3500);
    } catch(_) { console.log('[Toast]', msg); }
  }
  window.showT = toast;

  function fmtTime(ms) {
    var safe = Math.max(0, ms);
    var h = String(Math.floor(safe/3600000)).padStart(2,'0');
    var m = String(Math.floor((safe%3600000)/60000)).padStart(2,'0');
    var s = String(Math.floor((safe%60000)/1000)).padStart(2,'0');
    return h+':'+m+':'+s;
  }

  /* ══════════════════════════════════════
     DRAGGABLE FLOATING TIMER
  ══════════════════════════════════════ */
  function initDraggableTimer() {
    var ft = $('skillakFloatTimer');
    if (!ft || ft._dragInit) return;
    ft._dragInit = true;
    var dragging = false, ox = 0, oy = 0, startX = 0, startY = 0;

    function onDown(e) {
      if (e.target.tagName === 'BUTTON') return;
      dragging = true;
      var touch = e.touches ? e.touches[0] : e;
      startX = touch.clientX; startY = touch.clientY;
      var rect = ft.getBoundingClientRect();
      ox = rect.left; oy = rect.top;
      ft.style.transition = 'none';
      ft.style.cursor = 'grabbing';
      e.preventDefault();
    }
    function onMove(e) {
      if (!dragging) return;
      var touch = e.touches ? e.touches[0] : e;
      var nx = ox + (touch.clientX - startX);
      var ny = oy + (touch.clientY - startY);
      var maxX = window.innerWidth  - ft.offsetWidth  - 8;
      var maxY = window.innerHeight - ft.offsetHeight - 8;
      nx = Math.max(8, Math.min(nx, maxX));
      ny = Math.max(8, Math.min(ny, maxY));
      ft.style.right = 'auto'; ft.style.bottom = 'auto';
      ft.style.left = nx+'px'; ft.style.top = ny+'px';
      e.preventDefault();
    }
    function onUp() { dragging = false; ft.style.cursor = 'grab'; ft.style.transition = ''; }

    ft.addEventListener('mousedown', onDown);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    ft.addEventListener('touchstart', onDown, {passive:false});
    document.addEventListener('touchmove', onMove, {passive:false});
    document.addEventListener('touchend', onUp);
    ft.style.cursor = 'grab';
  }

  function updateFloatTimer(rem, otherName) {
    var ft = $('skillakFloatTimer');
    if (!ft) return;
    ft.style.display = 'flex';
    var ftTxt = $('skillakFloatTime');
    var ftSub = $('skillakFloatSub');
    var ftName = $('skillakFloatName');
    if (ftTxt) { ftTxt.textContent = fmtTime(rem); ftTxt.style.color = rem < 600000 ? '#f59e0b' : '#5eead4'; }
    if (ftSub) { var m = Math.ceil(rem/60000); ftSub.textContent = rem<=0 ? 'انتهى الوقت' : 'متبقي '+m+' دقيقة'; }
    if (ftName && otherName) ftName.textContent = 'جلسة مع '+otherName;
    initDraggableTimer();
  }

  function hideFloatTimer() {
    var ft = $('skillakFloatTimer');
    if (ft) ft.style.display = 'none';
  }

  /* ══════════════════════════════════════
     RENDER PANEL — Google Meet Embedded
  ══════════════════════════════════════ */
  function renderPanel(bk, meeting, isTutor) {
    window._smUri = meeting.uri || '';
    var waitOv = $('waitOv');
    var locWrap = $('locWrap');
    if (locWrap) locWrap.style.display = 'none';
    ['micBtn','camBtn','scrBtn','flipBtn'].forEach(function(id){
      var el=$(id); if(!el) return; el.style.display='none';
      var w=el.closest?el.closest('.cwrap'):null; if(w) w.style.display='none';
    });

    var sesTxt = $('sesTxt'); var sesDot = $('sesDot');
    var hasLink = !!meeting.uri;
    var other = isTutor ? (bk.studentName||'الطالب') : (bk.tutorName||'المعلم');
    var initial = (other[0]||'?').toUpperCase();
    var endsAtMs = Number(meeting.endsAtMs||0);
    var countdown = fmtTime(Math.max(0, endsAtMs - Date.now()));

    if (sesTxt) sesTxt.textContent = hasLink ? 'رابط الجلسة جاهز' : 'جارٍ تجهيز الجلسة...';
    if (sesDot) sesDot.style.background = 'var(--green,#22c55e)';

    if (!waitOv) return;
    waitOv.classList.remove('hidden');
    waitOv.style.cssText = 'position:absolute;inset:0;z-index:20;display:flex;flex-direction:column;'+
      'align-items:stretch;justify-content:stretch;overflow:hidden;'+
      'background:linear-gradient(160deg,#0a1628 0%,#0d2137 55%,#071a14 100%)';

    if (hasLink) {
      /* ── EMBEDDED MEET (iframe fills screen) ── */
      waitOv.innerHTML =
        '<div id="smMeetWrap" style="position:relative;flex:1;display:flex;flex-direction:column;min-height:0">'+
          '<div id="smTopBar" style="display:flex;align-items:center;gap:10px;padding:8px 14px;'+
            'background:rgba(0,0,0,.5);backdrop-filter:blur(8px);flex-shrink:0;direction:rtl;'+
            'border-bottom:1px solid rgba(255,255,255,.08)">'+
            '<div style="width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,#0d6e75,#14b8a6);'+
              'display:flex;align-items:center;justify-content:center;font-weight:900;font-size:.9rem;color:#fff;flex-shrink:0">'+
              esc(initial)+'</div>'+
            '<div style="flex:1;min-width:0">'+
              '<div style="font-weight:700;font-size:.88rem;color:#fff;font-family:Cairo,sans-serif">'+esc(other)+'</div>'+
              '<div style="font-size:.73rem;color:rgba(255,255,255,.5);font-family:Cairo,sans-serif">'+
                (isTutor?'الطالب':'المعلم')+'</div>'+
            '</div>'+
            '<div style="text-align:center">'+
              '<div id="smCountdown" style="font-size:1rem;font-weight:900;color:#5eead4;'+
                'font-variant-numeric:tabular-nums;font-family:Fraunces,serif">'+countdown+'</div>'+
              '<div style="font-size:.65rem;color:rgba(255,255,255,.4);font-family:Cairo,sans-serif">متبقي</div>'+
            '</div>'+
            '<a href="'+esc(meeting.uri)+'" target="_blank" rel="noopener noreferrer" '+
              'style="display:flex;align-items:center;gap:5px;background:rgba(255,255,255,.1);'+
              'color:#fff;border:1px solid rgba(255,255,255,.2);border-radius:10px;'+
              'padding:6px 12px;font-size:.78rem;font-family:Cairo,sans-serif;text-decoration:none;flex-shrink:0">'+
              '↗ فتح خارجي</a>'+
          '</div>'+
          '<iframe id="smMeetIframe" src="'+esc(meeting.uri)+'" '+
            'allow="camera;microphone;display-capture;fullscreen;autoplay;clipboard-write;encrypted-media;picture-in-picture" '+
            'allowfullscreen style="flex:1;border:none;min-height:0;width:100%;display:block">'+
          '</iframe>'+
        '</div>';
    } else {
      /* ── LOADING STATE ── */
      waitOv.innerHTML =
        '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;'+
          'flex:1;gap:16px;font-family:Cairo,sans-serif;color:#fff;text-align:center;padding:24px">'+
          '<div style="display:flex;align-items:center;gap:8px;background:rgba(255,255,255,.08);'+
            'border:1px solid rgba(255,255,255,.12);border-radius:100px;padding:7px 18px 7px 12px">'+
            '<svg width="20" height="20" viewBox="0 0 48 48" fill="none">'+
              '<path d="M29 24c0 2.76-2.24 5-5 5s-5-2.24-5-5 2.24-5 5-5 5 2.24 5 5z" fill="#4fc3f7"/>'+
              '<path d="M34 17l-5 4v6l5 4V17z" fill="#4fc3f7"/>'+
            '</svg>'+
            '<span style="font-size:.88rem;font-weight:700">Google Meet</span>'+
          '</div>'+
          '<div style="width:60px;height:60px;border-radius:50%;background:linear-gradient(135deg,#0d6e75,#14b8a6);'+
            'display:flex;align-items:center;justify-content:center;font-size:1.6rem;font-weight:900">'+
            esc(initial)+'</div>'+
          '<div style="font-size:1.05rem;font-weight:700">'+esc(other)+'</div>'+
          '<div style="font-size:.82rem;opacity:.6">جارٍ إنشاء رابط Google Meet...</div>'+
          '<div style="width:36px;height:36px;border-radius:50%;border:3px solid rgba(255,255,255,.15);'+
            'border-top-color:#5eead4;animation:spin 1s linear infinite"></div>'+
          '<style>@keyframes spin{to{transform:rotate(360deg)}}</style>'+
        '</div>';
    }
  }

  /* ══════════════════════════════════════
     TIMER — Firestore synced
  ══════════════════════════════════════ */
  function startCountdown(endsAtMs, bkId, isTutor, other) {
    if (countdownTimer) clearInterval(countdownTimer);
    autoEndLocked = false;

    function tick() {
      var rem = Math.max(0, endsAtMs - Date.now());
      var txt = fmtTime(rem);
      var el1 = $('smCountdown');
      var el2 = $('sesCountdown');
      if (el1) { el1.textContent = txt; el1.style.color = rem<600000?'#f59e0b':'#5eead4'; }
      if (el2) el2.textContent = txt;
      updateFloatTimer(rem, other);
      if (rem <= 0 && !autoEndLocked) {
        autoEndLocked = true;
        clearInterval(countdownTimer);
        countdownTimer = null;
        hideFloatTimer();
        setTimeout(function(){ if(typeof window.endSession==='function') window.endSession(bkId,{auto:true}); }, 200);
      }
    }
    tick();
    countdownTimer = setInterval(tick, 1000);
  }

  /* ── Cleanup ── */
  function cleanup() {
    try { if(window.pc){window.pc.close();window.pc=null;} } catch(_){}
    try { if(window.locSt){window.locSt.getTracks().forEach(function(t){t.stop();});window.locSt=null;} } catch(_){}
    try { if(window.sesChatL){window.sesChatL();window.sesChatL=null;} } catch(_){}
    try { if(window.sesTInt){clearInterval(window.sesTInt);window.sesTInt=null;} } catch(_){}
  }

  /* ── API ── */
  async function apiCreate() {
    var r = await fetch(CREATE_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
    var text = await r.text(); var data={};
    try{data=JSON.parse(text);}catch(_){if(!r.ok) throw new Error('HTTP '+r.status);}
    if(!r.ok) { var m=data.error||data.message||'HTTP '+r.status; throw new Error(typeof m==='object'?JSON.stringify(m):String(m)); }
    return data;
  }
  async function apiEnd(spaceName) {
    if(!spaceName) return;
    try{await fetch(END_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({spaceName:spaceName})});}catch(_){}
  }

  async function saveMeeting(bookingId, meta) {
    var _db=db(); if(!_db||!bookingId||!meta) return;
    var pl={meetingProvider:'google-meet',meetingSpaceName:meta.spaceName||'',
      meetingUri:meta.uri||'',meetingCode:meta.code||'',
      meetingCreatedAtMs:meta.createdAtMs||Date.now(),
      meetingEndsAtMs:meta.endsAtMs||(Date.now()+HOUR_MS),
      sessionEndsAtMs:meta.endsAtMs||(Date.now()+HOUR_MS),
      sessionType:'google-meet',meetingStatus:'active'};
    await _db.collection('bookings').doc(bookingId).set(pl,{merge:true}).catch(function(){});
    await _db.collection('sessions').doc(bookingId).set(
      Object.assign({},pl,{status:'active',startedAt:firebase.firestore.FieldValue.serverTimestamp()}),
      {merge:true}).catch(function(){});
    return pl;
  }

  async function getOrCreateMeeting(bookingId, bk) {
    var _db=db(); var now=Date.now();
    // Always refresh from Firestore so second user gets same link
    if(_db&&bookingId) {
      try {
        var fs=await _db.collection('bookings').doc(bookingId).get();
        if(fs.exists) bk=Object.assign({},bk,fs.data(),{id:bookingId});
      } catch(_){}
    }
    // Use existing valid link (not expired, not forcing new)
    var hasValid = bk.meetingUri && Number(bk.meetingEndsAtMs||0) > now+15000;
    if(hasValid) {
      return {spaceName:bk.meetingSpaceName||'',uri:bk.meetingUri,
        code:bk.meetingCode||'',createdAtMs:Number(bk.meetingCreatedAtMs||now),
        endsAtMs:Number(bk.sessionEndsAtMs||bk.meetingEndsAtMs)};
    }
    // Create new
    var c=await apiCreate();
    var meta={spaceName:c.spaceName||c.name||'',uri:c.meetingUri||c.meetingUrl||'',
      code:c.meetingCode||'',createdAtMs:Number(c.createdAtMs||now),
      endsAtMs:Number(c.expiresAtMs||(now+HOUR_MS))};
    if(!meta.uri) throw new Error('لم يتم إرجاع رابط Meet');
    await saveMeeting(bookingId, meta);
    return meta;
  }

  /* ══════════════════════════════════════
     MAIN FLOW
  ══════════════════════════════════════ */
  async function openMeet(bookingId) {
    var _db=db(); var _CU=CU(); var _CP=CP();
    if(!bookingId) { toast('معرّف الجلسة غير صحيح','err'); return; }
    if(!_CU) { toast('يجب تسجيل الدخول أولاً','err'); return; }
    if(!_db) { toast('قاعدة البيانات غير جاهزة','err'); return; }

    var snap, bk;
    try {
      snap=await _db.collection('bookings').doc(bookingId).get();
      if(!snap.exists){toast('لم يُعثر على الحجز','err');return;}
      bk=Object.assign({id:bookingId},snap.data());
    } catch(e){toast('خطأ: '+e.message,'err');return;}

    var uid=_CU.uid;
    var isStudent=bk.studentId===uid, isTutor=bk.tutorId===uid;
    var isAdmin=_CP&&_CP.role==='admin';
    if(!isStudent&&!isTutor&&!isAdmin){toast('⛔ لا صلاحية لهذه الجلسة','err');return;}

    var allowed=['confirmed','active','paused'];
    if(allowed.indexOf(bk.status)===-1){toast('الجلسة غير متاحة حالياً','err');return;}

    // Navigate to session page FIRST (so DOM elements exist)
    if(typeof go==='function') go('session');
    var mainNav=$('mainNav'); if(mainNav) mainNav.style.display='none';
    var sesTitle=$('sesTitle');
    if(sesTitle) sesTitle.textContent='جلسة مع '+(isTutor?(bk.studentName||'الطالب'):(bk.tutorName||'المعلم'));

    // Show loading state immediately
    var other=isTutor?(bk.studentName||'الطالب'):(bk.tutorName||'المعلم');
    var fakeEndsAt=Number(bk.sessionEndsAtMs||bk.meetingEndsAtMs||0)||Date.now()+HOUR_MS;
    renderPanel(bk, {uri:'', endsAtMs:fakeEndsAt}, isTutor);

    // Get or create meeting (may take 1-2s on first time)
    var meeting;
    try { meeting=await getOrCreateMeeting(bookingId,bk); }
    catch(e) { toast('❌ تعذر تجهيز Google Meet: '+e.message,'err'); return; }

    // Preserve original session end time
    var endsAtMs = Number(bk.sessionEndsAtMs||bk.meetingEndsAtMs||0);
    if(!endsAtMs||endsAtMs<Date.now()) endsAtMs = meeting.endsAtMs;
    meeting.endsAtMs = endsAtMs;

    // Update Firestore (only set endsAtMs on first entry)
    try {
      var upd={status:'active',lastEnteredAt:firebase.firestore.FieldValue.serverTimestamp(),meetingProvider:'google-meet'};
      if(!bk.sessionEndsAtMs||Number(bk.sessionEndsAtMs)<=0) {
        upd.sessionEndsAtMs=meeting.endsAtMs; upd.meetingEndsAtMs=meeting.endsAtMs;
      }
      await _db.collection('bookings').doc(bookingId).set(upd,{merge:true});
    } catch(_){}

    // Update global state
    window.curSesBid=bookingId;
    window.curSesBk=Object.assign({},bk,{status:'active',meetingUri:meeting.uri,
      meetingSpaceName:meeting.spaceName,sessionEndsAtMs:endsAtMs,meetingEndsAtMs:endsAtMs});
    window.unreadSes=0;
    cleanup();

    // Render with real link (embedded iframe)
    renderPanel(window.curSesBk, meeting, isTutor);
    startCountdown(endsAtMs, bookingId, isTutor, other);
    if(typeof loadSesChat==='function') loadSesChat(bookingId);

    toast('✅ جلسة Google Meet جاهزة — تفاعل مع النافذة للسماح بالكاميرا','suc');
  }

  window.enterSession = async function(bookingId) {
    try { await openMeet(bookingId); }
    catch(e) { toast('❌ '+(e&&e.message?e.message:'خطأ غير متوقع'),'err'); }
  };

  window.endSession = async function(bookingId, opts) {
    opts=opts||{};
    var _db=db(), _CU=CU();
    var bid=bookingId||window.curSesBid||null;
    var bk=window.curSesBk||null;
    if(!bid) return;
    if(!bk&&_db) {
      try{var s=await _db.collection('bookings').doc(bid).get();if(s.exists) bk=Object.assign({id:bid},s.data());}catch(_){}
    }

    var uid=_CU?_CU.uid:null;
    var isTutor=bk&&bk.tutorId===uid;
    var auto=!!opts.auto;

    if(countdownTimer){clearInterval(countdownTimer);countdownTimer=null;}
    hideFloatTimer();
    cleanup();

    // End Meet space on Google's side
    if((auto||!isTutor)&&bk&&bk.meetingSpaceName) await apiEnd(bk.meetingSpaceName);

    if(_db) {
      var endFully=auto||!isTutor;
      if(endFully) {
        await _db.collection('bookings').doc(bid).set({status:'completed',meetingStatus:'ended',
          completedAt:firebase.firestore.FieldValue.serverTimestamp(),meetingEndedAtMs:Date.now()},{merge:true}).catch(function(){});
        await _db.collection('sessions').doc(bid).set({status:'ended',
          endedAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true}).catch(function(){});
      } else {
        await _db.collection('bookings').doc(bid).set({status:'paused',meetingStatus:'paused',
          lastPausedAt:firebase.firestore.FieldValue.serverTimestamp(),pausedBy:uid},{merge:true}).catch(function(){});
        await _db.collection('sessions').doc(bid).set({status:'paused',
          pausedAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true}).catch(function(){});
      }
    }

    // Remove iframe to stop camera/mic
    var iframe=$('smMeetIframe'); if(iframe){iframe.src='about:blank';iframe.remove();}
    var waitOv=$('waitOv'); if(waitOv){waitOv.classList.add('hidden');waitOv.style.display='none';}
    var mainNav=$('mainNav'); if(mainNav) mainNav.style.display='';

    window.curSesBid=null; window.curSesBk=null;
    if(typeof go==='function') go('dashboard');
    setTimeout(function(){if(typeof dNav==='function') dNav('sessions');},200);
    toast(auto?'⏰ انتهت الجلسة تلقائياً':isTutor?'⏸️ تم إيقاف الجلسة':' ✅ تم إنهاء الجلسة',
          auto?'inf':isTutor?'inf':'suc');
  };

  window.studentExitSession = async function(bookingId) {
    var _db=db(), _CU=CU();
    var bid=bookingId||window.curSesBid||null;
    if(!bid) return;
    if(!confirm('هل تريد مغادرة الجلسة مؤقتاً؟\nيمكنك العودة قبل انتهاء المدة.')) return;
    if(countdownTimer){clearInterval(countdownTimer);countdownTimer=null;}
    hideFloatTimer();
    cleanup();
    var iframe=$('smMeetIframe'); if(iframe){iframe.src='about:blank';iframe.remove();}
    if(_db){
      await _db.collection('bookings').doc(bid).set({status:'paused',meetingStatus:'paused',
        lastPausedAt:firebase.firestore.FieldValue.serverTimestamp(),pausedBy:_CU?_CU.uid:null},{merge:true}).catch(function(){});
      await _db.collection('sessions').doc(bid).set({status:'paused',
        pausedAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true}).catch(function(){});
    }
    var mainNav=$('mainNav'); if(mainNav) mainNav.style.display='';
    window.curSesBid=null; window.curSesBk=null;
    if(typeof go==='function') go('dashboard');
    setTimeout(function(){if(typeof dNav==='function') dNav('sessions');},200);
    toast('🚪 خرجت من الجلسة مؤقتاً','inf');
  };

  window.addEventListener('beforeunload',function(){
    try{if(countdownTimer) clearInterval(countdownTimer);}catch(_){}
  });

  console.log('✅ meet-session.js v9.0 loaded — Embedded Google Meet');
})();
