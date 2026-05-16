/* ═══════════════════════════════════════════════════════════════
   meet-session.js  v8.0 — Skillak × Google Meet
   Clean rewrite: no db-before-init, no raw JS in HTML, fully responsive
   ═══════════════════════════════════════════════════════════════ */
'use strict';

(function () {
  if (window.__skillakMeetBridgeLoaded) return;
  window.__skillakMeetBridgeLoaded = true;

  /* ── Constants ── */
  const HOUR_MS       = 60 * 60 * 1000;
  const CREATE_URL    = '/api/meet/create';
  const END_URL       = '/api/meet/end';

  /* ── State ── */
  let countdownTimer  = null;
  let autoEndLocked   = false;

  /* ── Helpers ── */
  const $  = (id) => document.getElementById(id);
  const db = () => window.db || null;
  const CU = () => window.CU || null;
  const CP = () => window.CP || null;

  function esc(s) {
    return String(s || '')
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  /* Safe toast — never crashes even if #toast element is absent */
  function toast(msg, kind) {
    kind = kind || 'inf';
    try {
      var t = document.getElementById('toast');
      if (t) {
        t.textContent = msg;
        t.className = 'toast ' + (kind === 'suc' ? 'suc' : kind === 'err' ? 'err' : 'inf') + ' show';
        clearTimeout(window.__toastTmr);
        window.__toastTmr = setTimeout(function(){ t.classList.remove('show'); }, 3500);
        return;
      }
    } catch(_) {}
    /* Fallback floating notification */
    try {
      var fb = document.createElement('div');
      fb.textContent = msg;
      var bg = kind === 'err' ? '#dc2626' : kind === 'suc' ? '#059669' : '#0d6e75';
      fb.style.cssText = 'position:fixed;bottom:28px;left:50%;transform:translateX(-50%);' +
        'background:' + bg + ';color:#fff;padding:11px 24px;border-radius:14px;font-size:.9rem;' +
        'z-index:99999;box-shadow:0 4px 24px rgba(0,0,0,.35);font-family:Cairo,sans-serif;' +
        'max-width:90vw;text-align:center;pointer-events:none;direction:rtl';
      document.body.appendChild(fb);
      setTimeout(function(){ if (fb.isConnected) fb.remove(); }, 3500);
    } catch(_) { console.log('[Skillak Toast]', msg); }
  }

  /* Override window.showT globally to make it safe everywhere */
  window.showT = toast;

  function fmtTime(ms) {
    var safe = Math.max(0, ms);
    var h = String(Math.floor(safe / 3600000)).padStart(2,'0');
    var m = String(Math.floor((safe % 3600000) / 60000)).padStart(2,'0');
    var s = String(Math.floor((safe % 60000) / 1000)).padStart(2,'0');
    return h + ':' + m + ':' + s;
  }

  /* ── Global helpers for inline button calls ── */
  window._smOpenMeet   = function() {
    var uri = window._smUri;
    if (uri) window.open(uri, '_blank', 'noopener,noreferrer');
  };
  window._smCopyLink   = function() {
    var uri = window._smUri;
    if (!uri) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(uri)
        .then(function(){ toast('✅ تم نسخ الرابط', 'suc'); })
        .catch(function(){ toast('⚠️ تعذّر النسخ', 'err'); });
    } else {
      try {
        var ta = document.createElement('textarea');
        ta.value = uri; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        document.execCommand('copy'); document.body.removeChild(ta);
        toast('✅ تم نسخ الرابط', 'suc');
      } catch(_) { toast('⚠️ تعذّر النسخ', 'err'); }
    }
  };

  /* ── Render session panel ── */
  function renderPanel(bk, meeting, isTutor) {
    window._smUri = meeting.meetingUri || '';

    var waitOv     = $('waitOv');
    var sesTxt     = $('sesTxt');
    var sesDot     = $('sesDot');
    var sesCountdown = $('sesCountdown');
    var locWrap    = $('locWrap');

    if (locWrap) locWrap.style.display = 'none';

    /* Hide legacy WebRTC controls */
    ['micBtn','camBtn','scrBtn','flipBtn'].forEach(function(id) {
      var el = $(id);
      if (!el) return;
      el.style.display = 'none';
      var wrap = el.closest ? el.closest('.cwrap') : null;
      if (wrap) wrap.style.display = 'none';
    });

    if (sesTxt)  sesTxt.textContent  = meeting.meetingUri ? 'رابط الجلسة جاهز' : 'جارٍ تجهيز الجلسة...';
    if (sesDot)  sesDot.style.background = 'var(--green, #22c55e)';
    if (sesCountdown) {
      sesCountdown.style.display = 'inline-flex';
      sesCountdown.textContent = fmtTime(Math.max(0, Number(meeting.endsAtMs || 0) - Date.now()));
    }

    if (!waitOv) return;
    waitOv.classList.remove('hidden');

    var other   = isTutor ? (bk.studentName || 'الطالب') : (bk.tutorName || 'المعلم');
    var initial = (other[0] || '?').toUpperCase();
    var hasLink = !!meeting.meetingUri;
    var countdown = fmtTime(Math.max(0, Number(meeting.endsAtMs || 0) - Date.now()));

    waitOv.style.cssText = [
      'position:absolute','inset:0','z-index:20',
      'display:flex','align-items:center','justify-content:center',
      'overflow-y:auto','padding:clamp(12px,4vw,32px)',
      'background:linear-gradient(160deg,#0a1628 0%,#0d2137 55%,#071a14 100%)'
    ].join(';');

    waitOv.innerHTML = [
      '<div style="width:min(100%,480px);display:flex;flex-direction:column;',
      'align-items:center;gap:0;text-align:center;font-family:Cairo,sans-serif;color:#fff">',

      /* — Google Meet badge — */
      '<div style="display:flex;align-items:center;gap:8px;',
      'background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12);',
      'border-radius:100px;padding:6px 16px 6px 10px;margin-bottom:24px">',
        '<svg width="20" height="20" viewBox="0 0 48 48" fill="none">',
          '<rect width="48" height="48" rx="10" fill="white" fill-opacity=".15"/>',
          '<path d="M29 24c0 2.76-2.24 5-5 5s-5-2.24-5-5 2.24-5 5-5 5 2.24 5 5z" fill="#4fc3f7"/>',
          '<path d="M34 17l-5 4v6l5 4V17z" fill="#4fc3f7"/>',
        '</svg>',
        '<span style="font-size:.85rem;font-weight:700;letter-spacing:.02em">Google Meet</span>',
      '</div>',

      /* — Avatar — */
      '<div style="width:clamp(56px,12vw,76px);height:clamp(56px,12vw,76px);',
      'border-radius:50%;background:linear-gradient(135deg,#0d6e75,#14b8a6);',
      'display:flex;align-items:center;justify-content:center;',
      'font-size:clamp(1.4rem,4vw,1.9rem);font-weight:900;margin-bottom:10px;',
      'box-shadow:0 4px 20px rgba(20,184,166,.4)">' + esc(initial) + '</div>',

      '<div style="font-size:clamp(.95rem,2.5vw,1.1rem);font-weight:700;margin-bottom:3px">' + esc(other) + '</div>',
      '<div style="font-size:.8rem;opacity:.55;margin-bottom:20px">' + (isTutor ? 'الطالب' : 'المعلم') + '</div>',

      /* — Info card — */
      '<div style="width:100%;background:rgba(255,255,255,.06);',
      'border:1px solid rgba(255,255,255,.1);border-radius:16px;',
      'padding:clamp(12px,3vw,18px) clamp(14px,4vw,22px);margin-bottom:18px;',
      'display:grid;gap:12px;text-align:right">',

        '<div style="display:flex;justify-content:space-between;align-items:center;',
        'font-size:clamp(.8rem,2.2vw,.9rem)">',
          '<strong style="color:' + (hasLink ? '#5eead4' : '#fbbf24') + '">' +
            (hasLink ? '● رابط الجلسة جاهز' : '⏳ جارٍ تجهيز الرابط...') + '</strong>',
          '<span style="opacity:.5;font-size:.78rem">الحالة</span>',
        '</div>',

        '<div style="height:1px;background:rgba(255,255,255,.07)"></div>',

        '<div style="display:flex;justify-content:space-between;align-items:center;',
        'font-size:clamp(.8rem,2.2vw,.9rem)">',
          '<strong id="smCountdown" style="color:#fbbf24;font-variant-numeric:tabular-nums;',
          'letter-spacing:.03em">' + countdown + '</strong>',
          '<span style="opacity:.5;font-size:.78rem">الوقت المتبقي</span>',
        '</div>',

      '</div>',

      /* — Buttons — */
      hasLink ? [
        '<div style="display:flex;gap:10px;width:100%;margin-bottom:14px;flex-wrap:wrap">',
          '<button onclick="window._smOpenMeet()" ',
          'style="flex:2;min-width:140px;padding:clamp(10px,3vw,14px) 20px;',
          'background:linear-gradient(135deg,#0d6e75,#0891b2);color:#fff;border:none;',
          'border-radius:14px;font-size:clamp(.9rem,2.5vw,1rem);font-weight:700;',
          'cursor:pointer;font-family:Cairo,sans-serif;',
          'box-shadow:0 4px 18px rgba(13,110,117,.5)">📹 فتح الجلسة</button>',
          '<button onclick="window._smCopyLink()" ',
          'style="flex:1;min-width:100px;padding:clamp(10px,3vw,14px) 14px;',
          'background:rgba(255,255,255,.09);color:#fff;',
          'border:1px solid rgba(255,255,255,.18);border-radius:14px;',
          'font-size:clamp(.82rem,2.2vw,.92rem);font-weight:600;cursor:pointer;',
          'font-family:Cairo,sans-serif">🔗 نسخ الرابط</button>',
        '</div>',
        '<p style="font-size:.76rem;opacity:.45;line-height:1.75;margin:0">',
          'إذا خرج أحد الطرفين يبقى الرابط محفوظاً حتى انتهاء الساعة.',
        '</p>'
      ].join('') : [
        '<div style="display:flex;align-items:center;gap:10px;opacity:.75;',
        'font-size:.88rem;margin-top:4px">',
          '<div class="spin" style="width:16px;height:16px;border-width:2px;flex-shrink:0"></div>',
          '<span>جارٍ إنشاء رابط Google Meet...</span>',
        '</div>'
      ].join(''),

      '</div>'
    ].join('');

    /* Start countdown timer + floating timer */
    if (countdownTimer) clearInterval(countdownTimer);
    autoEndLocked = false;

    function updateFloatTimer(rem) {
      var ft    = document.getElementById('skillakFloatTimer');
      var ftTxt = document.getElementById('skillakFloatTime');
      var ftSub = document.getElementById('skillakFloatSub');
      if (!ft) return;
      ft.style.display = 'block';
      if (ftTxt) ftTxt.textContent = fmtTime(rem);
      if (ftSub) {
        var mins = Math.ceil(rem / 60000);
        ftSub.textContent = rem <= 0 ? 'انتهى الوقت' : ('متبقي ' + mins + ' دقيقة');
      }
      // Color warning when < 10 min
      if (ftTxt) ftTxt.style.color = rem < 600000 ? '#f59e0b' : '#5eead4';
    }

    countdownTimer = setInterval(function() {
      var rem = Math.max(0, Number(meeting.endsAtMs || 0) - Date.now());
      var txt = fmtTime(rem);
      var el1 = $('smCountdown');
      var el2 = $('sesCountdown');
      if (el1) el1.textContent = txt;
      if (el2) el2.textContent = txt;
      updateFloatTimer(rem);
      if (rem <= 0 && !autoEndLocked) {
        autoEndLocked = true;
        clearInterval(countdownTimer);
        countdownTimer = null;
        var ft = document.getElementById('skillakFloatTimer');
        if (ft) ft.style.display = 'none';
        setTimeout(function() {
          if (typeof window.endSession === 'function')
            window.endSession(bk.id, { auto: true });
        }, 100);
      }
    }, 1000);

    // Show immediately
    updateFloatTimer(Math.max(0, Number(meeting.endsAtMs || 0) - Date.now()));
  }

  /* ── Cleanup legacy WebRTC state ── */
  function cleanup() {
    try { if (typeof _p9_cleanupSessionUi === 'function') _p9_cleanupSessionUi(); } catch(_) {}
    try { if (window.pc) { window.pc.close(); window.pc = null; } } catch(_) {}
    try {
      if (window.locSt) { window.locSt.getTracks().forEach(function(t){ t.stop(); }); window.locSt = null; }
    } catch(_) {}
    try {
      if (window.scrSt) { window.scrSt.getTracks().forEach(function(t){ t.stop(); }); window.scrSt = null; }
    } catch(_) {}
    try { if (window.sesChatL) { window.sesChatL(); window.sesChatL = null; } } catch(_) {}
    try { if (window.sesTInt) { clearInterval(window.sesTInt); window.sesTInt = null; } } catch(_) {}
  }

  /* ── API calls ── */
  async function apiCreate() {
    var resp = await fetch(CREATE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    var text = await resp.text();
    var data = {};
    try { data = JSON.parse(text); } catch(_) {
      if (!resp.ok) throw new Error('HTTP ' + resp.status + ' — invalid response');
    }
    if (!resp.ok) {
      var msg = data.error || data.message || 'HTTP ' + resp.status;
      throw new Error(typeof msg === 'object' ? JSON.stringify(msg) : String(msg));
    }
    return data;
  }

  async function apiEnd(spaceName) {
    if (!spaceName) return;
    try {
      await fetch(END_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spaceName: spaceName }),
      });
    } catch(_) {}
  }

  /* ── Persist meeting metadata to Firestore ── */
  async function saveMeeting(bookingId, meta) {
    var _db = db();
    if (!_db || !bookingId || !meta) return;
    var payload = {
      meetingProvider: 'google-meet',
      meetingSpaceName: meta.spaceName  || '',
      meetingUri:       meta.uri        || '',
      meetingCode:      meta.code       || '',
      meetingCreatedAtMs: meta.createdAtMs || Date.now(),
      meetingEndsAtMs:    meta.endsAtMs    || (Date.now() + HOUR_MS),
      sessionEndsAtMs:    meta.endsAtMs    || (Date.now() + HOUR_MS),
      sessionType: 'google-meet',
      meetingStatus: 'active',
    };
    await _db.collection('bookings').doc(bookingId).set(payload, { merge: true }).catch(function(){});
    await _db.collection('sessions').doc(bookingId).set(
      Object.assign({}, payload, {
        status: 'active',
        startedAt: firebase.firestore.FieldValue.serverTimestamp(),
      }), { merge: true }
    ).catch(function(){});
    return payload;
  }

  /* ── Get or create a Meet link ── */
  async function getOrCreateMeeting(bookingId, bk, forceNew) {
    var now = Date.now();

    // Always re-fetch the booking from Firestore to get the latest meetingUri
    // (critical for the second user who joins after the first creates the link)
    var _db = db();
    if (_db && bookingId) {
      try {
        var freshSnap = await _db.collection('bookings').doc(bookingId).get();
        if (freshSnap.exists) {
          var freshData = freshSnap.data();
          bk = Object.assign({}, bk, freshData, { id: bookingId });
        }
      } catch(_) {}
    }

    var hasValid = bk.meetingUri && Number(bk.meetingEndsAtMs || 0) > now + 15000;

    // If a valid link already exists AND we're not forcing a new one → reuse it
    if (!forceNew && hasValid) {
      return {
        spaceName:   bk.meetingSpaceName || '',
        uri:         bk.meetingUri,
        code:        bk.meetingCode || '',
        createdAtMs: Number(bk.meetingCreatedAtMs || now),
        endsAtMs:    Number(bk.meetingEndsAtMs),
      };
    }

    // No valid link yet → create one (only the first requester; second will reuse above)
    var created = await apiCreate();
    var meta = {
      spaceName:   created.spaceName   || created.name || '',
      uri:         created.meetingUri  || created.meetingUrl || '',
      code:        created.meetingCode || '',
      createdAtMs: Number(created.createdAtMs || now),
      endsAtMs:    Number(created.expiresAtMs || (now + HOUR_MS)),
    };
    if (!meta.uri) throw new Error('لم يتم إرجاع رابط Meet من الخادم');
    await saveMeeting(bookingId, meta);
    return meta;
  }

  /* ════════════════════════════════════════
     Main flow: enterSession → Google Meet
     ════════════════════════════════════════ */
  async function openMeet(bookingId, autoOpen) {
    var _db = db();
    var _CU = CU();
    var _CP = CP();

    if (!bookingId) { toast('معرّف الجلسة غير صحيح', 'err'); return; }
    if (!_CU)       { toast('يجب تسجيل الدخول أولاً', 'err'); return; }
    if (!_db)       { toast('قاعدة البيانات غير جاهزة — أعد التحميل', 'err'); return; }

    var snap, bk;
    try {
      snap = await _db.collection('bookings').doc(bookingId).get();
      if (!snap.exists) { toast('لم يُعثر على الحجز', 'err'); return; }
      bk = Object.assign({ id: bookingId }, snap.data());
    } catch(e) { toast('خطأ: ' + e.message, 'err'); return; }

    var uid      = _CU.uid;
    var isStudent = bk.studentId === uid;
    var isTutor   = bk.tutorId   === uid;
    var isAdmin   = _CP && _CP.role === 'admin';

    if (!isStudent && !isTutor && !isAdmin) { toast('⛔ لا صلاحية لهذه الجلسة', 'err'); return; }

    var allowed = ['confirmed','active','paused'];
    if (allowed.indexOf(bk.status) === -1) { toast('الجلسة غير متاحة حالياً', 'err'); return; }

    // Session persistence: keep the original end time so leaving and rejoining
    // doesn't reset the clock — the session runs until its original end time.
    var existingEndsAt = Number(bk.meetingEndsAtMs || bk.sessionEndsAtMs || 0);
    var sessionStillValid = existingEndsAt > Date.now() + 15000;
    var forceNew = !bk.meetingUri || (!sessionStillValid && bk.status !== 'active');
    var meeting;
    try {
      meeting = await getOrCreateMeeting(bookingId, bk, forceNew);
    } catch(e) {
      toast('❌ تعذر تجهيز Google Meet: ' + e.message, 'err');
      return;
    }

    /* Update booking status — preserve original endsAtMs on re-entry */
    try {
      var updatePayload = {
        status: 'active',
        lastEnteredAt: firebase.firestore.FieldValue.serverTimestamp(),
        meetingProvider: 'google-meet',
      };
      // Only set sessionEndsAtMs if not already set (first entry)
      if (!bk.sessionEndsAtMs || Number(bk.sessionEndsAtMs) <= 0) {
        updatePayload.sessionEndsAtMs = meeting.endsAtMs;
        updatePayload.meetingEndsAtMs = meeting.endsAtMs;
      } else {
        // Re-entry: use saved endsAtMs so clock doesn't reset
        meeting.endsAtMs = Number(bk.sessionEndsAtMs || bk.meetingEndsAtMs || meeting.endsAtMs);
      }
      await _db.collection('bookings').doc(bookingId).set(updatePayload, { merge: true });
    } catch(_) {}

    /* Update global session state */
    window.curSesBid = bookingId;
    window.curSesBk  = Object.assign({}, bk, {
      status: 'active',
      meetingUri: meeting.uri,
      meetingSpaceName: meeting.spaceName,
      sessionEndsAtMs: meeting.endsAtMs,
    });
    window.unreadSes = 0;

    cleanup();

    /* Navigate to session page */
    if (typeof go === 'function') go('session');
    var mainNav = $('mainNav');
    if (mainNav) mainNav.style.display = 'none';

    var sesTitle = $('sesTitle');
    if (sesTitle) sesTitle.textContent = 'جلسة مع ' + (isTutor ? (bk.studentName||'الطالب') : (bk.tutorName||'المعلم'));

    var sesTimer = $('sesTimer');
    if (sesTimer) { sesTimer.textContent = '00:00:00'; sesTimer.style.display = 'none'; }

    renderPanel(window.curSesBk, meeting, isTutor);

    if (typeof loadSesChat === 'function') loadSesChat(bookingId);
    toast('🔗 تم تجهيز جلسة Google Meet', 'suc');

    /* Auto-open Meet in new tab */
    if (autoOpen && meeting.uri) {
      setTimeout(function() {
        try {
          var w = window.open(meeting.uri, '_blank', 'noopener,noreferrer');
          if (!w) toast('اضغط "فتح الجلسة" للانضمام إلى Google Meet', 'inf');
        } catch(_) {}
      }, 300);
    }
  }

  /* ════════════════════════════════════════
     window.enterSession override
     ════════════════════════════════════════ */
  window.enterSession = async function(bookingId) {
    try { await openMeet(bookingId, true); }
    catch(e) { toast('❌ ' + (e && e.message ? e.message : 'خطأ غير متوقع'), 'err'); }
  };

  /* ════════════════════════════════════════
     window.endSession override
     ════════════════════════════════════════ */
  window.endSession = async function(bookingId, opts) {
    opts = opts || {};
    var _db  = db();
    var _CU  = CU();
    var bid  = bookingId || window.curSesBid || null;
    var bk   = window.curSesBk || null;
    if (!bid) return;

    if (!bk && _db) {
      try {
        var s = await _db.collection('bookings').doc(bid).get();
        if (s.exists) bk = Object.assign({ id: bid }, s.data());
      } catch(_) {}
    }
    if (!bk) return;

    var uid       = _CU ? _CU.uid : null;
    var isTutor   = bk.tutorId   === uid;
    var isStudent = bk.studentId === uid;
    var auto      = !!opts.auto;

    if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }
    cleanup();

    var endFully = auto || isStudent || !isTutor;
    if (endFully && bk.meetingSpaceName) await apiEnd(bk.meetingSpaceName);

    if (_db) {
      if (endFully) {
        await _db.collection('bookings').doc(bid).set({
          status: 'completed', meetingStatus: 'ended',
          completedAt: firebase.firestore.FieldValue.serverTimestamp(),
          meetingEndedAtMs: Date.now(),
        }, { merge: true }).catch(function(){});
        await _db.collection('sessions').doc(bid).set({
          status: 'ended', endedAt: firebase.firestore.FieldValue.serverTimestamp(),
        }, { merge: true }).catch(function(){});
      } else {
        await _db.collection('bookings').doc(bid).set({
          status: 'paused', meetingStatus: 'paused',
          lastPausedAt: firebase.firestore.FieldValue.serverTimestamp(),
          pausedBy: uid,
        }, { merge: true }).catch(function(){});
        await _db.collection('sessions').doc(bid).set({
          status: 'paused', pausedAt: firebase.firestore.FieldValue.serverTimestamp(),
        }, { merge: true }).catch(function(){});
      }
    }

    var waitOv = $('waitOv');
    if (waitOv) { waitOv.classList.add('hidden'); waitOv.style.display = 'none'; }
    var mainNav = $('mainNav');
    if (mainNav) mainNav.style.display = '';
    var ft = document.getElementById('skillakFloatTimer');
    if (ft) ft.style.display = 'none';

    window.curSesBid = null;
    window.curSesBk  = null;

    if (typeof go === 'function') go('dashboard');
    setTimeout(function(){ if (typeof dNav === 'function') dNav('sessions'); }, 200);

    toast(auto ? '⏰ انتهت الجلسة تلقائياً بعد ساعة' : isTutor ? '⏸️ تم إيقاف الجلسة مؤقتاً' : '✅ تم إنهاء الجلسة',
          auto ? 'inf' : isTutor ? 'inf' : 'suc');
  };

  /* ════════════════════════════════════════
     window.studentExitSession override
     ════════════════════════════════════════ */
  window.studentExitSession = async function(bookingId) {
    var _db = db();
    var _CU = CU();
    var bid = bookingId || window.curSesBid || null;
    if (!bid) return;
    if (!confirm('هل تريد مغادرة الجلسة مؤقتاً؟\nيمكنك العودة قبل انتهاء المدة.')) return;

    if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }
    cleanup();

    if (_db) {
      await _db.collection('bookings').doc(bid).set({
        status: 'paused', meetingStatus: 'paused',
        lastPausedAt: firebase.firestore.FieldValue.serverTimestamp(),
        pausedBy: _CU ? _CU.uid : null,
      }, { merge: true }).catch(function(){});
      await _db.collection('sessions').doc(bid).set({
        status: 'paused', pausedAt: firebase.firestore.FieldValue.serverTimestamp(),
      }, { merge: true }).catch(function(){});
    }

    var mainNav = $('mainNav');
    if (mainNav) mainNav.style.display = '';
    window.curSesBid = null;
    window.curSesBk  = null;

    if (typeof go === 'function') go('dashboard');
    setTimeout(function(){ if (typeof dNav === 'function') dNav('sessions'); }, 200);
    toast('🚪 خرجت من الجلسة مؤقتاً', 'inf');
  };

  window.addEventListener('beforeunload', function() {
    try { if (countdownTimer) clearInterval(countdownTimer); } catch(_) {}
  });

  /* Restore float timer if user refreshed during an active session */
  (function restoreFloatTimer() {
    var bid = window.curSesBid;
    var bk  = window.curSesBk;
    if (!bid || !bk) return;
    var endsAt = Number(bk.sessionEndsAtMs || bk.meetingEndsAtMs || 0);
    if (!endsAt || endsAt <= Date.now()) return;
    var ft    = document.getElementById('skillakFloatTimer');
    var ftTxt = document.getElementById('skillakFloatTime');
    if (!ft || !ftTxt) return;
    ft.style.display = 'block';
    ftTxt.textContent = fmtTime(Math.max(0, endsAt - Date.now()));
  })();

  console.log('✅ meet-session.js v8.0 loaded — Skillak × Google Meet');
})();
