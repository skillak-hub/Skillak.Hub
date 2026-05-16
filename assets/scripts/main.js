
/* ===== BEGIN script.js ===== */
(function () {
      function forceHideLoading() {
        const el = document.getElementById('loadScreen');
        if (!el) return;
        el.style.opacity = '0';
        el.style.pointerEvents = 'none';
        el.style.display = 'none';
      }

      // Hide even if the main app hits a runtime error later.
      const hideSoon = () => setTimeout(forceHideLoading, 1800);

      if (document.readyState === 'complete' || document.readyState === 'interactive') hideSoon();
      else window.addEventListener('DOMContentLoaded', hideSoon, { once: true });

      window.addEventListener('load', () => setTimeout(forceHideLoading, 1200), { once: true });
      setTimeout(forceHideLoading, 6000);
    })();
  

    /* ── FIREBASE INIT ── */
    firebase.initializeApp({
      apiKey: "AIzaSyAfQUrsU1y0nHSdqOw4EA9wWkouLzOA9Ps",
      authDomain: "fir-c24f7.firebaseapp.com",
      projectId: "fir-c24f7",
      storageBucket: "fir-c24f7.firebasestorage.app",
      messagingSenderId: "65956673453",
      appId: "1:65956673453:web:d4e620b2621aba8a215324"
    });
    const auth = firebase.auth();
    const db = firebase.firestore();
    window.db = db; // expose globally for meet-session.js

    /* ── CONSTANTS ── */
    const DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const TIMES = [
      { v: '08:00', lbl: '8 ص (صباحاً)' }, { v: '09:00', lbl: '9 ص (صباحاً)' },
      { v: '10:00', lbl: '10 ص (صباحاً)' }, { v: '11:00', lbl: '11 ص (صباحاً)' },
      { v: '12:00', lbl: '12 م (ظهراً)' }, { v: '13:00', lbl: '1 م (بعد الظهر)' },
      { v: '14:00', lbl: '2 م (بعد الظهر)' }, { v: '15:00', lbl: '3 م (بعد الظهر)' },
      { v: '16:00', lbl: '4 م (مساءً)' }, { v: '17:00', lbl: '5 م (مساءً)' },
      { v: '18:00', lbl: '6 م (مساءً)' }, { v: '19:00', lbl: '7 م (مساءً)' },
      { v: '20:00', lbl: '8 م (مساءً)' }
    ];
    // Helper: get label from time value
    function timeLbl(v) { const t = TIMES.find(x => x.v === v); return t ? t.lbl : v; }
    const ABG = ['#fde68a', '#5eead4', '#a78bfa', '#86efac', '#fca5a5', '#fcd34d', '#6ee7b7', '#c4b5fd', '#bae6fd', '#fda4af'];
    const AFG = ['#78350f', '#065f46', '#4c1d95', '#166534', '#9f1239', '#78350f', '#064e3b', '#4c1d95', '#075985', '#9f1239'];
    const CATCOL = { 'برمجة': '#0ea5e9', 'تصميم': '#a855f7', 'لغات': '#10b981', 'Excel': '#f59e0b', 'تسويق': '#ef4444', 'مونتاج': '#f97316', 'مهارات وظيفية': '#6366f1', 'موسيقى': '#ec4899' };
    const RTC = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }, { urls: 'stun:stun2.l.google.com:19302' }] };
    function escapeHTML(v = '') {
      return String(v)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function fmtEGP(v) {
      const n = Number(v || 0);
      return `${n.toFixed(2)} ج.م`;
    }

    async function getLatestPairBooking(otherUid) {
      if (!CU || !otherUid) return null;
      try {
        const [s1, s2] = await Promise.all([
          db.collection('bookings').where('studentId', '==', CU.uid).get().catch(() => ({ docs: [] })),
          db.collection('bookings').where('tutorId', '==', CU.uid).get().catch(() => ({ docs: [] }))
        ]);
        const list = [...s1.docs, ...s2.docs]
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(b => (b.studentId === CU.uid && b.tutorId === otherUid) || (b.tutorId === CU.uid && b.studentId === otherUid))
          .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        return list[0] || null;
      } catch (e) {
        return null;
      }
    }

    function canChatOnBooking(bk) {
      if (!bk) return false;
      if (bk.adminConfirmed) return false;
      if (['cancelled', 'refunded'].includes(bk.status)) return false;
      return ['confirmed', 'active', 'paused', 'completed'].includes(bk.status);
    }

    async function refreshChatState(otherUid) {
      const rel = allContacts[otherUid] || { uid: otherUid };
      const latest = await getLatestPairBooking(otherUid);
      const allowed = canChatOnBooking(latest);
      const statusMap = {
        confirmed: 'جلسة نشطة — الشات مفتوح',
        active: 'الجلسة جارية — الشات مفتوح',
        paused: 'الجلسة مؤقتة — الشات مفتوح',
        completed: 'انتهت الجلسة — الشات مفتوح حتى تحويل المستحقات',
        cancelled: 'تم إلغاء الجلسة',
        refunded: 'تمت إعادة المبلغ',
      };
      rel.latestBooking = latest || null;
      rel.chatAllowed = allowed;
      rel.chatStatus = latest ? (latest.adminConfirmed
        ? 'تم تحويل المستحقات — الشات مغلق'
        : (statusMap[latest.status] || latest.status)) : 'لا توجد جلسة نشطة';
      allContacts[otherUid] = rel;
      return rel;
    }

    function canBookTarget(targetId) {
      if (!CU || !CP || !targetId) return false;
      if (CU.uid === targetId) return false;
      // Only learner/both/admin accounts may book. Tutor-only accounts cannot.
      if (CP.role === 'tutor') return false;
      return true;
    }

    async function mirrorSessionToChat(booking, text, senderName, senderPhoto) {
      if (!booking || !booking.studentId || !booking.tutorId) return;
      const threadId = [booking.studentId, booking.tutorId].sort().join('_');
      const payload = {
        threadId,
        senderId: CU.uid,
        senderName: senderName || CP?.name || '—',
        senderPhoto: senderPhoto || CP?.photo || '',
        receiverId: CU.uid === booking.studentId ? booking.tutorId : booking.studentId,
        receiverName: CU.uid === booking.studentId ? booking.tutorName || '—' : booking.studentName || '—',
        receiverPhoto: '',
        text,
        read: false,
        sessionId: booking.id,
        bookingId: booking.id,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      await db.collection('messages').add(payload);
    }

    function setChatUiState(allowed, statusText, showCall = false) {
      const input = document.getElementById('chatInpArea');
      const call = document.getElementById('chatCallBtn');
      const status = document.getElementById('chatHdrStatus');
      const msgs = document.getElementById('chatMsgs');
      if (input) input.style.display = allowed ? 'flex' : 'none';
      if (call) call.style.display = showCall ? 'flex' : 'none';
      if (status && statusText) status.textContent = statusText;
      if (msgs && !allowed && !document.getElementById('chatLockNotice')) {
        msgs.insertAdjacentHTML('afterbegin', `
          <div id="chatLockNotice" style="margin:10px 0 6px;padding:12px 14px;border-radius:14px;background:#fff8e1;border:1px solid #f4d06f;color:#8a5a00;font-size:.82rem;line-height:1.75">
            💬 الشات مغلق حالياً. يفتح بعد تأكيد الجلسة، ويظل متاحاً حتى تحويل المستحقات وإغلاقها نهائياً.
          </div>
        `);
      }
      const lock = document.getElementById('chatLockNotice');
      if (allowed && lock) lock.remove();
    }


    /* ── APP STATE ── */
    let CU = null, CP = null, walBal = 0;
    function syncProfileWindow() {
      try {
        window.CU = CU || null;
        window.CP = CP ? { ...CP } : null;
      } catch (_) {}
      try {
        if (typeof window.refreshAnnouncements === 'function') {
          setTimeout(() => { try { window.refreshAnnouncements(); } catch(_){} }, 80);
        }
      } catch (_) {}
      try {
        if (typeof window.syncWithdrawVisibility === 'function') {
          setTimeout(() => { try { window.syncWithdrawVisibility(); } catch(_){} }, 80);
        }
      } catch (_) {}
    }

    let allT = [], curT = null, selDate = null, selTime = null;
    let allKnownUsers = {};
    let regRole = 'learner', r3SkList = [], regStep = 1;
    let edSkList = [];
    let revStar = 0, revBid = null, revTid = null;
    let dashTab = 'overview';
    let pc = null, locSt = null, scrSt = null, micOn = true, camOn = true, scrOn = false;
    let sesTInt = null, sesSec = 0, sesChatL = null, curSesBid = null, curSesBk = null, unreadSes = 0;
    let curChatUid = null, chatL = null, allContacts = {};
    let msgUnsubL = null;
    let toastTmr = null;
    let userDocL = null, walletDocL = null, usersLiveL = null;
    let supportChatPhoto = '';
    window.supportChatPhoto = supportChatPhoto;

    /* ── SETUP CHECK ── */
    window.addEventListener('DOMContentLoaded', () => {
      // Show setup banner if Firestore hasn't been initialized yet
      db.collection('_ping').doc('test').get().then(() => {
        // Firestore works fine
      })
      // .catch(err => {
      //   if (err.code === 'permission-denied' || err.code === 'unavailable') {
      //     // Show setup guide
      //     const banner = document.createElement('div');
      //     banner.style.cssText = 'position:fixed;top:64px;inset-inline:0;background:#f59e0b;color:#111;padding:12px 20px;z-index:90;text-align:center;font-size:.88rem;font-weight:600;display:flex;align-items:center;justify-content:center;gap:10px';
      //     banner.innerHTML = `طور مهارتك<strong></strong>  مع Skillak <strong></strong> <button onclick="this.parentElement.remove()" style="background:none;border:none;cursor:pointer;font-size:1.2rem">✕</button>`;
      //     document.body.appendChild(banner);
      //   }
      // });

      // Extra safety: if anything blocks auth or Firestore for too long, release the UI anyway.
      setTimeout(() => {
        const el = document.getElementById('loadScreen');
        if (el && getComputedStyle(el).display !== 'none') {
          hideLd(true);
        }
      }, 5000);
    });

    /* ── FIREBASE SETUP CHECK ── */
    // setTimeout(() => {
    //   db.collection('users').limit(1).get().catch(err => {
    //     if (err.code === 'permission-denied' || err.message?.includes('offline') || err.message?.includes('unavailable')) {
    //       const b = document.createElement('div');
    //       b.id = 'setupBanner';
    //       b.style.cssText = 'position:fixed;top:var(--nh);right:0;left:0;background:#f59e0b;color:#111;padding:11px 20px;z-index:90;text-align:center;font-size:.85rem;font-weight:600;display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap';
    //       b.innerHTML = ` تعلّم أي مهارة <strong> من شخص حقيقي </strong> في وقتك أنت<strong> مع Skillak </strong> <button onclick="this.parentElement.remove()" style="background:none;border:none;cursor:pointer;font-size:1.2rem">✕</button>`;
    //       document.body.appendChild(b);
    //     }
    //   });
    // }, 3000);

    /* ── AUTH LISTENER ── */
    auth.onAuthStateChanged(async user => {
      CU = user;
      if (user) {
        try {
          const s = await db.collection('users').doc(user.uid).get();
          if (s.exists) {
            CP = s.data();
            syncProfileWindow();
            await loadWal();
            updNavU();
            startMsgL();
            if (userDocL) { try { userDocL(); } catch(_){} userDocL = null; }
            if (walletDocL) { try { walletDocL(); } catch(_){} walletDocL = null; }
            userDocL = db.collection('users').doc(user.uid).onSnapshot(sn => {
              if (!sn.exists) return;
              CP = { ...(CP || {}), ...sn.data() };
              syncProfileWindow();
              updNavU();
            });
            walletDocL = db.collection('wallets').doc(user.uid).onSnapshot(sn => {
              walBal = sn.exists ? (sn.data().balance || 0) : 0;
              const el = document.getElementById('nwAmt'); if (el) el.textContent = walBal.toFixed(2) + ' ج.م';
              syncWithdrawVisibility();
            });
            console.log('✅ User loaded:', CP.name, '| Role:', CP.role);
          } else {
            // User exists in Auth but not in Firestore - create basic profile
            console.warn('User in Auth but not in Firestore - creating profile');
            CP = { uid: user.uid, email: user.email, name: user.email.split('@')[0], role: 'learner', isApproved: true, rating: 0, totalReviews: 0, totalSessions: 0 };
            syncProfileWindow();
            await db.collection('users').doc(user.uid).set({ ...CP, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
            await db.collection('wallets').doc(user.uid).set({ balance: 0, userId: user.uid });
            updNavU();
            startMsgL();
            if (userDocL) { try { userDocL(); } catch(_){} userDocL = null; }
            if (walletDocL) { try { walletDocL(); } catch(_){} walletDocL = null; }
            userDocL = db.collection('users').doc(user.uid).onSnapshot(sn => {
              if (!sn.exists) return;
              CP = { ...(CP || {}), ...sn.data() };
              syncProfileWindow();
              updNavU();
            });
            walletDocL = db.collection('wallets').doc(user.uid).onSnapshot(sn => {
              walBal = sn.exists ? (sn.data().balance || 0) : 0;
              const el = document.getElementById('nwAmt'); if (el) el.textContent = walBal.toFixed(2) + ' ج.م';
              syncWithdrawVisibility();
            });
          }
        } catch (e) { console.error('auth state:', e); }
      } else {
        if (userDocL) { try { userDocL(); } catch(_){} userDocL = null; }
        if (walletDocL) { try { walletDocL(); } catch(_){} walletDocL = null; }
        CP = null; walBal = 0; updNavG();
      }
      hideLd();
      await seedAndLoad();
    });

    if (!usersLiveL) {
      try {
        usersLiveL = db.collection('users').onSnapshot(snap => {
          const next = {};
          snap.docs.forEach(d => {
            next[d.id] = { id: d.id, ...d.data() };
          });
          allKnownUsers = next;
          try {
            if (typeof renderHeroCards === 'function') renderHeroCards();
            if (typeof renderExplore === 'function') renderExplore();
            if (typeof renderContacts === 'function') renderContacts();
            if (typeof enhanceAdminUserRows === 'function') setTimeout(enhanceAdminUserRows, 30);
            if (typeof ensureSupportThreadPin === 'function') setTimeout(() => ensureSupportThreadPin().catch(() => {}), 60);
            if (curChatUid && allContacts[curChatUid] && allContacts[curChatUid].photo !== (next[curChatUid]?.photo || '')) {
              allContacts[curChatUid] = {
                ...(allContacts[curChatUid] || {}),
                ...next[curChatUid]
              };
              const hdrAv = document.getElementById('chatHdrAv');
              if (hdrAv && document.querySelector('.page:not(.hidden)')?.id === 'page-chat') {
                const photo = next[curChatUid]?.photo || (curChatUid === supportAdminUid ? getSupportChatPhoto() : '');
                if (photo) hdrAv.innerHTML = `<img src="${photo}" style="width:38px;height:38px;border-radius:50%;object-fit:cover">`;
              }
            }
          } catch (_) {}
        });
      } catch (_) {}
    }

    function hideLd(force = false) {
      const el = document.getElementById('loadScreen');
      if (!el) return;
      el.style.opacity = '0';
      el.style.pointerEvents = 'none';
      const hideNow = () => { el.style.display = 'none'; };
      if (force) hideNow();
      else setTimeout(hideNow, 420);
    }

    // Fallbacks so the app never stays stuck on the loading screen
    window.addEventListener('load', () => {
      setTimeout(() => hideLd(true), 900);
    });
    setTimeout(() => {
      const el = document.getElementById('loadScreen');
      if (el && getComputedStyle(el).display !== 'none') {
        console.warn('Loading screen fallback triggered');
        hideLd(true);
      }
    }, 12000);

    /* ── NAV ── */
    function updNavU() {
      document.getElementById('ngst').style.display = 'none';
      document.getElementById('nusr').style.display = 'flex';
      const av = document.getElementById('navAv');
      if (CP?.photo) { av.innerHTML = `<img src="${CP.photo}">`; }
      else { av.textContent = CP?.name?.[0] || 'أ'; av.style.background = CP?.color || 'var(--amber)'; }
      document.getElementById('nwAmt').textContent = walBal.toFixed(2) + ' ج.م';
      document.getElementById('nlD').style.display = 'block';
      document.getElementById('nlC').style.display = 'block';
      document.getElementById('nlA').style.display = CP?.role === 'admin' ? 'block' : 'none';
      // Update mobile menu
      if (typeof updMobNav === 'function') updMobNav();
    }
    function updNavG() {
      document.getElementById('ngst').style.display = 'flex';
      document.getElementById('nusr').style.display = 'none';
      document.getElementById('nlD').style.display = 'none';
      document.getElementById('nlC').style.display = 'none';
      document.getElementById('nlA').style.display = 'none';
      // Update mobile menu
      if (typeof updMobNav === 'function') updMobNav();
    }

    /* ── MSG BADGE LISTENER ── */
    let bookingNotifL = null;
    function startMsgL() {
      if (!CU || msgUnsubL) return;
      // Unread messages badge
      msgUnsubL = db.collection('messages')
        .where('receiverId', '==', CU.uid)
        .where('read', '==', false)
        .onSnapshot(snap => {
          const cnt = snap.size;
          const badge = document.getElementById('msgBadge');
          const bnBadge = document.getElementById('bnBadge');
          if (cnt > 0) {
            badge.textContent = cnt > 9 ? '9+' : cnt; badge.classList.remove('hidden');
            if (bnBadge) { bnBadge.textContent = cnt > 9 ? '9+' : cnt; bnBadge.classList.remove('hidden'); }
          } else {
            badge.classList.add('hidden');
            if (bnBadge) bnBadge.classList.add('hidden');
          }
        }, err => console.warn('msgBadge listener:', err.code));

      // Real-time booking notifications for tutors
      if (CP && (CP.role === 'tutor' || CP.role === 'both')) {
        if (!bookingNotifL) {
          let isFirst = true;
          bookingNotifL = db.collection('bookings')
            .where('tutorId', '==', CU.uid)
            .where('status', '==', 'confirmed')
            .onSnapshot(snap => {
              if (isFirst) { isFirst = false; return; } // skip initial load
              snap.docChanges().forEach(change => {
                if (change.type === 'added') {
                  const bk = change.doc.data();
                  showT(`🔔 حجز جديد من ${bk.studentName || 'طالب'} بتاريخ ${bk.date} ${bk.time}`, 'inf');
                }
              });
            });
        }
      }
    }

    /* ── SEED + LOAD TEACHERS ── */
    async function seedAndLoad() {
      // No demo seeding - only real users from Firestore
      await loadT();
    }

    async function loadT() {
      try {
        // Query without orderBy to avoid needing a composite index
        // We sort client-side by rating
        // Load ALL tutors regardless of isApproved (filter client-side)
        const snap = await db.collection('users')
          .where('role', 'in', ['tutor', 'both'])
          .get();
        const users = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        allKnownUsers = users.reduce((acc, u) => { acc[u.id] = u; return acc; }, {});
        allT = users
          .filter(t => ['tutor', 'both'].includes(t.role))
          .filter(t => t.isApproved !== false) // show approved tutors (default true if not set)
          .sort((a, b) => (b.rating || 0) - (a.rating || 0)); // sort by rating desc
        const tc = allT.length;
        const ts = allT.reduce((s, t) => s + (t.totalSessions || 0), 0);
        const hST = document.getElementById('hST'); if (hST) hST.textContent = tc + '+';
        const hSS = document.getElementById('hSS'); if (hSS) hSS.textContent = (ts > 999 ? Math.round(ts / 1000) + 'K' : ts) + '+';
        const hTag = document.getElementById('hTagCnt'); if (hTag) hTag.textContent = tc + '+';
        renderFeat();
        renderExplore();
        renderHeroCards();
      } catch (e) { console.error('loadT:', e); }
    }

    function renderHeroCards() {
      const el = document.getElementById('heroFloatCards');
      if (!el || !allT.length) return;
      const top3 = allT.slice(0, 3);
      el.innerHTML = top3.map((t, i) => {
        const bg = t.color || ABG[i % ABG.length];
        const fg = t.fgColor || AFG[i % AFG.length];
        const avHTML = t.photo
          ? `<img src="${t.photo}" style="width:40px;height:40px;border-radius:50%;object-fit:cover">`
          : `<div class="fcav" style="background:${bg};color:${fg}">${t.emoji || t.name?.[0] || 'م'}</div>`;
        const cat = (t.skills || []).slice(0, 2).join(' & ') || t.category || '';
        const genderWord = ['س', 'ن', 'ر', 'ل', 'م'].includes(t.name?.[0]) ? 'متصلة الآن' : 'متصل الآن';
        return `<div class="fc">${avHTML}<div><div class="fcname">${t.name}</div><div class="fcsub">${cat} · $${t.price || 0}/ساعة</div><div class="lb"><div class="ld"></div>${genderWord}</div></div></div>`;
      }).join('');
    }

    /* ── TEACHER CARD HTML ── */
    function tcHTML(t) {
      const idx = (t.name?.charCodeAt(0) || 0) % ABG.length;
      const bg = t.color || ABG[idx];
      const fg = t.fgColor || AFG[idx];
      const avIn = t.photo
        ? `<img src="${t.photo}" style="width:100%;height:100%;object-fit:cover">`
        : `<span style="color:${fg}">${t.emoji || t.name?.[0] || '؟'}</span>`;
      const bc = CATCOL[t.category] || '#0d6e75';
      const rat = t.rating ? parseFloat(t.rating).toFixed(1) : '—';
      const skStr = (t.skills || []).slice(0, 3).join(' · ');
      return `<div class="tc" onclick="openProf('${t.id}')">
    <div class="tcban" style="background:linear-gradient(135deg,${bc} 0%,${bc}bb 100%)">
      <div class="tcav" style="background:${bg}">${avIn}</div><div class="tcdot"></div>
    </div>
    <div class="tcb">
      <div class="tcname">${t.name}</div>
      <div class="tcsk">${skStr}</div>
      <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:2px">
        <span class="tag">${t.category || ''}</span>
        <span class="tag tag-a" style="margin-right:4px">${t.lang || ''}</span>
        ${t.experience ? `<span class="tag tag-g" style="margin-right:4px">${t.experience}سنة خبرة </span>` : ''}
      </div>
      <div class="tcmeta">
        <div class="tcrat"><span class="stars">★</span> ${rat} <span style="color:var(--muted);font-size:.78rem">(${t.totalReviews || 0})</span></div>
        <div class="tcprice">$${t.price || 0} <small>/ ساعة</small></div>
      </div>
    </div>
  </div>`;
    }

    function renderFeat() {
      const el = document.getElementById('featGrid'); if (!el) return;
      const top = allT.slice(0, 4); // already sorted by rating desc
      el.innerHTML = top.length ? top.map(tcHTML).join('') : '<div class="empty"><div class="emptyic">👨‍🏫</div><p>لا يوجد معلمون بعد</p></div>';
    }

    /* ── EXPLORE ── */
    function renderExplore() {
      const q = (document.getElementById('exSrch')?.value || '').toLowerCase();
      const cat = document.getElementById('exCat')?.value || '';
      const minR = parseFloat(document.getElementById('exRat')?.value || 0);
      const maxP = parseFloat(document.getElementById('exPrc')?.value || 9999);
      const lng = document.getElementById('exLng')?.value || '';
      const srt = document.getElementById('exSort')?.value || 'rating';

      let list = allT.filter(t => {
        const ms = !q || t.name?.toLowerCase().includes(q) || (t.skills || []).some(s => s.toLowerCase().includes(q)) || t.category?.toLowerCase().includes(q) || t.bio?.toLowerCase().includes(q);
        return ms && (!cat || t.category === cat) && (t.rating || 0) >= minR && (t.price || 0) <= maxP && (!lng || t.lang === lng);
      });

      // Sort
      if (srt === 'sessions') list = [...list].sort((a, b) => (b.totalSessions || 0) - (a.totalSessions || 0));
      else if (srt === 'price_asc') list = [...list].sort((a, b) => (a.price || 0) - (b.price || 0));
      else if (srt === 'price_desc') list = [...list].sort((a, b) => (b.price || 0) - (a.price || 0));
      // default 'rating' — allT is already sorted by rating desc from Firestore

      const el = document.getElementById('exploreGrid');
      const cnt = document.getElementById('exCnt');
      if (cnt) cnt.textContent = `عرض ${list.length} من ${allT.length} معلم`;
      if (el) el.innerHTML = list.length ? list.map(tcHTML).join('') : `<div class="empty"><div class="emptyic">🔍</div><p style="font-weight:700;font-size:1rem;margin-bottom:8px">لم يتم العثور على نتائج</p><p>جرّب تغيير كلمة البحث أو الفلاتر</p></div>`;
    }

    /* ── PROFILE ── */
    async function openProf(id) {
      // Always fetch fresh from Firestore to get latest rating/availability
      try {
        const s = await db.collection('users').doc(id).get();
        if (s.exists) {
          curT = { id: s.id, ...s.data() };
          // Update local cache too
          const idx = allT.findIndex(t => t.id === id);
          if (idx >= 0) allT[idx] = curT;
          else allT.push(curT);
        }
      } catch (e) {
        curT = allT.find(t => t.id === id);
      }
      if (!curT) { showT('تعذّر تحميل بيانات المعلم', 'err'); return; }
      selDate = null; selTime = null;
      const t = curT;
      const idx = (t.name?.charCodeAt(0) || 0) % ABG.length;
      const bg = t.color || ABG[idx];
      const fg = t.fgColor || AFG[idx];
      const avIn = t.photo ? `<img src="${t.photo}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">` : `<span style="color:${fg}">${t.emoji || t.name?.[0] || '؟'}</span>`;

      // Load reviews
      let revHTML = '<div style="text-align:center;padding:20px;color:var(--muted);font-size:.83rem">لا توجد تقييمات بعد. كن أول من يقيّم!</div>';
      try {
        const rs = await db.collection('reviews').where('tutorId', '==', id).limit(5).get();
        if (!rs.empty) revHTML = rs.docs.map(d => {
          const r = d.data();
          const dt = r.createdAt?.toDate ? r.createdAt.toDate().toLocaleDateString('ar-SA') : '';
          const st = '★'.repeat(r.rating || 5) + '☆'.repeat(5 - (r.rating || 5));
          return `<div class="revitem"><div class="revhd"><div class="revname">${r.studentName || 'طالب'} <span class="stars" style="font-size:.8rem">${st}</span></div><div class="revdate">${dt}</div></div><p class="revtxt">${r.comment || ''}</p></div>`;
        }).join('');
      } catch (e) { }

      // Load availability
      let avHTML = '<div style="color:var(--muted);font-size:.81rem">لا توجد أوقات محددة</div>';
      try {
        const av = await db.collection('availability').doc(id).get();
        if (av.exists && av.data().slots) {
          const sl = av.data().slots;
          const adays = DAYS.filter(d => sl[d] && sl[d].length);
          if (adays.length) avHTML = `<div class="avdisp">${adays.map(d => `<div class="avdcol"><div class="avdname">${d}</div>${(sl[d] || []).map(s => `<div class="avdslot">${s}</div>`).join('')}</div>`).join('')}</div>`;
        }
      } catch (e) { }

      document.getElementById('profMain').innerHTML = `
    <div class="profhero">
      <div class="profav" style="background:${bg}">${avIn}</div>
      <div>
        <div class="profname">${t.name}</div>
        <div class="profmeta">
          <span>⭐ ${(t.rating || 0).toFixed(1)} · ${t.totalReviews || 0} تقييم</span>
          <span>🎯 ${t.totalSessions || 0} جلسة</span>
          <span>🌐 ${t.lang || ''}</span>
          <span>📍 ${t.country || ''}</span>
          <span>📂 ${t.category || ''}</span>
        </div>
      </div>
    </div>
    <div class="profsec"><h3>نبذة تعريفية</h3><p style="color:#374151;line-height:1.78;font-size:.88rem">${t.bio || 'لا يوجد وصف.'}</p></div>
    <div class="profsec">
      <h3>الخبرة والكفاءات</h3>
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px">
        ${t.experience ? `<div class="expb"><span>🏆</span><div><strong>${t.experience} سنة</strong><div style="font-size:.72rem;color:var(--muted)">خبرة</div></div></div>` : ''}
        <div class="expb"><span>📂</span><div><strong>${t.category || '—'}</strong><div style="font-size:.72rem;color:var(--muted)">التخصص</div></div></div>
        <div class="expb"><span>💰</span><div><strong>$${t.price || 0}/ساعة</strong><div style="font-size:.72rem;color:var(--muted)">السعر</div></div></div>
      </div>
      <div class="skchips">${(t.skills || []).map(s => `<span class="skchip">${s}</span>`).join('')}</div>
    </div>
    <div class="profsec"><h3>الأوقات المتاحة للحجز</h3>${avHTML}</div>
    <div class="profsec"><h3>تقييمات الطلاب (${t.totalReviews || 0})</h3>${revHTML}</div>
  `;

      const mustLogin = !CU;
      const canChat = CU && CU.uid !== id;
      const safeId = id.replace(/'/g, "\\'");
      const safeName = (t.name || '').replace(/'/g, "\\'");
      const safeEmoji = (t.emoji || t.name?.[0] || '؟').replace(/'/g, "\\'");
      const safeColor = (t.color || ABG[idx]).replace(/'/g, "\\'");
      const safeFgCol = (t.fgColor || AFG[idx]).replace(/'/g, "\\'");

      document.getElementById('profSidebar').innerHTML = `
    <div class="bksb">
      <div class="bkprice">$${t.price || 0}</div>
      <div class="bkplbl">لكل ساعة · جلسة فيديو مباشر 🎥</div>
      <div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:13px">
        <span class="tag">⭐ ${(t.rating || 0).toFixed(1)}</span>
        <span class="tag tag-g">✅ ${t.totalSessions || 0} جلسة</span>
        <span class="tag tag-a">🌐 ${t.lang || ''}</span>
      </div>
      <div class="fg"><label>📅 اختر التاريخ</label><input type="date" id="bkDI" min="${new Date().toISOString().split('T')[0]}" onchange="onDateChg('${safeId}')"/></div>
      <div id="slotsArea"><div style="font-size:.78rem;color:var(--muted);padding:9px;background:var(--cream2);border-radius:var(--rsm)">اختر تاريخاً لعرض الأوقات المتاحة</div></div>
      <button class="btn btn-p" style="width:100%;margin-top:12px;margin-bottom:8px" onclick="${mustLogin ? `openM('loginMod')` : (!canBookTarget('${safeId}') ? `showT('لا يمكنك حجز جلسة مع نفسك أو كمعلّم فقط','err')` : 'openBkMod()')}">
        ${mustLogin ? '🔐 سجّل دخولك للحجز' : '📅 احجز جلسة فيديو الآن'}
      </button>
      ${canChat ? `<button class="btn btn-o" style="width:100%;margin-bottom:8px" onclick="openChatWith('${safeId}','${safeName}','','${safeColor}','${safeFgCol}','${safeEmoji}')">💬 راسل المعلم واستفسر</button>` : ''}
      <div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--border);font-size:.7rem;color:var(--muted);text-align:center;line-height:1.85">
        🎥 فيديو مباشر داخل المنصة<br/>🎤 ميكروفون · 📷 كاميرا · 🖥️ مشاركة شاشة<br/>💬 شات مثل واتساب مع المعلم<br/>💳 دفع آمن من محفظتك
      </div>
    </div>
  `;
      go('profile');
    }

    async function onDateChg(tid) {
      const v = document.getElementById('bkDI')?.value;
      if (!v) return;
      selDate = v; selTime = null;
      const area = document.getElementById('slotsArea');
      area.innerHTML = '<div style="padding:9px;color:var(--muted);font-size:.8rem;display:flex;align-items:center;gap:7px"><div class="spin spin-sm"></div> جاري تحميل المواعيد...</div>';
      let booked = [];
      try {
        const bs = await db.collection('bookings').where('tutorId', '==', tid).where('date', '==', v).where('status', 'in', ['pending', 'confirmed']).get();
        booked = bs.docs.map(d => d.data().time);
      } catch (e) { }
      let slots = [];
      try {
        const av = await db.collection('availability').doc(tid).get();
        if (av.exists && av.data().slots) {
          const dn = DAYS[new Date(v + 'T12:00:00').getDay()];
          if (av.data().slots[dn]) slots = av.data().slots[dn];
        }
      } catch (e) { }
      if (!slots.length) {
        area.innerHTML = '<div style="font-size:.82rem;color:var(--red);padding:12px 14px;background:var(--red2);border-radius:var(--rsm);border-right:3px solid var(--red)">⛔ المعلم غير متاح في هذا اليوم. جرّب يوماً آخر.</div>';
        return;
      }
      area.innerHTML = `<div class="fg" style="margin-bottom:0"><label style="margin-bottom:7px">⏰ اختر وقت الجلسة (${slots.length - booked.length} متاح)</label><div class="tsGrid">${slots.map(s => {
        const tk = booked.includes(s);
        const lbl = timeLbl(s);
        return `<div class="tsbtn ${tk ? 'taken' : ''}" ${!tk ? `onclick="selSlot('${s}',this)"` : ''}>
      ${tk ? `${lbl}<br><small style="font-size:.6rem;opacity:.7">محجوز</small>` : lbl}
    </div>`;
      }).join('')}</div></div>`;
    }

    function selSlot(t, el) {
      document.querySelectorAll('.tsbtn:not(.taken)').forEach(b => b.classList.remove('sel'));
      el.classList.add('sel');
      selTime = t;
    }

    function openBkMod() {
      if (!CU) { openM('loginMod'); return; }
      if (!selDate) { showT('اختر تاريخاً أولاً', 'err'); return; }
      if (!selTime) { showT('اختر وقت الجلسة', 'err'); return; }
      const t = curT, fees = calcBookingFees(t.price);
      document.getElementById('bkTch').textContent = t.name;
      document.getElementById('bkDt').textContent = selDate;
      document.getElementById('bkTm').textContent = timeLbl(selTime) || selTime;
      document.getElementById('bkPrc').textContent = fees.price.toFixed(2) + ' ج.م';
      document.getElementById('bkStudentFee').textContent = fees.studentFee.toFixed(2) + ' ج.م';
      document.getElementById('bkTutorFee').textContent = fees.tutorFee.toFixed(2) + ' ج.م';
      document.getElementById('bkFee').textContent = fees.platformFee.toFixed(2) + ' ج.م';
      document.getElementById('bkTot').textContent = fees.totalDue.toFixed(2) + ' ج.م';
      document.getElementById('bkBal').textContent = walBal.toFixed(2) + ' ج.م';
      const ins = walBal < fees.totalDue;
      document.getElementById('bkInsuf').classList.toggle('hidden', !ins);
      document.getElementById('bkBtn').disabled = ins;
      openM('bkMod');
    }

    async function confirmBk() {
      if (!CU || !curT) return;
      const t = curT;
      const noteEl = document.getElementById('bkNote');
      const btn = document.getElementById('bkBtn');
      if (!selDate) { showT('اختر تاريخ الجلسة أولاً', 'err'); return; }
      if (!selTime) { showT('اختر وقت الجلسة أولاً', 'err'); return; }
      if (!canBookTarget(t.id)) { showT('لا يمكنك الحجز مع نفسك أو كمعلّم فقط', 'err'); closeM('bkMod'); return; }
      if (btn) { btn.textContent = 'جاري الحجز...'; btn.disabled = true; }
      const fees = calcBookingFees(t.price);
      try {
        // Hold money from student wallet immediately
        await db.runTransaction(async tx => {
          const r = db.collection('wallets').doc(CU.uid);
          const s = await tx.get(r);
          const b = s.exists ? (s.data().balance || 0) : 0;
          if (b < fees.totalDue) throw new Error('رصيد غير كافٍ');
          tx.set(r, { balance: b - fees.totalDue, userId: CU.uid }, { merge: true });
        });
        const bRef = await db.collection('bookings').add({
          studentId: CU.uid, studentName: CP?.name || CU.email,
          studentPhone: CP?.phone || '',
          tutorId: t.id, tutorName: t.name,
          date: selDate, time: selTime, timeLbl: timeLbl(selTime), duration: 60,
          sessionStartsAtMs: new Date(`${selDate}T${selTime}:00`).getTime(),
          sessionEndsAtMs: new Date(`${selDate}T${selTime}:00`).getTime() + (60 * 60000),
          price: fees.price, fee: fees.studentFee, studentFee: fees.studentFee, tutorFee: fees.tutorFee, platformFee: fees.platformFee, total: fees.totalDue,
          note: noteEl?.value || '',
          status: 'pending',
          reviewed: false, paymentStatus: 'held',
          adminConfirmed: false,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        await db.collection('transactions').add({
          userId: CU.uid, type: 'debit', kind: 'booking', amount: fees.totalDue,
          description: `حجز جلسة مع ${t.name} — بتاريخ ${selDate} ${timeLbl(selTime)}`,
          bookingId: bRef.id, status: 'held',
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        const threadId = [CU.uid, t.id].sort().join('_');
        await db.collection('messages').add({
          threadId, senderId: CU.uid, senderName: CP?.name || '—', senderPhoto: CP?.photo || '',
          receiverId: t.id, receiverName: t.name, receiverPhoto: t.photo || '',
          text: `📅 طلب حجز جلسة بتاريخ ${selDate} الساعة ${timeLbl(selTime)}.${noteEl?.value ? '\nملاحظة: ' + noteEl.value : ''}\n⏳ يُرجى الموافقة أو الرفض من لوحة التحكم.`,
          read: false, isBookingNotif: true, bookingId: bRef.id,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        }).catch(() => { });
        walBal -= fees.totalDue;
        const nw = document.getElementById('nwAmt');
        if (nw) nw.textContent = walBal.toFixed(2) + ' ج.م';
        closeM('bkMod');
        showT('⏳ تم تقديم طلب الحجز — في انتظار موافقة المعلم', 'suc');
        allContacts[t.id] = { uid: t.id, name: t.name, photo: t.photo || '', color: t.color || '', fgColor: t.fgColor || '', emoji: t.emoji || t.name?.[0] || '؟' };
        setTimeout(() => { dashTab = 'sessions'; go('dashboard'); }, 1400);
      } catch (e) {
        showT('خطأ: ' + e.message, 'err');
      } finally {
        if (btn) { btn.textContent = 'تأكيد الدفع والحجز'; btn.disabled = false; }
      }
    }

    // Tutor: approve booking
    async function tutorApproveBk(bid, studentId, tot) {
      if (!confirm('الموافقة على هذا الحجز؟')) return;
      try {
        await db.collection('bookings').doc(bid).update({ status: 'confirmed', confirmedAt: firebase.firestore.FieldValue.serverTimestamp() });
        // Notify student
        const bData = (await db.collection('bookings').doc(bid).get()).data();
        const threadId = [CU.uid, studentId].sort().join('_');
        await db.collection('messages').add({
          threadId, senderId: CU.uid, senderName: CP?.name || '—', senderPhoto: CP?.photo || '',
          receiverId: studentId, receiverName: bData?.studentName || '—', receiverPhoto: '',
          text: `✅ تمت الموافقة على حجزك بتاريخ ${bData?.date || ''} الساعة ${bData?.timeLbl || bData?.time || ''}.\nنراك قريباً! 🎉`,
          read: false, createdAt: firebase.firestore.FieldValue.serverTimestamp()
        }).catch(() => { });
        showT('✅ تمت الموافقة على الحجز وإشعار الطالب', 'suc');
        await dNav('sessions');
      } catch (e) { showT('خطأ: ' + e.message, 'err'); }
    }

    // Tutor: reject booking (refund student)
    async function tutorRejectBk(bid, studentId, refund) {
      if (!confirm('رفض هذا الحجز؟ سيتم استرداد المبلغ للطالب.')) return;
      try {
        await db.runTransaction(async tx => {
          const wr = db.collection('wallets').doc(studentId);
          const ws = await tx.get(wr);
          const wb = ws.exists ? (ws.data().balance || 0) : 0;
          tx.set(wr, { balance: wb + refund, userId: studentId }, { merge: true });
          tx.update(db.collection('bookings').doc(bid), { status: 'cancelled', rejectedBy: 'tutor', cancelledAt: firebase.firestore.FieldValue.serverTimestamp() });
        });
        await db.collection('transactions').add({
          userId: studentId, type: 'credit', kind: 'booking', amount: refund,
          description: 'استرداد — رفض المعلم للحجز', bookingId: bid,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        // Notify student
        const bData = (await db.collection('bookings').doc(bid).get()).data();
        const threadId = [CU.uid, studentId].sort().join('_');
        await db.collection('messages').add({
          threadId, senderId: CU.uid, senderName: CP?.name || '—', senderPhoto: CP?.photo || '',
          receiverId: studentId, receiverName: bData?.studentName || '—', receiverPhoto: '',
          text: `❌ عذراً، لم أتمكن من تأكيد حجزك بتاريخ ${bData?.date || ''}.\nتم استرداد المبلغ كاملاً لمحفظتك. يمكنك اختيار وقت آخر.`,
          read: false, createdAt: firebase.firestore.FieldValue.serverTimestamp()
        }).catch(() => { });
        showT('تم رفض الحجز وإعادة المبلغ للطالب', 'suc');
        await dNav('sessions');
      } catch (e) { showT('خطأ: ' + e.message, 'err'); }
    }

    /* ── WALLET ── */
    async function loadWal() {
      if (!CU) return;
      try {
        const s = await db.collection('wallets').doc(CU.uid).get();
        walBal = s.exists ? (s.data().balance || 0) : 0;
        const el = document.getElementById('nwAmt'); if (el) el.textContent = walBal.toFixed(2) + ' ج.م';
      } catch (e) { }
    }

    /* ══════════════════════════════════════════════
       MULTI-METHOD PAYMENT SYSTEM
       ══════════════════════════════════════════════ */

    let paySelectedAmt = 0;
    let activePayTab = 'instapay';
    let activeWdMethod = '';

    function selAmt(amt, btn) {
      paySelectedAmt = amt;
      document.getElementById('customAmt').value = '';
      document.querySelectorAll('.amt-btn').forEach(b => b.classList.remove('sel', 'selected'));
      btn.classList.add('sel', 'selected');
      showPayAmt();
    }

    function selAmtCustom(amt) {
      paySelectedAmt = amt;
      document.querySelectorAll('.amt-btn').forEach(b => b.classList.remove('sel', 'selected'));
      showPayAmt();
    }

    function showPayAmt() {
      const d = document.getElementById('paySelDisplay');
      const a = document.getElementById('paySelAmt');
      if (paySelectedAmt > 0) {
        if (d) d.style.display = 'block';
        if (a) a.textContent = `${paySelectedAmt} جنيه مصري`;
      } else {
        if (d) d.style.display = 'none';
      }
    }

    function switchPayTab(tab, btn) {
      activePayTab = tab;
      document.querySelectorAll('.pay-tab').forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.pay-panel').forEach(p => p.classList.remove('active'));
      document.getElementById(`panel-${tab}`).classList.add('active');
    }

    function cpyTxt(txt, lbl) {
      navigator.clipboard.writeText(txt).then(() => showT(`✅ تم نسخ ${lbl}`, 'suc')).catch(() => showT('تعذّر النسخ', 'err'));
    }

    function genFawryCode() {
      const code = '01004959936';
      const el = document.getElementById('fawryCode');
      if (el) el.textContent = code;
      cpyTxt(code, 'رقم Fawry');
    }

    function selWdMethod(method) {
      activeWdMethod = method;
      document.querySelectorAll('.withdraw-method-btn').forEach(b => b.classList.remove('sel'));
      document.getElementById(`wm-${method}`)?.classList.add('sel');
      const lbl = document.getElementById('wdAccLabel');
      if (lbl) {
        const labels = { instapay: 'رقم الهاتف المسجل في InstaPay', vodafone: 'رقم فودافون كاش', bank: 'رقم الحساب البنكي + اسم البنك' };
        lbl.innerHTML = (labels[method] || 'رقم الحساب') + ' <span class="req">*</span>';
      }
    }

    async function submitPayment() {
      if (!CU) { openM('loginMod'); return; }
      if (!paySelectedAmt || paySelectedAmt < 20) { showT('الحد الأدنى للشحن 20 جنيه', 'err'); return; }

      const refInput = document.getElementById(`ref-${activePayTab}`);
      const ref = refInput?.value.trim();
      if (!ref) { showT('أدخل رقم العملية / الإيصال أولاً', 'err'); return; }

      const btn = document.getElementById('paySubmitBtn');
      btn.disabled = true;
      btn.innerHTML = '<div class="spin spin-sm spin-wh" style="display:inline-block"></div> جاري الإرسال...';

      const methodNames = { instapay: 'InstaPay', vodafone: 'فودافون كاش', fawry: 'Fawry', bank: 'تحويل بنكي' };
      const reqRef = db.collection('paymentRequests').doc();

      try {
        await db.runTransaction(async tx => {
          tx.set(reqRef, {
            userId: CU.uid,
            userName: CP?.name || CU.email,
            userPhone: CP?.phone || '',
            amount: paySelectedAmt,
            currency: 'EGP',
            method: activePayTab,
            methodName: methodNames[activePayTab] || activePayTab,
            refNumber: ref,
            status: 'pending',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
          tx.set(db.collection('transactions').doc(reqRef.id), {
            userId: CU.uid,
            type: 'credit',
            kind: 'topup',
            amount: paySelectedAmt,
            currency: 'EGP',
            status: 'pending',
            description: `طلب شحن محفظة — ${methodNames[activePayTab] || activePayTab}`,
            requestId: reqRef.id,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        });

        const pdAmt = document.getElementById('pdAmt');
        const pdMethod = document.getElementById('pdMethod');
        if (pdAmt) pdAmt.textContent = `${paySelectedAmt} جنيه مصري`;
        if (pdMethod) pdMethod.textContent = methodNames[activePayTab];
        openM('payDoneMod');
        if (refInput) refInput.value = '';
        const customAmt = document.getElementById('customAmt');
        if (customAmt) customAmt.value = '';
        paySelectedAmt = 0;
        document.querySelectorAll('.amt-btn').forEach(b => b.classList.remove('sel', 'selected'));
        const psd = document.getElementById('paySelDisplay');
        if (psd) psd.style.display = 'none';
        await loadTxList().catch(() => { });
      } catch (e) {
        showT('خطأ: ' + e.message, 'err');
      } finally {
        btn.disabled = false;
        btn.innerHTML = '<span>📤</span> إرسال طلب الشحن';
      }
    }

    // Old submitWithdrawal replaced by new version in buildWithdrawPage

    async function loadWdHistory() {
      const el = document.getElementById('wdHistory'); if (!el || !CU) return;
      const snap = await db.collection('withdrawalRequests').where('userId', '==', CU.uid).get().catch(() => ({ docs: [] }));
      const docs = [...snap.docs].map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
        .slice(0, 10);

      if (!docs.length) { el.innerHTML = ''; return; }

      const stMap = {
        pending: '<span class="wrq-status wrq-pending">⏳ قيد المراجعة</span>',
        approved: '<span class="wrq-status wrq-approved">✅ تمت الموافقة</span>',
        rejected: '<span class="wrq-status wrq-rejected">❌ مرفوض</span>'
      };

      el.innerHTML = `<div style="font-weight:700;font-size:.85rem;margin-bottom:10px">طلبات السحب السابقة</div>` +
        docs.map(r => {
          const dt = r.createdAt?.toDate ? r.createdAt.toDate().toLocaleDateString('ar-SA') : '—';
          return `<div class="withdraw-req-card"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px">
            <div>
              <div style="font-weight:700;font-size:.86rem">${r.amount} ${r.currency} — ${r.methodName}</div>
              <div style="font-size:.72rem;color:var(--muted);margin-top:3px">${r.accountNumber} · ${dt}</div>
            </div>
            ${stMap[r.status] || ''}
          </div></div>`;
        }).join('');
    }


    function normalizeRole(v) {
      return String(v || '').trim().toLowerCase();
    }

    function isTutorRole(role) {
      role = normalizeRole(role);
      return ['tutor', 'both', 'admin', 'teacher', 'معلم', 'معلم/طالب'].includes(role);
    }

    function syncWithdrawVisibility(forceShow) {
      const wCard = document.getElementById('withdrawCard');
      if (!wCard) return;
      const shouldShow = typeof forceShow === 'boolean' ? forceShow : isTutorRole(CP?.role);
      wCard.style.display = shouldShow ? 'block' : 'none';
      wCard.hidden = !shouldShow;
      wCard.setAttribute('aria-hidden', shouldShow ? 'false' : 'true');
    }

    window.syncWithdrawVisibility = syncWithdrawVisibility;

    async function loadTxList() {
      const el = document.getElementById('txList'); if (!el || !CU) return;
      el.innerHTML = '<div style="padding:28px;text-align:center"><div class="spin" style="margin:0 auto"></div></div>';
      const ws = await db.collection('wallets').doc(CU.uid).get().catch(() => null);
      if (ws?.exists) {
        walBal = ws.data().balance || 0;
        const wb = document.getElementById('wBal'); if (wb) wb.textContent = walBal.toFixed(2);
        const navAmt = document.getElementById('nwAmt'); if (navAmt) navAmt.textContent = walBal.toFixed(2) + ' ج.م';
      }

      const wdBal = document.getElementById('wdBal');
      if (wdBal) wdBal.textContent = walBal.toFixed(2) + ' ج.م';

      const isTutor = isTutorRole(CP?.role);
      syncWithdrawVisibility(isTutor);
      if (isTutor) loadWdHistory();

      const snap = await db.collection('transactions').where('userId', '==', CU.uid).get().catch(() => ({ docs: [] }));
      const visible = [...snap.docs].map(d => ({ id: d.id, ...d.data() }))
        .filter(tx => {
          const kind = String(tx.kind || '').toLowerCase();
          if (!kind) {
            const desc = String(tx.description || '').toLowerCase();
            return /شحن|سحب|withdraw|top.?up|payment/.test(desc);
          }
          return kind === 'topup' || kind === 'withdrawal';
        })
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

      if (!visible.length) {
        el.innerHTML = '<div class="empty" style="padding:40px"><div class="emptyic">📭</div><p>لا توجد معاملات مالية بعد</p><p style="font-size:.8rem;color:var(--muted);margin-top:6px">ستظهر هنا عمليات الشحن والسحب الخاصة بك فقط</p></div>';
        return;
      }

      let totalIn = 0, totalOut = 0;
      visible.forEach(tx => {
        const kind = String(tx.kind || '').toLowerCase();
        if (kind === 'topup' && tx.status === 'approved') totalIn += tx.amount || 0;
        if (kind === 'withdrawal' && tx.status === 'approved') totalOut += tx.amount || 0;
      });
      const ti = document.getElementById('wTotalIn');
      const to = document.getElementById('wTotalOut');
      if (ti) ti.textContent = totalIn.toFixed(2) + ' ج.م';
      if (to) to.textContent = totalOut.toFixed(2) + ' ج.م';

      const statusPill = (status, kind) => {
        const map = {
          pending: '<span class="pill pp">⏳ قيد المراجعة</span>',
          approved: '<span class="pill pc">✅ معتمد</span>',
          rejected: '<span class="pill pca">❌ مرفوض</span>'
        };
        return map[status] || `<span class="pill ${kind === 'topup' ? 'pc' : 'pp'}">${status || '—'}</span>`;
      };

      el.innerHTML = visible.map(tx => {
        const kind = String(tx.kind || '').toLowerCase();
        const isIn = kind === 'topup';
        const isOut = kind === 'withdrawal';
        const dt = tx.createdAt?.toDate ? tx.createdAt.toDate().toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' }) : '-';
        const desc = tx.description || (isIn ? 'شحن محفظة' : isOut ? 'سحب أرباح' : '-');
        const amtSign = isIn ? '+' : '-';
        return `<div class="txitem">
          <div style="display:flex;align-items:center;gap:12px">
            <div class="txic ${isIn ? 'cr' : 'db'}" style="font-size:1.1rem">${isIn ? '💰' : '💸'}</div>
            <div>
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                <div style="font-weight:700;font-size:.84rem">${desc}</div>
                ${statusPill(tx.status, kind)}
              </div>
              <div style="font-size:.71rem;color:var(--muted);margin-top:2px">${dt}</div>
            </div>
          </div>
          <div class="${isIn ? 'txcr' : 'txdb'}" style="font-weight:900;font-size:.95rem">
            ${amtSign}${(tx.amount || 0).toFixed(2)} ج.م
          </div>
        </div>`;
      }).join('');
    }

    /* ── WHATSAPP CHAT ── */
    function openChatWith(uid, name, photo, color, fgColor, emoji) {
      if (!CU) { openM('loginMod'); return; }
      allContacts[uid] = { uid, name, photo: photo || '', color: color || '', fgColor: fgColor || '', emoji: emoji || name?.[0] || '؟' };
      go('chat');
      setTimeout(() => openConv(uid), 150);
    }

    async function loadChatPage() {
      if (!CU) return;
      await loadContacts();
      if (curChatUid && allContacts[curChatUid]) await openConv(curChatUid);
    }

    async function loadContacts() {
      if (!CU) return;
      const uid = CU.uid;
      try {
        const [s1, s2] = await Promise.all([
          db.collection('messages').where('senderId', '==', uid).get().catch(() => ({ docs: [] })),
          db.collection('messages').where('receiverId', '==', uid).get().catch(() => ({ docs: [] }))
        ]);
        const threads = {};
        [...s1.docs, ...s2.docs].forEach(d => {
          const m = d.data();
          const oid = m.senderId === uid ? m.receiverId : m.senderId;
          const onam = m.senderId === uid ? m.receiverName : m.senderName;
          const oph = m.senderId === uid ? (m.receiverPhoto || '') : (m.senderPhoto || '');
          const ts = m.createdAt?.seconds || 0;
          if (!threads[oid] || ts > (threads[oid].ts || 0)) {
            threads[oid] = { uid: oid, name: onam || '—', photo: oph, lastMsg: m.text || '', ts, unread: 0 };
          }
        });
        // Count unread messages per thread
        [...s2.docs].forEach(d => {
          const m = d.data();
          if (!m.read && threads[m.senderId]) {
            threads[m.senderId].unread = (threads[m.senderId].unread || 0) + 1;
          }
        });
        // Merge with allContacts for avatar/color info
        Object.values(threads).forEach(c => {
          if (!allContacts[c.uid]) {
            allContacts[c.uid] = { uid: c.uid, name: c.name, photo: c.photo, color: '', fgColor: '', emoji: c.name?.[0] || '؟' };
          } else {
            allContacts[c.uid].name = c.name || allContacts[c.uid].name;
          }
        });
        renderContacts(Object.values(threads).filter(t => t.uid).sort((a, b) => b.ts - a.ts));
      } catch (e) {
        console.error('loadContacts:', e);
      }
    }

    function renderContacts(list) {
      const el = document.getElementById('contactsList'); if (!el) return;
      if (!list.length) {
        el.innerHTML = '<div class="nocont"><div class="emptyic" style="font-size:2.5rem;margin-bottom:8px">💬</div><p>لا توجد محادثات بعد.<br/>ابحث عن معلم وراسله!</p></div>';
        return;
      }
      el.innerHTML = list.map(c => {
        const ci = allContacts[c.uid] || {};
        const idx = (c.name?.charCodeAt(0) || 0) % ABG.length;
        const bg = ci.color || ABG[idx];
        const fg = ci.fgColor || AFG[idx];
        const avC = ci.photo ? `<img src="${ci.photo}" style="width:46px;height:46px;border-radius:50%;object-fit:cover">` : `<span style="color:${fg};font-weight:900;font-family:'Fraunces',serif">${ci.emoji || c.name?.[0] || '؟'}</span>`;
        const time = c.ts ? new Date(c.ts * 1000).toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' }) : '';
        return `<div class="citem ${c.uid === curChatUid ? 'act' : ''}" id="ci-${c.uid}" onclick="openConv('${c.uid}')">
      <div class="ciav" style="background:${bg}">${avC}</div>
      <div class="ciinfo">
        <div class="ciname">${c.name || '—'}</div>
        <div class="ciprev">${c.lastMsg || 'ابدأ المحادثة...'}</div>
      </div>
      <div class="citime">${time}</div>
      ${c.unread > 0 ? `<div class="cibadge">${c.unread > 9 ? '9+' : c.unread}</div>` : ''}
    </div>`;
      }).join('');
    }

    function filterContacts() {
      const q = (document.getElementById('cpSrch')?.value || '').toLowerCase();
      document.querySelectorAll('.citem').forEach(el => {
        const nm = el.querySelector('.ciname')?.textContent.toLowerCase() || '';
        el.style.display = (!q || nm.includes(q)) ? 'flex' : 'none';
      });
    }

    async function openConv(uid) {
      curChatUid = uid;
      const ci = allContacts[uid] || {};
      if (chatL) { chatL(); chatL = null; }

      const refreshed = await refreshChatState(uid);
      const idx = (refreshed.name?.charCodeAt(0) || 0) % ABG.length;
      const bg = refreshed.color || ABG[idx];
      const fg = refreshed.fgColor || AFG[idx];
      const hdrAv = document.getElementById('chatHdrAv');
      const convPhoto = refreshed.photo || (uid === supportAdminUid ? getSupportChatPhoto() : '');
      if (convPhoto) { hdrAv.innerHTML = `<img src="${escapeHTML(convPhoto)}" style="width:38px;height:38px;border-radius:50%;object-fit:cover">`; }
      else { hdrAv.textContent = refreshed.emoji || refreshed.name?.[0] || '؟'; }
      hdrAv.style.background = bg;
      const chatHdrName = document.getElementById('chatHdrName');
      if (chatHdrName) chatHdrName.textContent = refreshed.name || '—';
      if (CP?.role === 'admin' && uid !== supportAdminUid) {
        const chatHdrStatus = document.getElementById('chatHdrStatus');
        if (chatHdrStatus) chatHdrStatus.textContent = 'دردشة مفتوحة من خدمة العملاء';
      }
      setChatUiState(!!refreshed.chatAllowed, refreshed.chatStatus || 'لا توجد جلسة نشطة', !!refreshed.chatAllowed);

      document.querySelectorAll('.citem').forEach(el => el.classList.toggle('act', el.id === `ci-${uid}`));

      const threadId = [CU.uid, uid].sort().join('_');
      const msgsEl = document.getElementById('chatMsgs');
      msgsEl.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:10px;color:var(--muted)"><div class="spin spin-sm"></div><span style="font-size:.84rem">جاري تحميل الرسائل...</span></div>';

      chatL = db.collection('messages').where('threadId', '==', threadId).onSnapshot(async snap => {
        if (!snap.docs.length) {
          msgsEl.innerHTML = '<div class="chatempty"><div class="chatemptyic">👋</div><p style="font-weight:700;margin-bottom:6px">ابدأ المحادثة!</p><p style="font-size:.82rem;color:var(--muted)">اكتب رسالتك الأولى أدناه</p></div>';
          return;
        }

        const docs = [...snap.docs].sort((a, b) => {
          const ta = a.data().createdAt?.seconds || 0;
          const tb = b.data().createdAt?.seconds || 0;
          return ta - tb;
        });

        const unread = docs.filter(d => d.data().receiverId === CU.uid && !d.data().read);
        if (unread.length) {
          const batch = db.batch();
          unread.forEach(d => batch.update(d.ref, { read: true }));
          batch.commit().catch(() => { });
        }

        let prevDate = '', html = '';
        const todayStr = new Date().toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' });

        docs.forEach(d => {
          const m = d.data();
          const mine = m.senderId === CU.uid;
          const dt = m.createdAt?.toDate ? m.createdAt.toDate() : new Date();
          const dateStr = dt.toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' });
          const timeStr = dt.toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' });

          if (dateStr !== prevDate) {
            html += `<div class="datesep"><span>${dateStr === todayStr ? 'اليوم' : escapeHTML(dateStr)}</span></div>`;
            prevDate = dateStr;
          }

          const rtick = mine ? (m.read ? `<span class="rtick" title="مُقرأة">✓✓</span>` : `<span style="color:rgba(0,0,0,.35);font-size:.7rem">✓</span>`) : '';
          const senderLabel = !mine ? (escapeHTML(m.senderName || (m.senderRole === 'support' ? 'خدمة العملاء' : '')) || '') : '';
          html += `<div class="mrow ${mine ? 'mine' : 'theirs'}">
        <div class="mbub ${mine ? 'mine' : 'theirs'}">
          ${senderLabel ? `<div class="msender">${senderLabel}</div>` : ''}
          <div class="mtext">${escapeHTML(m.text || '')}</div>
          <div class="mtime"><span>${timeStr}</span>${rtick}</div>
        </div>
      </div>`;
        });

        msgsEl.innerHTML = html;
        setTimeout(() => { msgsEl.scrollTop = msgsEl.scrollHeight; }, 30);
      }, err => {
        console.error('chat listener error:', err);
        msgsEl.innerHTML = `<div style="text-align:center;padding:30px;color:var(--red)"><div style="font-size:2rem;margin-bottom:10px">⚠️</div><p style="font-weight:700">تعذّر تحميل الرسائل</p><p style="font-size:.8rem;color:var(--muted);margin-top:6px">${escapeHTML(err.message || '')}</p></div>`;
      });
    }

    async function sendMsg() {
      const inp = document.getElementById('chatInp');
      const text = inp.value.trim();
      if (!text || !curChatUid || !CU) return;
      const rel = await refreshChatState(curChatUid);
      if (!rel.chatAllowed) {
        showT('الشات يعمل بعد تأكيد الجلسة فقط', 'err');
        return;
      }
      inp.value = '';
      const threadId = [CU.uid, curChatUid].sort().join('_');
      const tgt = allContacts[curChatUid] || {};
      try {
        const isAdminSupport = CP?.role === 'admin';
        const payload = {
          threadId,
          senderId: CU.uid,
          senderName: isAdminSupport ? 'خدمة العملاء' : (CP?.name || '—'),
          senderPhoto: isAdminSupport ? getSupportChatPhoto() : (CP?.photo || ''),
          senderRole: isAdminSupport ? 'support' : 'user',
          receiverId: curChatUid, receiverName: tgt.name || '—', receiverPhoto: tgt.photo || '',
          text, read: false,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        await db.collection('messages').add(payload);
        if (rel.latestBooking?.id) {
          await db.collection('sessions').doc(rel.latestBooking.id).collection('chat').add({
            senderId: CU.uid,
            senderName: CP?.name || '—',
            text,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          }).catch(() => { });
        }
        await loadContacts();
      } catch (e) { showT('خطأ في الإرسال', 'err'); }
    }

    function startVideoFromChat() {
      if (!curChatUid) { go('dashboard'); setTimeout(() => dNav('sessions'), 120); return; }
      go('dashboard');
      setTimeout(() => dNav('sessions'), 120);
    }

    /* ── SESSION (WebRTC) ── */
    async function enterSession(bookingId) {
      const bS = await db.collection('bookings').doc(bookingId).get();
      if (!bS.exists) { showT('لم يتم العثور على الجلسة', 'err'); return; }
      const bk = bS.data();
      if (!isBookingStillOpen(bk)) { showT('انتهى وقت الجلسة أو لم تعد متاحة للدخول', 'err'); return; }
      const isTutor = bk.tutorId === CU.uid;
      curSesBid = bookingId; curSesBk = bk; sesSec = 0; unreadSes = 0;
      if (sesTInt) clearInterval(sesTInt);
      if (sesChatL) sesChatL();
      document.getElementById('sesTitle').textContent = `جلسة مع ${isTutor ? bk.studentName : bk.tutorName}`;
      document.getElementById('mainNav').style.display = 'none';
      document.getElementById('waitOv').classList.remove('hidden');
      document.getElementById('sesDot').style.background = 'var(--amber)';
      document.getElementById('sesTxt').textContent = 'جاري الاتصال...';
      document.getElementById('sesTimer').textContent = '00:00:00';
      go('session');

      // Get media
      try {
        locSt = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        document.getElementById('locVid').srcObject = locSt;
        micOn = true; camOn = true; updCtrl();
      } catch (e) { showT('⚠️ تعذّر الوصول للكاميرا/الميكروفون: ' + e.message, 'err'); locSt = null; }

      // WebRTC
      pc = new RTCPeerConnection(RTC);
      if (locSt) locSt.getTracks().forEach(t => pc.addTrack(t, locSt));

      pc.ontrack = e => {
        document.getElementById('remVid').srcObject = e.streams[0];
        document.getElementById('waitOv').classList.add('hidden');
        document.getElementById('sesDot').style.background = 'var(--green)';
        document.getElementById('sesTxt').textContent = 'متصل';
        if (!sesTInt) {
          sesTInt = setInterval(() => {
            sesSec++;
            const h = Math.floor(sesSec / 3600), m = Math.floor((sesSec % 3600) / 60), s = sesSec % 60;
            document.getElementById('sesTimer').textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
          }, 1000);
        }
      };
      pc.oniceconnectionstatechange = () => {
        if (['failed', 'disconnected'].includes(pc.iceConnectionState)) {
          document.getElementById('sesDot').style.background = 'var(--red)';
          document.getElementById('sesTxt').textContent = 'انقطع الاتصال...';
          document.getElementById('waitOv').classList.remove('hidden');
        }
      };

      const sesRef = db.collection('sessions').doc(bookingId);
      await db.collection('bookings').doc(bookingId).set({
        status: 'active',
        lastEnteredAt: firebase.firestore.FieldValue.serverTimestamp(),
        sessionEndsAtMs: bk.sessionEndsAtMs || getBookingEndMs(bk)
      }, { merge: true }).catch(() => { });

      if (isTutor) {
        pc.onicecandidate = async e => { if (e.candidate) await sesRef.collection('tCand').add(e.candidate.toJSON()); };
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await sesRef.set({ offer: { type: offer.type, sdp: offer.sdp }, tutorId: CU.uid, status: 'active', startedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
        sesRef.onSnapshot(async snap => {
          const d = snap.data();
          if (d?.answer && !pc.currentRemoteDescription) {
            try { await pc.setRemoteDescription(new RTCSessionDescription(d.answer)); } catch (e) { }
          }
        });
        sesRef.collection('sCand').onSnapshot(snap => {
          snap.docChanges().forEach(async c => {
            if (c.type === 'added') { try { await pc.addIceCandidate(new RTCIceCandidate(c.doc.data())); } catch (e) { } }
          });
        });
      } else {
        pc.onicecandidate = async e => { if (e.candidate) await sesRef.collection('sCand').add(e.candidate.toJSON()); };
        const doAns = async of => {
          if (pc.currentRemoteDescription) return;
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(of));
            const ans = await pc.createAnswer();
            await pc.setLocalDescription(ans);
            await sesRef.update({ answer: { type: ans.type, sdp: ans.sdp }, studentId: CU.uid });
          } catch (e) { console.error('answer:', e); }
        };
        const sn = await sesRef.get();
        if (sn.exists && sn.data()?.offer) await doAns(sn.data().offer);
        else sesRef.onSnapshot(async sn => { const d = sn.data(); if (d?.offer && !pc.currentRemoteDescription) await doAns(d.offer); });
        sesRef.collection('tCand').onSnapshot(snap => {
          snap.docChanges().forEach(async c => {
            if (c.type === 'added') { try { await pc.addIceCandidate(new RTCIceCandidate(c.doc.data())); } catch (e) { } }
          });
        });
      }
      loadSesChat(bookingId);
    }

    function loadSesChat(bid) {
      if (sesChatL) sesChatL();
      sesChatL = db.collection('sessions').doc(bid).collection('chat').orderBy('createdAt', 'asc').onSnapshot(snap => {
        const el = document.getElementById('sesMsgs'); if (!el) return;
        el.innerHTML = snap.docs.map(d => {
          const m = d.data(), mine = m.senderId === CU?.uid;
          const t = m.createdAt?.toDate ? m.createdAt.toDate().toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' }) : '';
          return `<div style="display:flex;flex-direction:column;align-items:${mine ? 'flex-end' : 'flex-start'}">
        <div class="sesmb ${mine ? 'mine' : 'theirs'}">${escapeHTML(m.text || '')}<div class="sesmeta">${t}</div></div>
      </div>`;
        }).join('');
        el.scrollTop = el.scrollHeight;
        const canTalk = !!curSesBk && canChatOnBooking(curSesBk);
        const inp = document.getElementById('sesInp');
        if (inp) inp.disabled = !canTalk;
        const btn = document.querySelector('#sesChatPnl .btn.btn-p.btn-sm');
        if (btn) btn.disabled = !canTalk;
        if (document.getElementById('sesChatPnl').classList.contains('hidden')) {
          unreadSes++;
          if (unreadSes > 0) document.getElementById('chatTogBtn').classList.add('unread');
        } else {
          unreadSes = 0; document.getElementById('chatTogBtn').classList.remove('unread');
        }
      });
    }

    async function sendSesMsg() {
      const inp = document.getElementById('sesInp'), text = inp.value.trim();
      if (!text || !curSesBid || !curSesBk || !canChatOnBooking(curSesBk)) {
        showT('الشات يعمل أثناء الجلسة وحتى تحويل المستحقات فقط', 'err');
        return;
      }
      inp.value = '';
      try {
        await db.collection('sessions').doc(curSesBid).collection('chat').add({
          senderId: CU.uid,
          senderName: CP?.name || 'أنا',
          text,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        await mirrorSessionToChat(curSesBk, text, CP?.name || 'أنا', CP?.photo || '');
      }
      catch (e) { }
    }

    function toggleSesChat() {
      const p = document.getElementById('sesChatPnl');
      p.classList.toggle('hidden');
      if (!p.classList.contains('hidden')) { unreadSes = 0; document.getElementById('chatTogBtn').classList.remove('unread'); }
    }

    function togMic() {
      if (!locSt) return;
      micOn = !micOn;
      locSt.getAudioTracks().forEach(t => t.enabled = micOn);
      updCtrl();
    }
    function togCam() {
      if (!locSt) return;
      camOn = !camOn;
      locSt.getVideoTracks().forEach(t => t.enabled = camOn);
      document.getElementById('camOffOv').style.display = camOn ? 'none' : 'flex';
      updCtrl();
    }
    let camFacing = 'user';
    async function switchCameraFacing() {
      try {
        if (!locSt || !navigator.mediaDevices?.enumerateDevices) {
          showT('تبديل الكاميرا غير متاح على هذا الجهاز', 'err');
          return;
        }
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cams = devices.filter(d => d.kind === 'videoinput');
        if (cams.length < 2) {
          showT('لا توجد كاميرا ثانية متاحة على هذا الجهاز', 'err');
          return;
        }
        const currentTrack = locSt.getVideoTracks()[0];
        const currentLabel = currentTrack?.label || '';
        let next = cams.find(d => d.label && d.label !== currentLabel) || cams[(cams.findIndex(d => d.label === currentLabel) + 1) % cams.length];
        camFacing = camFacing === 'user' ? 'environment' : 'user';
        const constraints = { video: { deviceId: next?.deviceId ? { exact: next.deviceId } : undefined, facingMode: camFacing }, audio: true };
        const newStream = await navigator.mediaDevices.getUserMedia(constraints);
        const newVideoTrack = newStream.getVideoTracks()[0];
        const oldAudioTracks = locSt.getAudioTracks();
        if (pc) {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video');
          if (sender) await sender.replaceTrack(newVideoTrack).catch(() => {});
        }
        locSt.getVideoTracks().forEach(t => t.stop());
        locSt = new MediaStream([newVideoTrack, ...oldAudioTracks]);
        document.getElementById('locVid').srcObject = locSt;
        showT('تم تبديل الكاميرا', 'suc');
      } catch (e) {
        showT('تعذر تبديل الكاميرا: ' + (e?.message || e), 'err');
      }
    }
    async function togScr() {
      if (!navigator.mediaDevices?.getDisplayMedia) {
        showT('مشاركة الشاشة غير مدعومة على هذا الجهاز أو المتصفح', 'err');
        return;
      }
      if (scrOn) {
        if (scrSt) scrSt.getTracks().forEach(t => t.stop());
        if (locSt) {
          const ct = locSt.getVideoTracks()[0];
          if (ct) {
            const s = pc?.getSenders().find(s => s.track?.kind === 'video');
            if (s) await s.replaceTrack(ct).catch(() => {});
            document.getElementById('locVid').srcObject = locSt;
          }
        }
        scrOn = false;
      } else {
        try {
          scrSt = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
          const st = scrSt.getVideoTracks()[0];
          const s = pc?.getSenders().find(s => s.track?.kind === 'video');
          if (s) await s.replaceTrack(st).catch(() => {});
          document.getElementById('locVid').srcObject = scrSt;
          st.onended = () => {
            if (scrOn) togScr();
          };
          scrOn = true;
        } catch (e) { showT('تعذّرت مشاركة الشاشة: ' + (e?.message || e), 'err'); return; }
      }
      updCtrl();
    }
    function updCtrl() {
      const m = document.getElementById('micBtn'); m.className = 'cbtn ' + (micOn ? 'on' : 'off'); m.textContent = micOn ? '🎤' : '🔇';
      const c = document.getElementById('camBtn'); c.className = 'cbtn ' + (camOn ? 'on' : 'off'); c.textContent = camOn ? '📷' : '📵';
      const s = document.getElementById('scrBtn'); s.className = 'cbtn ' + (scrOn ? 'scron' : 'on'); s.textContent = scrOn ? '⏹️' : '🖥️';
    }

    async function endSession() {
      const mins = Math.floor(sesSec / 60);
      const secs = sesSec % 60;
      const durStr = mins > 0 ? `${mins} دقيقة ${secs > 0 ? 'و' + secs + ' ثانية' : ''}` : `${secs} ثانية`;
      if (!confirm(`هل تريد إنهاء الجلسة؟\nمدة الجلسة: ${durStr}`)) return;
      if (sesTInt) clearInterval(sesTInt);
      if (sesChatL) sesChatL();
      if (pc) { pc.close(); pc = null; }
      if (locSt) locSt.getTracks().forEach(t => t.stop());
      if (scrSt) scrSt.getTracks().forEach(t => t.stop());
      locSt = null; scrSt = null;

      if (curSesBid) {
        try {
          const bS = await db.collection('bookings').doc(curSesBid).get();
          const bk = bS.data();
          const endMs = getBookingEndMs(bk);
          const stillOpen = endMs && Date.now() < endMs;
          if (stillOpen) {
            await db.collection('sessions').doc(curSesBid).set({
              status: 'paused',
              pausedAt: firebase.firestore.FieldValue.serverTimestamp(),
              sessionEndsAtMs: endMs
            }, { merge: true }).catch(() => { });
            await db.collection('bookings').doc(curSesBid).set({
              status: 'paused',
              lastPausedAt: firebase.firestore.FieldValue.serverTimestamp(),
              sessionEndsAtMs: endMs
            }, { merge: true }).catch(() => { });
            curSesBk = null;
            document.getElementById('mainNav').style.display = '';
            go('dashboard');
            showT('تم إغلاق الجلسة مؤقتًا. يمكن للمعلم والطالب الدخول مرة أخرى قبل انتهاء الوقت.', 'inf');
            return;
          }

          await db.collection('sessions').doc(curSesBid).update({ status: 'ended', endedAt: firebase.firestore.FieldValue.serverTimestamp() }).catch(() => { });
          await db.collection('bookings').doc(curSesBid).update({ status: 'completed', completedAt: firebase.firestore.FieldValue.serverTimestamp() }).catch(() => { });
          curSesBk = null;
          curSesBk = null;
          curSesBk = null;

          document.getElementById('mainNav').style.display = '';
          go('dashboard');

          if (bk?.tutorId === CU?.uid) {
            setTimeout(() => {
              revBid = curSesBid; revTid = bk.studentId;
              const ti = document.getElementById('revTutorInfo');
              if (ti) {
                const stBg = ABG[(bk.studentName?.charCodeAt(0) || 0) % ABG.length] || '#fde68a';
                ti.innerHTML = `<div style="width:42px;height:42px;border-radius:50%;background:${stBg};display:flex;align-items:center;justify-content:center;font-weight:900;font-family:'Fraunces',serif;font-size:1.1rem;flex-shrink:0">${bk.studentName?.[0] || 'ط'}</div><div><div style="font-weight:700;font-size:.9rem">${bk.studentName}</div><div style="font-size:.75rem;color:var(--muted)">طالب · ${bk.date} ${bk.time}</div></div>`;
              }
              const sub = document.getElementById('revSub');
              if (sub) sub.textContent = `قيّم جلستك مع ${bk.studentName}`;
              setSt(0); document.getElementById('revCmt').value = '';
              openM('revMod');
            }, 700);
          } else {
            setTimeout(() => {
              revBid = curSesBid; revTid = bk.tutorId;
              const ti = document.getElementById('revTutorInfo');
              if (ti) {
                const tData = allT.find(t => t.id === bk.tutorId) || {};
                const bg = tData.color || '#fde68a';
                const avHTML = tData.photo ? `<img src="${tData.photo}" style="width:42px;height:42px;border-radius:50%;object-fit:cover">` : `<div style="width:42px;height:42px;border-radius:50%;background:${bg};display:flex;align-items:center;justify-content:center;font-weight:900;font-family:'Fraunces',serif;font-size:1.1rem;flex-shrink:0">${bk.tutorName?.[0] || 'م'}</div>`;
                ti.innerHTML = `${avHTML}<div><div style="font-weight:700;font-size:.9rem">${bk.tutorName}</div><div style="font-size:.75rem;color:var(--muted)">${tData.category || 'معلم'} · ${bk.date} ${bk.time}</div></div>`;
              }
              const sub = document.getElementById('revSub');
              if (sub) sub.textContent = `كيف كانت جلستك مع ${bk.tutorName}؟`;
              setSt(0); document.getElementById('revCmt').value = '';
              openM('revMod');
            }, 600);
          }
        } catch (e) {
          console.error('endSession:', e);
          document.getElementById('mainNav').style.display = '';
          go('dashboard');
        }
      } else {
        document.getElementById('mainNav').style.display = '';
        go('dashboard');
      }
    }

    /* ── REVIEWS ── */
    const STAR_LABELS = ['', 'ضعيف 😞', 'مقبول 😐', 'جيد 🙂', 'جيد جداً 😊', 'ممتاز! 🌟'];
    function setSt(n) {
      revStar = n;
      document.querySelectorAll('.sbtn').forEach((b, i) => b.classList.toggle('lit', i < n));
      const lbl = document.getElementById('revStarLbl');
      if (lbl) lbl.textContent = STAR_LABELS[n] || '';
    }

    async function subRev() {
      if (!revStar) { showT('اختر عدد النجوم أولاً', 'err'); return; }
      const comment = document.getElementById('revCmt').value;
      try {
        await db.collection('reviews').add({
          bookingId: revBid, tutorId: revTid,
          studentId: CU.uid, studentName: CP?.name || 'طالب',
          rating: revStar, comment,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        await db.collection('bookings').doc(revBid).update({ reviewed: true });
        // Update tutor rating
        const tS = await db.collection('users').doc(revTid).get();
        if (tS.exists) {
          const td = tS.data();
          const tot = (td.totalReviews || 0) + 1;
          const nr = (((td.rating || 0) * (td.totalReviews || 0)) + revStar) / tot;
          await db.collection('users').doc(revTid).update({ rating: parseFloat(nr.toFixed(2)), totalReviews: tot });
        }
        closeM('revMod');
        showT('✅ شكراً على تقييمك! ساعدت المجتمع.', 'suc');
        await loadT(); // Reload to get updated ratings
      } catch (e) { showT('خطأ: ' + e.message, 'err'); }
    }

    function openRevFromBk(bid, tid, tname) {
      revBid = bid; revTid = tid;
      document.getElementById('revSub').textContent = `كيف كانت جلستك مع ${tname}؟`;
      setSt(0); document.getElementById('revCmt').value = '';
      openM('revMod');
    }

    /* ── DASHBOARD ── */
    function buildSb() {
      if (!CP) return;
      const p = CP;
      const isTutor = isTutorRole(p?.role);
      const rMap = { learner: 'متعلم', tutor: 'معلم', both: 'متعلم ومعلم', admin: 'مدير' };
      const sa = document.getElementById('sbAv');
      if (p.photo) sa.innerHTML = `<img src="${p.photo}">`;
      else { sa.textContent = p.name?.[0] || 'أ'; sa.style.background = p.color || 'var(--amber)'; }
      document.getElementById('sbNm').textContent = p.name || '—';
      document.getElementById('sbRl').textContent = rMap[p.role] || p.role;

      const items = [
        { k: 'overview', i: '📊', l: 'الرئيسية', show: true },
        { k: 'sessions', i: '📅', l: 'جلساتي', show: true },
        { k: 'chat', i: '💬', l: 'الرسائل', show: true },
        { k: 'wallet', i: '💳', l: 'المحفظة', show: true },
      ];
      if (isTutor) items.push(
        { k: 'availability', i: '🕐', l: 'أوقاتي المتاحة', show: true },
        { k: 'earnings', i: '💰', l: 'الأرباح', show: true },
        { k: 'myReviews', i: '⭐', l: 'تقييماتي', show: true }
      );
      items.push(
        { k: 'editProfile', i: '👤', l: 'الملف الشخصي', show: true },
        { k: 'logout', i: '🚪', l: 'تسجيل الخروج', show: true }
      );
      document.getElementById('sbNav').innerHTML = items.map(it =>
        `<div class="ni ${it.k === dashTab ? 'act' : ''}" onclick="dNav('${it.k}')"><span class="nic">${it.i}</span>${it.l}</div>`
      ).join('');
    }

    async function dNav(k) {
      if (k === 'logout') { doLogout(); return; }
      if (k === 'editProfile') { go('editProfile'); return; }
      if (k === 'wallet') { go('wallet'); return; }
      if (k === 'chat') { go('chat'); return; }
      if (k === 'withdraw') { go('wallet'); return; }
      dashTab = k; buildSb();
      const el = document.getElementById('dashCon');
      el.innerHTML = '<div style="text-align:center;padding:80px"><div class="spin" style="margin:0 auto"></div></div>';
      if (k === 'overview') await rdOverview(el);
      else if (k === 'sessions') await rdSessions(el);
      else if (k === 'availability') await rdAvail(el);
      else if (k === 'earnings') await rdEarnings(el);
      else if (k === 'myReviews') await rdReviews(el);
    }

    function isSesTm(date, time) {
      if (!date || !time) return false;
      const now = new Date();
      const ses = new Date(`${date}T${time}:00`);
      const diffMins = (ses - now) / 60000;
      return diffMins < 60 && diffMins > -180; // 60 min before until 3 hours after
    }

    function canJoinSession(b) {
      return isBookingStillOpen(b);
    }

    function bkTblHTML(list) {
      if (!list.length) return `<div style="text-align:center;padding:40px;color:var(--muted)"><div style="font-size:2.5rem;margin-bottom:10px">📭</div><p>لا توجد جلسات بعد.</p><a style="color:var(--teal);cursor:pointer;font-weight:600;display:inline-block;margin-top:8px" onclick="go('explore')">اعثر على معلم ←</a></div>`;
      const stL = { pending: '⏳ بانتظار الموافقة', confirmed: '✅ مؤكد', completed: '🏁 مكتمل', cancelled: '❌ ملغى', refunded: '↩️ مسترد' };
      const stCls = { pending: 'pp', confirmed: 'pc', completed: 'pco', cancelled: 'pca', refunded: 'pc' };
      const isMobile = window.innerWidth <= 768;

      if (isMobile) {
        return `<div class="bkcards">
  ${list.map(b => {
          const isS = b.studentId === CU?.uid;
          const isTutorOfBooking = b.tutorId === CU?.uid;
          const other = isS ? b.tutorName : b.studentName;
          const otherUid = isS ? b.tutorId : b.studentId;
          const canJoin = canJoinSession(b);
          const canRev = isS && b.status === 'completed' && !b.reviewed;
          const canCan = isS && ['pending'].includes(b.status);
          const canTutorAct = isTutorOfBooking && b.status === 'pending';
          const canChat = otherUid && CU?.uid !== otherUid;
          const canExit = ['confirmed','active','paused'].includes(b.status);
          const canEnd = isS && ['confirmed','active','paused'].includes(b.status);
          const safeName = escapeHTML(other || '—').replace(/'/g, "\\'");
          const safeUid = (otherUid || '').replace(/'/g, "\\'");
          const avBg = ABG[(other?.charCodeAt(0) || 0) % ABG.length] || '#fde68a';
          return `<div class="bkcard">
          <div class="bkcard-h">
            <div style="display:flex;align-items:center;gap:10px;min-width:0">
              <div class="tav" style="background:${avBg};flex-shrink:0">${escapeHTML(other?.[0] || '؟')}</div>
              <div style="min-width:0">
                <div class="bkcard-title">${escapeHTML(other || '—')}</div>
                <div class="bkcard-sub">${isS ? 'معلم' : 'طالب'} · ${escapeHTML(b.date || '—')} · ${escapeHTML(b.timeLbl || b.time || '')}</div>
              </div>
            </div>
            <span class="pill ${stCls[b.status] || 'pp'}" style="white-space:nowrap">${stL[b.status] || escapeHTML(b.status || '')}</span>
          </div>
          <div class="bkcard-meta">
            <span class="tag">⏱️ ${escapeHTML(String(b.duration || 60))} دقيقة</span>
            <span class="tag tag-a">💰 ${Number(b.price || 0).toFixed(2)} ج.م</span>
          </div>
          <div class="bkcard-kv">
            <span class="k">التاريخ</span><span>${escapeHTML(b.date || '—')}</span>
            <span class="k">الوقت</span><span>${escapeHTML(b.timeLbl || b.time || '—')}</span>
          </div>
          <div class="bkcard-actions">
            ${canTutorAct ? `<button class="btn btn-s btn-xs" onclick="tutorApproveBk('${b.id}','${b.studentId}',${b.total || b.price || 0})">✅ موافقة</button><button class="btn btn-d btn-xs" onclick="tutorRejectBk('${b.id}','${b.studentId}',${b.total || b.price || 0})">❌ رفض</button>` : ''}
            ${canJoin ? `<button class="btn btn-p btn-xs" style="background:linear-gradient(135deg,var(--teal),var(--teal2));font-weight:800;letter-spacing:.02em" onclick="enterSession('${b.id}')">🎥 دخول الجلسة</button>` : ''}
            ${canEnd ? `<button class="btn btn-d btn-xs" onclick="endSession('${b.id}')">📵 إنهاء</button>` : ''}
            ${canChat ? `<button class="btn btn-xs" style="background:var(--wa-green);color:#fff" onclick="openChatWith('${safeUid}','${safeName}','','','','${escapeHTML(other?.[0] || '؟')}')">💬 شات</button>` : ''}
            ${canRev ? `<button class="btn btn-a btn-xs" onclick="openRevFromBk('${b.id}','${b.tutorId}','${escapeHTML(b.tutorName || '')}')">⭐ قيّم</button>` : ''}
            ${canCan ? `<button class="btn btn-xs" style="background:transparent;color:var(--red);border:1.5px solid var(--red);border-radius:var(--rxs)" onclick="cancelBk('${b.id}',${b.total || b.price || 0})">إلغاء</button>` : ''}
            ${!canTutorAct && !canJoin && !canRev && !canCan && !canChat ? '<span style="color:var(--muted);font-size:.78rem">—</span>' : ''}
          </div>
        </div>`;
        }).join('')}
        </div>`;
      }

      return `<div class="dtbl-wrap"><table class="dtbl"><thead><tr><th>الطرف الآخر</th><th>التاريخ والوقت</th><th>المبلغ</th><th>الحالة</th><th>إجراءات</th></tr></thead><tbody>
  ${list.map(b => {
        const isS = b.studentId === CU?.uid;
        const isTutorOfBooking = b.tutorId === CU?.uid;
        const other = isS ? b.tutorName : b.studentName;
        const otherUid = isS ? b.tutorId : b.studentId;
        const canJoin = canJoinSession(b);
        const canRev = isS && b.status === 'completed' && !b.reviewed;
        const canCan = isS && ['pending'].includes(b.status);
        const canTutorAct = isTutorOfBooking && b.status === 'pending';
        const canChat = otherUid && CU?.uid !== otherUid;
        const canExit = ['confirmed','active','paused'].includes(b.status);
        const canEnd = isS && ['confirmed','active','paused'].includes(b.status);
        const safeName = escapeHTML(other || '').replace(/'/g, "\\'");
        const safeUid = (otherUid || '').replace(/'/g, "\\'");
        const avBg = ABG[(other?.charCodeAt(0) || 0) % ABG.length] || '#fde68a';
        return `<tr>
      <td><div style="display:flex;align-items:center;gap:9px">
        <div class="tav" style="background:${avBg}">${escapeHTML(other?.[0] || '؟')}</div>
        <div><div style="font-weight:700;font-size:.87rem">${escapeHTML(other || '—')}</div><div style="font-size:.71rem;color:var(--muted)">${isS ? 'معلم' : 'طالب'}</div></div>
      </div></td>
      <td><div style="font-weight:600;font-size:.86rem">${escapeHTML(b.date || '—')}</div><div style="font-size:.76rem;color:var(--muted)">${escapeHTML(b.time || '')} · ${escapeHTML(String(b.duration || 60))} دقيقة</div></td>
      <td style="font-weight:700;color:var(--teal);font-size:.92rem">${Number(b.price || 0).toFixed(2)} ج.م</td>
      <td><span class="pill ${stCls[b.status] || 'pp'}" style="white-space:nowrap">${stL[b.status] || escapeHTML(b.status || '')}</span></td>
      <td><div style="display:flex;gap:4px;flex-wrap:wrap;align-items:center">
        ${canTutorAct ? `<button class="btn btn-s btn-xs" onclick="tutorApproveBk('${b.id}','${b.studentId}',${b.total || b.price || 0})">✅ موافقة</button><button class="btn btn-d btn-xs" onclick="tutorRejectBk('${b.id}','${b.studentId}',${b.total || b.price || 0})">❌ رفض</button>` : ''}
        ${canJoin ? `<button class="btn btn-p btn-xs" style="background:linear-gradient(135deg,var(--teal),var(--teal2));font-weight:800;letter-spacing:.02em" onclick="enterSession('${b.id}')">🎥 دخول الجلسة</button>` : ''}
        ${canEnd ? `<button class="btn btn-d btn-xs" onclick="endSession('${b.id}')">📵 إنهاء</button>` : ''}
        ${canChat ? `<button class="btn btn-xs" style="background:var(--wa-green);color:#fff" onclick="openChatWith('${safeUid}','${safeName}','','','','${escapeHTML(other?.[0] || '؟')}')">💬 شات</button>` : ''}
        ${canRev ? `<button class="btn btn-a btn-xs" onclick="openRevFromBk('${b.id}','${b.tutorId}','${escapeHTML(b.tutorName || '')}')">⭐ قيّم</button>` : ''}
        ${canCan ? `<button class="btn btn-xs" style="background:transparent;color:var(--red);border:1.5px solid var(--red);border-radius:var(--rxs)" onclick="cancelBk('${b.id}',${b.total || b.price || 0})">إلغاء</button>` : ''}
        ${!canTutorAct && !canJoin && !canRev && !canCan && !canChat ? '<span style="color:var(--muted);font-size:.78rem">—</span>' : ''}
      </div></td>
    </tr>`;
      }).join('')}</tbody></table></div>`;
    }

    async function rdOverview(el) {
      const uid = CU.uid, p = CP;
      const isTutor = isTutorRole(p?.role);
      const [sb, tb] = await Promise.all([
        db.collection('bookings').where('studentId', '==', uid).get().catch(() => ({ docs: [] })),
        db.collection('bookings').where('tutorId', '==', uid).get().catch(() => ({ docs: [] }))
      ]);
      const studentBks = sb.docs.map(d => ({ id: d.id, ...d.data() }));
      const tutorBks = tb.docs.map(d => ({ id: d.id, ...d.data() }));
      const compT = tutorBks.filter(b => b.status === 'completed');
      const mySessions = isTutor ? tutorBks : studentBks;
      const upcoming = mySessions.filter(d => ['pending', 'confirmed', 'active', 'paused'].includes(d.status)).length;
      const paidCompleted = compT.filter(b => b.adminConfirmed || b.paidToTutorAt);
      const pendingCompleted = compT.filter(b => !(b.adminConfirmed || b.paidToTutorAt));
      const earnings = paidCompleted.reduce((s, d) => s + Number((d.price || 0) - (d.tutorFee ?? d.fee ?? 0)), 0);
      const pendingEarnings = pendingCompleted.reduce((s, d) => s + Number((d.price || 0) - (d.tutorFee ?? d.fee ?? 0)), 0);
      const all = [...studentBks, ...tutorBks].map(d => ({ id: d.id, ...d })).filter((b, i, a) => a.findIndex(x => x.id === b.id) === i).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)).slice(0, 10);

      el.innerHTML = `
    <div class="dashphdr">
      <div><div style="font-size:.72rem;font-weight:800;letter-spacing:.1em;color:var(--amber);margin-bottom:3px">لوحة التحكم</div><div class="dashph">مرحباً، ${p.name?.split(' ')[0] || 'أهلاً'} 👋</div></div>
      <button class="btn btn-p" onclick="go('explore')">+ احجز جلسة جديدة</button>
    </div>
    <div class="srow">
      <div class="sc acc"><div class="scic">📅</div><div class="scval">${mySessions.length}</div><div class="sclbl">${isTutor ? 'جلساتي كمعلم' : 'جلساتي كطالب'}</div></div>
      <div class="sc"><div class="scic">⏰</div><div class="scval">${upcoming}</div><div class="sclbl">جلسات قادمة</div></div>
      ${isTutor ? `
      <div class="sc amb"><div class="scic">💰</div><div class="scval">${earnings.toFixed(0)} ج.م</div><div class="sclbl">الأرباح المحوّلة</div><div style="font-size:.72rem;color:var(--muted);margin-top:4px">المعلقة: ${pendingEarnings.toFixed(0)} ج.م</div></div>
      <div class="sc"><div class="scic">⭐</div><div class="scval">${(p.rating || 0).toFixed(1) || '—'}</div><div class="sclbl">تقييمي كمعلم</div></div>
      ` : `
      <div class="sc"><div class="scic">💳</div><div class="scval" style="font-size:1.4rem">${walBal.toFixed(0)}<span style="font-size:.7rem;font-weight:600;opacity:.6"> ج.م</span></div><div class="sclbl">رصيد المحفظة</div></div>
      <div class="sc"><div class="scic">✅</div><div class="scval">${studentBks.filter(d => d.status === 'completed').length}</div><div class="sclbl">جلسات مكتملة</div></div>
      `}
    </div>
    ${isTutor ? `<div class="dsec" style="margin-bottom:18px"><div class="dsech"><div class="dsect">📊 ملفي كمعلم — ${(p.rating || 0).toFixed(1)} ⭐ · ${p.totalReviews || 0} تقييم</div><button class="btn btn-gh btn-sm" onclick="go('editProfile')">تعديل الملف</button></div><div style="padding:16px;display:flex;gap:18px;flex-wrap:wrap"><div class="expb"><span>💰</span><div><strong>$${p.price || 0}/ساعة</strong><div style="font-size:.7rem;color:var(--muted)">السعر</div></div></div><div class="expb"><span>🏆</span><div><strong>${p.experience || 0} سنة</strong><div style="font-size:.7rem;color:var(--muted)">خبرة</div></div></div><button class="btn btn-o btn-sm" onclick="dNav('availability')">⏰ إدارة الأوقات المتاحة</button></div></div>` : ''}
    ${upcoming > 0 ? `<div class="dsec" style="margin-bottom:18px;border-color:var(--teal);"><div class="dsech" style="background:var(--teal3)"><div class="dsect" style="color:var(--teal)">⏰ جلساتك القادمة (${upcoming})</div><button class="btn btn-p btn-sm" onclick="dNav('sessions')">عرض الكل</button></div>${bkTblHTML(all.filter(b => ['pending', 'confirmed', 'active', 'paused'].includes(b.status) && (isTutor ? b.tutorId === uid : b.studentId === uid)))}</div>` : ''}
    <div class="dsec"><div class="dsech"><div class="dsect">آخر الجلسات</div><button class="btn btn-gh btn-sm" onclick="dNav('sessions')">عرض الكل</button></div>${bkTblHTML(all)}</div>
  `;
    }

    async function rdSessions(el) {
      const uid = CU.uid;
      const [s, t] = await Promise.all([
        db.collection('bookings').where('studentId', '==', uid).get().catch(() => ({ docs: [] })),
        db.collection('bookings').where('tutorId', '==', uid).get().catch(() => ({ docs: [] }))
      ]);
      const all = [...s.docs, ...t.docs].map(d => ({ id: d.id, ...d.data() })).filter((b, i, a) => a.findIndex(x => x.id === b.id) === i).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)); // sorted client-side
      el.innerHTML = `<div class="dashphdr"><div class="dashph">📅 كل جلساتي</div><button class="btn btn-p" onclick="go('explore')">+ حجز جديد</button></div><div class="dsec">${bkTblHTML(all)}</div>`;
    }

    async function buildWithdrawPage(el) {
      const ws = await db.collection('wallets').doc(CU.uid).get().catch(() => null);
      const walBalance = ws?.exists ? (ws.data().balance || 0) : 0;
      const wdSnap = await db.collection('withdrawalRequests').where('userId', '==', CU.uid).orderBy('createdAt', 'desc').limit(10).get().catch(() => ({ docs: [] }));
      const stLbl = { pending: '⏳ قيد المراجعة', approved: '✅ معتمد', rejected: '❌ مرفوض' };
      const stCl = { pending: 'pp', approved: 'pc', rejected: 'pca' };
      el.innerHTML = `
        <div class="dashphdr"><div class="dashph">🏦 سحب الأرباح</div></div>
        <div style="max-width:600px">
          <div style="background:linear-gradient(135deg,#065f46,#10b981);border-radius:18px;padding:22px 24px;color:#fff;margin-bottom:20px">
            <div style="font-size:.76rem;opacity:.7;margin-bottom:4px">الرصيد المتاح للسحب</div>
            <div style="font-family:'Fraunces',serif;font-size:2.5rem;font-weight:900">${walBalance.toFixed(2)} ج.م</div>
            <div style="font-size:.72rem;opacity:.55;margin-top:6px">الحد الأدنى للسحب: 100 ج.م</div>
          </div>
          <div class="card" style="margin-bottom:20px">
            <div class="ch"><div class="ct">💸 طلب سحب جديد</div></div>
            <div class="cb">
              <div class="fg">
                <label>المبلغ المطلوب (ج.م) <span class="req">*</span></label>
                <input type="number" id="wdAmt" placeholder="الحد الأدنى 100 ج.م" min="100" max="${walBalance}"/>
                <div class="fh">رصيدك المتاح: ${walBalance.toFixed(2)} ج.م</div>
              </div>
              <div class="fg fr">
                <div>
                  <label>طريقة الاستلام <span class="req">*</span></label>
                  <select id="wdMethod" onchange="updWdFields()">
                    <option value="instapay">InstaPay</option>
                    <option value="vodafone">فودافون كاش</option>
                    <option value="bank">تحويل بنكي</option>
                  </select>
                </div>
                <div>
                  <label id="wdAccLbl">رقم الهاتف <span class="req">*</span></label>
                  <input type="text" id="wdAccount" placeholder="01xxxxxxxxx"/>
                </div>
              </div>
              <div class="fg">
                <label>الاسم الكامل <span class="req">*</span></label>
                <input type="text" id="wdName" placeholder="الاسم كما في البنك/المحفظة" value="${CP?.name || ''}"/>
              </div>
              <button class="btn btn-p" style="width:100%;padding:13px;background:linear-gradient(135deg,#065f46,#10b981)" onclick="submitWithdrawal()">
                🏦 تقديم طلب السحب
              </button>
            </div>
          </div>
          <div class="card">
            <div class="ch"><div class="ct">📋 سجل طلبات السحب</div></div>
            <div style="padding:0">
              ${wdSnap.docs.length ? wdSnap.docs.map(d => {
        const w = { ...d.data(), id: d.id };
        const dt = w.createdAt?.toDate ? w.createdAt.toDate().toLocaleDateString('ar-SA') : '—';
        return `<div class="txitem" style="display:flex;align-items:center;justify-content:space-between;gap:10px">
                  <div style="display:flex;align-items:center;gap:12px">
                    <div class="txic db">💸</div>
                    <div>
                      <div style="font-weight:700;font-size:.84rem">\${w.amount} ج.م ← \${w.methodName||w.method}</div>
                      <div style="font-size:.7rem;color:var(--muted)">\${dt} · \${w.accountNumber||''}</div>
                    </div>
                  </div>
                  <span class="pill \${stCl[w.status]||'pp'}">\${stLbl[w.status]||w.status}</span>
                </div>`;
      }).join('') : '<div style="text-align:center;padding:28px;color:var(--muted)">لا توجد طلبات سحب سابقة</div>'}
            </div>
          </div>
        </div>`;
    }

    function getWdElements() {
      const methodEl = document.getElementById('wdMethod');
      const amtEl = document.getElementById('wdAmt');
      const accountEl = document.getElementById('wdAccount') || document.getElementById('wdAccNum');
      const nameEl = document.getElementById('wdName') || document.getElementById('wdAccName');
      const labelEl = document.getElementById('wdAccLbl') || document.getElementById('wdAccLabel');
      return { methodEl, amtEl, accountEl, nameEl, labelEl };
    }

    function updWdFields() {
      const { methodEl, accountEl, labelEl } = getWdElements();
      const m = methodEl?.value;
      if (!labelEl || !accountEl) return;
      if (m === 'bank') {
        labelEl.innerHTML = 'رقم الحساب / IBAN <span class="req">*</span>';
        accountEl.placeholder = 'EG18XXXX...';
      } else if (m === 'instapay') {
        labelEl.innerHTML = 'رقم الهاتف / InstaPay <span class="req">*</span>';
        accountEl.placeholder = '01xxxxxxxxx';
      } else {
        labelEl.innerHTML = 'رقم الهاتف <span class="req">*</span>';
        accountEl.placeholder = '01xxxxxxxxx';
      }
      accountEl.style.direction = 'ltr';
    }

    async function submitWithdrawal() {
      if (!CU) { openM('loginMod'); return; }

      const { methodEl, amtEl, accountEl, nameEl } = getWdElements();
      const amt = parseFloat(amtEl?.value || 0);
      const method = methodEl?.value || 'instapay';
      const account = accountEl?.value?.trim();
      const name = nameEl?.value?.trim();
      const methodNames = { instapay: 'InstaPay', vodafone: 'فودافون كاش', bank: 'تحويل بنكي' };

      if (!amt || amt < 100) { showT('الحد الأدنى للسحب 100 ج.م', 'err'); return; }
      if (!account) { showT('أدخل رقم الحساب أو الهاتف', 'err'); return; }
      if (!name) { showT('أدخل اسمك الكامل', 'err'); return; }

      const reqRef = db.collection('withdrawalRequests').doc();
      try {
        await db.runTransaction(async tx => {
          const r = db.collection('wallets').doc(CU.uid);
          const s = await tx.get(r);
          const bal = s.exists ? (s.data().balance || 0) : 0;
          if (amt > bal) throw new Error(`رصيدك (${bal.toFixed(2)} ج.م) غير كافٍ`);
          tx.set(r, { balance: bal - amt, userId: CU.uid }, { merge: true });
          tx.set(reqRef, {
            userId: CU.uid,
            userName: CP?.name || '—',
            userPhone: CP?.phone || '',
            amount: amt,
            currency: 'EGP',
            method,
            methodName: methodNames[method] || method,
            accountNumber: account,
            accountName: name,
            status: 'pending',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
          tx.set(db.collection('transactions').doc(reqRef.id), {
            userId: CU.uid,
            type: 'debit',
            kind: 'withdrawal',
            amount: amt,
            currency: 'EGP',
            status: 'pending',
            description: `طلب سحب أرباح — ${methodNames[method] || method}`,
            requestId: reqRef.id,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        });

        walBal = Math.max(0, walBal - amt);
        const nw = document.getElementById('nwAmt'); if (nw) nw.textContent = walBal.toFixed(2) + ' ج.م';
        const wb = document.getElementById('wBal'); if (wb) wb.textContent = walBal.toFixed(2);
        const wdBal = document.getElementById('wdBal'); if (wdBal) wdBal.textContent = walBal.toFixed(2) + ' ج.م';
        if (amtEl) amtEl.value = '';
        if (accountEl) accountEl.value = '';
        if (nameEl && CP?.name) nameEl.value = CP.name;

        showT('✅ تم تقديم طلب السحب — تم حجز المبلغ بانتظار مراجعة الإدارة', 'suc');
        await loadTxList().catch(() => { });
        dNav('withdraw');
      } catch (e) {
        showT('خطأ: ' + e.message, 'err');
      }
    }

    async function cancelBk(bid, refund) {
      if (!confirm('إلغاء هذا الحجز واسترداد المبلغ؟')) return;
      try {
        await db.collection('bookings').doc(bid).update({ status: 'cancelled' });
        await db.runTransaction(async tx => {
          const r = db.collection('wallets').doc(CU.uid);
          const s = await tx.get(r);
          const b = s.exists ? (s.data().balance || 0) : 0;
          tx.set(r, { balance: b + refund, userId: CU.uid }, { merge: true });
        });
        await db.collection('transactions').add({ userId: CU.uid, type: 'credit', kind: 'booking', amount: refund, description: 'استرداد حجز ملغى', createdAt: firebase.firestore.FieldValue.serverTimestamp() });
        walBal += refund;
        document.getElementById('nwAmt').textContent = walBal.toFixed(2) + ' ج.م';
        showT(`✅ تم الإلغاء واسترداد ${parseFloat(refund).toFixed(2)} ج.م`, 'suc');
        await dNav('sessions');
      } catch (e) { showT('خطأ: ' + e.message, 'err'); }
    }

    async function rdAvail(el) {
      let saved = {};
      try { const s = await db.collection('availability').doc(CU.uid).get(); if (s.exists) saved = s.data().slots || {}; } catch (e) { }
      const grid = DAYS.map(day => {
        const ds = saved[day] || [];
        return `<div class="avday"><div class="avdlbl">${day}</div><div class="avtog-group"><div class="avtog-sect">🌅 صباحاً</div>${TIMES.filter(t => parseInt(t.v) < 12).map(t => `<div class="avtog ${ds.includes(t.v) ? 'on' : ''}" data-day="${day}" data-time="${t.v}" onclick="this.classList.toggle('on')">${t.lbl}</div>`).join('')}<div class="avtog-sect">🌆 مساءً</div>${TIMES.filter(t => parseInt(t.v) >= 12).map(t => `<div class="avtog ${ds.includes(t.v) ? 'on' : ''}" data-day="${day}" data-time="${t.v}" onclick="this.classList.toggle('on')">${t.lbl}</div>`).join('')}</div></div>`;
      }).join('');
      el.innerHTML = `<div class="dashphdr"><div class="dashph">🕐 أوقاتي المتاحة</div><button class="btn btn-p" onclick="saveAvail()">💾 حفظ الجدول</button></div><div class="card"><div class="cb"><p style="font-size:.82rem;color:var(--muted);margin-bottom:13px">انقر على الوقت لتفعيله. الأوقات الخضراء ستظهر للطلاب عند الحجز.</p><div class="avgrid">${grid}</div></div></div>`;
    }

    async function saveAvail() {
      const chips = document.querySelectorAll('.avgrid .avtog.on, .av-grid .avtog.on, #avGrid .avtog.on');
      const slots = {};
      chips.forEach(c => {
        const d = c.dataset.day, t = c.dataset.time;
        if (d && t) { if (!slots[d]) slots[d] = []; if (!slots[d].includes(t)) slots[d].push(t); }
      });
      try {
        await db.collection('availability').doc(CU.uid).set({ tutorId: CU.uid, slots, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
        showT('✅ تم حفظ جدولك بنجاح', 'suc');
      } catch (e) { showT('خطأ: ' + e.message, 'err'); }
    }

    async function rdEarnings(el) {
      const snap = await db.collection('bookings').where('tutorId', '==', CU.uid).get().catch(() => ({ docs: [] }));
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const comp = all.filter(b => b.status === 'completed');
      const paid = comp.filter(b => b.adminConfirmed || b.paidToTutorAt);
      const pending = comp.filter(b => !(b.adminConfirmed || b.paidToTutorAt));
      const studentCommissions = comp.reduce((s, b) => s + Number(b.studentFee ?? b.fee ?? 0), 0);
      const tutorCommissions = comp.reduce((s, b) => s + Number(b.tutorFee ?? 0), 0);
      const gross = comp.reduce((s, b) => s + Number(b.price || 0), 0);
      const paidNet = paid.reduce((s, b) => s + Number((b.price || 0) - (b.tutorFee ?? b.fee ?? 0)), 0);
      const pendingNet = pending.reduce((s, b) => s + Number((b.price || 0) - (b.tutorFee ?? b.fee ?? 0)), 0);
      const platformProfit = studentCommissions + tutorCommissions;
      const ws = await db.collection('wallets').doc(CU.uid).get().catch(() => null);
      const walBalance = ws?.exists ? (ws.data().balance || 0) : 0;
      const wdSnap = await db.collection('withdrawalRequests').where('userId', '==', CU.uid).where('status', '==', 'pending').get().catch(() => ({ size: 0 }));
      el.innerHTML = `<div class="dashph" style="margin-bottom:20px">💰 الأرباح والإيرادات</div>
  <div class="srow" style="margin-bottom:20px">
    <div class="sc acc"><div class="scic">💵</div><div class="scval" style="font-size:1.5rem">${gross.toFixed(0)}</div><div class="sclbl">إجمالي الإيرادات</div></div>
    <div class="sc"><div class="scic">✅</div><div class="scval" style="font-size:1.5rem">${paidNet.toFixed(0)}</div><div class="sclbl">صافي محوّل</div></div>
    <div class="sc"><div class="scic">⏳</div><div class="scval" style="font-size:1.5rem">${pendingNet.toFixed(0)}</div><div class="sclbl">صافي بانتظار الإدارة</div></div>
    <div class="sc amb"><div class="scic">💰</div><div class="scval" style="font-size:1.5rem">${platformProfit.toFixed(0)}</div><div class="sclbl">أرباح المنصة</div></div>
    <div class="sc"><div class="scic">💳</div><div class="scval" style="font-size:1.5rem">${walBalance.toFixed(0)}</div><div class="sclbl">رصيد المحفظة (ج.م)</div></div>
    <div class="sc"><div class="scic">📊</div><div class="scval" style="font-size:1.5rem">${comp.length}</div><div class="sclbl">جلسات مكتملة</div></div>
  </div>
  ${wdSnap.size ? `<div style="background:var(--amber3);border:1px solid rgba(245,158,11,.3);border-radius:var(--r);padding:12px 16px;margin-bottom:16px;font-size:.82rem">⏳ لديك <strong>${wdSnap.size}</strong> طلب سحب قيد المراجعة</div>` : ''}
  <div style="margin-bottom:20px;display:flex;gap:10px;flex-wrap:wrap">
    <button class="btn btn-p" onclick="dNav('withdraw')" style="background:linear-gradient(135deg,#065f46,#10b981)">
      🏦 طلب سحب الأرباح
    </button>
    <button class="btn btn-gh" onclick="go('wallet')">💳 شحن المحفظة</button>
  </div>
  <div class="dsec" style="overflow-x:auto">${comp.length ? `<table class="dtbl"><thead><tr><th>الطالب</th><th>التاريخ والوقت</th><th>المدة</th><th>إيراد الجلسة</th><th>عمولة الطالب</th><th>عمولة المعلم</th><th>صافي للمعلم</th><th>الحالة</th></tr></thead><tbody>
    ${comp.map(b => `<tr>
      <td><strong>${b.studentName || '—'}</strong></td>
      <td style="white-space:nowrap;font-size:.8rem">${b.date || '—'}<br><span style="color:var(--muted);font-size:.72rem">${b.timeLbl || b.time || ''}</span></td>
      <td style="font-size:.8rem">${b.actualDuration ? b.actualDuration + 'د' : (b.duration || 60) + 'د'}</td>
      <td style="color:var(--teal);font-weight:800">${Number(b.price || 0).toFixed(2)} ج.م</td>
      <td style="color:var(--muted);font-size:.82rem">${Number(b.studentFee ?? b.fee ?? 0).toFixed(2)} ج.م</td>
      <td style="color:var(--muted);font-size:.82rem">${Number(b.tutorFee || 0).toFixed(2)} ج.م</td>
      <td style="color:var(--green);font-weight:800">${Number((b.price || 0) - (b.tutorFee ?? 0)).toFixed(2)} ج.م</td>
      <td>${b.adminConfirmed ? '<span class="pill pc">✓ مُحوَّل</span>' : '<span class="pill pp">⏳ بانتظار الإدارة</span>'}</td>
    </tr>`).join('')}</tbody></table>` : '<div style="text-align:center;padding:32px;color:var(--muted)">لا توجد جلسات مكتملة بعد</div>'}</div>`;
    }

    async function rdReviews(el) {
      const p = CP, isTutor = isTutorRole(p?.role);
      const snap = await db.collection('reviews').where(isTutor ? 'tutorId' : 'studentId', '==', CU.uid).get().catch(() => ({ docs: [] }));
      const revs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const avg = revs.length ? (revs.reduce((s, r) => s + (r.rating || 0), 0) / revs.length).toFixed(1) : '—';
      el.innerHTML = `<div class="dashph" style="margin-bottom:20px">⭐ التقييمات</div>
  <div class="dsec" style="margin-bottom:16px"><div class="cb" style="display:flex;align-items:center;gap:16px">
    <div style="font-family:'Fraunces',serif;font-size:3rem;font-weight:900;color:var(--amber)">${avg}</div>
    <div><div style="font-weight:700">متوسط التقييم</div><div style="color:var(--muted);font-size:.8rem">${revs.length} تقييم إجمالي</div></div>
  </div></div>
  <div class="dsec">${revs.length ? revs.map(r => `<div style="padding:15px 18px;border-bottom:1px solid var(--border)"><div style="display:flex;justify-content:space-between;margin-bottom:6px"><div style="font-weight:600">${r[isTutor ? 'studentName' : 'tutorName'] || '—'} <span class="stars">${'★'.repeat(r.rating || 5)}</span></div><div style="font-size:.71rem;color:var(--muted)">${r.createdAt?.toDate ? r.createdAt.toDate().toLocaleDateString('ar-SA') : ''}</div></div><p style="font-size:.83rem;color:#374151">${r.comment || ''}</p></div>`).join('') : '<div style="text-align:center;padding:32px;color:var(--muted)">لا توجد تقييمات بعد</div>'}</div>`;
    }

    /* ── EDIT PROFILE ── */
    async function loadEditProf() {
      if (!CP) return;
      const p = CP;
      const isTutor = isTutorRole(p?.role);
      document.getElementById('editFN').value = p.name?.split(' ')[0] || '';
      document.getElementById('editLN').value = p.name?.split(' ').slice(1).join(' ') || '';
      document.getElementById('editBio').value = p.bio || '';
      document.getElementById('editCnt').value = p.country || '';
      document.getElementById('editLng').value = p.lang || 'عربي';
      document.getElementById('editPh').value = p.photo || '';
      prvEditAv();
      if (isTutor) {
        document.getElementById('editTutSec').classList.remove('hidden');
        document.getElementById('editAvailSec').classList.remove('hidden');
        document.getElementById('editCat').value = p.category || 'برمجة';
        document.getElementById('editPrc').value = p.price || '';
        document.getElementById('editExp').value = p.experience || '';
        edSkList = Array.isArray(p.skills) ? [...p.skills] : [];
        rdEdSk();
        await buildEditAvGrid();
      }
    }

    function prvEditAv() {
      const url = document.getElementById('editPh').value;
      const el = document.getElementById('editAvPr');
      if (url) { el.innerHTML = `<img src="${url}">`; }
      else { el.textContent = CP?.name?.[0] || 'أ'; el.style.background = CP?.color || 'var(--amber)'; }
    }

    function rdEdSk() {
      const box = document.getElementById('skBox'), inp = document.getElementById('skInp');
      box.querySelectorAll('.sktag').forEach(e => e.remove());
      edSkList.forEach(s => {
        const t = document.createElement('div'); t.className = 'sktag';
        t.innerHTML = `${s}<button onclick="edSkList=edSkList.filter(x=>x!=='${s}');rdEdSk()" type="button">×</button>`;
        box.insertBefore(t, inp);
      });
    }
    function hdlSkEdit(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        const v = e.target.value.trim();
        if (v && !edSkList.includes(v)) { edSkList.push(v); rdEdSk(); }
        e.target.value = '';
      }
    }

    async function buildEditAvGrid() {
      let saved = {};
      try { const s = await db.collection('availability').doc(CU.uid).get(); if (s.exists) saved = s.data().slots || {}; } catch (e) { }
      document.getElementById('avGrid').innerHTML = DAYS.map(day => {
        const ds = saved[day] || [];
        return `<div class="avday"><div class="avdlbl">${day}</div><div class="avtog-group"><div class="avtog-sect">🌅 صباحاً</div>${TIMES.filter(t => parseInt(t.v) < 12).map(t => `<div class="avtog ${ds.includes(t.v) ? 'on' : ''}" data-day="${day}" data-time="${t.v}" onclick="this.classList.toggle('on')">${t.lbl}</div>`).join('')}<div class="avtog-sect">🌆 مساءً</div>${TIMES.filter(t => parseInt(t.v) >= 12).map(t => `<div class="avtog ${ds.includes(t.v) ? 'on' : ''}" data-day="${day}" data-time="${t.v}" onclick="this.classList.toggle('on')">${t.lbl}</div>`).join('')}</div></div>`;
      }).join('');
    }

    async function savePrf() {
      const first = document.getElementById('editFN').value.trim();
      if (!first) { showT('أدخل اسمك الأول', 'err'); return; }
      const p = CP, isTutor = isTutorRole(p?.role);
      const data = {
        name: `${first} ${document.getElementById('editLN').value.trim()}`.trim(),
        bio: document.getElementById('editBio').value,
        country: document.getElementById('editCnt').value,
        lang: document.getElementById('editLng').value,
        photo: selectedEditPhoto || document.getElementById('editPh').value
      };
      if (isTutor) {
        data.category = document.getElementById('editCat').value;
        data.price = parseFloat(document.getElementById('editPrc').value) || 0;
        data.experience = parseInt(document.getElementById('editExp').value) || 0;
        data.skills = edSkList;
        data.isApproved = true;
        // Save availability
        const chips = document.querySelectorAll('#avGrid .avtog.on');
        const slots = {};
        chips.forEach(c => {
          const d = c.dataset.day, t = c.dataset.time;
          if (d && t) { if (!slots[d]) slots[d] = []; if (!slots[d].includes(t)) slots[d].push(t); }
        });
        if (Object.keys(slots).length) await db.collection('availability').doc(CU.uid).set({ tutorId: CU.uid, slots, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
      }
      try {
        await db.collection('users').doc(CU.uid).update(data);
        // Refresh from Firestore
        const freshSnap = await db.collection('users').doc(CU.uid).get();
        if (freshSnap.exists) CP = freshSnap.data();
        else CP = { ...CP, ...data };
        syncProfileWindow();
        updNavU();
        await loadT(); // Reload all tutors to reflect changes
        showT('✅ تم حفظ الملف الشخصي بنجاح', 'suc');
        go('dashboard');
      } catch (e) { showT('خطأ: ' + e.message, 'err'); }
    }

    /* ── REGISTRATION ── */
    function pickRole(r) {
      regRole = r;
      ['learner', 'tutor', 'both'].forEach(x => document.getElementById(`ro-${x}`)?.classList.toggle('act', x === r));
    }

    function gRS(step) {
      if (step === 3) {
        const f = document.getElementById('r2F').value.trim();
        const e = document.getElementById('r2E').value.trim();
        const p = document.getElementById('r2P').value;
        if (!f || !e || !p) { showT('يرجى ملء جميع الحقول', 'err'); return; }
        if (p.length < 6) { showT('كلمة المرور يجب أن تكون 6 أحرف على الأقل', 'err'); return; }
        if (regRole === 'learner') { doReg(); return; } // Skip tutor steps for learner
      }
      if (step === 4) {
        if (!document.getElementById('r3Bio')?.value.trim()) { showT('أضف نبذة تعريفية', 'err'); return; }
        if (!document.getElementById('r3Prc')?.value) { showT('أدخل السعر بالساعة', 'err'); return; }
        buildRegAv();
      }
      for (let i = 1; i <= 4; i++) document.getElementById(`rS${i}`)?.classList.toggle('hidden', i !== step);
      regStep = step; updSD();
    }

    function updSD() {
      for (let i = 1; i <= 4; i++) {
        const d = document.getElementById(`sd${i}`), l = document.getElementById(`sl${i}`);
        if (d) d.className = 'sd' + (i < regStep ? ' done' : i === regStep ? ' act' : '');
        if (l) l.className = 'sline' + (i < regStep ? ' done' : '');
      }
    }

    function hdlR3Sk(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        const v = e.target.value.trim();
        if (v && !r3SkList.includes(v)) { r3SkList.push(v); rdR3Sk(); }
        e.target.value = '';
      }
    }
    function rdR3Sk() {
      const box = document.getElementById('r3SkBox'), inp = document.getElementById('r3SkI');
      box.querySelectorAll('.sktag').forEach(e => e.remove());
      r3SkList.forEach(s => {
        const t = document.createElement('div'); t.className = 'sktag';
        t.innerHTML = `${s}<button onclick="r3SkList=r3SkList.filter(x=>x!=='${s}');rdR3Sk()" type="button">×</button>`;
        box.insertBefore(t, inp);
      });
    }

    function buildRegAv() {
      const grid = document.getElementById('regAvGrid'); if (!grid) return;
      grid.innerHTML = DAYS.map(day => `<div class="avday"><div class="avdlbl">${day}</div><div class="avtog-group"><div class="avtog-sect">🌅 صباحاً</div>${TIMES.filter(t => parseInt(t.v) < 12).map(t => `<div class="avtog" data-day="${day}" data-time="${t.v}" onclick="this.classList.toggle('on')">${t.lbl}</div>`).join('')}<div class="avtog-sect">🌆 مساءً</div>${TIMES.filter(t => parseInt(t.v) >= 12).map(t => `<div class="avtog" data-day="${day}" data-time="${t.v}" onclick="this.classList.toggle('on')">${t.lbl}</div>`).join('')}</div></div>`).join('');
    }

    async function doReg() {
      const email = document.getElementById('r2E').value.trim();
      const pass = document.getElementById('r2P').value;
      const first = document.getElementById('r2F').value.trim();
      const last = document.getElementById('r2L').value.trim();
      const phone = document.getElementById('r2Ph')?.value?.trim() || '';
      const btn = document.getElementById('finRegBtn');
      if (!first) { showT('أدخل اسمك الأول', 'err'); return; }
      if (!email || !email.includes('@')) { showT('أدخل بريدًا إلكترونيًا صحيحًا', 'err'); return; }
      if (!phone || phone.length < 10) { showT('أدخل رقم هاتف صحيح (10 أرقام على الأقل)', 'err'); return; }
      if (pass.length < 6) { showT('كلمة المرور قصيرة جداً (6 أحرف على الأقل)', 'err'); return; }
      if (btn) { btn.textContent = 'جاري الإنشاء...'; btn.disabled = true; }
      try {
        const cred = await auth.createUserWithEmailAndPassword(email, pass);
        const uid = cred.user.uid;
        const isTutor = regRole === 'tutor' || regRole === 'both';

        // Collect availability
        const avSlots = {};
        document.querySelectorAll('#regAvGrid .avtog.on').forEach(el => {
          const d = el.dataset.day, t = el.dataset.time;
          if (d && t) { if (!avSlots[d]) avSlots[d] = []; if (!avSlots[d].includes(t)) avSlots[d].push(t); }
        });

        const profile = {
          uid, email, phone, name: `${first} ${last}`.trim(),
          role: regRole, bio: '', photo: regPhotoData || '', skills: [], price: 0,
          lang: 'عربي', country: '', category: '', rating: 0,
          totalReviews: 0, totalSessions: 0,
          isApproved: !isTutor,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        if (isTutor) {
          profile.bio = document.getElementById('r3Bio')?.value || '';
          profile.experience = parseInt(document.getElementById('r3Exp')?.value) || 0;
          profile.price = parseFloat(document.getElementById('r3Prc')?.value) || 0;
          profile.category = document.getElementById('r3Cat')?.value || '';
          profile.lang = document.getElementById('r3Lng')?.value || 'عربي';
          profile.country = document.getElementById('r3Cnt')?.value || '';
          profile.skills = r3SkList;
          profile.isApproved = true;
        }

        const batch = db.batch();
        batch.set(db.collection('users').doc(uid), profile);
        batch.set(db.collection('wallets').doc(uid), { balance: 0, userId: uid });
        if (isTutor && Object.keys(avSlots).length) {
          batch.set(db.collection('availability').doc(uid), { tutorId: uid, slots: avSlots, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
        }
        await batch.commit();

        CP = profile;
        syncProfileWindow();
        closeM('regMod');
        showT(`🎉 مرحباً ${first}! تم إنشاء حسابك بنجاح.`, 'suc');
        updNavU();
        startMsgL();
        // Add tutor to local list immediately so they show up in explore
        if (isTutor) {
          allT.push({ ...profile, id: uid });
          allT.sort((a, b) => (b.rating || 0) - (a.rating || 0));
        }
        await loadT(); // Also reload from Firestore
        go('dashboard');
      } catch (e) {
        const errMap = {
          'auth/email-already-in-use': 'هذا البريد الإلكتروني مستخدم بالفعل. <a onclick="switchM(\'regMod\',\'loginMod\')" style="color:var(--teal);cursor:pointer;text-decoration:underline">سجّل دخولك</a>',
          'auth/invalid-email': 'صيغة البريد الإلكتروني غير صحيحة',
          'auth/weak-password': 'كلمة المرور ضعيفة جداً (يجب أن تكون 6 أحرف على الأقل)',
          'auth/network-request-failed': 'تحقق من اتصالك بالإنترنت',
        };
        const msg = errMap[e.code] || e.message;
        showT('خطأ: ' + msg.replace(/<[^>]*>/g, ''), 'err');
        if (btn) { btn.textContent = '🎉 إنشاء الحساب'; btn.disabled = false; }
      }
    }

    /* ── AUTH ── */
    function togPassVis(inputId, btn) {
      const inp = document.getElementById(inputId);
      if (!inp) return;
      if (inp.type === 'password') { inp.type = 'text'; btn.textContent = '🙈'; }
      else { inp.type = 'password'; btn.textContent = '👁'; }
    }

    async function doLogin() {
      const e = document.getElementById('liE').value.trim();
      const p = document.getElementById('liP').value;
      const errEl = document.getElementById('loginErr');
      if (errEl) errEl.classList.add('hidden');
      if (!e || !p) { showLoginErr('أدخل البريد الإلكتروني وكلمة المرور'); return; }
      if (!e.includes('@')) { showLoginErr('البريد الإلكتروني غير صحيح'); return; }
      if (p.length < 6) { showLoginErr('كلمة المرور قصيرة جداً (6 أحرف على الأقل)'); return; }
      const btn = document.getElementById('liBtn');
      btn.innerHTML = '<div class="spin spin-sm spin-wh"></div> جاري الدخول...'; btn.disabled = true;
      try {
        await auth.signInWithEmailAndPassword(e, p);
        closeM('loginMod');
        showT('مرحباً بعودتك! 👋', 'suc');
        go('dashboard');
      } catch (err) {
        const errMap = {
          'auth/wrong-password': 'كلمة المرور غير صحيحة',
          'auth/user-not-found': 'لا يوجد حساب بهذا البريد الإلكتروني',
          'auth/invalid-credential': 'البريد أو كلمة المرور غير صحيحة',
          'auth/invalid-email': 'صيغة البريد الإلكتروني غير صحيحة',
          'auth/too-many-requests': 'تم تجاوز عدد المحاولات. انتظر قليلاً ثم أعد المحاولة',
          'auth/network-request-failed': 'تحقق من اتصالك بالإنترنت',
          'auth/user-disabled': 'تم تعطيل هذا الحساب. تواصل مع الدعم',
        };
        showLoginErr(errMap[err.code] || 'حدث خطأ، حاول مرة أخرى');
      } finally {
        btn.innerHTML = 'تسجيل الدخول'; btn.disabled = false;
      }
    }

    function showLoginErr(msg) {
      const el = document.getElementById('loginErr');
      if (el) { el.textContent = '⚠️ ' + msg; el.classList.remove('hidden'); }
      else showT(msg, 'err');
    }

    async function doLogout() {
      if (chatL) { chatL(); chatL = null; }
      if (msgUnsubL) { msgUnsubL(); msgUnsubL = null; }
      if (bookingNotifL) { bookingNotifL(); bookingNotifL = null; }
      curChatUid = null; allContacts = {};
      await auth.signOut();
      CP = null; CU = null; walBal = 0;
      syncProfileWindow();
      updNavG();
      showT('تم تسجيل الخروج بنجاح', 'suc');
      go('home');
    }

    async function doFgt() {
      const e = document.getElementById('liE').value.trim();
      if (!e || !e.includes('@')) { showT('أدخل بريدك الإلكتروني الصحيح أولاً', 'err'); return; }
      const fgtBtn = document.querySelector('[onclick="doFgt()"]');
      if (fgtBtn) { fgtBtn.style.pointerEvents = 'none'; fgtBtn.textContent = 'جاري الإرسال...'; }
      try {
        await auth.sendPasswordResetEmail(e, {
          url: window.location.href, // redirect back after reset
          handleCodeInApp: false
        });
        showT('✅ تم إرسال رابط إعادة التعيين إلى بريدك على Gmail — تحقق من Inbox أو Spam', 'suc');
        if (fgtBtn) { fgtBtn.textContent = '✅ تم الإرسال'; }
      } catch (err) {
        const errMap = {
          'auth/user-not-found': 'لا يوجد حساب بهذا البريد الإلكتروني',
          'auth/invalid-email': 'البريد الإلكتروني غير صحيح',
          'auth/too-many-requests': 'تجاوزت الحد المسموح — انتظر قليلاً'
        };
        showT(errMap[err.code] || 'خطأ: ' + err.message, 'err');
        if (fgtBtn) { fgtBtn.style.pointerEvents = ''; fgtBtn.textContent = 'نسيت كلمة المرور؟'; }
      }
    }

    function openRegAs(role) { pickRole(role); openM('regMod'); }

    /* ── ADMIN ── */
    async function adTab(tab, el) {
      document.querySelectorAll('.adminTab').forEach(t => t.className = 'btn btn-gh btn-sm adminTab');
      el.className = 'btn btn-p btn-sm adminTab';
      const con = document.getElementById('adCon');
      con.innerHTML = '<div style="text-align:center;padding:46px"><div class="spin" style="margin:0 auto"></div></div>';

      if (tab === 'users') {
        const snap = await db.collection('users').orderBy('createdAt', 'desc').get().catch(() => ({ docs: [] }));
        const users = snap.docs.map(d => d.data());
        const rMap = { learner: 'متعلم', tutor: 'معلم', both: 'الاثنان', admin: 'مدير' };
        con.innerHTML = `
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:8px">
            <strong>${users.length} مستخدم مسجّل</strong>
            <input type="text" placeholder="🔍 بحث بالاسم أو البريد..." oninput="filterAdmTbl(this.value,'usersTbl')"
              style="padding:8px 14px;border:1.5px solid var(--border);border-radius:var(--rsm);font-family:'Cairo',sans-serif;font-size:.82rem;min-width:200px"/>
          </div>
          <div class="card support-photo-card" style="margin:14px 0 16px;border-radius:18px;overflow:hidden">
            <div class="ch">
              <div class="ct" style="display:flex;align-items:center;gap:8px"><span style="font-size:1.05rem">💬</span><span>صورة شات خدمة العملاء</span></div>
              <div class="pill pc">من صفحة المستخدمين فقط</div>
            </div>
            <div class="cb">
              <div class="support-photo-grid">
                <div class="support-photo-visual">
                  <img id="supportChatPhotoPreview" src="${supportChatPhoto || 'skillak.png'}" alt="صورة الشات" class="support-photo-preview" />
                  <div class="support-photo-badge">معاينة مباشرة</div>
                </div>
                <div class="support-photo-copy">
                  <div class="support-photo-title">اجعل الشات يظهر بصورة المنصة أو بأي صورة مخصصة.</div>
                  <div class="support-photo-desc">
                    ارفع صورة من جهازك مع القص، أو ضع رابطاً مباشراً للصورة. عند ترك الحقل فارغاً يبقى لوجو Skillak هو الصورة الافتراضية لكل المستخدمين.
                  </div>
                  <div class="support-photo-actions">
                    <div class="fg support-photo-field">
                      <label>رابط الصورة</label>
                      <input type="text" id="supportChatPhotoInput" value="${supportChatPhoto || ''}" placeholder="https://..." style="direction:ltr" />
                    </div>
                    <div class="support-photo-buttons">
                      <input type="file" id="supportChatPhotoFileInput" accept="image/*" class="hidden" onchange="previewSupportChatFile(this)" />
                      <button class="btn btn-o btn-sm" type="button" onclick="document.getElementById('supportChatPhotoFileInput')?.click()">📤 رفع من الجهاز</button>
                      <button class="btn btn-gh btn-sm" type="button" onclick="previewSupportChatUrl()">👁 معاينة/قص الرابط</button>
                      <button class="btn btn-p btn-sm" type="button" onclick="saveSupportChatPhoto()">💾 حفظ الصورة</button>
                    </div>
                  </div>
                  <div id="supportChatPhotoMsg" class="fh support-photo-msg">الصورة الافتراضية هي لوجو Skillak، ويمكنك تغييرها من هنا فقط.</div>
                </div>
              </div>
            </div>
          </div>

          <div class="dsec" style="overflow-x:auto">
            <table class="dtbl" id="usersTbl"><thead><tr>
              <th>الاسم</th><th>البريد</th><th>الهاتف</th><th>الدور</th><th>التقييم</th><th>الجلسات</th><th>الحالة</th><th>إجراء</th>
            </tr></thead><tbody>
            ${users.map(u => `<tr data-uid="${u.uid}" data-name="${(u.name || '—').replace(/"/g,'&quot;')}" data-photo="${(u.photo || '').replace(/"/g,'&quot;')}" data-color="${u.color || ''}" data-fg="${u.fgColor || ''}" data-emoji="${(u.emoji || (u.name?.[0] || '؟')).replace(/"/g,'&quot;')}">
              <td><strong>${u.name || '—'}</strong></td>
              <td style="font-size:.76rem;color:var(--muted)">${u.email || '—'}</td>
              <td style="font-size:.78rem">${u.phone || '—'}</td>
              <td><span class="tag ${u.role === 'tutor' ? 'tag-g' : u.role === 'admin' ? 'tag-r' : ''}">${rMap[u.role] || u.role}</span></td>
              <td>${u.rating ? parseFloat(u.rating).toFixed(1) + '⭐' : '—'}</td>
              <td>${u.totalSessions || 0}</td>
              <td><span class="pill ${u.isApproved ? 'pc' : 'pp'}">${u.isApproved ? 'معتمد' : 'قيد المراجعة'}</span></td>
              <td style="display:flex;gap:4px;flex-wrap:wrap">
                ${!u.isApproved ? `<button class="btn btn-s btn-xs" onclick="apprU('${u.uid}',this)">✓ موافقة</button>` : ''}
                <button class="btn btn-d btn-xs" onclick="delU('${u.uid}',this)">حذف</button>
              </td>
            </tr>`).join('')}
            </tbody></table>
          </div>`;

      } else if (tab === 'bookings') {
        const snap = await db.collection('bookings').orderBy('createdAt', 'desc').get().catch(() => ({ docs: [] }));
        const bks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const stL = { pending: '⏳ انتظار موافقة المعلم', confirmed: '✅ مؤكد', completed: '🏁 مكتمل', cancelled: '❌ ملغى', refunded: '↩️ مسترد' };
        const stCl = { pending: 'pp', confirmed: 'pc', completed: 'pco', cancelled: 'pca', refunded: 'pc' };
        const pending = bks.filter(b => b.status === 'pending').length;
        const confirmed = bks.filter(b => b.status === 'confirmed').length;
        const completed = bks.filter(b => b.status === 'completed').length;
        const completedPaid = bks.filter(b => b.status === 'completed' && (b.adminConfirmed || b.paidToTutorAt)).length;
        const totalRevenue = bks.filter(b => b.status === 'completed').reduce((s, b) => s + Number((b.studentFee ?? b.fee ?? 0) + (b.tutorFee ?? 0)), 0);
        const totalTutorNet = bks.filter(b => b.status === 'completed').reduce((s, b) => s + Number((b.price ?? b.total ?? 0) - (b.tutorFee ?? b.fee ?? 0)), 0);
        con.innerHTML = `
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin-bottom:18px">
            <div class="sc"><div class="scic">⏳</div><div class="scval" style="font-size:1.5rem">${pending}</div><div class="sclbl">بانتظار الموافقة</div></div>
            <div class="sc"><div class="scic">✅</div><div class="scval" style="font-size:1.5rem">${confirmed}</div><div class="sclbl">مؤكدة</div></div>
            <div class="sc"><div class="scic">🏁</div><div class="scval" style="font-size:1.5rem">${completed}</div><div class="sclbl">مكتملة</div></div>
            <div class="sc"><div class="scic">💰</div><div class="scval" style="font-size:1.5rem">${totalRevenue.toFixed(0)}</div><div class="sclbl">إجمالي الإيراد</div></div>
            <div class="sc"><div class="scic">🏦</div><div class="scval" style="font-size:1.5rem">${completedPaid}</div><div class="sclbl">محوّلة للمعلم</div></div>
          </div>
          <div class="dsec" style="overflow-x:auto">
            <table class="dtbl"><thead><tr>
              <th>الطالب</th><th>المعلم</th><th>التاريخ والوقت</th><th>تقرير الجلسة</th><th>إجمالي الجلسة</th><th>العمولة</th><th>صافي المعلم</th><th>الحالة المالية</th><th>الإجراء</th>
            </tr></thead><tbody>
            ${bks.map(b => {
          const total = Number(b.total ?? b.price ?? 0);
          const studentFee = Number(b.studentFee ?? 0);
          const tutorFee = Number(b.tutorFee ?? b.fee ?? 0);
          const netTutor = Number((b.price ?? b.total ?? 0) - tutorFee);
          const paid = !!b.adminConfirmed || !!b.paidToTutorAt;
          const sessionReport = [
            b.actualDuration ? `${b.actualDuration} د` : `${b.duration || 60} د`,
            b.sessionStartsAtMs ? 'بدأت' : '',
            b.sessionEndsAtMs ? 'لها نهاية' : '',
            b.completedAt ? 'انتهت' : ''
          ].filter(Boolean).join(' · ') || '—';
          const financeState = b.status === 'completed'
            ? (paid ? 'تم التحويل' : 'جاهز للتحويل')
            : (b.status === 'refunded'
              ? (paid ? 'تم التحويل ثم مسترد' : 'مسترد')
              : '—');
          const financeBadge = b.status === 'completed'
            ? (paid ? 'pc' : 'pp')
            : (b.status === 'refunded' ? (paid ? 'pco' : 'pca') : 'pp');
          const sessionBrief = `
            <div style="display:flex;flex-direction:column;gap:4px;min-width:190px">
              <div style="font-size:.78rem;color:var(--muted)">${stL[b.status] || b.status}</div>
              <div style="font-size:.82rem;line-height:1.55">${sessionReport}</div>
              <div style="font-size:.74rem;color:var(--muted)">${b.studentPhone || ''}${b.studentPhone ? ' • ' : ''}${b.tutorPhone || ''}</div>
            </div>`;
          return `<tr>
                <td><strong>${b.studentName || '—'}</strong><div style="font-size:.7rem;color:var(--muted)">${b.studentPhone || ''}</div></td>
                <td><strong>${b.tutorName || '—'}</strong></td>
                <td style="white-space:nowrap;font-size:.8rem">${b.date || '—'}<br><span style="color:var(--muted);font-size:.72rem">${b.timeLbl || b.time || ''}</span></td>
                <td>${sessionBrief}</td>
                <td style="font-weight:800;color:var(--teal);white-space:nowrap">${total.toFixed(2)} ج.م</td>
                <td style="white-space:nowrap">${tutorFee.toFixed(2)} ج.م</td>
                <td style="white-space:nowrap">${netTutor.toFixed(2)} ج.م</td>
                <td><span class="pill ${financeBadge}" style="white-space:nowrap">${financeState}</span></td>
                <td>
                  <div style="display:flex;gap:4px;flex-wrap:wrap">
                    ${b.status === 'pending' ? `<span class="pill pp">⏳ بانتظار موافقة المعلم</span>` : ''}
                    ${b.status === 'confirmed' ? `<button class="btn btn-xs" style="background:var(--teal);color:#fff" onclick="adminCompleteBk('${b.id}','${b.tutorId}',${b.price || 0},${b.fee || 0})">🏁 تأكيد الانتهاء</button>` : ''}
                    ${b.status === 'completed' && !paid ? `<button class="btn btn-s btn-xs" onclick="adminPayTutor('${b.id}','${b.tutorId}',${b.price || 0},${b.fee || 0})">💰 حوّل للمعلم</button>` : ''}
                    ${b.status === 'completed' ? `<button class="btn btn-o btn-xs" onclick="adminRefundBk('${b.id}','${b.studentId}',${b.total || b.price || b.totalDue || 0})">↩️ إرجاع للطالب</button>` : ''}
                    ${paid ? '<span style="color:var(--green);font-size:.75rem;font-weight:700">✓ تم التحويل</span>' : ''}
                    ${b.status === 'refunded' ? '<span style="color:var(--blue);font-size:.75rem;font-weight:700">↩️ مُسترد</span>' : ''}
                  </div>
                </td>
              </tr>`;
        }).join('')}
            </tbody></table>
          </div>`;

      } else if (tab === 'payments') {
        const snap = await db.collection('paymentRequests').orderBy('createdAt', 'desc').get().catch(() => ({ docs: [] }));
        const reqs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const pending = reqs.filter(r => r.status === 'pending').length;
        con.innerHTML = `
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:8px">
            <div><strong>${reqs.length} طلب شحن</strong>${pending ? `<span style="background:var(--red2);color:var(--red);border-radius:100px;padding:2px 10px;font-size:.74rem;font-weight:700;margin-right:8px">⚠️ ${pending} معلق</span>` : ''}</div>
          </div>
          <div class="dsec" style="overflow-x:auto">
            <table class="dtbl"><thead><tr>
              <th>المستخدم</th><th>المبلغ</th><th>الطريقة</th><th>رقم العملية</th><th>التاريخ</th><th>الحالة</th><th>إجراء</th>
            </tr></thead><tbody>
            ${reqs.map(r => {
          const dt = r.createdAt?.toDate ? r.createdAt.toDate().toLocaleDateString('ar-SA') : '—';
          return `<tr>
                <td><strong>${r.userName || '—'}</strong><div style="font-size:.7rem;color:var(--muted)">${r.userPhone || r.userId?.slice(0, 8) || ''}</div></td>
                <td style="font-weight:800;color:var(--teal)">${r.amount} ج.م</td>
                <td style="font-size:.8rem">${r.methodName || r.method || '—'}</td>
                <td style="font-family:monospace;font-size:.78rem;max-width:120px;overflow:hidden;text-overflow:ellipsis">${r.refNumber || '—'}</td>
                <td style="font-size:.74rem;color:var(--muted)">${dt}</td>
                <td><span class="pill ${r.status === 'approved' ? 'pc' : r.status === 'rejected' ? 'pca' : 'pp'}">${r.status === 'approved' ? 'معتمد ✓' : r.status === 'rejected' ? 'مرفوض' : '⏳ معلق'}</span></td>
                <td style="display:flex;gap:4px;flex-wrap:wrap">
                  ${r.status === 'pending' ? `<button class="btn btn-s btn-xs" onclick="apprPay('${r.id}','${r.userId}',${r.amount},this)">✅ اعتماد</button><button class="btn btn-d btn-xs" onclick="rejPay('${r.id}','${r.userId}',${r.amount},this)">❌ رفض</button>` : '<span style="color:var(--muted);font-size:.76rem">—</span>'}
                </td>
              </tr>`;
        }).join('')}
            </tbody></table>
          </div>`;

      } else if (tab === 'withdrawals') {
        const snap = await db.collection('withdrawalRequests').orderBy('createdAt', 'desc').get().catch(() => ({ docs: [] }));
        const reqs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const pending = reqs.filter(r => r.status === 'pending').length;
        con.innerHTML = `
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:8px">
            <div><strong>${reqs.length} طلب سحب</strong>${pending ? `<span style="background:var(--red2);color:var(--red);border-radius:100px;padding:2px 10px;font-size:.74rem;font-weight:700;margin-right:8px">⚠️ ${pending} معلق</span>` : ''}</div>
          </div>
          <div class="dsec" style="overflow-x:auto">
            <table class="dtbl"><thead><tr>
              <th>المعلم</th><th>المبلغ</th><th>البنك / الطريقة</th><th>رقم الحساب</th><th>الاسم البنكي</th><th>التاريخ</th><th>الحالة</th><th>إجراء</th>
            </tr></thead><tbody>
            ${reqs.map(r => {
          const dt = r.createdAt?.toDate ? r.createdAt.toDate().toLocaleDateString('ar-SA') : '—';
          return `<tr>
                <td><strong>${r.userName || '—'}</strong></td>
                <td style="font-weight:800;color:var(--teal);white-space:nowrap">${r.amount} ج.م</td>
                <td style="font-size:.8rem">${r.bankName || r.methodName || r.method || '—'}</td>
                <td style="font-family:monospace;font-size:.76rem;direction:ltr">${r.accountNumber || '—'}</td>
                <td style="font-size:.8rem">${r.accountName || r.holderName || '—'}</td>
                <td style="font-size:.74rem;color:var(--muted)">${dt}</td>
                <td><span class="pill ${r.status === 'approved' ? 'pc' : r.status === 'rejected' ? 'pca' : 'pp'}">${r.status === 'approved' ? 'معتمد ✓' : r.status === 'rejected' ? 'مرفوض' : '⏳ معلق'}</span></td>
                <td style="display:flex;gap:4px;flex-wrap:wrap">
                  ${r.status === 'pending' ? `<button class="btn btn-s btn-xs" onclick="apprWd('${r.id}','${r.userId}',${r.amount},this)">✅ اعتماد</button><button class="btn btn-d btn-xs" onclick="rejWd('${r.id}','${r.userId}',${r.amount},this)">❌ رفض</button>` : '<span style="color:var(--muted);font-size:.76rem">—</span>'}
                </td>
              </tr>`;
        }).join('')}
            </tbody></table>
          </div>`;

      } else if (tab === 'reviews') {
        const snap = await db.collection('reviews').orderBy('createdAt', 'desc').get().catch(() => ({ docs: [] }));
        const revs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const reviewerIds = [...new Set(revs.map(r => r.studentId).filter(Boolean))];
        const reviewers = {};
        await Promise.all(reviewerIds.map(async id => {
          try {
            const s = await db.collection('users').doc(id).get();
            if (s.exists) reviewers[id] = s.data();
          } catch (e) {}
        }));
        con.innerHTML = `<div style="margin-bottom:12px"><strong>${revs.length} تقييم</strong></div>
          <div class="dsec">${revs.map(r => {
            const rr = reviewers[r.studentId] || {};
            const rt = ['tutor', 'both', 'admin'].includes(rr.role) ? 'تقييم معلم' : 'تقييم طالب';
            const badge = rt === 'تقييم معلم' ? 'pc' : 'pp';
            return `
            <div style="padding:14px 18px;border-bottom:1px solid var(--border);display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap">
              <div style="flex:1">
                <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:6px">
                  <div style="font-weight:700;font-size:.85rem">${r.studentName || '—'}</div>
                  <span class="pill ${badge}">${rt}</span>
                </div>
                <div style="font-size:.74rem;color:var(--muted);margin-bottom:5px">المقيَّم: ${r.tutorName || '—'}</div>
                <div style="font-size:.83rem;color:#374151;line-height:1.5">${r.comment || 'بدون تعليق'}</div>
              </div>
              <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
                <span class="stars" style="font-size:1rem">${'★'.repeat(r.rating || 5)}${'☆'.repeat(5 - (r.rating || 5))}</span>
                <button class="btn btn-d btn-xs" onclick="delRev('${r.id}',this)">حذف</button>
              </div>
            </div>`;
          }).join('')}</div>`;

      } else if (tab === 'stats') {
        const [u, b, r, pay, wd] = await Promise.all([
          db.collection('users').get().catch(() => ({ size: 0, docs: [] })),
          db.collection('bookings').get().catch(() => ({ docs: [] })),
          db.collection('reviews').get().catch(() => ({ size: 0 })),
          db.collection('paymentRequests').where('status', '==', 'pending').get().catch(() => ({ size: 0 })),
          db.collection('withdrawalRequests').where('status', '==', 'pending').get().catch(() => ({ size: 0 }))
        ]);
        const allBks = b.docs || [];
        const revenue = allBks.filter(d => d.data().status === 'completed').reduce((s, d) => s + Number((d.data().studentFee ?? d.data().fee ?? 0) + (d.data().tutorFee ?? 0)), 0);
        const tutors = (u.docs || []).filter(d => ['tutor', 'both'].includes(d.data().role)).length;
        const learners = (u.docs || []).filter(d => d.data().role === 'learner').length;
        con.innerHTML = `
          <div class="srow" style="margin-bottom:20px">
            <div class="sc acc"><div class="scic">👥</div><div class="scval">${u.size || 0}</div><div class="sclbl">المستخدمون</div></div>
            <div class="sc"><div class="scic">🎓</div><div class="scval">${tutors}</div><div class="sclbl">معلمون</div></div>
            <div class="sc"><div class="scic">📚</div><div class="scval">${learners}</div><div class="sclbl">متعلمون</div></div>
            <div class="sc"><div class="scic">📅</div><div class="scval">${allBks.length}</div><div class="sclbl">الحجوزات</div></div>
            <div class="sc"><div class="scic">🏁</div><div class="scval">${allBks.filter(d => d.data().status === 'completed').length}</div><div class="sclbl">جلسات مكتملة</div></div>
            <div class="sc"><div class="scic">⭐</div><div class="scval">${r.size || 0}</div><div class="sclbl">التقييمات</div></div>
            <div class="sc amb"><div class="scic">💰</div><div class="scval">${revenue.toFixed(0)}</div><div class="sclbl">عمولة (ج.م)</div></div>
          </div>
          ${pay.size || wd.size ? `<div style="background:var(--red2);border:1px solid var(--red);border-radius:var(--r);padding:14px 18px;display:flex;gap:16px;align-items:center;flex-wrap:wrap;margin-bottom:18px">
            <span style="font-size:1.2rem">⚠️</span>
            <div>
              <div style="font-weight:700;color:var(--red)">يتطلب انتباهاً فورياً</div>
              ${pay.size ? `<div style="font-size:.82rem;color:#b91c1c">${pay.size} طلب شحن معلق — يحتاج مراجعة وموافقة</div>` : ''}
              ${wd.size ? `<div style="font-size:.82rem;color:#b91c1c">${wd.size} طلب سحب معلق — يحتاج اعتماد ومعالجة</div>` : ''}
            </div>
            <div style="display:flex;gap:8px;margin-right:auto">
              ${pay.size ? `<button class="btn btn-sm" style="background:var(--red);color:#fff" onclick="adTab('payments',document.querySelector('.adminTab:nth-child(3)'))">💰 طلبات الشحن</button>` : ''}
              ${wd.size ? `<button class="btn btn-sm" style="background:var(--red);color:#fff" onclick="adTab('withdrawals',document.querySelector('.adminTab:nth-child(4)'))">💸 طلبات السحب</button>` : ''}
            </div>
          </div>`: ''}`;
      }
    }

    async function loadAdminBadges() {
      try {
        const [bk, pay, wd] = await Promise.all([
          db.collection('bookings').where('status', '==', 'pending').get().catch(() => ({ size: 0 })),
          db.collection('paymentRequests').where('status', '==', 'pending').get().catch(() => ({ size: 0 })),
          db.collection('withdrawalRequests').where('status', '==', 'pending').get().catch(() => ({ size: 0 }))
        ]);
        const showBadge = (id, n) => {
          const el = document.getElementById(id);
          if (!el) return;
          if (n > 0) { el.textContent = n > 9 ? '9+' : n; el.classList.remove('hidden'); }
          else el.classList.add('hidden');
        };
        showBadge('admBkBadge', bk.size || 0);
        showBadge('admPayBadge', pay.size || 0);
        showBadge('admWdBadge', wd.size || 0);
      } catch (e) { }
    }

    // Admin: booking approval is handled by the tutor first
    async function adminConfirmBk(bid) {
      showT('المعلم هو من يوافق على الجلسة أولاً', 'err');
    }

    // Admin: cancel booking and refund
    async function adminCancelBk(bid, studentId, refund) {
      if (!confirm(`إلغاء الحجز وإعادة ${refund.toFixed(2)} ج.م للطالب؟`)) return;
      await db.runTransaction(async tx => {
        const wr = db.collection('wallets').doc(studentId);
        const ws = await tx.get(wr);
        const wb = ws.exists ? (ws.data().balance || 0) : 0;
        tx.set(wr, { balance: wb + refund, userId: studentId }, { merge: true });
        tx.update(db.collection('bookings').doc(bid), { status: 'cancelled', cancelledBy: 'admin', cancelledAt: firebase.firestore.FieldValue.serverTimestamp() });
      });
      await db.collection('transactions').add({
        userId: studentId, type: 'credit', amount: refund, currency: 'EGP',
        description: 'استرداد — إلغاء الحجز من الإدارة',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      showT(`✅ تم الإلغاء وإعادة ${refund.toFixed(2)} ج.م`, 'suc');
      adTab('bookings', document.querySelector('.adminTab[onclick*="bookings"]'));
    }

    // Admin: mark session as completed + log duration
    async function adminCompleteBk(bid, tutorId, price, fee) {
      const dur = prompt('مدة الجلسة الفعلية بالدقائق (اضغط إلغاء للإلغاء):', '60');
      if (dur === null) return;
      const durNum = parseInt(dur) || 60;
      await db.collection('bookings').doc(bid).update({
        status: 'completed', actualDuration: durNum, completedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      showT('🏁 تم تسجيل انتهاء الجلسة. يمكن للإدارة تحويل الأرباح لاحقاً فقط بعد التأكيد.', 'suc');
      adTab('bookings', document.querySelector('.adminTab[onclick*="bookings"]'));
    }

    // Admin: transfer earnings to tutor wallet after session
    async function adminPayTutor(bid, tutorId, price, fee) {
      const bkSnap = await db.collection('bookings').doc(bid).get().catch(() => null);
      const bk = bkSnap?.data?.() || {};
      const tutorFee = Number(bk.tutorFee ?? fee ?? 0);
      const net = Number(bk.price ?? price ?? 0) - tutorFee;
      if (!confirm(`تحويل ${net.toFixed(2)} ج.م (صافي) لمحفظة المعلم بعد خصم عمولة المعلم (${tutorFee.toFixed(2)} ج.م)؟`)) return;
      try {
        await db.runTransaction(async tx => {
          const wr = db.collection('wallets').doc(tutorId);
          const ws = await tx.get(wr);
          const wb = ws.exists ? (ws.data().balance || 0) : 0;
          tx.set(wr, { balance: wb + net, userId: tutorId }, { merge: true });
          tx.update(db.collection('bookings').doc(bid), { adminConfirmed: true, paidToTutorAt: firebase.firestore.FieldValue.serverTimestamp() });
        });
        await db.collection('transactions').add({
          userId: tutorId, type: 'credit', kind: 'booking', amount: net, currency: 'EGP',
          description: `أرباح جلسة — معتمدة من الإدارة (${Number(bk.price ?? price ?? 0)} - ${tutorFee} عمولة = ${net.toFixed(2)} ج.م)`,
          bookingId: bid,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        showT(`✅ تم تحويل ${net.toFixed(2)} ج.م لمحفظة المعلم`, 'suc');
        adTab('bookings', document.querySelector('.adminTab[onclick*="bookings"]'));
      } catch (e) { showT('خطأ: ' + e.message, 'err'); }
    }

    async function adminRefundBk(bid, studentId, refund) {
      try {
        const bkSnap0 = await db.collection('bookings').doc(bid).get().catch(() => null);
        const bk0 = bkSnap0?.exists ? (bkSnap0.data() || {}) : {};
        const refundAmt = Number(refund || bk0.total || bk0.price || bk0.totalDue || 0);
        if (!(refundAmt > 0)) {
          showT('لا يوجد مبلغ صالح للاسترداد', 'err');
          return;
        }
        const paidBefore = !!bk0.adminConfirmed || !!bk0.paidToTutorAt;
        if (!confirm(`إرجاع ${refundAmt.toFixed(2)} ج.م للطالب${paidBefore ? ' مع خصمها من محفظة المعلم' : ''}؟`)) return;

        await db.runTransaction(async tx => {
          const bkRef = db.collection('bookings').doc(bid);
          const bkSnap = await tx.get(bkRef);
          const bk = bkSnap.exists ? (bkSnap.data() || {}) : {};
          const effectivePaid = !!bk.adminConfirmed || !!bk.paidToTutorAt;
          const actualStudentId = bk.studentId || studentId;
          const actualTutorId = bk.tutorId || null;

          const studentRef = db.collection('wallets').doc(actualStudentId);
          const studentSnap = await tx.get(studentRef);
          const studentBal = studentSnap.exists ? Number(studentSnap.data().balance || 0) : 0;
          tx.set(studentRef, { balance: +(studentBal + refundAmt).toFixed(2), userId: actualStudentId }, { merge: true });

          let tutorDebited = 0;
          if (effectivePaid && actualTutorId) {
            const tutorRef = db.collection('wallets').doc(actualTutorId);
            const tutorSnap = await tx.get(tutorRef);
            const tutorBal = tutorSnap.exists ? Number(tutorSnap.data().balance || 0) : 0;
            tutorDebited = refundAmt;
            tx.set(tutorRef, { balance: +(tutorBal - refundAmt).toFixed(2), userId: actualTutorId }, { merge: true });
          }

          tx.set(bkRef, {
            status: 'refunded',
            financeState: effectivePaid ? 'transferred_refunded' : 'refunded',
            refundedAt: firebase.firestore.FieldValue.serverTimestamp(),
            refundAmount: refundAmt,
            refundToStudent: true,
            refundFromTutor: effectivePaid,
            refundDeductedAmount: +(tutorDebited || 0).toFixed(2),
            refundDeductedAt: effectivePaid ? firebase.firestore.FieldValue.serverTimestamp() : null,
            adminConfirmed: !!bk.adminConfirmed,
            paidToTutorAt: bk.paidToTutorAt || null,
            lastUpdatedAt: firebase.firestore.FieldValue.serverTimestamp()
          }, { merge: true });
        });

        const actualStudentId = bk0.studentId || studentId;
        const actualTutorId = bk0.tutorId || null;

        await db.collection('transactions').add({
          userId: actualStudentId,
          type: 'credit',
          kind: 'booking',
          amount: refundAmt,
          currency: 'EGP',
          description: 'استرداد — قرار الإدارة بعد انتهاء الجلسة',
          bookingId: bid,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        if (paidBefore && actualTutorId) {
          await db.collection('transactions').add({
            userId: actualTutorId,
            type: 'debit',
            kind: 'booking',
            amount: refundAmt,
            currency: 'EGP',
            description: 'خصم استرداد بعد تحويل الأرباح للمعلم',
            bookingId: bid,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          }).catch(() => {});
        }

        showT(`✅ تم إرجاع ${refundAmt.toFixed(2)} ج.م للطالب${paidBefore ? ' وخصمها من المعلم' : ''}`, 'suc');
        adTab('bookings', document.querySelector('.adminTab[onclick*="bookings"]'));
      } catch (e) { showT('خطأ: ' + e.message, 'err'); }
    }

    // Filter admin table
    function filterAdmTbl(q, tblId) {
      const tbl = document.getElementById(tblId);
      if (!tbl) return;
      tbl.querySelectorAll('tbody tr').forEach(row => {
        row.style.display = row.textContent.toLowerCase().includes(q.toLowerCase()) ? '' : 'none';
      });
    }

    async function apprU(uid, btn) {
      await db.collection('users').doc(uid).update({ isApproved: true });
      btn.textContent = '✅ معتمد'; btn.disabled = true;
      showT('تمت الموافقة', 'suc');
    }

    async function cascadeDeleteUserData(uid) {
      const deleteQuery = async (col, field, value) => {
        if (!field) return;
        const snap = await db.collection(col).where(field, '==', value).get().catch(() => null);
        if (!snap || snap.empty) return;
        const batch = db.batch();
        snap.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit().catch(() => {});
      };
      try {
        await Promise.allSettled([
          db.collection('wallets').doc(uid).delete(),
          db.collection('availability').doc(uid).delete(),
          db.collection('users').doc(uid).delete(),
        ]);
        await Promise.allSettled([
          deleteQuery('paymentRequests', 'userId', uid),
          deleteQuery('withdrawalRequests', 'userId', uid),
          deleteQuery('transactions', 'userId', uid),
          deleteQuery('reviews', 'studentId', uid),
          deleteQuery('reviews', 'tutorId', uid),
          deleteQuery('bookings', 'studentId', uid),
          deleteQuery('bookings', 'tutorId', uid),
          deleteQuery('messages', 'senderId', uid),
          deleteQuery('messages', 'receiverId', uid),
          deleteQuery('sessions', 'studentId', uid),
          deleteQuery('sessions', 'tutorId', uid),
        ]);
        const sessSnap = await db.collection('sessions').get().catch(() => null);
        if (sessSnap && !sessSnap.empty) {
          const batch = db.batch();
          sessSnap.docs.forEach(doc => {
            const d = doc.data() || {};
            if (doc.id === uid || d.studentId === uid || d.tutorId === uid) batch.delete(doc.ref);
          });
          await batch.commit().catch(() => {});
        }
      } catch (e) {
        console.error('cascade delete failed', e);
      }
    }

    async function delU(uid, btn) {
      if (!confirm('حذف هذا المستخدم نهائياً وكل بياناته؟')) return;
      await cascadeDeleteUserData(uid);
      btn.closest('tr')?.remove();
      showT('تم الحذف مع تنظيف البيانات المرتبطة', 'suc');
    }
    async function delRev(id, btn) {
      if (!confirm('حذف هذا التقييم؟')) return;
      await db.collection('reviews').doc(id).delete();
      btn.closest('div[style]')?.remove();
      showT('تم الحذف', 'suc');
    }

    // ── APPROVE PAYMENT REQUEST (Admin) ──
    async function apprPay(reqId, userId, amtEGP, btn) {
      if (!confirm(`الموافقة على شحن ${amtEGP} ج.م؟ سيضاف المبلغ مباشرة لمحفظة المستخدم.`)) return;
      btn.disabled = true; btn.textContent = '...';
      try {
        await db.runTransaction(async tx => {
          const r = db.collection('wallets').doc(userId);
          const s = await tx.get(r);
          const b = s.exists ? (s.data().balance || 0) : 0;
          tx.set(r, { balance: b + amtEGP, userId }, { merge: true });
          tx.set(db.collection('paymentRequests').doc(reqId), { status: 'approved', approvedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
        });
        await db.collection('transactions').doc(reqId).set({
          userId,
          type: 'credit',
          kind: 'topup',
          amount: amtEGP,
          currency: 'EGP',
          status: 'approved',
          processedAt: firebase.firestore.FieldValue.serverTimestamp(),
          description: `شحن محفظة معتمد من الإدارة — ${amtEGP} ج.م`,
          requestId: reqId,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        const row = btn.closest('tr');
        if (row) {
          const actionTd = btn.closest('td');
          if (actionTd) actionTd.innerHTML = '<span style="color:var(--green);font-weight:700">✓ تم</span>';
        }
        showT(`✅ تم شحن ${amtEGP} ج.م للمستخدم`, 'suc');
      } catch (e) { showT('خطأ: ' + e.message, 'err'); btn.disabled = false; btn.textContent = '✅ موافقة'; }
    }

    async function rejPay(reqId, userId, amtEGP, btn) {
      if (!confirm('رفض هذا الطلب؟ سيُبلَّغ المستخدم بالرفض.')) return;
      try {
        await db.collection('paymentRequests').doc(reqId).set({
          status: 'rejected',
          rejectedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        await db.collection('transactions').doc(reqId).set({
          userId,
          type: 'credit',
          kind: 'topup',
          amount: amtEGP,
          currency: 'EGP',
          status: 'rejected',
          processedAt: firebase.firestore.FieldValue.serverTimestamp(),
          description: `طلب شحن مرفوض — ${amtEGP} ج.م`,
          requestId: reqId,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        const row = btn.closest('tr');
        if (row) {
          const actionTd = btn.closest('td');
          if (actionTd) actionTd.innerHTML = '<span style="color:var(--red);font-weight:700">✗ مرفوض</span>';
        }
        showT('تم رفض الطلب', 'suc');
      } catch (e) { showT('خطأ: ' + e.message, 'err'); }
    }

    // ── APPROVE WITHDRAWAL REQUEST (Admin) ──
    async function apprWd(reqId, userId, amtEGP, btn) {
      if (!confirm(`تأكيد سحب ${amtEGP} ج.م للمعلم؟`)) return;
      btn.disabled = true; btn.textContent = '...';
      try {
        await db.runTransaction(async tx => {
          tx.set(db.collection('withdrawalRequests').doc(reqId), { status: 'approved', approvedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
        });
        await db.collection('transactions').doc(reqId).set({
          userId,
          type: 'debit',
          kind: 'withdrawal',
          amount: amtEGP,
          currency: 'EGP',
          status: 'approved',
          processedAt: firebase.firestore.FieldValue.serverTimestamp(),
          description: `سحب أرباح معتمد من الإدارة — ${amtEGP} ج.م`,
          requestId: reqId,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        const row = btn.closest('tr');
        if (row) {
          const actionTd = btn.closest('td');
          if (actionTd) actionTd.innerHTML = '<span style="color:var(--green);font-weight:700">✓ تم</span>';
        }
        showT(`✅ تم اعتماد سحب ${amtEGP} ج.م`, 'suc');
      } catch (e) { showT('خطأ: ' + e.message, 'err'); btn.disabled = false; btn.textContent = '✅ موافقة'; }
    }

    async function rejWd(reqId, userId, amtEGP, btn) {
      if (!confirm('رفض طلب السحب؟ سيتم إعادة المبلغ للمحفظة.')) return;
      try {
        await db.runTransaction(async tx => {
          const r = db.collection('wallets').doc(userId);
          const s = await tx.get(r);
          const b = s.exists ? (s.data().balance || 0) : 0;
          tx.set(r, { balance: b + amtEGP, userId }, { merge: true });
          tx.set(db.collection('withdrawalRequests').doc(reqId), { status: 'rejected', rejectedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
        });
        await db.collection('transactions').doc(reqId).set({
          userId,
          type: 'debit',
          kind: 'withdrawal',
          amount: amtEGP,
          currency: 'EGP',
          status: 'rejected',
          processedAt: firebase.firestore.FieldValue.serverTimestamp(),
          description: `طلب سحب مرفوض — تم إرجاع ${amtEGP} ج.م`,
          requestId: reqId,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        const row = btn.closest('tr');
        if (row) {
          const actionTd = btn.closest('td');
          if (actionTd) actionTd.innerHTML = '<span style="color:var(--red);font-weight:700">✗ مرفوض</span>';
        }
        showT('تم رفض طلب السحب وإعادة المبلغ', 'suc');
      } catch (e) { showT('خطأ: ' + e.message, 'err'); }
    }

    /* ── PAGE NAVIGATION ── */
    const PAGES = ['home', 'explore', 'profile', 'dashboard', 'chat', 'session', 'wallet', 'editProfile', 'admin'];

    function go(name) {
      // Stop chat listener when leaving chat
      if (name !== 'chat' && chatL) { chatL(); chatL = null; }

      PAGES.forEach(p => {
        const el = document.getElementById(`page-${p}`);
        if (el) el.classList.add('hidden');
      });
      const tgt = document.getElementById(`page-${name}`);
      if (tgt) {
        tgt.classList.remove('hidden');
        if (name !== 'session' && name !== 'chat') window.scrollTo({ top: 0, behavior: 'smooth' });
      }

      // Sync bottom nav active state
      const bnMap = { home: 'bnHome', explore: 'bnExplore', profile: 'bnExplore', chat: 'bnChat', dashboard: 'bnDash', wallet: 'bnDash', editProfile: 'bnDash', admin: null, session: null };
      document.querySelectorAll('.bn-item').forEach(el => el.classList.remove('active'));
      const bnTarget = bnMap[name];
      if (bnTarget) { const el = document.getElementById(bnTarget); if (el) el.classList.add('active'); }

      // Close mobile menu if open
      if (typeof closeMobMenu === 'function') closeMobMenu();

      // Page-specific init
      if (name === 'explore') {
        if (!allT.length) loadT().then(() => renderExplore());
        else renderExplore();
      }
      if (name === 'home') renderFeat();
      if (name === 'dashboard') {
        if (CU) { buildSb(); rdOverview(document.getElementById('dashCon')); }
        else openM('loginMod');
      }
      if (name === 'chat') {
        if (CU) loadChatPage();
        else openM('loginMod');
      }
      if (name === 'wallet') {
        if (CU) { syncWithdrawVisibility(); loadTxList(); }
        else openM('loginMod');
      }
      if (name === 'editProfile') {
        if (CU) loadEditProf();
        else openM('loginMod');
      }
      if (name === 'admin') {
        if (CP?.role === 'admin') {
          loadAdminBadges();
          adTab('stats', document.querySelector('.adminTab'));
        }
        else { showT('غير مصرح لك بالدخول', 'err'); go('home'); }
      }
    }

    function fGo(cat) { go('explore'); setTimeout(() => { const el = document.getElementById('exCat'); if (el) { el.value = cat; } renderExplore(); }, 60); }
    function doHeroSrch() { const q = document.getElementById('heroSrch').value; go('explore'); setTimeout(() => { const el = document.getElementById('exSrch'); if (el) { el.value = q; } renderExplore(); }, 60); }

    /* ── MODALS ── */
    function openM(id) {
      document.getElementById(id).classList.remove('hidden');
      document.body.style.overflow = 'hidden';
    }
    function closeM(id) { document.getElementById(id).classList.add('hidden'); document.body.style.overflow = ''; }
    function closeBg(e, id) { if (e.target === e.currentTarget) closeM(id); }
    function switchM(from, to) { closeM(from); openM(to); }
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') ['regMod', 'loginMod', 'bkMod', 'revMod', 'payDoneMod', 'paymobCfgMod'].forEach(id => closeM(id));
    });

    /* ── TOAST ── */
    function showT(msg, type = '') {
      const t = document.getElementById('toast');
      if (!t) {
        // DOM toast element not ready — show a safe floating fallback
        try {
          const fb = document.createElement('div');
          fb.textContent = msg;
          fb.style.cssText = [
            'position:fixed','bottom:28px','left:50%','transform:translateX(-50%)',
            'background:' + (type==='err'?'#dc2626':type==='suc'?'#059669':'#0d6e75'),
            'color:#fff','padding:11px 24px','border-radius:14px','font-size:.9rem',
            'z-index:99999','box-shadow:0 4px 24px rgba(0,0,0,.3)',
            'font-family:Cairo,sans-serif','max-width:90vw','text-align:center',
            'pointer-events:none'
          ].join(';');
          document.body.appendChild(fb);
          setTimeout(() => fb.isConnected && fb.remove(), 3500);
        } catch(_) { console.log('[Toast]', msg); }
        return;
      }
      t.textContent = msg;
      t.className = `toast ${type === 'suc' ? 'suc' : type === 'err' ? 'err' : type === 'inf' ? 'inf' : ''} show`;
      if (toastTmr) clearTimeout(toastTmr);
      toastTmr = setTimeout(() => t.classList.remove('show'), 3500);
    }

    /* ── MOBILE NAV ── */
    let mobMenuOpen = false;
    function toggleMobMenu() {
      mobMenuOpen = !mobMenuOpen;
      const menu = document.getElementById('mobMenu');
      const btn = document.getElementById('hamBtn');
      if (mobMenuOpen) {
        menu.classList.add('open');
        btn.classList.add('open');
        document.body.style.overflow = 'hidden';
      } else {
        menu.classList.remove('open');
        btn.classList.remove('open');
        document.body.style.overflow = '';
      }
    }
    function closeMobMenu() {
      mobMenuOpen = false;
      document.getElementById('mobMenu').classList.remove('open');
      document.getElementById('hamBtn').classList.remove('open');
      document.body.style.overflow = '';
    }
    // Close mobile menu on outside click
    document.addEventListener('click', e => {
      if (mobMenuOpen && !e.target.closest('#mobMenu') && !e.target.closest('#hamBtn')) {
        closeMobMenu();
      }
    });

    /* ── BOTTOM NAV HELPERS ── */
    function setBnActive(id) {
      document.querySelectorAll('.bn-item').forEach(el => el.classList.remove('active'));
      const el = document.getElementById(id);
      if (el) el.classList.add('active');
    }
    function bnChatClick() {
      if (CU) { go('chat'); setBnActive('bnChat'); }
      else openM('loginMod');
    }
    function bnDashClick() {
      if (CU) { go('dashboard'); setBnActive('bnDash'); }
      else openM('loginMod');
    }

    /* ── FILTER TOGGLE (mobile explore) ── */
    let filtersOpen = false;
    function toggleFilters() {
      filtersOpen = !filtersOpen;
      const bar = document.getElementById('filterBar');
      const label = document.getElementById('filterToggleLabel');
      if (filtersOpen) {
        bar.classList.remove('collapsed');
        if (label) label.textContent = 'إخفاء الفلاتر';
      } else {
        bar.classList.add('collapsed');
        if (label) label.textContent = 'إظهار الفلاتر';
      }
    }
    // Open filters on desktop automatically
    function checkFilterState() {
      if (window.innerWidth > 768) {
        const bar = document.getElementById('filterBar');
        if (bar) bar.classList.remove('collapsed');
      }
    }
    window.addEventListener('resize', checkFilterState);
    checkFilterState();

    /* ── MOBILE NAV STATE UPDATE ── */
    function updMobNav() {
      const isLoggedIn = !!CU;
      ['mobD', 'mobC', 'mobW', 'mobEP'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = isLoggedIn ? 'flex' : 'none';
      });
      const mobA = document.getElementById('mobA');
      if (mobA) mobA.style.display = (CP?.role === 'admin') ? 'flex' : 'none';
      const guest = document.getElementById('mobAuthGuest');
      const user = document.getElementById('mobAuthUser');
      if (guest) guest.style.display = isLoggedIn ? 'none' : 'flex';
      if (user) user.style.display = isLoggedIn ? 'block' : 'none';
    }

    /* ── SCROLL TO TOP BUTTON ── */
    const scrollTopBtn = document.getElementById('scrollTopBtn');
    window.addEventListener('scroll', () => {
      if (window.scrollY > 320) {
        scrollTopBtn.classList.add('show');
      } else {
        scrollTopBtn.classList.remove('show');
      }
      // Navbar shadow on scroll
      const nav = document.getElementById('mainNav');
      if (nav) nav.classList.toggle('scrolled', window.scrollY > 10);
    });

    /* ── SYNC BOTTOM NAV WITH PAGE ── */
    const _origGo = go;
    // Extend go() to update bottom nav active state
    const _pageNavMap = {
      home: 'bnHome', explore: 'bnExplore', chat: 'bnChat',
      dashboard: 'bnDash', wallet: 'bnDash', editProfile: 'bnDash',
      profile: 'bnExplore', session: null, admin: null
    };
  

/* ============================================================
   Skillak Pro enhancements
   ============================================================ */
var studentCommissionRate = 5;
var tutorCommissionRate = 5;
var platformCommission = 10;
var supportAdminUid = null;
var regPhotoData = '';
var selectedEditPhoto = '';
var cropperInstance = null;
var cropMode = '';
var cropSource = '';

async function resolveSupportAdminUid() {
  if (supportAdminUid) return supportAdminUid;
  try {
    const snap = await db.collection('users').where('role', '==', 'admin').limit(1).get();
    if (!snap.empty) {
      supportAdminUid = snap.docs[0].id;
    }
  } catch (e) { }
  return supportAdminUid;
}

function getCommissionRates() {
  const s = Number(studentCommissionRate);
  const t = Number(tutorCommissionRate);
  return {
    student: Number.isFinite(s) ? Math.max(0, s) : 0,
    tutor: Number.isFinite(t) ? Math.max(0, t) : 0
  };
}

function calcBookingFees(price) {
  const base = Math.max(0, Number(price || 0));
  const rates = getCommissionRates();
  const studentFee = +(base * rates.student / 100).toFixed(2);
  const tutorFee = +(base * rates.tutor / 100).toFixed(2);
  return {
    price: base,
    studentFee,
    tutorFee,
    platformFee: +(studentFee + tutorFee).toFixed(2),
    totalDue: +(base + studentFee).toFixed(2),
    tutorNet: +(base - tutorFee).toFixed(2)
  };
}

function getBookingEndMs(bk) {
  if (!bk) return 0;
  if (bk.sessionEndsAtMs) return Number(bk.sessionEndsAtMs) || 0;
  const date = bk.date || bk.sessionDate;
  const time = bk.time || bk.timeLbl;
  if (!date || !time) return 0;
  const start = new Date(`${date}T${String(time).slice(0,5)}:00`);
  if (Number.isNaN(start.getTime())) return 0;
  return start.getTime() + (Number(bk.duration || 60) * 60000);
}

function isBookingStillOpen(bk) {
  if (!bk) return false;
  if (!['confirmed', 'active', 'paused'].includes(bk.status)) return false;
  if (bk.status === 'paused') return true;
  const endMs = getBookingEndMs(bk);
  if (!endMs) return true;
  return Date.now() <= endMs;
}

function getSupportChatPhoto() {
  return supportChatPhoto || 'skillak.png';
}

try {
  db.collection('settings').doc('platform').onSnapshot(s => {
    const d = s.exists ? s.data() : null;
    const legacy = Number(d?.commissionRate ?? d?.commission ?? 10);
    const sRate = Number(d?.studentCommissionRate ?? (Number.isFinite(legacy) ? legacy / 2 : 5));
    const tRate = Number(d?.tutorCommissionRate ?? (Number.isFinite(legacy) ? legacy / 2 : 5));
    studentCommissionRate = Number.isFinite(sRate) ? sRate : 5;
    tutorCommissionRate = Number.isFinite(tRate) ? tRate : 5;
    platformCommission = +(studentCommissionRate + tutorCommissionRate).toFixed(2);
    supportChatPhoto = String(d?.supportChatPhoto || d?.supportPhoto || d?.supportImage || '').trim();
    window.supportChatPhoto = supportChatPhoto;
    const sv = document.getElementById('studentCommissionRateView');
    const tv = document.getElementById('tutorCommissionRateView');
    const pv = document.getElementById('commissionRateView');
    if (sv) sv.textContent = `${studentCommissionRate}%`;
    if (tv) tv.textContent = `${tutorCommissionRate}%`;
    if (pv) pv.textContent = `${platformCommission}%`;
    const sinp = document.getElementById('studentCommissionRateInput');
    const tinp = document.getElementById('tutorCommissionRateInput');
    if (sinp && document.activeElement !== sinp) sinp.value = studentCommissionRate;
    if (tinp && document.activeElement !== tinp) tinp.value = tutorCommissionRate;
    const photoInp = document.getElementById('supportChatPhotoInput');
    const photoPrev = document.getElementById('supportChatPhotoPreview');
    if (photoInp && document.activeElement !== photoInp) photoInp.value = supportChatPhoto;
    if (photoPrev) {
      photoPrev.src = supportChatPhoto || 'skillak.png';
      photoPrev.alt = supportChatPhoto ? 'صورة الشات' : 'لوجو المنصة';
    }
    const feeLbl = document.getElementById('bkFeeLabel');
    if (feeLbl) feeLbl.textContent = `📊 إجمالي العمولة (${platformCommission}%)`;
    const sl = document.getElementById('bkStudentFeeLabel');
    const tl = document.getElementById('bkTutorFeeLabel');
    if (sl) sl.textContent = `💳 عمولة الطالب (${studentCommissionRate}%)`;
    if (tl) tl.textContent = `🏦 عمولة المعلم (${tutorCommissionRate}%)`;
    try {
      if (typeof ensureSupportThreadPin === 'function') ensureSupportThreadPin();
      if (typeof renderContacts === 'function') renderContacts(allContacts ? Object.values(allContacts) : []);
    } catch (_) {}
  });
} catch (e) {}

function syncCropPreview(mode, dataUrl) {
  const img = dataUrl ? `<img src="${dataUrl}" alt="preview">` : '';
  if (mode === 'reg') {
    regPhotoData = dataUrl || '';
    const box = document.getElementById('r2PhotoPreview');
    if (box) {
      box.classList.toggle('hidden', !dataUrl);
      box.innerHTML = img || '';
    }
  } else if (mode === 'edit') {
    selectedEditPhoto = dataUrl || '';
    const box = document.getElementById('editPhotoPreview');
    if (box) {
      box.classList.toggle('hidden', !dataUrl);
      box.innerHTML = img || '';
    }
    prvEditAv();
  } else if (mode === 'support') {
    window._pendingSupportChatPhotoDataUrl = dataUrl || '';
    const box = document.getElementById('supportChatPhotoPreview');
    if (box) {
      box.src = dataUrl || 'skillak.png';
      box.alt = dataUrl ? 'صورة الشات' : 'لوجو المنصة';
    }
  }
}

function openCropModal(dataUrl, mode) {
  cropMode = mode;
  cropSource = dataUrl;
  const image = document.getElementById('cropImage');
  const zoom = document.getElementById('cropZoomRange');
  if (!image) return;
  image.src = dataUrl;
  if (zoom) zoom.value = 1;
  openM('cropMod');
  setTimeout(() => {
    try {
      if (cropperInstance) cropperInstance.destroy();
      cropperInstance = new Cropper(image, {
        aspectRatio: 1,
        viewMode: 2,
        dragMode: 'move',
        autoCropArea: 1,
        responsive: true,
        background: false,
        scalable: true,
        zoomable: true,
        movable: true,
        cropBoxResizable: true,
        ready() {
          try { cropperInstance.zoomTo(1); } catch (e) {}
        }
      });
    } catch (e) {
      showT('تعذر فتح أداة قص الصورة', 'err');
    }
  }, 80);
}

function handleImageInput(input, mode) {
  const file = input?.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => openCropModal(reader.result, mode);
  reader.readAsDataURL(file);
}

function rotateCrop(deg) {
  if (cropperInstance) cropperInstance.rotate(deg);
}
function resetCrop() {
  if (cropperInstance) cropperInstance.reset();
}
function setCropZoom(value) {
  if (!cropperInstance) return;
  const v = Number(value);
  if (!Number.isFinite(v)) return;
  const isStep = Math.abs(v) < 0.5;
  if (isStep) {
    cropperInstance.zoom(v);
    const range = document.getElementById('cropZoomRange');
    if (range) {
      const current = Number(range.value || 1);
      const next = Math.min(3, Math.max(0.8, current + v));
      range.value = next.toFixed(2);
    }
  } else {
    cropperInstance.zoomTo(v);
  }
}

function applyCrop() {
  if (!cropperInstance) return;
  const canvas = cropperInstance.getCroppedCanvas({ width: 900, height: 900, imageSmoothingQuality: 'high' });
  const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
  syncCropPreview(cropMode, dataUrl);
  if (cropMode === 'edit') {
    const editPh = document.getElementById('editPh');
    if (editPh) editPh.value = dataUrl;
  } else if (cropMode === 'reg') {
    const r2 = document.getElementById('r2Img');
    if (r2) r2.dataset.cropped = dataUrl;
  } else if (cropMode === 'support') {
    const inp = document.getElementById('supportChatPhotoInput');
    if (inp) inp.value = '';
    window._pendingSupportChatPhotoDataUrl = dataUrl;
    const msg = document.getElementById('supportChatPhotoMsg');
    if (msg) msg.textContent = 'تم تجهيز الصورة المقصوصة. اضغط حفظ لتطبيقها على كل المستخدمين.';
  }
  closeM('cropMod');
}

// Guards for signed-in users
const _skillakOpenM = window.openM;
window.openM = function(id) {
  if (id === 'regMod' && CU) {
    showT('لديك حساب بالفعل. استخدم لوحة التحكم أو عدّل ملفك الشخصي.', 'err');
    return;
  }
  return _skillakOpenM(id);
};

const _skillakOpenRegAs = window.openRegAs;
window.openRegAs = function(role) {
  if (CU) {
    showT('لديك حساب بالفعل. لا يمكن فتح التسجيل مرة أخرى.', 'err');
    return;
  }
  return _skillakOpenRegAs(role);
};

const _skillakGo = window.go;
window.go = function(name) {
  document.querySelectorAll('.page').forEach(el => el.classList.add('hidden'));
  return _skillakGo(name);
};

const _skillakPrvEditAv = window.prvEditAv;
window.prvEditAv = function() {
  const url = selectedEditPhoto || document.getElementById('editPh')?.value || '';
  const el = document.getElementById('editAvPr');
  if (!el) return;
  if (url) { el.innerHTML = `<img src="${url}">`; }
  else { el.textContent = CP?.name?.[0] || 'أ'; el.style.background = CP?.color || 'var(--amber)'; }
};

const _skillakLoadEditProf = window.loadEditProf;
window.loadEditProf = async function() {
  await _skillakLoadEditProf();
  selectedEditPhoto = document.getElementById('editPh')?.value || '';
  syncCropPreview('edit', selectedEditPhoto || '');
};

window.doGoogleLogin = async function() {
  showT('تم إيقاف تسجيل الدخول عبر Google في هذه النسخة', 'err');
};

// Support chat pin + admin thread
async function ensureSupportThreadPin() {
  await resolveSupportAdminUid();
  const list = document.getElementById('contactsList');
  if (!list || !supportAdminUid) return;
  const existing = document.getElementById(`ci-${supportAdminUid}`);
  if (existing) {
    existing.classList.add('support-pin');
    const nm = existing.querySelector('.ciname');
    const pr = existing.querySelector('.ciprev');
    if (nm) nm.textContent = 'خدمة العملاء';
    if (pr) pr.textContent = 'محادثة مفتوحة مع الدعم';
    return;
  }
  const item = document.createElement('div');
  item.id = `ci-${supportAdminUid}`;
  item.className = 'citem support-pin';
  item.style.cursor = 'pointer';
  const photo = getSupportChatPhoto();
  const name = 'خدمة العملاء';
  const emoji = '🛟';
  item.innerHTML = `
    <div class="ciav" style="background:linear-gradient(135deg,rgba(13,110,117,.22),rgba(245,158,11,.22))">${photo ? `<img src="${photo}" style="width:46px;height:46px;border-radius:50%;object-fit:cover">` : `<span style="font-weight:900;font-family:'Fraunces',serif">${emoji}</span>`}</div>
    <div class="ciinfo"><div class="ciname">${name}</div><div class="ciprev">تحدث مع فريق الدعم</div></div>
    <div class="citime">—</div>
  `;
  item.onclick = () => openConv(supportAdminUid);
  list.prepend(item);
}

const _skillakLoadContacts = window.loadContacts;
window.loadContacts = async function() {
  await _skillakLoadContacts();
  await ensureSupportThreadPin();
};

const _skillakRenderContacts = window.renderContacts;
window.renderContacts = function(list) {
  _skillakRenderContacts(list);
  ensureSupportThreadPin().catch(() => {});
};

const _skillakRefreshChatState = window.refreshChatState;
window.refreshChatState = async function(otherUid) {
  await resolveSupportAdminUid();
  if (CP?.role === 'admin' && otherUid && otherUid !== CU?.uid) {
    const rel = allContacts[otherUid] || { uid: otherUid };
    rel.latestBooking = null;
    rel.chatAllowed = true;
    rel.chatStatus = 'دردشة مفتوحة مع العملاء';
    rel.isSupportConversation = true;
    rel.photo = getSupportChatPhoto();
    rel.emoji = '🛟';
    allContacts[otherUid] = rel;
    return rel;
  }
  if (otherUid && supportAdminUid && otherUid === supportAdminUid) {
    const rel = allContacts[otherUid] || { uid: otherUid };
    rel.latestBooking = null;
    rel.chatAllowed = true;
    rel.chatStatus = 'خدمة العملاء متاحة الآن';
    rel.name = 'خدمة العملاء';
    rel.photo = getSupportChatPhoto();
    rel.emoji = '🛟';
    allContacts[otherUid] = rel;
    return rel;
  }
  return _skillakRefreshChatState(otherUid);
};

// Admin users rows => add direct chat button
function enhanceAdminUserRows() {
  document.querySelectorAll('#usersTbl tbody tr').forEach(row => {
    const uid = row.getAttribute('data-uid');
    if (!uid) return;
    const actionTd = row.querySelector('td:last-child');
    if (!actionTd || actionTd.querySelector('.adm-chat-btn')) return;
    const name = row.getAttribute('data-name') || '—';
    const photo = row.getAttribute('data-photo') || '';
    const color = row.getAttribute('data-color') || '';
    const fg = row.getAttribute('data-fg') || '';
    const emoji = row.getAttribute('data-emoji') || '؟';
    const btn = document.createElement('button');
    btn.className = 'btn btn-o btn-xs adm-chat-btn';
    btn.textContent = '💬 شات';
    btn.onclick = () => openChatWith(uid, name, photo, color, fg, emoji);
    actionTd.prepend(btn);
  });
}

const _skillakAdTab = window.adTab;
window.adTab = async function(tab, el) {
  const out = await _skillakAdTab(tab, el);
  if (tab === 'users') setTimeout(enhanceAdminUserRows, 30);
  if (tab === 'commission') {
    const con = document.getElementById('adCon');
    const currentStudent = Number.isFinite(studentCommissionRate) ? studentCommissionRate : 5;
    const currentTutor = Number.isFinite(tutorCommissionRate) ? tutorCommissionRate : 5;
    const current = Number.isFinite(platformCommission) ? platformCommission : (currentStudent + currentTutor);
    con.innerHTML = `
      <div class="ad-panel">
        <div class="ad-panel-hd">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
            <div>
              <span class="sl" style="margin-bottom:6px">العمولة</span>
              <h3 style="margin:0;font-family:'Fraunces',serif">التحكم في عمولة الطالب والمعلم</h3>
            </div>
            <span class="pill pc">الإجمالي: <strong id="commissionRateView">${current}%</strong></span>
          </div>
        </div>
        <div class="cb">
          <div class="ad-grid" style="margin-bottom:14px">
            <div class="ad-card"><strong>عمولة الطالب</strong><div class="num"><span id="studentCommissionRateView">${currentStudent}%</span></div><div style="font-size:.8rem;color:var(--muted)">تُخصم من الطالب عند الحجز</div></div>
            <div class="ad-card"><strong>عمولة المعلم</strong><div class="num"><span id="tutorCommissionRateView">${currentTutor}%</span></div><div style="font-size:.8rem;color:var(--muted)">تُخصم من أرباح المعلم</div></div>
            <div class="ad-card"><strong>أرباح المنصة</strong><div class="num">${current}%</div><div style="font-size:.8rem;color:var(--muted)">مجموع العمولتين</div></div>
          </div>
          <div class="fr" style="align-items:end;margin-top:14px">
            <div class="fg" style="margin-bottom:0">
              <label>عمولة الطالب %</label>
              <input type="number" id="studentCommissionRateInput" min="0" max="100" step="0.5" value="${currentStudent}" />
            </div>
            <div class="fg" style="margin-bottom:0">
              <label>عمولة المعلم %</label>
              <input type="number" id="tutorCommissionRateInput" min="0" max="100" step="0.5" value="${currentTutor}" />
            </div>
            <button class="btn btn-p" onclick="saveCommissionRate()">💾 حفظ العمولة</button>
          </div>
          <div id="commissionMsg" class="fh" style="margin-top:10px">تحديث القيم هنا ينعكس تلقائياً على الحجز والأرباح والتقارير.</div>
        </div>
      </div>`;
  }
  if (tab === 'reports') {
    const con = document.getElementById('adCon');
    const usersSnap = await db.collection('users').orderBy('createdAt', 'desc').get().catch(() => ({ docs: [] }));
    const users = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    con.innerHTML = `
      <div class="ad-panel">
        <div class="ad-panel-hd">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
            <div>
              <span class="sl" style="margin-bottom:6px">التقارير</span>
              <h3 style="margin:0;font-family:'Fraunces',serif">تقرير مستخدم أو تقرير المنصة بالكامل</h3>
            </div>
            <button class="btn btn-o btn-sm" onclick="downloadAdminReportPdf()">⬇️ تحميل PDF</button>
          </div>
        </div>
        <div class="cb">
          <div class="fg">
            <label>اختر التقرير</label>
            <select id="reportUserSel" onchange="buildAdminReport(this.value)">
              <option value="__ALL__">📊 المنصة كاملة</option>
              ${users.map(u => `<option value="${u.id}">${u.name || u.email || u.id}</option>`).join('')}
            </select>
          </div>
          <div id="adminReportCard" class="ad-report"></div>
        </div>
      </div>`;
    buildAdminReport('__ALL__');
  }
  return out;
};

window.saveCommissionRate = async function() {
  const sInp = document.getElementById('studentCommissionRateInput');
  const tInp = document.getElementById('tutorCommissionRateInput');
  const msg = document.getElementById('commissionMsg');
  const sVal = Number(sInp?.value);
  const tVal = Number(tInp?.value);
  if (![sVal, tVal].every(v => Number.isFinite(v) && v >= 0 && v <= 100)) {
    if (msg) msg.textContent = 'أدخل نسباً صحيحة بين 0 و 100.';
    showT('أدخل نسباً صحيحة بين 0 و100', 'err');
    return;
  }
  try {
    await db.collection('settings').doc('platform').set({
      studentCommissionRate: sVal,
      tutorCommissionRate: tVal,
      commissionRate: +(sVal + tVal).toFixed(2),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    studentCommissionRate = sVal;
    tutorCommissionRate = tVal;
    platformCommission = +(sVal + tVal).toFixed(2);
    if (msg) msg.textContent = `تم حفظ العمولة بنجاح: طالب ${sVal}% + معلم ${tVal}%`;
    showT(`تم تحديث العمولة إلى ${platformCommission}%`, 'suc');
    const rateEl = document.getElementById('commissionRateView');
    if (rateEl) rateEl.textContent = `${platformCommission}%`;
    const sv = document.getElementById('studentCommissionRateView');
    const tv = document.getElementById('tutorCommissionRateView');
    if (sv) sv.textContent = `${studentCommissionRate}%`;
    if (tv) tv.textContent = `${tutorCommissionRate}%`;
    const sl = document.getElementById('bkStudentFeeLabel');
    const tl = document.getElementById('bkTutorFeeLabel');
    if (sl) sl.textContent = `💳 عمولة الطالب (${studentCommissionRate}%)`;
    if (tl) tl.textContent = `🏦 عمولة المعلم (${tutorCommissionRate}%)`;
  } catch (e) {
    showT('تعذر حفظ العمولة: ' + e.message, 'err');
  }
};

window.previewSupportChatFile = function(input) {
  const file = input?.files?.[0];
  if (!file) return;
  if (!file.type?.startsWith('image/')) {
    showT('اختر ملف صورة فقط', 'err');
    input.value = '';
    return;
  }
  if (file.size > 4 * 1024 * 1024) {
    showT('حجم الصورة كبير جداً. اختر صورة أصغر من 4MB', 'err');
    input.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = () => openCropModal(String(reader.result || ''), 'support');
  reader.readAsDataURL(file);
};

window.previewSupportChatUrl = function() {
  const urlInp = document.getElementById('supportChatPhotoInput');
  const url = String(urlInp?.value || '').trim();
  if (!url) {
    showT('أضف رابط الصورة أولاً أو ارفعها من الجهاز', 'err');
    return;
  }
  openCropModal(url, 'support');
};

window.saveSupportChatPhoto = async function() {
  if (!CP || CP.role !== 'admin') {
    showT('الصلاحية للمدير فقط', 'err');
    return;
  }
  const urlInp = document.getElementById('supportChatPhotoInput');
  const fileInp = document.getElementById('supportChatPhotoFileInput');
  const msg = document.getElementById('supportChatPhotoMsg');
  const urlVal = String(urlInp?.value || '').trim();
  const fileVal = String(window._pendingSupportChatPhotoDataUrl || '').trim();
  const val = fileVal || urlVal || '';
  try {
    await db.collection('settings').doc('platform').set({
      supportChatPhoto: val,
      supportChatPhotoUpdatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy: CU?.uid || null
    }, { merge: true });
    supportChatPhoto = val;
    window.supportChatPhoto = supportChatPhoto;
    window._pendingSupportChatPhotoDataUrl = '';
    if (fileInp) fileInp.value = '';
    if (msg) msg.textContent = val ? 'تم حفظ صورة الشات وستظهر لجميع المستخدمين.' : 'تمت إعادة صورة الشات إلى لوجو المنصة الافتراضي.';
    showT('✅ تم تحديث صورة الشات', 'suc');
  } catch (e) {
    showT('تعذر حفظ صورة الشات: ' + e.message, 'err');
  }
};

function sanitizePdfName(name) {
  return String(name || 'report')
    .replace(/[\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) || 'report';
}

async function buildAdminReport(uid) {
  const card = document.getElementById('adminReportCard');
  if (!card || !uid) return;
  card.innerHTML = '<div style="text-align:center;padding:24px"><div class="spin" style="margin:0 auto 10px"></div><div style="color:var(--muted)">جاري تجهيز التقرير...</div></div>';
  try {
    const isAll = uid === '__ALL__';
    let users = [], bookings = [], txs = [], withdrawals = [], payments = [];
    if (isAll) {
      const [uSnap, bSnap, tSnap, wSnap, pSnap] = await Promise.all([
        db.collection('users').get().catch(() => ({ docs: [] })),
        db.collection('bookings').get().catch(() => ({ docs: [] })),
        db.collection('transactions').get().catch(() => ({ docs: [] })),
        db.collection('withdrawalRequests').get().catch(() => ({ docs: [] })),
        db.collection('paymentRequests').get().catch(() => ({ docs: [] }))
      ]);
      users = uSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      bookings = bSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      txs = tSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      withdrawals = wSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      payments = pSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    } else {
      const [userSnap, b1, b2, txSnap, wdSnap, paySnap] = await Promise.all([
        db.collection('users').doc(uid).get(),
        db.collection('bookings').where('studentId', '==', uid).get().catch(() => ({ docs: [] })),
        db.collection('bookings').where('tutorId', '==', uid).get().catch(() => ({ docs: [] })),
        db.collection('transactions').where('userId', '==', uid).get().catch(() => ({ docs: [] })),
        db.collection('withdrawalRequests').where('userId', '==', uid).get().catch(() => ({ docs: [] })),
        db.collection('paymentRequests').where('userId', '==', uid).get().catch(() => ({ docs: [] }))
      ]);
      users = [userSnap.exists ? { id: userSnap.id, ...userSnap.data() } : {}];
      bookings = [...(b1.docs || []), ...(b2.docs || [])].map(d => ({ id: d.id, ...d.data() }));
      txs = (txSnap.docs || []).map(d => ({ id: d.id, ...d.data() }));
      withdrawals = (wdSnap.docs || []).map(d => ({ id: d.id, ...d.data() }));
      payments = (paySnap.docs || []).map(d => ({ id: d.id, ...d.data() }));
    }

    const completed = bookings.filter(b => b.status === 'completed').length;
    const pending = bookings.filter(b => b.status === 'pending').length;
    const cancelled = bookings.filter(b => ['cancelled', 'rejected'].includes(b.status)).length;
    const refunded = bookings.filter(b => b.status === 'refunded').length;
    const spent = txs.filter(t => t.type === 'debit' && (t.kind === 'booking' || t.kind === 'withdrawal' || t.kind === 'topup')).reduce((s, t) => s + Number(t.amount || 0), 0)
      - txs.filter(t => t.type === 'credit' && t.kind === 'booking').reduce((s, t) => s + Number(t.amount || 0), 0);
    const earned = txs.filter(t => t.type === 'credit').reduce((s, t) => s + Number(t.amount || 0), 0);
    const balance = isAll ? null : Number((await db.collection('wallets').doc(uid).get().catch(() => null))?.data()?.balance || 0);
    const userLabel = isAll ? 'تقرير المنصة بالكامل' : (users[0]?.name || '—');
    const userEmail = isAll ? '—' : (users[0]?.email || '—');
    const role = isAll ? 'المنصة كاملة' : ({ learner: 'متعلم', tutor: 'معلم', both: 'متعلم ومعلم', admin: 'مدير' }[users[0]?.role] || (users[0]?.role || '—'));
    const lastTx = txs[0]?.createdAt?.toDate ? txs[0].createdAt.toDate().toLocaleDateString('ar-EG') : '—';
    const platformProfit = bookings.filter(b => b.status === 'completed').reduce((s, b) => s + Number((b.studentFee ?? b.fee ?? 0) + (b.tutorFee ?? 0)), 0);

    card.innerHTML = `
      <div class="report-meta" style="margin-bottom:14px">
        <div class="rm"><span>الاسم</span><strong>${userLabel}</strong></div>
        <div class="rm"><span>البريد</span><strong>${userEmail}</strong></div>
        <div class="rm"><span>الدور</span><strong>${role}</strong></div>
        <div class="rm"><span>الرصيد الحالي</span><strong>${isAll ? '—' : `${Number(balance || 0).toFixed(2)} ج.م`}</strong></div>
        <div class="rm"><span>آخر معاملة</span><strong>${lastTx}</strong></div>
        <div class="rm"><span>العمولة الحالية</span><strong>${platformCommission}%</strong></div>
      </div>
      <div class="ad-grid" style="margin-bottom:14px">
        <div class="ad-card"><strong>الجلسات</strong><div class="num">${bookings.length}</div><div style="font-size:.8rem;color:var(--muted)">مكتملة: ${completed}</div></div>
        <div class="ad-card"><strong>المعلقة</strong><div class="num">${pending}</div><div style="font-size:.8rem;color:var(--muted)">مرفوضة/ملغاة: ${cancelled}</div></div>
        <div class="ad-card"><strong>المستردة</strong><div class="num">${refunded}</div><div style="font-size:.8rem;color:var(--muted)">كل العمليات المرتبطة</div></div>
        <div class="ad-card"><strong>المعاملات</strong><div class="num">${txs.length}</div><div style="font-size:.8rem;color:var(--muted)">إجمالي الشحن/السحب/الحجز</div></div>
      </div>
      <div class="report-meta" style="margin-bottom:14px">
        <div class="rm"><span>إجمالي الشحن</span><strong>${payments.reduce((s, x) => s + Number(x.amount || 0), 0).toFixed(2)} ج.م</strong></div>
        <div class="rm"><span>إجمالي السحب</span><strong>${withdrawals.reduce((s, x) => s + Number(x.amount || 0), 0).toFixed(2)} ج.م</strong></div>
        <div class="rm"><span>إجمالي الإنفاق الصافي</span><strong>${spent.toFixed(2)} ج.م</strong></div>
        <div class="rm"><span>أرباح المنصة</span><strong>${platformProfit.toFixed(2)} ج.م</strong></div>
      </div>
      <div class="card" style="border-radius:18px;overflow:hidden;margin-bottom:14px">
        <div class="ch"><div class="ct">سجل الجلسات</div><div class="pill pc">${bookings.length} سجل</div></div>
        <div class="cb" style="padding:0;overflow:auto;max-height:300px">
          <table class="dtbl" style="min-width:760px"><thead><tr><th>النوع</th><th>التاريخ</th><th>الحالة</th><th>المبلغ</th><th>المعلم/الطالب</th></tr></thead><tbody>
            ${bookings.map(b => `<tr><td>${isAll ? (b.studentName ? 'جلسة/حجز' : '—') : (b.studentId === uid ? 'حجز كطالب' : 'جلسة كمعلم')}</td><td>${b.date || '—'} ${b.timeLbl || b.time || ''}</td><td><span class="pill ${b.status === 'completed' ? 'pc' : b.status === 'refunded' ? 'pco' : b.status === 'cancelled' ? 'pca' : 'pp'}">${b.status || '—'}</span></td><td>${Number(b.total || b.price || 0).toFixed(2)} ج.م</td><td>${isAll ? `${b.studentName || '—'} / ${b.tutorName || '—'}` : (b.studentId === uid ? (b.tutorName || '—') : (b.studentName || '—'))}</td></tr>`).join('')}
          </tbody></table>
        </div>
      </div>
      <div class="card" style="border-radius:18px;overflow:hidden">
        <div class="ch"><div class="ct">سجل المعاملات</div><div class="pill pp">${txs.length} حركة</div></div>
        <div class="cb" style="padding:0;overflow:auto;max-height:280px">
          <table class="dtbl" style="min-width:760px"><thead><tr><th>النوع</th><th>الوصف</th><th>المبلغ</th><th>الحالة</th><th>التاريخ</th></tr></thead><tbody>
            ${txs.map(t => `<tr><td>${t.kind || t.type || '—'}</td><td>${t.description || '—'}</td><td>${Number(t.amount || 0).toFixed(2)} ج.م</td><td>${t.status || '—'}</td><td>${t.createdAt?.toDate ? t.createdAt.toDate().toLocaleString('ar-EG') : '—'}</td></tr>`).join('')}
          </tbody></table>
        </div>
      </div>`;
  } catch (e) {
    card.innerHTML = `<div style="padding:20px;color:var(--red)">تعذر تحميل التقرير: ${e.message}</div>`;
  }
}

window.downloadAdminReportPdf = async function() {
  const card = document.getElementById('adminReportCard');
  const sel = document.getElementById('reportUserSel');
  if (!card) return;
  try {
    const canvas = await html2canvas(card, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
    const imgData = canvas.toDataURL('image/png');
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth - 10;
    const imgHeight = canvas.height * imgWidth / canvas.width;
    let heightLeft = imgHeight;
    let position = 5;
    pdf.addImage(imgData, 'PNG', 5, position, imgWidth, imgHeight);
    heightLeft -= (pageHeight - 10);
    while (heightLeft > 0) {
      pdf.addPage();
      position = heightLeft - imgHeight + 5;
      pdf.addImage(imgData, 'PNG', 5, position, imgWidth, imgHeight);
      heightLeft -= (pageHeight - 10);
    }
    const label = sel?.value === '__ALL__' ? 'platform' : sanitizePdfName(sel?.selectedOptions?.[0]?.textContent || 'report');
    pdf.save(`Skillak-${label}-${new Date().toISOString().slice(0,10)}.pdf`);
  } catch (e) {
    showT('تعذر إنشاء ملف PDF: ' + e.message, 'err');
  }
};

// Improve load/save of profile photos through cropper
const _skillakDoReg = window.doReg;
window.doReg = async function() {
  regPhotoData = regPhotoData || document.getElementById('r2Img')?.dataset?.cropped || '';
  return _skillakDoReg();
};

const _skillakSavePrf = window.savePrf;
window.savePrf = async function() {
  selectedEditPhoto = selectedEditPhoto || document.getElementById('editPh')?.value || '';
  return _skillakSavePrf();
};

// Image picker listeners
window.addEventListener('DOMContentLoaded', () => {
  const r2 = document.getElementById('r2Img');
  if (r2) r2.addEventListener('change', () => handleImageInput(r2, 'reg'));
  const ed = document.getElementById('editImg');
  if (ed) ed.addEventListener('change', () => handleImageInput(ed, 'edit'));
  const saveEdit = document.getElementById('editPh');
  if (saveEdit) saveEdit.addEventListener('input', () => { selectedEditPhoto = saveEdit.value.trim(); prvEditAv(); });
  const feeLbl = document.getElementById('bkFeeLabel');
  if (feeLbl) feeLbl.textContent = `📊 رسوم الخدمة (${platformCommission}%)`;
});


/* ===== END script.js ===== */


/* ===== BEGIN patch.js ===== */
/* Skillak compatibility stub */

/* ===== END patch.js ===== */


/* ===== BEGIN patch2.js ===== */
/* Skillak compatibility stub */

/* ===== END patch2.js ===== */


/* ===== BEGIN patch3.js ===== */
/* Skillak compatibility stub */

/* ===== END patch3.js ===== */


/* ===== BEGIN patch4.js ===== */
/* ═══════════════════════════════════════════════════════════════════
   patch4.js — Skillak Platform v6.0
   mahmoud.hamed.ahmed25@gmail.com

   ═══════════════════════════════════════════════════════════════════
   ✅ 1.  تعديل البريد الإلكتروني وكلمة المرور من الملف الشخصي
   ✅ 2.  نظام الجلسات الكامل — إعادة الاتصال التلقائي
   ✅ 3.  العودة لـ "جلساتي" بعد الخروج من الجلسة
   ✅ 4.  تفاصيل الجلسة والأرباح الكاملة في لوحة الأدمن
   ✅ 5.  تحويل الأرباح للمعلم بعد اعتماد الأدمن
   ✅ 6.  إرسال بريد إلكتروني عند الحجز (EmailJS)
   ✅ 7.  غرفة انتظار محسّنة مع إعادة اتصال فورية
   ✅ 8.  زر إنهاء للطالب فقط — المعلم يخرج مؤقتاً
   ✅ 9.  تحسينات واجهة المستخدم الشاملة
   ═══════════════════════════════════════════════════════════════════ */
'use strict';

/* ─── helpers ─── */
const _p4 = {
  e: id => document.getElementById(id),
  esc: v => String(v||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'),
  fmt: n => Number(n||0).toFixed(2),
  toast: (msg, type='') => {
    try {
      const t = document.getElementById('toast');
      if (!t) throw new Error('no toast el');
      if (typeof showT === 'function') showT(msg, type);
    } catch(_) {
      try {
        const fb = document.createElement('div');
        fb.textContent = msg;
        fb.style.cssText = 'position:fixed;bottom:28px;left:50%;transform:translateX(-50%);background:' +
          (type==='err'?'#dc2626':type==='suc'?'#059669':'#0d6e75') +
          ';color:#fff;padding:11px 24px;border-radius:14px;font-size:.9rem;z-index:99999;' +
          'font-family:Cairo,sans-serif;max-width:90vw;text-align:center;pointer-events:none;' +
          'box-shadow:0 4px 24px rgba(0,0,0,.3)';
        document.body.appendChild(fb);
        setTimeout(() => fb.isConnected && fb.remove(), 3500);
      } catch(_2) { console.log('[Toast]', msg); }
    }
  },
  go: name => { if (typeof go==='function') go(name); },
};

/* ══════════════════════════════════════════════════════
   ⚙️ EmailJS CONFIG
   اذهب لـ https://www.emailjs.com وأنشئ حساب مجاني
   ثم أبدل القيم أدناه وغيّر enabled إلى true
   ══════════════════════════════════════════════════════ */
const _p4_EMAIL = {
  serviceId:  'service_zsr4t7b',   // من لوحة EmailJS
  templateId: 'template_wl51tit',  // قالب بريدك
  publicKey:  'a2SEaFDGp1ofly7HC',   // المفتاح العام
  enabled: true                   // ← اجعلها true بعد الإعداد
};

async function _p4_sendEmail(toEmail, toName, params) {
  if (!_p4_EMAIL.enabled) {
    console.log('[Skillak Email]', toEmail, params.subject);
    return;
  }
  try {
    if (!window.emailjs) {
      await new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js';
        s.onload = res; s.onerror = rej;
        document.head.appendChild(s);
      });
      window.emailjs.init(_p4_EMAIL.publicKey);
    }
    await window.emailjs.send(_p4_EMAIL.serviceId, _p4_EMAIL.templateId, {
      to_email: toEmail,
      email: toEmail,
      recipient_email: toEmail,
      reply_to: toEmail,
      to_name: toName,
      name: toName,
      ...params
    });
  } catch(e) { console.warn('[Skillak Email]', e.message); }
}

/* ══════════════════════════════════════════════════════
   1. تعديل البريد الإلكتروني وكلمة المرور
   ══════════════════════════════════════════════════════ */

function _p4_injectSecuritySection() {
  // Only inject once
  if (_p4.e('p4SecurityCard')) return;

  // Find the save button row in editProfile
  const editWrap = document.querySelector('.editwrap');
  if (!editWrap) return;

  const secCard = document.createElement('div');
  secCard.id = 'p4SecurityCard';
  secCard.className = 'card';
  secCard.style.cssText = 'margin-top:16px';
  secCard.innerHTML = `
    <div class="ch">
      <div class="ct" style="display:flex;align-items:center;gap:8px">
        <span style="font-size:1.2rem">🔐</span>
        <span>إعدادات الأمان</span>
      </div>
    </div>
    <div class="cb">

      <!-- Change Email -->
      <div style="margin-bottom:24px">
        <div style="font-weight:800;font-size:.88rem;margin-bottom:12px;display:flex;align-items:center;gap:8px">
          <span style="width:28px;height:28px;background:rgba(13,110,117,.12);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:.9rem">📧</span>
          تغيير البريد الإلكتروني
        </div>
        <div id="p4CurrentEmail" style="font-size:.8rem;color:var(--muted);margin-bottom:10px;padding:8px 12px;background:var(--cream2);border-radius:8px">
          البريد الحالي: جاري التحميل...
        </div>
        <div class="fg" style="margin-bottom:10px">
          <label>البريد الجديد <span class="req">*</span></label>
          <input type="email" id="p4NewEmail" placeholder="new@email.com" style="direction:ltr" />
        </div>
        <div class="fg" style="margin-bottom:12px">
          <label>كلمة المرور الحالية (للتحقق) <span class="req">*</span></label>
          <div style="position:relative">
            <input type="password" id="p4EmailPass" placeholder="أدخل كلمة مرورك الحالية" />
            <button type="button" onclick="document.getElementById('p4EmailPass').type=document.getElementById('p4EmailPass').type==='password'?'text':'password'"
              style="position:absolute;left:10px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;font-size:1rem">👁</button>
          </div>
        </div>
        <button class="btn btn-p btn-sm" onclick="p4ChangeEmail()" style="width:100%">
          📧 تحديث البريد الإلكتروني
        </button>
      </div>

      <div style="border-top:1.5px solid var(--border);margin:0 0 20px"></div>

      <!-- Change Password -->
      <div>
        <div style="font-weight:800;font-size:.88rem;margin-bottom:12px;display:flex;align-items:center;gap:8px">
          <span style="width:28px;height:28px;background:rgba(245,158,11,.12);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:.9rem">🔑</span>
          تغيير كلمة المرور
        </div>
        <div class="fg" style="margin-bottom:10px">
          <label>كلمة المرور الحالية <span class="req">*</span></label>
          <div style="position:relative">
            <input type="password" id="p4OldPass" placeholder="كلمة المرور الحالية" />
            <button type="button" onclick="document.getElementById('p4OldPass').type=document.getElementById('p4OldPass').type==='password'?'text':'password'"
              style="position:absolute;left:10px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;font-size:1rem">👁</button>
          </div>
        </div>
        <div class="fg" style="margin-bottom:10px">
          <label>كلمة المرور الجديدة <span class="req">*</span></label>
          <div style="position:relative">
            <input type="password" id="p4NewPass" placeholder="6 أحرف على الأقل" />
            <button type="button" onclick="document.getElementById('p4NewPass').type=document.getElementById('p4NewPass').type==='password'?'text':'password'"
              style="position:absolute;left:10px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;font-size:1rem">👁</button>
          </div>
        </div>
        <div class="fg" style="margin-bottom:12px">
          <label>تأكيد كلمة المرور الجديدة <span class="req">*</span></label>
          <div style="position:relative">
            <input type="password" id="p4ConfPass" placeholder="أعد كتابة كلمة المرور الجديدة" />
            <button type="button" onclick="document.getElementById('p4ConfPass').type=document.getElementById('p4ConfPass').type==='password'?'text':'password'"
              style="position:absolute;left:10px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;font-size:1rem">👁</button>
          </div>
        </div>
        <!-- Password strength indicator -->
        <div id="p4PassStrength" style="margin-bottom:12px;display:none">
          <div style="height:4px;border-radius:4px;background:#e5e7eb;overflow:hidden">
            <div id="p4PassBar" style="height:100%;border-radius:4px;transition:width .3s,background .3s;width:0"></div>
          </div>
          <div id="p4PassLabel" style="font-size:.72rem;margin-top:4px;color:var(--muted)"></div>
        </div>
        <button class="btn btn-p btn-sm" onclick="p4ChangePassword()" style="width:100%;background:linear-gradient(135deg,#f59e0b,#d97706);border-color:transparent">
          🔑 تحديث كلمة المرور
        </button>
      </div>

    </div>
  `;

  // Append to editwrap
  editWrap.appendChild(secCard);

  // Password strength listener
  const newPassEl = _p4.e('p4NewPass');
  if (newPassEl) {
    newPassEl.addEventListener('input', () => {
      const v = newPassEl.value;
      const str = _p4.e('p4PassStrength');
      const bar = _p4.e('p4PassBar');
      const lbl = _p4.e('p4PassLabel');
      if (!str || !bar || !lbl) return;
      if (!v) { str.style.display = 'none'; return; }
      str.style.display = 'block';
      const score = [v.length >= 8, /[A-Z]/.test(v), /[0-9]/.test(v), /[^A-Za-z0-9]/.test(v)].filter(Boolean).length;
      const map = [
        ['25%', '#ef4444', 'ضعيفة جداً 😟'],
        ['50%', '#f59e0b', 'مقبولة 😐'],
        ['75%', '#10b981', 'جيدة 😊'],
        ['100%', '#059669', 'قوية جداً 💪'],
      ];
      const [width, color, text] = map[Math.max(0, score - 1)] || map[0];
      bar.style.width = width; bar.style.background = color;
      lbl.textContent = text; lbl.style.color = color;
    });
  }
}

/* Fill current email when profile loads */
function _p4_fillCurrentEmail() {
  const el = _p4.e('p4CurrentEmail');
  if (!el) return;
  const email = (typeof CU !== 'undefined' ? CU?.email : null) ||
                (typeof CP !== 'undefined' ? CP?.email : null) || '—';
  el.textContent = `البريد الحالي: ${email}`;
}

/* Change Email */
window.p4ChangeEmail = async function() {
  const newEmail = (_p4.e('p4NewEmail')?.value || '').trim();
  const pass     = _p4.e('p4EmailPass')?.value || '';
  if (!newEmail || !newEmail.includes('@')) { _p4.toast('❌ البريد الإلكتروني غير صحيح', 'err'); return; }
  if (!pass) { _p4.toast('❌ أدخل كلمة مرورك الحالية للتحقق', 'err'); return; }
  if (!CU) { _p4.toast('يرجى تسجيل الدخول', 'err'); return; }

  const btn = document.querySelector('[onclick="p4ChangeEmail()"]');
  if (btn) { btn.textContent = 'جاري التحديث...'; btn.disabled = true; }

  try {
    // Re-authenticate first
    const credential = firebase.auth.EmailAuthProvider.credential(CU.email, pass);
    await CU.reauthenticateWithCredential(credential);
    await CU.updateEmail(newEmail);
    // Update in Firestore too
    await db.collection('users').doc(CU.uid).update({ email: newEmail });
    if (typeof CP !== 'undefined' && CP) CP.email = newEmail;
    _p4_fillCurrentEmail();
    if (_p4.e('p4NewEmail')) _p4.e('p4NewEmail').value = '';
    if (_p4.e('p4EmailPass')) _p4.e('p4EmailPass').value = '';
    _p4.toast('✅ تم تحديث البريد الإلكتروني بنجاح', 'suc');
  } catch(e) {
    const errMap = {
      'auth/wrong-password':         '❌ كلمة المرور الحالية غير صحيحة',
      'auth/email-already-in-use':   '❌ هذا البريد مستخدم بالفعل من حساب آخر',
      'auth/invalid-email':          '❌ صيغة البريد الإلكتروني غير صحيحة',
      'auth/requires-recent-login':  '❌ يرجى تسجيل الخروج وإعادة الدخول ثم المحاولة',
    };
    _p4.toast(errMap[e.code] || '❌ ' + e.message, 'err');
  } finally {
    if (btn) { btn.textContent = '📧 تحديث البريد الإلكتروني'; btn.disabled = false; }
  }
};

/* Change Password */
window.p4ChangePassword = async function() {
  const oldPass  = _p4.e('p4OldPass')?.value || '';
  const newPass  = _p4.e('p4NewPass')?.value || '';
  const confPass = _p4.e('p4ConfPass')?.value || '';
  if (!oldPass)             { _p4.toast('❌ أدخل كلمة المرور الحالية', 'err'); return; }
  if (newPass.length < 6)   { _p4.toast('❌ كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل', 'err'); return; }
  if (newPass !== confPass)  { _p4.toast('❌ كلمتا المرور غير متطابقتين', 'err'); return; }
  if (!CU)                   { _p4.toast('يرجى تسجيل الدخول', 'err'); return; }

  const btn = document.querySelector('[onclick="p4ChangePassword()"]');
  if (btn) { btn.textContent = 'جاري التحديث...'; btn.disabled = true; }

  try {
    const credential = firebase.auth.EmailAuthProvider.credential(CU.email, oldPass);
    await CU.reauthenticateWithCredential(credential);
    await CU.updatePassword(newPass);
    if (_p4.e('p4OldPass'))  _p4.e('p4OldPass').value  = '';
    if (_p4.e('p4NewPass'))  _p4.e('p4NewPass').value  = '';
    if (_p4.e('p4ConfPass')) _p4.e('p4ConfPass').value = '';
    const str = _p4.e('p4PassStrength');
    if (str) str.style.display = 'none';
    _p4.toast('✅ تم تغيير كلمة المرور بنجاح', 'suc');
  } catch(e) {
    const errMap = {
      'auth/wrong-password':        '❌ كلمة المرور الحالية غير صحيحة',
      'auth/requires-recent-login': '❌ يرجى تسجيل الخروج وإعادة الدخول ثم المحاولة',
      'auth/weak-password':         '❌ كلمة المرور الجديدة ضعيفة جداً',
    };
    _p4.toast(errMap[e.code] || '❌ ' + e.message, 'err');
  } finally {
    if (btn) { btn.textContent = '🔑 تحديث كلمة المرور'; btn.disabled = false; }
  }
};

/* Hook into loadEditProf */
const _p4_origLoadEdit = window.loadEditProf;
window.loadEditProf = async function() {
  if (typeof _p4_origLoadEdit === 'function') await _p4_origLoadEdit();
  _p4_injectSecuritySection();
  _p4_fillCurrentEmail();
};

/* ══════════════════════════════════════════════════════
   2. نظام الجلسات — إعادة الاتصال التلقائي
   ══════════════════════════════════════════════════════ */

/* Waiting room with live countdown + retry */
window._p4_sesConnected = false;

function _p4_injectWaitingRoomEnhancer(bk, isTutor) {
  const waitOv = _p4.e('waitOv');
  if (!waitOv) return;

  const endMs = typeof getBookingEndMs === 'function' ? getBookingEndMs(bk) : 0;
  const other = isTutor ? (bk.studentName || 'الطالب') : (bk.tutorName || 'المعلم');

  // Create enhanced overlay content if not already enhanced
  if (waitOv.querySelector('.swr-inner')) return;
  const inner = waitOv.querySelector('.waitinner') || waitOv.firstElementChild;
  if (!inner) return;

  // Add retry button and countdown to overlay
  const extra = document.createElement('div');
  extra.id = 'p4WaitExtra';
  extra.style.cssText = 'margin-top:14px;text-align:center';
  extra.innerHTML = `
    <div id="p4WaitCountdown" style="font-size:.8rem;color:rgba(255,255,255,.5);margin-bottom:10px"></div>
    <div style="font-size:.82rem;color:rgba(255,255,255,.6);margin-bottom:10px">
      في انتظار <strong style="color:#fff">${_p4.esc(other)}</strong> للانضمام...
    </div>
    <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
      <button onclick="_p4_retryConnection()" 
        style="background:rgba(255,255,255,.1);color:#fff;border:1px solid rgba(255,255,255,.2);
               border-radius:10px;padding:8px 16px;font-size:.8rem;cursor:pointer;font-family:'Cairo',sans-serif">
        🔄 إعادة الاتصال
      </button>
      <button onclick="_p4_exitWaitingRoom()" 
        style="background:transparent;color:rgba(255,255,255,.5);border:1px solid rgba(255,255,255,.15);
               border-radius:10px;padding:8px 16px;font-size:.8rem;cursor:pointer;font-family:'Cairo',sans-serif">
        ← الخروج
      </button>
    </div>`;

  if (inner) inner.appendChild(extra);

  // Update countdown
  if (endMs) {
    const countdownEl = _p4.e('p4WaitCountdown');
    const update = () => {
      if (!countdownEl) return;
      const rem = endMs - Date.now();
      if (rem <= 0) { countdownEl.textContent = '⏰ انتهى وقت الجلسة'; return; }
      const h = Math.floor(rem / 3600000);
      const m = Math.floor((rem % 3600000) / 60000);
      const s = Math.floor((rem % 60000) / 1000);
      const str = h > 0 ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}` : `${m}:${String(s).padStart(2,'0')}`;
      countdownEl.textContent = `⏱️ الوقت المتبقي للجلسة: ${str}`;
    };
    update();
    const _countInt = setInterval(() => {
      if (!_p4.e('p4WaitCountdown')) { clearInterval(_countInt); return; }
      update();
    }, 1000);
  }
}

window._p4_retryConnection = async function() {
  const bid = typeof curSesBid !== 'undefined' ? curSesBid : null;
  if (!bid) return;
  _p4.toast('🔄 جاري إعادة محاولة الاتصال...', 'inf');
  // Restart WebRTC from scratch
  try {
    if (typeof pc !== 'undefined' && pc) { try { pc.close(); } catch(e) {} window.pc = null; }
    // Re-enter session
    if (typeof enterSession === 'function') await enterSession(bid);
  } catch(e) {
    _p4.toast('تعذرت إعادة الاتصال: ' + e.message, 'err');
  }
};

window._p4_exitWaitingRoom = function() {
  const bid = typeof curSesBid !== 'undefined' ? curSesBid : null;
  // Pause session and return to sessions page
  if (bid) {
    const bk = typeof curSesBk !== 'undefined' ? curSesBk : null;
    if (bk) {
      const endMs = typeof getBookingEndMs === 'function' ? getBookingEndMs(bk) : 0;
      db.collection('bookings').doc(bid).set({
        status: 'paused',
        lastPausedAt: firebase.firestore.FieldValue.serverTimestamp(),
        sessionEndsAtMs: endMs
      }, { merge: true }).catch(() => {});
    }
  }
  // Cleanup
  if (typeof pc !== 'undefined' && pc) { try { pc.close(); } catch(e) {} window.pc = null; }
  if (typeof locSt !== 'undefined' && locSt) { locSt.getTracks().forEach(t => t.stop()); window.locSt = null; }
  if (typeof sesTInt !== 'undefined' && sesTInt) { clearInterval(sesTInt); }
  if (typeof sesChatL !== 'undefined' && sesChatL) { try { sesChatL(); } catch(e) {} }
  const mainNav = _p4.e('mainNav');
  if (mainNav) mainNav.style.display = '';
  if (typeof curSesBid !== 'undefined') window.curSesBid = null;
  if (typeof curSesBk !== 'undefined') window.curSesBk = null;
  // Go to sessions tab
  _p4.go('dashboard');
  setTimeout(() => { if (typeof dNav === 'function') dNav('sessions'); }, 300);
};

/* Hook enterSession to enhance waiting room */
const _p4_origEnter = window.enterSession;
window.enterSession = async function(bookingId) {
  _p4.toast('🔗 جاري الاتصال بالجلسة...', 'inf');
  try {
    const bSnap = await db.collection('bookings').doc(bookingId).get();
    const bk = bSnap.exists ? { id: bookingId, ...bSnap.data() } : null;
    const uid = typeof CU !== 'undefined' ? CU?.uid : null;
    const isTutor = bk?.tutorId === uid;

    const result = typeof _p4_origEnter === 'function' ? await _p4_origEnter(bookingId) : undefined;

    // Enhance waiting room after render
    setTimeout(() => {
      if (bk) _p4_injectWaitingRoomEnhancer(bk, isTutor);
    }, 800);

    // ICE reconnection listener
    setTimeout(() => {
      const peerConn = typeof pc !== 'undefined' ? pc : null;
      if (!peerConn) return;
      let reconnAttempts = 0;
      const origStateChange = peerConn.oniceconnectionstatechange;
      peerConn.oniceconnectionstatechange = async () => {
        if (typeof origStateChange === 'function') origStateChange.call(peerConn);
        const state = peerConn.iceConnectionState;
        if (['disconnected', 'failed'].includes(state) && reconnAttempts < 3) {
          reconnAttempts++;
          _p4.toast(`📶 انقطع الاتصال — محاولة إعادة الاتصال (${reconnAttempts}/3)...`, 'inf');
          setTimeout(async () => {
            try {
              await peerConn.restartIce?.();
            } catch(e) {}
          }, 2000 * reconnAttempts);
        }
      };
    }, 1500);

    return result;
  } catch(e) {
    _p4.toast('تعذر الدخول للجلسة: ' + e.message, 'err');
    _p4.go('dashboard');
    setTimeout(() => { if (typeof dNav === 'function') dNav('sessions'); }, 300);
  }
};

/* ══════════════════════════════════════════════════════
   3. العودة لـ "جلساتي" بعد الخروج
   ══════════════════════════════════════════════════════ */

/* Patch original endSession — after any exit, go to sessions tab */
const _p4_origEnd = window.endSession;
window.endSession = async function() {
  if (typeof _p4_origEnd === 'function') await _p4_origEnd();
  // Small delay then navigate to sessions
  setTimeout(() => {
    const currentPage = document.querySelector('.page:not(.hidden)');
    if (!currentPage || currentPage.id !== 'page-session') {
      if (typeof dNav === 'function') dNav('sessions');
    }
  }, 500);
};

/* ══════════════════════════════════════════════════════
   4. لوحة الأدمن — تفاصيل الجلسة والأرباح الكاملة
   ══════════════════════════════════════════════════════ */

/* Enhanced admin bookings view */
const _p4_origAdTab = window.adTab;
window.adTab = async function(tab, el) {
  const res = typeof _p4_origAdTab === 'function' ? await _p4_origAdTab(tab, el) : undefined;

  if (tab === 'bookings') {
    setTimeout(_p4_enhanceAdminBookings, 300);
  }
  if (tab === 'stats') {
    setTimeout(_p4_enhanceAdminStats, 300);
  }
  return res;
};

async function _p4_enhanceAdminBookings() {
  const con = _p4.e('adCon');
  if (!con) return;

  // Add summary cards at top if not there
  if (con.querySelector('.p4-bk-summary')) return;

  try {
    const snap = await db.collection('bookings').get().catch(() => ({ docs: [] }));
    const bks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const comp = bks.filter(b => b.status === 'completed');
    const pending_payment = comp.filter(b => !b.adminConfirmed);
    const total_platform_profit = comp.reduce((s, b) =>
      s + Number(b.studentFee || 0) + Number(b.tutorFee ?? b.fee ?? 0), 0);
    const total_tutor_net = comp.reduce((s, b) =>
      s + Number((b.price || 0) - (b.tutorFee ?? b.fee ?? 0)), 0);

    const summaryDiv = document.createElement('div');
    summaryDiv.className = 'p4-bk-summary';
    summaryDiv.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-bottom:18px';
    summaryDiv.innerHTML = `
      <div style="background:linear-gradient(135deg,rgba(13,110,117,.1),rgba(13,110,117,.05));border:1px solid rgba(13,110,117,.2);border-radius:14px;padding:14px;text-align:center">
        <div style="font-size:1.5rem;font-weight:900;font-family:'Fraunces',serif;color:var(--teal)">${_p4.fmt(total_platform_profit)}</div>
        <div style="font-size:.72rem;color:var(--muted);margin-top:4px">💰 أرباح المنصة (ج.م)</div>
      </div>
      <div style="background:linear-gradient(135deg,rgba(5,150,105,.1),rgba(5,150,105,.05));border:1px solid rgba(5,150,105,.2);border-radius:14px;padding:14px;text-align:center">
        <div style="font-size:1.5rem;font-weight:900;font-family:'Fraunces',serif;color:#059669">${_p4.fmt(total_tutor_net)}</div>
        <div style="font-size:.72rem;color:var(--muted);margin-top:4px">👨‍🏫 إجمالي أرباح المعلمين</div>
      </div>
      <div style="background:linear-gradient(135deg,rgba(245,158,11,.1),rgba(245,158,11,.05));border:1px solid rgba(245,158,11,.2);border-radius:14px;padding:14px;text-align:center">
        <div style="font-size:1.5rem;font-weight:900;font-family:'Fraunces',serif;color:#d97706">${pending_payment.length}</div>
        <div style="font-size:.72rem;color:var(--muted);margin-top:4px">⏳ بانتظار التحويل للمعلم</div>
      </div>
      <div style="background:linear-gradient(135deg,rgba(99,102,241,.1),rgba(99,102,241,.05));border:1px solid rgba(99,102,241,.2);border-radius:14px;padding:14px;text-align:center">
        <div style="font-size:1.5rem;font-weight:900;font-family:'Fraunces',serif;color:#6366f1">${comp.length}</div>
        <div style="font-size:.72rem;color:var(--muted);margin-top:4px">🏁 جلسات مكتملة</div>
      </div>`;

    const firstTable = con.querySelector('.dsec');
    if (firstTable) firstTable.insertBefore(summaryDiv, firstTable.firstChild);

    // Enhance table rows with profit details
    _p4_addProfitDetailsToRows(bks);

  } catch(e) {}
}

function _p4_addProfitDetailsToRows(bks) {
  const rows = document.querySelectorAll('#adCon table tbody tr');
  rows.forEach(row => {
    if (row.querySelector('.p4-profit-details')) return;
    // Try to match booking by student/tutor name from row text
    const tds = row.querySelectorAll('td');
    if (tds.length < 4) return;

    // Add profit breakdown cell if completed bookings
    const statusCell = row.querySelector('.pill.pco, .pill.pc');
    if (!statusCell) return;

    // Find the booking from buttons onclick
    let bid = null;
    row.querySelectorAll('button[onclick]').forEach(btn => {
      const m = btn.getAttribute('onclick')?.match(/['"]([\w]{15,})['"]/);
      if (m) bid = m[1];
    });
    if (!bid) return;

    const bk = bks.find(b => b.id === bid);
    if (!bk) return;

    const lastTd = row.querySelector('td:last-child');
    if (!lastTd) return;

    const profitSpan = document.createElement('div');
    profitSpan.className = 'p4-profit-details';
    profitSpan.style.cssText = 'margin-top:6px;font-size:.7rem;background:rgba(13,110,117,.06);border-radius:6px;padding:5px 8px;border:1px solid rgba(13,110,117,.12)';
    const price = Number(bk.price || 0);
    const sFee = Number(bk.studentFee || 0);
    const tFee = Number(bk.tutorFee ?? bk.fee ?? 0);
    const net = price - tFee;
    profitSpan.innerHTML = `
      <div style="color:var(--muted)">سعر: ${_p4.fmt(price)} · عمولة الطالب: ${_p4.fmt(sFee)} · عمولة المعلم: ${_p4.fmt(tFee)}</div>
      <div style="color:#059669;font-weight:700;margin-top:3px">صافي المعلم: ${_p4.fmt(net)} ج.م · ربح المنصة: ${_p4.fmt(sFee + tFee)} ج.م</div>`;
    lastTd.appendChild(profitSpan);
  });
}

/* Enhanced admin stats with profit breakdown */
async function _p4_enhanceAdminStats() {
  const con = _p4.e('adCon');
  if (!con || con.querySelector('.p4-profit-card')) return;

  try {
    const [bSnap, uSnap] = await Promise.all([
      db.collection('bookings').where('status', '==', 'completed').get().catch(() => ({ docs: [] })),
      db.collection('users').get().catch(() => ({ docs: [] }))
    ]);
    const bks = bSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const total_s_fee = bks.reduce((s, b) => s + Number(b.studentFee || 0), 0);
    const total_t_fee = bks.reduce((s, b) => s + Number(b.tutorFee ?? b.fee ?? 0), 0);
    const total_profit = total_s_fee + total_t_fee;
    const total_gross = bks.reduce((s, b) => s + Number(b.price || 0), 0);
    const tutors = uSnap.docs.filter(d => ['tutor','both'].includes(d.data().role)).length;
    const students = uSnap.docs.filter(d => d.data().role === 'learner').length;
    const pending_admin = bks.filter(b => !b.adminConfirmed).length;

    const profitCard = document.createElement('div');
    profitCard.className = 'p4-profit-card';
    profitCard.style.cssText = 'margin-top:16px';
    profitCard.innerHTML = `
      <div style="font-weight:900;font-size:1rem;margin-bottom:14px;font-family:'Fraunces',serif">
        💰 تفاصيل الأرباح والإحصائيات الكاملة
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px">
        ${[
          ['الإيرادات الإجمالية', _p4.fmt(total_gross) + ' ج.م', '#0ea5e9', '💵'],
          ['عمولة المنصة من الطلاب', _p4.fmt(total_s_fee) + ' ج.م', '#f59e0b', '👨‍🎓'],
          ['عمولة المنصة من المعلمين', _p4.fmt(total_t_fee) + ' ج.م', '#a855f7', '👨‍🏫'],
          ['إجمالي أرباح المنصة', _p4.fmt(total_profit) + ' ج.م', '#10b981', '🏦'],
          ['جلسات تنتظر التحويل', pending_admin + ' جلسة', '#ef4444', '⏳'],
          ['معلمون / طلاب', `${tutors} / ${students}`, '#6366f1', '👥'],
        ].map(([lbl, val, color, icon]) => `
          <div style="background:#fff;border:1.5px solid ${color}22;border-radius:14px;padding:16px;border-right:4px solid ${color}">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
              <span>${icon}</span>
              <span style="font-size:.75rem;color:var(--muted)">${lbl}</span>
            </div>
            <div style="font-weight:900;font-size:1.2rem;color:${color};font-family:'Fraunces',serif">${val}</div>
          </div>`).join('')}
      </div>`;

    const srow = con.querySelector('.srow');
    if (srow) srow.after(profitCard);
  } catch(e) {}
}

/* ══════════════════════════════════════════════════════
   5. تحويل الأرباح بعد اعتماد الأدمن — تحسين الواجهة
   ══════════════════════════════════════════════════════ */

/* Add a "Transfer All Pending" button for admin */
function _p4_injectBulkPayButton() {
  const adCon = _p4.e('adCon');
  if (!adCon || adCon.querySelector('.p4-bulk-pay')) return;

  db.collection('bookings')
    .where('status', '==', 'completed')
    .where('adminConfirmed', '==', false)
    .get()
    .then(snap => {
      if (snap.empty) return;
      const pending = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      const bulkBtn = document.createElement('div');
      bulkBtn.className = 'p4-bulk-pay';
      bulkBtn.style.cssText = 'background:linear-gradient(135deg,rgba(5,150,105,.08),rgba(5,150,105,.04));border:1.5px solid rgba(5,150,105,.25);border-radius:14px;padding:14px 18px;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px';
      const total_net = pending.reduce((s, b) =>
        s + Number((b.price || 0) - (b.tutorFee ?? b.fee ?? 0)), 0);
      bulkBtn.innerHTML = `
        <div>
          <div style="font-weight:800;font-size:.9rem;color:#059669">
            ${pending.length} جلسة مكتملة بانتظار التحويل
          </div>
          <div style="font-size:.75rem;color:var(--muted);margin-top:3px">
            إجمالي صافي المعلمين: ${_p4.fmt(total_net)} ج.م
          </div>
        </div>
        <button onclick="p4BulkPayTutors()" class="btn btn-s btn-sm">
        </button>`;

      const firstSection = adCon.querySelector('.dsec') || adCon.firstElementChild;
      if (firstSection) adCon.insertBefore(bulkBtn, firstSection);
    }).catch(() => {});
}

window.p4BulkPayTutors = async function() {
  if (!confirm('تحويل أرباح جميع الجلسات المكتملة لمحافظ المعلمين؟')) return;
  _p4.toast('⏳ جاري التحويل...', 'inf');

  try {
    const snap = await db.collection('bookings')
      .where('status', '==', 'completed')
      .where('adminConfirmed', '==', false)
      .get();

    let count = 0;
    for (const doc of snap.docs) {
      const bk = { id: doc.id, ...doc.data() };
      const tutorFee = Number(bk.tutorFee ?? bk.fee ?? 0);
      const net = Number(bk.price || 0) - tutorFee;
      if (net <= 0) continue;

      try {
        await db.runTransaction(async tx => {
          const wr = db.collection('wallets').doc(bk.tutorId);
          const ws = await tx.get(wr);
          const wb = ws.exists ? (ws.data().balance || 0) : 0;
          tx.set(wr, { balance: +(wb + net).toFixed(2), userId: bk.tutorId }, { merge: true });
          tx.update(db.collection('bookings').doc(bk.id), {
            adminConfirmed: true,
            tutorPaidAt: firebase.firestore.FieldValue.serverTimestamp(),
            tutorNetAmount: net,
            paymentStatus: 'paid'
          });
        });
        await db.collection('transactions').add({
          userId: bk.tutorId, type: 'credit', kind: 'session_earnings',
          amount: net, currency: 'EGP', status: 'approved',
          bookingId: bk.id,
          description: `أرباح جلسة مع ${bk.studentName||'—'} — ${bk.date||''}`,
          approvedBy: typeof CU !== 'undefined' ? CU?.uid : 'admin',
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        count++;
      } catch(e) { console.warn('bulk pay error', bk.id, e); }
    }
    _p4.toast(`✅ تم تحويل أرباح ${count} جلسة بنجاح`, 'suc');
    if (typeof adTab === 'function') adTab('bookings', document.querySelector('.adminTab'));
  } catch(e) {
    _p4.toast('خطأ: ' + e.message, 'err');
  }
};

/* ══════════════════════════════════════════════════════
   6. البريد الإلكتروني بعد الحجز (EmailJS)
   ══════════════════════════════════════════════════════ */

const _p4_origConfirmBk = window.confirmBk;
window.confirmBk = async function() {
  if (typeof _p4_origConfirmBk === 'function') await _p4_origConfirmBk();

  // Send emails after successful booking
  setTimeout(async () => {
    try {
      if (!CU || !CP || typeof curT === 'undefined' || !curT) return;
      const t = curT;
      const timeLblStr = typeof timeLbl === 'function' ? timeLbl(typeof selTime !== 'undefined' ? selTime : '') : selTime;
      const dateStr = typeof selDate !== 'undefined' ? selDate : '—';

      // Email to student
      if (CU.email) {
        await _p4_sendEmail(CU.email, CP.name || 'طالب', {
          subject: `✅ تأكيد حجزك مع ${t.name} — Skillak`,
          message: `مرحباً ${CP.name || 'الطالب'}،\n\nتم حجز جلستك بنجاح!\n\n📅 التاريخ: ${dateStr}\n⏰ الوقت: ${timeLblStr}\n👨‍🏫 المعلم: ${t.name}\n💰 السعر: ${t.price} ج.م/ساعة\n\nستجد جلستك في قسم "جلساتي" في لوحة التحكم.\nسيتواصل معك المعلم لتأكيد الموعد.\n\nبالتوفيق! 🎓\nفريق Skillak`,
          teacher_name: t.name,
          student_name: CP.name || '—',
          session_date: dateStr,
          session_time: timeLblStr,
          platform: 'Skillak',
          platform_email: 'mahmoud.hamed.ahmed25@gmail.com'
        });
      }

      // Email to tutor
      try {
        const tutorDoc = await db.collection('users').doc(t.id).get();
        const tutorEmail = tutorDoc.data()?.email || '';
        if (tutorEmail) {
          await _p4_sendEmail(tutorEmail, t.name, {
            subject: `🔔 طلب حجز جلسة جديد — Skillak`,
            message: `مرحباً ${t.name}،\n\nلديك طلب حجز جلسة جديد!\n\n👨‍🎓 الطالب: ${CP.name || '—'}\n📅 التاريخ: ${dateStr}\n⏰ الوقت: ${timeLblStr}\n\nيرجى الموافقة أو الرفض من لوحة التحكم في أقرب وقت.\n\nشكراً! 🙏\nفريق Skillak`,
            student_name: CP.name || '—',
            teacher_name: t.name,
            session_date: dateStr,
            session_time: timeLblStr,
            platform: 'Skillak',
            platform_email: 'mahmoud.hamed.ahmed25@gmail.com'
          });
        }
      } catch(e) {}

    } catch(e) { console.warn('[p4 email]', e); }
  }, 3000);
};

/* Email when tutor approves */
const _p4_origTutorApprove = window.tutorApproveBk;
window.tutorApproveBk = async function(bid, studentId, tot) {
  if (typeof _p4_origTutorApprove === 'function') await _p4_origTutorApprove(bid, studentId, tot);

  setTimeout(async () => {
    try {
      const [bSnap, sSnap] = await Promise.all([
        db.collection('bookings').doc(bid).get(),
        db.collection('users').doc(studentId).get()
      ]);
      const bk = bSnap.data() || {};
      const studentEmail = sSnap.data()?.email || '';
      const studentName = sSnap.data()?.name || 'الطالب';

      if (studentEmail) {
        await _p4_sendEmail(studentEmail, studentName, {
          subject: `✅ تمت الموافقة على حجزك — Skillak`,
          message: `مرحباً ${studentName}،\n\nتمت الموافقة على حجزك! 🎉\n\n👨‍🏫 المعلم: ${bk.tutorName || '—'}\n📅 التاريخ: ${bk.date || '—'}\n⏰ الوقت: ${bk.timeLbl || bk.time || '—'}\n\nيمكنك الدخول للجلسة في وقت الموعد من قسم "جلساتي".\n\nبالتوفيق! 🎓\nفريق Skillak`,
          teacher_name: bk.tutorName || '—',
          student_name: studentName,
          session_date: bk.date || '—',
          session_time: bk.timeLbl || '—',
          platform: 'Skillak'
        });
      }
    } catch(e) {}
  }, 1500);
};

/* ══════════════════════════════════════════════════════
   7. تحسينات واجهة لوحة الأدمن — تبويبات إضافية
   ══════════════════════════════════════════════════════ */

/* Inject extra admin tabs if not present */
function _p4_injectAdminTabs() {
  const tabsRow = document.querySelector('.adminTabs, #adTabs, .admin-tabs');
  if (!tabsRow) return; // Handled in HTML already, skip

  // Add commission and reports tabs if missing
  if (!document.querySelector('.adminTab[onclick*="commission"]')) {
    const commBtn = document.createElement('button');
    commBtn.className = 'btn btn-gh btn-sm adminTab';
    commBtn.textContent = '💹 العمولة';
    commBtn.onclick = () => { if (typeof adTab === 'function') adTab('commission', commBtn); };
    tabsRow.appendChild(commBtn);
  }
}

/* ══════════════════════════════════════════════════════
   8. تحسينات جلسة — session bar محسّن
   ══════════════════════════════════════════════════════ */

/* Live session countdown in sesbar */
let _p4_sesBarTimer = null;

function _p4_startSesBarCountdown(bk) {
  const endMs = typeof getBookingEndMs === 'function' ? getBookingEndMs(bk) : 0;
  if (!endMs) return;

  if (_p4_sesBarTimer) clearInterval(_p4_sesBarTimer);
  _p4_sesBarTimer = setInterval(() => {
    const countdown = _p4.e('sesCountdown');
    if (!countdown) { clearInterval(_p4_sesBarTimer); return; }

    const rem = endMs - Date.now();
    if (rem <= 0) {
      countdown.textContent = '⏰ انتهى الوقت';
      countdown.classList.add('expired');
      clearInterval(_p4_sesBarTimer);
      return;
    }
    const m = Math.floor(rem / 60000);
    const s = Math.floor((rem % 60000) / 1000);
    countdown.textContent = `⏱️ ${m}:${String(s).padStart(2,'0')} متبقي`;
    countdown.classList.toggle('warning', rem < 5 * 60000);
  }, 1000);
}

/* Inject countdown element into sesbar */
function _p4_injectSesbarCountdown(bk) {
  const sesbar = document.querySelector('.sesbar');
  if (!sesbar || sesbar.querySelector('#sesCountdown')) return;

  const cd = document.createElement('div');
  cd.id = 'sesCountdown';
  cd.className = 'ses-countdown';
  cd.textContent = '⏱️ ...';
  sesbar.appendChild(cd);
  _p4_startSesBarCountdown(bk);
}

const _p4_origEnter2 = window.enterSession;
window.enterSession = async function(bookingId) {
  const result = typeof _p4_origEnter2 === 'function' ? await _p4_origEnter2(bookingId) : undefined;
  setTimeout(async () => {
    const bk = typeof curSesBk !== 'undefined' ? curSesBk : null;
    if (bk) _p4_injectSesbarCountdown(bk);
  }, 2000);
  return result;
};

/* ══════════════════════════════════════════════════════
   9. Session "Sessions" tab — refresh after actions
   ══════════════════════════════════════════════════════ */

/* Auto-refresh sessions list when a booking changes status */
function _p4_watchBookingStatus() {
  if (!CU) return;
  const uid = CU.uid;
  // Listen to student bookings
  db.collection('bookings').where('studentId', '==', uid)
    .onSnapshot(() => {
      // If sessions tab is open, quietly refresh
      const dash = _p4.e('dashCon');
      if (dash && typeof dashTab !== 'undefined' && dashTab === 'sessions') {
        if (typeof dNav === 'function') setTimeout(() => dNav('sessions'), 500);
      }
    }, () => {});
}

/* ══════════════════════════════════════════════════════
   10. تحسين الملف الشخصي للأدمن — إضافة قسم البريد
   ══════════════════════════════════════════════════════ */

/* Add EmailJS setup guide in admin commission tab */
const _p4_origAdTab2 = window.adTab;
window.adTab = async function(tab, el) {
  const res = typeof _p4_origAdTab2 === 'function' ? await _p4_origAdTab2(tab, el) : undefined;

  if (tab === 'commission') {
    setTimeout(() => {
      const con = _p4.e('adCon');
      if (!con || con.querySelector('.p4-email-setup')) return;

      const emailGuide = document.createElement('div');
      emailGuide.className = 'p4-email-setup card';
      emailGuide.style.cssText = 'margin-top:18px';
      emailGuide.innerHTML = `
        <div class="ch">
          <div class="ct">📧 إعداد البريد الإلكتروني التلقائي</div>
          <span class="pill ${_p4_EMAIL.enabled ? 'pc' : 'pp'}">${_p4_EMAIL.enabled ? '✅ مفعّل' : '⏳ غير مفعّل'}</span>
        </div>
        <div class="cb">
          <p style="font-size:.83rem;color:var(--muted);line-height:1.8">
            لتفعيل إرسال بريد إلكتروني تلقائي للطلاب والمعلمين عند الحجز والموافقة:
          </p>
          <ol style="font-size:.82rem;line-height:2;padding-right:18px;color:#374151">
            <li>اذهب إلى <a href="https://www.emailjs.com" target="_blank" style="color:var(--teal)">emailjs.com</a> وأنشئ حساب مجاني</li>
            <li>أنشئ Service (Gmail/Outlook) وTemplate يحتوي متغيرات: <code style="background:#f3f4f6;padding:2px 6px;border-radius:4px">to_email, to_name, subject, message</code></li>
            <li>افتح ملف <code style="background:#f3f4f6;padding:2px 6px;border-radius:4px">patch4.js</code> وعدّل الثوابت في أعلى الملف:</li>
          </ol>
          <div style="background:#1e293b;border-radius:10px;padding:14px;font-family:monospace;font-size:.78rem;color:#e2e8f0;margin:10px 0;direction:ltr;text-align:left">
            <div style="color:#94a3b8">// في patch4.js — ابحث عن _p4_EMAIL</div>
            serviceId:  '<span style="color:#4ade80">service_xxxxxxx</span>',<br>
            templateId: '<span style="color:#4ade80">template_xxxxxxx</span>',<br>
            publicKey:  '<span style="color:#4ade80">xxxxxxxxxxxxxxxxxxx</span>',<br>
            enabled: <span style="color:#fb923c">true</span>
          </div>
          <p style="font-size:.75rem;color:var(--muted)">✉️ بريد المنصة:mahmoud.hamed.ahmed25@gmail.com</p>
        </div>`;
      con.appendChild(emailGuide);
    }, 200);
  }



  if (tab === 'bookings') {
    setTimeout(_p4_injectBulkPayButton, 400);
  }
  return res;
};

/* ══════════════════════════════════════════════════════
   BOOT
   ══════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  // Start booking watcher after login
  setTimeout(() => {
    if (typeof CU !== 'undefined' && CU) {
      _p4_watchBookingStatus();
    }
  }, 4000);
});

/* After login */
const _p4_origUpdNavU = window.updNavU;
window.updNavU = function() {
  if (typeof _p4_origUpdNavU === 'function') _p4_origUpdNavU();
  setTimeout(() => {
    _p4_watchBookingStatus();
  }, 1000);
};

console.log('✅ Skillak patch4.js v6.0 loaded | mahmoud.hamed.ahmed25@gmail.com');

/* ===== END patch4.js ===== */


/* ===== BEGIN patch_final.js ===== */
/* patch_final.js v7.1 - Skillak */
'use strict';

function _pf_getCU()  { return typeof CU  !== 'undefined' ? CU  : null; }
function _pf_getCP()  { return typeof CP  !== 'undefined' ? CP  : null; }
function _pf_getDb()  { return typeof db  !== 'undefined' ? db  : null; }

/* ── isBookingStillOpen ── */
window.isBookingStillOpen = function(bk) {
  if (!bk) return false;
  if (!['confirmed','active','paused'].includes(bk.status)) return false;
  const endMs = typeof getBookingEndMs === 'function' ? getBookingEndMs(bk) : 0;
  if (!endMs) return true;
  return Date.now() <= endMs;
};
window.canJoinSession = b => window.isBookingStillOpen(b);


/* ── enterSession (نظيف - بدون window.CU) ── */
window.enterSession = async function(bookingId) {
  const _db = _pf_getDb(), _CU = _pf_getCU(), _CP = _pf_getCP();
  if (!bookingId) { if (typeof showT==='function') showT('معرّف الجلسة غير صحيح','err'); return; }
  if (!_CU) { if (typeof openM==='function') openM('loginMod'); return; }

  let bk;
  try {
    const s = await _db.collection('bookings').doc(bookingId).get();
    if (!s.exists) { if (typeof showT==='function') showT('لم يُعثر على الجلسة','err'); return; }
    bk = { id: bookingId, ...s.data() };
  } catch(e) { if (typeof showT==='function') showT('خطأ: '+e.message,'err'); return; }

  if (!['confirmed','active','paused'].includes(bk.status)) {
    const m = {pending:'⏳ الجلسة لم تُؤكد بعد',completed:'🏁 انتهت مسبقاً',cancelled:'❌ ملغاة',refunded:'↩️ مُستردّة'};
    if (typeof showT==='function') showT(m[bk.status]||'حالة: '+bk.status,'err'); return;
  }

  const uid=_CU.uid, isStudent=bk.studentId===uid, isTutor=bk.tutorId===uid, isAdmin=_CP?.role==='admin';
  if (!isStudent && !isTutor && !isAdmin) { if (typeof showT==='function') showT('⛔ لا صلاحية','err'); return; }

  const startMs = Number(bk.sessionStartsAtMs || 0) || (typeof getBookingStartMs === 'function' ? Number(getBookingStartMs(bk) || 0) : 0);
  const durationMs = Number(bk.duration || 60) * 60000;
  const baseEndMs = Number(bk.sessionEndsAtMs || 0) || (typeof getBookingEndMs === 'function' ? Number(getBookingEndMs(bk) || 0) : 0) || (startMs ? startMs + durationMs : 0);
  const remainingFromPause = bk.status === 'paused'
    ? Number(bk.sessionRemainingMs || Math.max(0, baseEndMs - Date.now()) || durationMs)
    : Math.max(0, baseEndMs - Date.now());
  const totalEndMs = Date.now() + (bk.status === 'paused' ? remainingFromPause : (baseEndMs ? Math.max(0, baseEndMs - Date.now()) : durationMs));

  try {
    await _db.collection('bookings').doc(bookingId).set({
      status:'active',
      resumedAt: firebase.firestore.FieldValue.serverTimestamp(),
      lastEnteredAt: firebase.firestore.FieldValue.serverTimestamp(),
      sessionResumedAtMs: Date.now(),
      ...(startMs ? { sessionStartsAtMs: startMs } : {}),
      sessionRemainingMs: firebase.firestore.FieldValue.delete(),
      ...(totalEndMs ? { sessionEndsAtMs: totalEndMs } : {})
    },{merge:true});
    bk.status = 'active';
  } catch(_){}

  curSesBid=bookingId; curSesBk=bk; unreadSes=0;
  if (sesTInt){clearInterval(sesTInt);sesTInt=null;}
  if (sesChatL){try{sesChatL();}catch(_){} sesChatL=null;}

  const $=id=>document.getElementById(id);
  const waitOv=$('waitOv'), sesDot=$('sesDot'), sesTxt=$('sesTxt'), sesTimerEl=$('sesTimer');
  if ($('sesTitle')) $('sesTitle').textContent=`جلسة مع ${isTutor?bk.studentName:bk.tutorName}`;
  if ($('mainNav')) $('mainNav').style.display='none';
  if (waitOv){waitOv.classList.remove('hidden');waitOv.style.display='';}
  if (sesDot) sesDot.style.background='var(--amber)';
  if (sesTxt) sesTxt.textContent='جاري الاتصال...';
  if (sesTimerEl) sesTimerEl.textContent='00:00:00';

  _pf_buildWaitingRoom(waitOv,bk,isTutor);
  if (typeof go==='function') go('session');

  try {
    locSt=await navigator.mediaDevices.getUserMedia({video:true,audio:true});
    const lv=$('locVid'); if(lv) lv.srcObject=locSt;
    micOn=true; camOn=true; if(typeof updCtrl==='function') updCtrl();
  } catch(e) { if(typeof showT==='function') showT('⚠️ تعذّر الكاميرا: '+e.message,'err'); locSt=null; }

  if(pc){try{pc.close();}catch(_){}pc=null;}
  pc=new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'},{urls:'stun:stun1.l.google.com:19302'}]});
  const _pc=pc;
  if(locSt) locSt.getTracks().forEach(t=>_pc.addTrack(t,locSt));

  let autoEnded = false;
  const tick = () => {
    if (totalEndMs) {
      const rem = Math.max(0, totalEndMs - Date.now());
      sesSec = Math.max(0, Math.floor(rem / 1000));
      const h=String(Math.floor(sesSec/3600)).padStart(2,'0');
      const m=String(Math.floor((sesSec%3600)/60)).padStart(2,'0');
      const s=String(sesSec%60).padStart(2,'0');
      if (sesTimerEl) sesTimerEl.textContent=`${h}:${m}:${s}`;
      if (rem <= 0 && !autoEnded) {
        autoEnded = true;
        if (typeof showT==='function') showT('⏰ انتهت مدة الجلسة', 'inf');
        setTimeout(() => { if (typeof window.endSession === 'function') window.endSession(bookingId, { auto: true }); }, 50);
      }
    }
  };
  tick();
  sesTInt = setInterval(tick, 1000);

  _pc.ontrack=e=>{
    const rv=$('remVid'); if(rv) rv.srcObject=e.streams[0];
    if(waitOv) waitOv.classList.add('hidden');
    if(sesDot) sesDot.style.background='var(--green)';
    if(sesTxt) sesTxt.textContent='متصل ✓';
  };

  let iceR=0;
  _pc.oniceconnectionstatechange=()=>{
    const st=_pc.iceConnectionState;
    if(['disconnected','failed'].includes(st)){
      if(sesDot) sesDot.style.background='var(--red)';
      if(sesTxt) sesTxt.textContent='📶 انقطع...';
      if(waitOv) waitOv.classList.remove('hidden');
      if(iceR<3){iceR++;setTimeout(()=>{try{_pc.restartIce?.();}catch(_){}},2000*iceR);}
    } else if(st==='connected'){
      if(sesDot) sesDot.style.background='var(--green)';
      if(sesTxt) sesTxt.textContent='متصل ✓'; iceR=0;
      if(waitOv) waitOv.classList.add('hidden');
    }
  };

  const sesRef=_db.collection('sessions').doc(bookingId);
  if(isTutor||(isAdmin&&!isStudent)){
    _pc.onicecandidate=async e=>{if(e.candidate) await sesRef.collection('tCand').add(e.candidate.toJSON()).catch(()=>{});};
    const offer=await _pc.createOffer();
    await _pc.setLocalDescription(offer);
    await sesRef.set({
      offer:{type:offer.type,sdp:offer.sdp},
      tutorId:uid,
      status:'active',
      startedAt:firebase.firestore.FieldValue.serverTimestamp(),
      sessionStartsAtMs: startMs || firebase.firestore.FieldValue.serverTimestamp(),
      sessionEndsAtMs: totalEndMs || endMs || null
    },{merge:true});
    const u=sesRef.onSnapshot(async s=>{const d=s.data();if(d?.answer&&!_pc.currentRemoteDescription){try{await _pc.setRemoteDescription(new RTCSessionDescription(d.answer));u();}catch(_){}}});
    sesRef.collection('sCand').onSnapshot(s=>s.docChanges().forEach(async c=>{if(c.type==='added'){try{await _pc.addIceCandidate(new RTCIceCandidate(c.doc.data()));}catch(_){}}}));
  } else {
    _pc.onicecandidate=async e=>{if(e.candidate) await sesRef.collection('sCand').add(e.candidate.toJSON()).catch(()=>{});};
    const doAns=async offer=>{
      if(_pc.currentRemoteDescription) return;
      try{
        await _pc.setRemoteDescription(new RTCSessionDescription(offer));
        const a=await _pc.createAnswer();
        await _pc.setLocalDescription(a);
        await sesRef.set({
          answer:{type:a.type,sdp:a.sdp},
          studentId:uid,
          status:'active',
          sessionStartsAtMs: startMs || firebase.firestore.FieldValue.serverTimestamp(),
          sessionEndsAtMs: totalEndMs || endMs || null
        },{merge:true});
      }catch(_){}
    };
    const init=await sesRef.get();
    if(init.exists&&init.data()?.offer) await doAns(init.data().offer);
    else{const u2=sesRef.onSnapshot(async s=>{const d=s.data();if(d?.offer&&!_pc.currentRemoteDescription){await doAns(d.offer);u2();}});}
    sesRef.collection('tCand').onSnapshot(s=>s.docChanges().forEach(async c=>{if(c.type==='added'){try{await _pc.addIceCandidate(new RTCIceCandidate(c.doc.data()));}catch(_){}}}));
  }

  if(typeof loadSesChat==='function') loadSesChat(bookingId);

  setTimeout(()=>{
    const endBtn=$('endBtn'); if(!endBtn) return;
    if(isStudent&&!isTutor){
      endBtn.innerHTML='📵'; endBtn.title='إنهاء الجلسة نهائياً';
      endBtn.style.cssText='background:linear-gradient(135deg,#dc2626,#b91c1c);box-shadow:0 4px 15px rgba(220,38,38,.4);width:56px;height:56px;border-radius:50%;border:none;cursor:pointer;font-size:1.4rem;display:flex;align-items:center;justify-content:center';
      const lbl=endBtn.closest?.('.cwrap')?.querySelector?.('.clbl'); if(lbl) lbl.textContent='إنهاء';
    } else if(isTutor){
      endBtn.innerHTML='🚪'; endBtn.title='خروج مؤقت';
      endBtn.style.cssText='background:rgba(245,158,11,.25);box-shadow:0 2px 8px rgba(0,0,0,.2);width:56px;height:56px;border-radius:50%;border:none;cursor:pointer;font-size:1.4rem;display:flex;align-items:center;justify-content:center';
      const lbl=endBtn.closest?.('.cwrap')?.querySelector?.('.clbl'); if(lbl) lbl.textContent='خروج';
    }
    const exitWrap = $('studentExitWrap');
    if (exitWrap) {
      exitWrap.style.display='flex';
      exitWrap.style.alignItems='center';
      exitWrap.style.flexDirection='column';
    }
  },1000);

  if(typeof showT==='function') showT('📡 جاري الاتصال بالجلسة...','inf');
};

/* ── غرفة الانتظار ── */
function _pf_buildWaitingRoom(waitOv,bk,isTutor){
  if(!waitOv) return;
  const other=isTutor?(bk.studentName||'الطالب'):(bk.tutorName||'المعلم');
  const endMs=typeof getBookingEndMs==='function'?getBookingEndMs(bk):0;
  waitOv.innerHTML=`<div class="swr-inner"><div class="swr-logo">Skill<span>ak</span></div><div class="swr-av"><div class="swr-initials" style="background:linear-gradient(135deg,#0d6e75,#14b8a6);color:#fff">${other.charAt(0)||'؟'}</div></div><p class="swr-name">${other}</p><p class="swr-role">${isTutor?'الطالب':'المعلم'}</p><div class="swr-status"><div class="swr-spin"></div><span>في انتظار الانضمام...</span></div><div id="pfWaitCD" style="font-size:.8rem;color:rgba(255,255,255,.5);margin-top:4px"></div><div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:10px"><button onclick="window._pfRetry()" style="background:rgba(255,255,255,.12);color:#fff;border:1px solid rgba(255,255,255,.2);border-radius:10px;padding:8px 16px;font-size:.82rem;cursor:pointer;font-family:'Cairo',sans-serif">🔄 إعادة الاتصال</button><button onclick="window._pfExitWait()" style="background:transparent;color:rgba(255,255,255,.5);border:1px solid rgba(255,255,255,.15);border-radius:10px;padding:8px 16px;font-size:.82rem;cursor:pointer;font-family:'Cairo',sans-serif">← الخروج</button></div></div>`;
  if(endMs){
    const el=document.getElementById('pfWaitCD');
    const tick=()=>{if(!el)return;const rem=Math.max(0,endMs-Date.now());if(rem<=0){el.textContent='⏰ انتهى الوقت';return;}const m=Math.floor(rem/60000),s=Math.floor((rem%60000)/1000);el.textContent=`⏱️ ${m}:${String(s).padStart(2,'0')} متبقي`;setTimeout(tick,1000);};
    tick();
  }
}
window._pfRetry=async function(){const bid=typeof curSesBid!=='undefined'?curSesBid:null;if(!bid)return;if(typeof pc!=='undefined'&&pc){try{pc.close();}catch(_){}pc=null;}await window.enterSession(bid);};
window._pfExitWait=async function(bookingId){
  const _db=_pf_getDb(), _CU=_pf_getCU();
  const bid = bookingId || (typeof curSesBid!=='undefined' ? curSesBid : null);
  const uid = _CU?.uid;
  const bk = typeof curSesBk!=='undefined' ? curSesBk : null;
  if (!bid || !_db) return;

  try {
    const doc = bk || ((await _db.collection('bookings').doc(bid).get()).data() || null);
    const endMs = typeof getBookingEndMs==='function' ? getBookingEndMs(doc) : (doc?.sessionEndsAtMs || 0);
    const remainingMs = Math.max(0, (Number(endMs || 0) || 0) - Date.now());

    await _db.collection('bookings').doc(bid).set({
      status:'paused',
      lastPausedAt: firebase.firestore.FieldValue.serverTimestamp(),
      pausedBy: uid,
      sessionPausedAtMs: Date.now(),
      sessionRemainingMs: remainingMs
    }, { merge:true }).catch(()=>{});
    await _db.collection('sessions').doc(bid).set({
      status:'paused',
      pausedAt: firebase.firestore.FieldValue.serverTimestamp(),
      pausedBy: uid,
      sessionRemainingMs: remainingMs
    }, { merge:true }).catch(()=>{});

    if (typeof curSesBid !== 'undefined' && curSesBid === bid) {
      _pfCleanup();
      curSesBid = null;
      curSesBk = null;
      if(document.getElementById('mainNav'))document.getElementById('mainNav').style.display='';
      if(typeof go==='function')go('dashboard');
      setTimeout(()=>{if(typeof dNav==='function')dNav('sessions');},300);
    }
    if (typeof showT==='function') showT('🚪 غادرت الجلسة مؤقتاً — يمكنك العودة قبل انتهاء الوقت', 'inf');
  } catch(e) {
    console.warn('[pf exit]', e);
  }
};

/* ── endSession ── */
/* ── endSession ── */
window.endSession=async function(bookingId, opts = {}){
  const _db=_pf_getDb(),_CU=_pf_getCU();
  const bid=bookingId || (typeof curSesBid!=='undefined'?curSesBid:null);
  let bk=typeof curSesBk!=='undefined'?curSesBk:null;
  const uid=_CU?.uid;

  if (bid && !bk && _db) {
    try {
      const s = await _db.collection('bookings').doc(bid).get();
      bk = s.exists ? s.data() : null;
    } catch(_) {}
  }

  if(!bid||!bk||!uid){
    _pfCleanup();
    if(typeof curSesBid!=='undefined')curSesBid=null;
    if(typeof curSesBk!=='undefined')curSesBk=null;
    if(document.getElementById('mainNav'))document.getElementById('mainNav').style.display='';
    if(typeof go==='function')go('dashboard');
    setTimeout(()=>{if(typeof dNav==='function')dNav('sessions');},300);
    return;
  }

  const isStudent=bk.studentId===uid,isTutor=bk.tutorId===uid;
  const endMs = typeof getBookingEndMs === 'function' ? getBookingEndMs(bk) : Number(bk.sessionEndsAtMs || 0);
  const remainingSec = endMs ? Math.max(0, Math.round((endMs - Date.now()) / 1000)) : Number(typeof sesSec !== 'undefined' ? sesSec : 0);
  const totalDurSec = Number(bk.duration || 60) * 60;
  const elapsedSec = endMs ? Math.max(0, totalDurSec - remainingSec) : remainingSec;
  const mins=Math.floor(elapsedSec/60),secs=elapsedSec%60;
  const durStr=mins>0?`${mins} دقيقة${secs>0?' و'+secs+' ثانية':''}`:secs+' ثانية';
  const auto = !!opts.auto;

  if(isStudent){
    if(!auto && !confirm(`إنهاء الجلسة نهائياً؟
المدة: ${durStr}

⚠️ لن يتمكن أحد من العودة.`)) return;
    _pfCleanup();
    try{
      await _db.collection('bookings').doc(bid).update({status:'completed',completedAt:firebase.firestore.FieldValue.serverTimestamp(),completedBy:uid,actualDuration:mins||bk.duration||60,adminConfirmed:false,paymentStatus:'pending_admin'});
      await _db.collection('sessions').doc(bid).set({status:'ended',endedAt:firebase.firestore.FieldValue.serverTimestamp(),endedBy:uid},{merge:true}).catch(()=>{});
      _db.collection('adminNotifications').add({type:'session_completed',bookingId:bid,tutorName:bk.tutorName||'—',studentName:bk.studentName||'—',price:bk.price||0,read:false,createdAt:firebase.firestore.FieldValue.serverTimestamp(),message:'انتهت الجلسة — يتطلب اعتماد الأدمن'}).catch(()=>{});
    }catch(e){console.error('[pf]',e);}
    curSesBid=null;curSesBk=null;
    if(document.getElementById('mainNav'))document.getElementById('mainNav').style.display='';
    if(typeof go==='function')go('dashboard');
    setTimeout(()=>{if(typeof dNav==='function')dNav('sessions');},300);
    if(!auto) setTimeout(()=>{if(!bk.reviewed&&typeof openRevFromBk==='function')openRevFromBk(bid,bk.tutorId,bk.tutorName||'المعلم');},800);
  } else if(isTutor){
    const endMs=typeof getBookingEndMs==='function'?getBookingEndMs(bk):0;
    const remainingMs=Math.max(0, Number(endMs || 0) - Date.now());
    const remMin=remainingMs?Math.max(0,Math.round(remainingMs/60000)):'؟';
    if(!auto && !confirm(`الخروج مؤقتاً؟
⏸️ الجلسة تبقى نشطة (${remMin} دقيقة)

يمكنك العودة لاحقاً.`)) return;
    _pfCleanup();
    try{
      await _db.collection('bookings').doc(bid).set({status:'paused',lastPausedAt:firebase.firestore.FieldValue.serverTimestamp(),pausedBy:uid,sessionPausedAtMs:Date.now(),sessionRemainingMs:remainingMs},{merge:true});
      await _db.collection('sessions').doc(bid).set({status:'paused',pausedAt:firebase.firestore.FieldValue.serverTimestamp(),sessionRemainingMs:remainingMs},{merge:true}).catch(()=>{});
    }catch(_){}
    curSesBid=null;curSesBk=null;
    if(document.getElementById('mainNav'))document.getElementById('mainNav').style.display='';
    if(typeof go==='function')go('dashboard');
    setTimeout(()=>{if(typeof dNav==='function')dNav('sessions');},300);
    if(typeof showT==='function')showT(auto ? '⏸️ تم إيقاف الجلسة مؤقتاً تلقائياً' : '⏸️ خرجت مؤقتاً — يمكنك العودة لاحقاً','inf');
  }
};

function _pfCleanup(){
  if(typeof sesTInt!=='undefined'&&sesTInt){clearInterval(sesTInt);sesTInt=null;}
  if(typeof _pfSessionMonitor!=='undefined'&&_pfSessionMonitor){clearInterval(_pfSessionMonitor);_pfSessionMonitor=null;}
  if(typeof sesChatL!=='undefined'&&sesChatL){try{sesChatL();}catch(_){}sesChatL=null;}
  if(typeof pc!=='undefined'&&pc){try{pc.close();}catch(_){}pc=null;}
  if(typeof locSt!=='undefined'&&locSt){try{locSt.getTracks().forEach(t=>t.stop());}catch(_){}locSt=null;}
  if(typeof scrSt!=='undefined'&&scrSt){try{scrSt.getTracks().forEach(t=>t.stop());}catch(_){}scrSt=null;}
}

/* ════════════════════════════════════════════════════
   لوحة تحكم مزدوجة لمستخدم "الاثنان"
   ════════════════════════════════════════════════════ */
const _pf_origRdOverview = window.rdOverview;
window.rdOverview = async function(el) {
  const _CU=_pf_getCU(), _CP=_pf_getCP(), _db=_pf_getDb();
  if (!_CU||!_CP||!_db||_CP.role!=='both') {
    if (typeof _pf_origRdOverview==='function') return _pf_origRdOverview(el);
    return;
  }
  el.innerHTML='<div style="text-align:center;padding:40px"><div class="spin" style="margin:0 auto"></div></div>';
  try {
    const uid=_CU.uid, p=_CP;
    const [sb,tb,ws]=await Promise.all([
      _db.collection('bookings').where('studentId','==',uid).get().catch(()=>({docs:[]})),
      _db.collection('bookings').where('tutorId','==',uid).get().catch(()=>({docs:[]})),
      _db.collection('wallets').doc(uid).get().catch(()=>null)
    ]);
    const sB=sb.docs.map(d=>({id:d.id,...d.data()})), tB=tb.docs.map(d=>({id:d.id,...d.data()}));
    const walBal=ws?.exists?Number(ws.data()?.balance||0):0;
    const sComp=sB.filter(b=>b.status==='completed').length;
    const sUp=sB.filter(b=>['pending','confirmed','active','paused'].includes(b.status)).length;
    const sSpent=sB.filter(b=>b.status==='completed').reduce((s,b)=>s+Number(b.price||0)+Number(b.studentFee||0),0);
    const tComp=tB.filter(b=>b.status==='completed').length;
    const tUp=tB.filter(b=>['pending','confirmed','active','paused'].includes(b.status)).length;
    const tEarn=tB.filter(b=>b.status==='completed').reduce((s,b)=>s+Number((b.price||0)-(b.tutorFee??b.fee??0)),0);
    const tPend=tB.filter(b=>b.status==='pending').length;
    const allBks=[...sB,...tB].filter((b,i,a)=>a.findIndex(x=>x.id===b.id)===i).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0)).slice(0,8);
    const upAll=allBks.filter(b=>['pending','confirmed','active','paused'].includes(b.status));

    el.innerHTML=`
<div class="dashphdr">
  <div><div style="font-size:.72rem;font-weight:800;letter-spacing:.1em;color:var(--amber);margin-bottom:3px">لوحة التحكم</div><div class="dashph">مرحباً، ${p.name?.split(' ')[0]||'أهلاً'} 👋</div></div>
  <button class="btn btn-p" onclick="go('explore')">+ احجز جلسة</button>
</div>

<div style="background:linear-gradient(135deg,#0a0a1a,#0d1a2e);border-radius:18px;padding:14px 18px;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
  <div style="display:flex;align-items:center;gap:12px">
    <span style="font-size:1.5rem">💳</span>
    <div><div style="font-size:.7rem;color:rgba(255,255,255,.4);margin-bottom:2px">رصيد المحفظة</div><div style="font-size:1.5rem;font-weight:900;font-family:'Fraunces',serif;color:#fff">${walBal.toFixed(2)}<span style="font-size:.75rem;opacity:.6"> ج.م</span></div></div>
  </div>
  <div style="display:flex;gap:8px">
    <button class="btn btn-p btn-sm" onclick="go('wallet')">شحن</button>
    <button class="btn btn-gh btn-sm" onclick="go('wallet')">💸 سحب</button>
  </div>
</div>

<div class="dual-block student-block">
  <div class="dual-block-hd">
    <div class="dual-block-icon">📚</div>
    <div><div class="dual-block-title">أنا كمتعلم</div><div class="dual-block-sub">جلساتي التي حجزتها</div></div>
    <button class="btn btn-sm" style="margin-right:auto;background:rgba(255,255,255,.15);color:#fff;border:1px solid rgba(255,255,255,.2)" onclick="dNav('sessions')">عرض ←</button>
  </div>
  <div class="dual-stats">
    <div class="ds-item"><div class="ds-val">${sB.length}</div><div class="ds-lbl">إجمالي</div></div>
    <div class="ds-item"><div class="ds-val">${sComp}</div><div class="ds-lbl">مكتملة ✅</div></div>
    <div class="ds-item"><div class="ds-val">${sUp}</div><div class="ds-lbl">قادمة ⏰</div></div>
    <div class="ds-item"><div class="ds-val">${sSpent.toFixed(0)}<small> ج.م</small></div><div class="ds-lbl">الإنفاق</div></div>
  </div>
  ${sUp>0?`<div class="dual-alert">⏰ <strong>${sUp} جلسة</strong> قادمة كطالب<button onclick="dNav('sessions')" style="margin-right:auto;background:rgba(255,255,255,.15);color:#fff;border:none;border-radius:8px;padding:5px 12px;cursor:pointer;font-family:'Cairo',sans-serif;font-size:.78rem">عرض</button></div>`:`<div class="dual-alert" style="background:rgba(255,255,255,.08);border:none">💡 ابحث عن معلم جديد<button onclick="go('explore')" style="margin-right:auto;background:rgba(255,255,255,.15);color:#fff;border:none;border-radius:8px;padding:5px 12px;cursor:pointer;font-family:'Cairo',sans-serif;font-size:.78rem">استكشف ←</button></div>`}
</div>

<div class="dual-block teacher-block">
  <div class="dual-block-hd">
    <div class="dual-block-icon">🎓</div>
    <div><div class="dual-block-title">أنا كمعلم</div><div class="dual-block-sub">${p.category||'معلم'} · ${(p.rating||0).toFixed(1)} ⭐ · $${p.price||0}/ساعة</div></div>
    <button class="btn btn-sm" style="margin-right:auto;background:rgba(255,255,255,.15);color:#fff;border:1px solid rgba(255,255,255,.2)" onclick="go('editProfile')">تعديل ✏️</button>
  </div>
  <div class="dual-stats">
    <div class="ds-item"><div class="ds-val">${tComp}</div><div class="ds-lbl">مكتملة</div></div>
    <div class="ds-item"><div class="ds-val">${tUp}</div><div class="ds-lbl">قادمة ⏰</div></div>
    <div class="ds-item"><div class="ds-val">${tEarn.toFixed(0)}<small> ج.م</small></div><div class="ds-lbl">الأرباح 💰</div></div>
    <div class="ds-item"><div class="ds-val">${(p.rating||0).toFixed(1)}<small>⭐</small></div><div class="ds-lbl">تقييمي</div></div>
  </div>
  ${tPend>0?`<div class="dual-alert" style="background:rgba(245,158,11,.15);border-color:rgba(245,158,11,.3)">🔔 <strong>${tPend} طلب</strong> ينتظر موافقتك<button onclick="dNav('sessions')" style="margin-right:auto;background:rgba(245,158,11,.25);color:#fff;border:none;border-radius:8px;padding:5px 12px;cursor:pointer;font-family:'Cairo',sans-serif;font-size:.78rem">راجع</button></div>`:`<div class="dual-teacher-info"><span class="dti-badge">🏆 ${p.experience||0} سنة</span><span class="dti-badge">📂 ${p.category||'—'}</span><span class="dti-badge">🌐 ${p.language||'عربي'}</span><button onclick="dNav('availability')" class="btn btn-sm dti-btn">⏰ أوقاتي</button></div>`}
</div>

${upAll.length>0?`<div class="dsec" style="margin-bottom:16px;border-color:var(--teal)"><div class="dsech" style="background:var(--teal3)"><div class="dsect" style="color:var(--teal)">⏰ الجلسات القادمة (${upAll.length})</div><button class="btn btn-p btn-sm" onclick="dNav('sessions')">الكل</button></div>${typeof bkTblHTML==='function'?bkTblHTML(upAll):''}</div>`:''}
<div class="dsec"><div class="dsech"><div class="dsect">📋 آخر الجلسات</div><button class="btn btn-gh btn-sm" onclick="dNav('sessions')">الكل</button></div>${typeof bkTblHTML==='function'?bkTblHTML(allBks):'<p style="padding:16px;color:var(--muted)">لا توجد جلسات</p>'}</div>`;

  } catch(e) {
    console.error('[pf] rdOverview both:',e);
    if(typeof _pf_origRdOverview==='function') return _pf_origRdOverview(el);
  }
};

/* ── Admin session button ── */
function _pf_addAdminSesBtn(){
  document.querySelectorAll('#adCon table tbody tr').forEach(row=>{
    if(row.querySelector('.pf-adm-ses')) return;
    let bid=null;
    row.querySelectorAll('button[onclick]').forEach(btn=>{const m=btn.getAttribute('onclick')?.match(/['"]([A-Za-z0-9]{15,})['"]/);if(m&&!bid)bid=m[1];});
    if(!bid) return;
    const pill=row.querySelector('.pill'), txt=pill?.textContent||'';
    if(!['نشطة','مؤكدة','معلقة','confirmed','active','paused','✓'].some(s=>txt.includes(s))) return;
    const lastTd=row.querySelector('td:last-child'); if(!lastTd) return;
    const b=document.createElement('button');
    b.className='pf-adm-ses btn btn-p btn-xs';
    b.style.cssText='margin-top:5px;width:100%;background:linear-gradient(135deg,#0d6e75,#14b8a6)!important;color:#fff!important;font-weight:800!important';
    b.textContent='🎥 دخول الجلسة (أدمن)'; b.onclick=()=>window.enterSession(bid);
    lastTd.appendChild(b);
  });
}
const _pf_prevAdTab=window.adTab;
window.adTab=async function(tab,el){
  const r=typeof _pf_prevAdTab==='function'?await _pf_prevAdTab(tab,el):undefined;
  if(tab==='bookings') setTimeout(_pf_addAdminSesBtn,600);
  return r;
};

/* ── CSS ── */
(()=>{const s=document.createElement('style');s.textContent=`
.dual-block{border-radius:20px;padding:18px 20px;margin-bottom:14px;color:#fff}
.student-block{background:linear-gradient(135deg,#1e40af,#3b82f6);box-shadow:0 6px 24px rgba(59,130,246,.2)}
.teacher-block{background:linear-gradient(135deg,#064e3b,#059669);box-shadow:0 6px 24px rgba(5,150,105,.2)}
.dual-block-hd{display:flex;align-items:center;gap:12px;margin-bottom:16px;flex-wrap:wrap}
.dual-block-icon{width:44px;height:44px;border-radius:13px;background:rgba(255,255,255,.16);display:flex;align-items:center;justify-content:center;font-size:1.35rem;flex-shrink:0}
.dual-block-title{font-weight:900;font-size:1rem}
.dual-block-sub{font-size:.73rem;opacity:.65;margin-top:2px}
.dual-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px}
@media(max-width:540px){.dual-stats{grid-template-columns:repeat(2,1fr)}}
.ds-item{background:rgba(255,255,255,.12);border-radius:12px;padding:10px 8px;text-align:center}
.ds-val{font-size:1.4rem;font-weight:900;font-family:'Fraunces',serif;line-height:1}
.ds-val small{font-size:.62rem;font-weight:600;opacity:.7}
.ds-lbl{font-size:.63rem;opacity:.7;margin-top:4px}
.dual-alert{display:flex;align-items:center;gap:8px;background:rgba(255,255,255,.1);border-radius:10px;padding:9px 13px;font-size:.81rem;margin-top:4px;flex-wrap:wrap}
.dual-teacher-info{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:4px}
.dti-badge{background:rgba(255,255,255,.14);border-radius:8px;padding:4px 10px;font-size:.76rem;font-weight:700}
.dti-btn{background:rgba(255,255,255,.16)!important;color:#fff!important;border:1px solid rgba(255,255,255,.25)!important}
`;document.head.appendChild(s);})();

/* ── PWA ── */
let _pf_dp = null;
let _pfSessionMonitor = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  _pf_dp = e;
});
window.addEventListener('appinstalled', () => {
  _pf_dp = null;
});

console.log('✅ patch_final.js v7.2 loaded — Session timing + finalization');

/* ===== END patch_final.js ===== */


/* ===== BEGIN patch_v9.js ===== */
/* ═══════════════════════════════════════════════════════════════════
   patch_v9.js — Skillak Platform v9.0
   ═══════════════════════════════════════════════════════════════════
   ✅ 1. إخفاء زر إنهاء الجلسة الأحمر نهائياً عن الطالب
   ✅ 2. زر "مغادرة مؤقتة" للطالب (لا يُنهي الجلسة)
   ✅ 3. المعلم فقط يملك صلاحية الإنهاء الرسمي
   ✅ 4. شاشة بداية احترافية بلوجو Skillak
   ✅ 5. بانر تثبيت PWA بلوجو الموقع
   ✅ 6. غرفة انتظار احترافية مع عداد تنازلي
   ✅ 7. إشعار فوري للمعلم عند طلب جلسة جديدة
   ✅ 8. مؤشر جودة الاتصال في شريط الجلسة
   ✅ 9. حماية من إغلاق التبويب عرضياً أثناء الجلسة
   ✅ 10. تحسينات شاملة للواجهة
   ═══════════════════════════════════════════════════════════════════ */
'use strict';

/* ─── helpers ─── */
const _p9 = {
  e:     id  => document.getElementById(id),
  getCU: ()  => { try { return typeof CU !== 'undefined' ? CU  : null; } catch(_){ return null; } },
  getCP: ()  => { try { return typeof CP !== 'undefined' ? CP  : null; } catch(_){ return null; } },
  getDb: ()  => { try { return typeof db !== 'undefined' ? db  : null; } catch(_){ return null; } },
  toast: (msg, type='') => {
    try {
      const t = document.getElementById('toast');
      if (!t) throw new Error('no toast el');
      if (typeof showT === 'function') showT(msg, type);
    } catch(_) {
      try {
        const fb = document.createElement('div');
        fb.textContent = msg;
        fb.style.cssText = 'position:fixed;bottom:28px;left:50%;transform:translateX(-50%);background:' +
          (type==='err'?'#dc2626':type==='suc'?'#059669':'#0d6e75') +
          ';color:#fff;padding:11px 24px;border-radius:14px;font-size:.9rem;z-index:99999;' +
          'font-family:Cairo,sans-serif;max-width:90vw;text-align:center;pointer-events:none;' +
          'box-shadow:0 4px 24px rgba(0,0,0,.3)';
        document.body.appendChild(fb);
        setTimeout(() => fb.isConnected && fb.remove(), 3500);
      } catch(_2) { console.log('[Toast]', msg); }
    }
  },
  go:    name => { if (typeof go === 'function') go(name); },
};

/* ══════════════════════════════════════════════════════════════════
   1. شاشة البداية الاحترافية (Splash Screen)
   ══════════════════════════════════════════════════════════════════ */
(function _p9_initSplash() {
  const ld = _p9.e('loadScreen');
  if (!ld) return;

  /* رسائل متناوبة في شريط التحميل */
  const msgs   = ['جاري التحميل...', 'تجهيز المنصة...', 'اتصال بالخوادم...', 'مرحباً في Skillak 🎓'];
  let mi       = 0;
  const subEl  = ld.querySelector('.skl-splash-sub');
  const msgInt = setInterval(() => {
    if (!subEl || !subEl.isConnected) { clearInterval(msgInt); return; }
    subEl.style.opacity = '0';
    setTimeout(() => {
      if (subEl.isConnected) {
        subEl.textContent = msgs[mi++ % msgs.length];
        subEl.style.opacity = '1';
      }
    }, 250);
  }, 1400);

  /* إخفاء الشاشة بعد التحميل */
  const hideSplash = () => {
    clearInterval(msgInt);
    ld.classList.add('fading');
    setTimeout(() => {
      if (ld.isConnected) {
        ld.style.display = 'none';
        ld.remove();
      }
    }, 520);
  };

  window.addEventListener('load', () => setTimeout(hideSplash, 700), { once: true });
  setTimeout(hideSplash, 7000); /* خط أمان */
})();

/* ══════════════════════════════════════════════════════════════════
   2. بانر تثبيت PWA بلوجو Skillak
   ══════════════════════════════════════════════════════════════════ */
let _p9_deferredPrompt = null;

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  _p9_deferredPrompt = e;
  /* عرض البانر بعد 4 ثوانٍ */
  setTimeout(_p9_showInstallBanner, 4000);
});

function _p9_showInstallBanner() {
  if (!_p9_deferredPrompt || _p9.e('p9InstallBanner')) return;

  const banner = document.createElement('div');
  banner.id        = 'p9InstallBanner';
  banner.className = 'pwa-install-banner';
  banner.innerHTML = `
    <img src="icon-192.png" class="pwa-banner-icon" alt="Skillak"
      onerror="this.src='skillak.png'">
    <div class="pwa-banner-text">
      <div class="pwa-banner-title">ثبّت تطبيق Skillak</div>
      <div class="pwa-banner-sub">يعمل بدون إنترنت · أسرع · أفضل تجربة</div>
    </div>
    <button class="pwa-banner-btn" id="p9InstallBtn">تثبيت</button>
    <button class="pwa-banner-close" onclick="document.getElementById('p9InstallBanner')?.remove()">✕</button>
  `;

  document.body.appendChild(banner);

  _p9.e('p9InstallBtn')?.addEventListener('click', async () => {
    if (!_p9_deferredPrompt) return;
    _p9_deferredPrompt.prompt();
    const { outcome } = await _p9_deferredPrompt.userChoice;
    _p9_deferredPrompt = null;
    banner.remove();
    if (outcome === 'accepted') {
      _p9.toast('✅ تم تثبيت Skillak بنجاح! 🎉', 'suc');
    }
  });

  /* إخفاء تلقائي بعد 12 ثانية */
  setTimeout(() => banner.isConnected && banner.remove(), 12000);
}

/* iOS: عرض دليل يدوي */
(function _p9_iosInstallHint() {
  const isIOS     = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStand   = window.navigator.standalone;
  const shown     = sessionStorage.getItem('p9_ios_hint');
  if (!isIOS || isStand || shown) return;

  setTimeout(() => {
    const hint = document.createElement('div');
    hint.style.cssText = `
      position:fixed;bottom:76px;left:50%;transform:translateX(-50%);
      background:linear-gradient(135deg,#0a0a1a,#0d1a2e);
      border:1px solid rgba(255,255,255,.12);
      border-radius:18px;padding:14px 18px;
      display:flex;align-items:center;gap:12px;
      box-shadow:0 8px 36px rgba(0,0,0,.55);
      z-index:9998;max-width:340px;width:92%;
      font-family:'Cairo',sans-serif;font-size:.82rem;color:#fff;
      animation:sklBannerSlide .4s ease;
    `;
    hint.innerHTML = `
      <img src="icon-192.png" style="width:40px;height:40px;border-radius:11px" alt="">
      <div style="flex:1;line-height:1.65">
        <strong style="font-size:.88rem">ثبّت Skillak على iPhone</strong><br>
        <span style="color:rgba(255,255,255,.55)">اضغط <strong>⬆️</strong> ثم اختر <strong>«إضافة للشاشة الرئيسية»</strong></span>
      </div>
      <button onclick="this.closest('div').remove()" style="background:none;border:none;color:rgba(255,255,255,.35);font-size:1.1rem;cursor:pointer">✕</button>
    `;
    document.body.appendChild(hint);
    sessionStorage.setItem('p9_ios_hint', '1');
    setTimeout(() => hint.isConnected && hint.remove(), 9000);
  }, 5000);
})();

/* ══════════════════════════════════════════════════════════════════
   3. إخفاء زر الإنهاء عن الطالب — ثلاث طبقات حماية
   ══════════════════════════════════════════════════════════════════ */

function _p9_applySessionRoleControls() {
  const endBtn  = _p9.e('endBtn');
  const endWrap = endBtn?.closest?.('.cwrap');
  const exitWrap = _p9.e('studentExitWrap');
  const sesPage = _p9.e('page-session');

  if (endBtn)  endBtn.style.setProperty('display', 'none', 'important');
  if (endWrap) endWrap.style.setProperty('display', 'none', 'important');
  if (exitWrap) {
    exitWrap.style.setProperty('display', 'flex', 'important');
    exitWrap.style.alignItems = 'center';
    exitWrap.style.flexDirection = 'column';
  }
  if (sesPage)  sesPage.setAttribute('data-session-live', '1');
  _p9.e('p9StudentNote')?.remove();
}

window._p9_cleanupSessionUi = function() {
  try { if (typeof pc !== 'undefined' && pc) { pc.close(); window.pc = null; } } catch(e) {}
  try { if (typeof locSt !== 'undefined' && locSt) { locSt.getTracks().forEach(t => t.stop()); window.locSt = null; } } catch(e) {}
  try { if (typeof scrSt !== 'undefined' && scrSt) { scrSt.getTracks().forEach(t => t.stop()); window.scrSt = null; } } catch(e) {}
  try { if (typeof sesTInt !== 'undefined' && sesTInt) { clearInterval(sesTInt); window.sesTInt = null; } } catch(e) {}
  try { if (typeof sesChatL !== 'undefined' && sesChatL) { sesChatL(); window.sesChatL = null; } } catch(e) {}
};

/* ══════════════════════════════════════════════════════════════════
   4. وظيفة مغادرة الطالب المؤقتة
   ══════════════════════════════════════════════════════════════════ */
window.studentExitSession = async function(bookingId) {
  if (!confirm('هل تريد مغادرة الجلسة مؤقتاً?\nيمكنك العودة إليها قبل انتهاء الوقت المحدد.')) return;

  const _db  = _p9.getDb();
  const bid  = bookingId || ((typeof curSesBid !== 'undefined') ? curSesBid : null);
  const bk   = (typeof curSesBk  !== 'undefined') ? curSesBk  : null;

  if (!bid || !_db) return;

  /* تنظيف WebRTC فقط إذا كانت الجلسة الحالية مفتوحة */
  if (typeof window._p9_cleanupSessionUi === 'function') window._p9_cleanupSessionUi();
  else {
    try { if (typeof pc !== 'undefined' && pc) { pc.close(); window.pc = null; } } catch(e) {}
    try { if (typeof locSt !== 'undefined' && locSt) { locSt.getTracks().forEach(t => t.stop()); window.locSt = null; } } catch(e) {}
    try { if (typeof scrSt !== 'undefined' && scrSt) { scrSt.getTracks().forEach(t => t.stop()); window.scrSt = null; } } catch(e) {}
    try { if (typeof sesTInt !== 'undefined' && sesTInt) clearInterval(sesTInt); } catch(e) {}
    try { if (typeof sesChatL !== 'undefined' && sesChatL) sesChatL(); } catch(e) {}
  }

  /* تحديث حالة الحجز إلى paused */
  try {
    const endMs = (typeof getBookingEndMs === 'function')
      ? getBookingEndMs(bk || {})
      : (bk?.sessionEndsAtMs || 0);

    await _db.collection('bookings').doc(bid).set({
      status: 'paused',
      lastPausedAt: firebase.firestore.FieldValue.serverTimestamp(),
      pausedBy: (typeof CU !== 'undefined' && CU?.uid) ? CU.uid : null,
      ...(endMs ? { sessionEndsAtMs: endMs } : {})
    }, { merge: true });

    await _db.collection('sessions').doc(bid).set({
      status: 'paused',
      pausedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true }).catch(() => {});
  } catch(e) { console.warn('[p9] studentExit:', e); }

  if (typeof curSesBid !== 'undefined' && curSesBid === bid) {
    try { window.curSesBid = null; } catch(e) {}
    try { window.curSesBk  = null; } catch(e) {}
    window.removeEventListener('beforeunload', _p9_beforeUnloadHandler);
    const mainNav = _p9.e('mainNav');
    if (mainNav) mainNav.style.display = '';
    _p9.e('p9StudentNote')?.remove();
    _p9.go('dashboard');
    setTimeout(() => { if (typeof dNav === 'function') dNav('sessions'); }, 350);
  }

  _p9.toast('🚪 غادرت الجلسة مؤقتاً — يمكنك العودة من "جلساتي"', 'inf');
};

/* ══════════════════════════════════════════════════════════════════
   5. Hook على enterSession
   ══════════════════════════════════════════════════════════════════ */
const _p9_origEnter = window.enterSession;
window.enterSession = async function(bookingId) {
  /* إخفاء زر الإنهاء فقط قبل الدخول، وإظهار زر الخروج داخل الجلسة */
  const endWrap  = _p9.e('endBtn')?.closest?.('.cwrap');
  const exitWrap = _p9.e('studentExitWrap');
  if (endWrap)  endWrap.style.display = 'none';
  if (exitWrap) exitWrap.style.display = 'flex';

  let result;
  try {
    result = typeof _p9_origEnter === 'function' ? await _p9_origEnter(bookingId) : undefined;
  } catch(e) {
    _p9.toast('❌ تعذر الدخول للجلسة: ' + e.message, 'err');
    return;
  }

  /* بعد الدخول — تطبيق قواعد الأدوار */
  setTimeout(() => {
    _p9_applySessionRoleControls();
    _p9_enhanceWaitingRoom();
    _p9_setupBeforeUnloadGuard();
    _p9_enhanceSesBar();
  }, 700);

  return result;
};

/* ══════════════════════════════════════════════════════════════════
   6. غرفة الانتظار الاحترافية
   ══════════════════════════════════════════════════════════════════ */
function _p9_enhanceWaitingRoom() {
  const waitOv = _p9.e('waitOv');
  if (!waitOv || waitOv.dataset.p9) return;
  waitOv.dataset.p9 = '1';

  const _CU = _p9.getCU();
  const bk  = (typeof curSesBk !== 'undefined') ? curSesBk : null;
  if (!bk) return;

  const isTutor = bk.tutorId === _CU?.uid;
  const other   = isTutor ? (bk.studentName || 'الطالب') : (bk.tutorName || 'المعلم');
  const initial = (other[0] || '?').toUpperCase();
  const endMs   = (typeof getBookingEndMs === 'function') ? getBookingEndMs(bk) : 0;
  const bgGrad  = isTutor
    ? 'linear-gradient(135deg,#1e40af,#3b82f6)'
    : 'linear-gradient(135deg,#064e3b,#059669)';

  waitOv.style.cssText = `
    position:absolute;inset:0;z-index:20;overflow-y:auto;padding:20px;
    background:linear-gradient(160deg,#0a0a1a 0%,#0d1a2e 50%,#0a1a14 100%);
    display:flex;align-items:center;justify-content:center;
  `;

  waitOv.innerHTML = `
    <div class="swr-inner">

      <!-- Logo -->
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px">
        <img src="skillak.png" alt="Skillak"
          style="height:32px;width:32px;object-fit:contain;border-radius:9px;flex-shrink:0"
          onerror="this.style.display='none'">
        <div style="font-family:'Fraunces',serif;font-size:1.4rem;font-weight:900;color:#fff;letter-spacing:-.02em">
          Skill<span style="color:#f59e0b">ak</span>
        </div>
      </div>

      <!-- Avatar -->
      <div style="position:relative;margin-bottom:10px">
        <div style="
          width:78px;height:78px;border-radius:50%;
          background:${bgGrad};
          display:flex;align-items:center;justify-content:center;
          font-size:1.9rem;font-weight:900;color:#fff;
          font-family:'Fraunces',serif;
          border:3px solid rgba(255,255,255,.18);
          box-shadow:0 0 0 7px rgba(255,255,255,.05);
        ">${initial}</div>
        <div style="
          position:absolute;bottom:2px;right:2px;
          width:16px;height:16px;border-radius:50%;
          background:var(--amber,#f59e0b);
          border:2px solid #0a0a1a;
          animation:pulse-warn 1.5s ease-in-out infinite;
        "></div>
      </div>

      <p class="swr-name">${other}</p>
      <p class="swr-role">${isTutor ? '🎓 طالب' : '👨‍🏫 معلمك'}</p>

      <!-- Info Grid -->
      <div class="swr-grid">
        <div class="swr-cell">
          <div class="swr-ic">📅</div>
          <div class="swr-val">${bk.date || '—'}</div>
          <div class="swr-lbl">التاريخ</div>
        </div>
        <div class="swr-cell">
          <div class="swr-ic">⏰</div>
          <div class="swr-val" style="font-size:.8rem">${bk.timeLbl || bk.time || '—'}</div>
          <div class="swr-lbl">الوقت</div>
        </div>
        <div class="swr-cell">
          <div class="swr-ic">⏱️</div>
          <div class="swr-val">${bk.duration || 60}</div>
          <div class="swr-lbl">دقيقة</div>
        </div>
        <div class="swr-cell">
          <div class="swr-ic">💰</div>
          <div class="swr-val">${Number(bk.price || 0).toFixed(0)}<small style="font-size:.55rem;opacity:.6"> ج.م</small></div>
          <div class="swr-lbl">الأتعاب</div>
        </div>
      </div>

      <!-- Status -->
      <div class="swr-status">
        <div class="swr-spin"></div>
        <span id="p9WaitCd">
          ${endMs ? '⏱️ جاري الحساب...' : 'في انتظار ' + other + '...'}
        </span>
      </div>

      <!-- Note -->
      <div class="swr-note">
        💡 سيبدأ الاتصال تلقائياً عند انضمام <strong>${other}</strong>.
        تأكد من منح إذن الكاميرا والميكروفون.
      </div>

      <!-- Actions -->
      <div style="display:flex;gap:9px;justify-content:center;flex-wrap:wrap;margin-top:4px">
        <button onclick="_p9_retryConn()"
          style="background:rgba(13,110,117,.22);color:#fff;border:1px solid rgba(13,110,117,.4);
                 border-radius:12px;padding:10px 20px;font-size:.82rem;cursor:pointer;
                 font-family:'Cairo',sans-serif;font-weight:700;transition:all .2s">
          🔄 إعادة الاتصال
        </button>
      </div>

      <p class="swr-tip">للحصول على أفضل جودة، استخدم واي فاي واغلق التطبيقات الأخرى</p>
    </div>
  `;

  /* عداد تنازلي */
  if (endMs) {
    const cdEl = _p9.e('p9WaitCd');
    const tick = () => {
      if (!cdEl?.isConnected) return;
      const rem = endMs - Date.now();
      if (rem <= 0) { cdEl.textContent = '⏰ انتهى وقت الجلسة'; return; }
      const h = Math.floor(rem / 3600000);
      const m = Math.floor((rem % 3600000) / 60000);
      const s = Math.floor((rem % 60000) / 1000);
      const str = h > 0
        ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
        : `${m}:${String(s).padStart(2,'0')}`;
      cdEl.textContent = `⏱️ متبقي من الجلسة: ${str}`;
    };
    tick();
    const _int = setInterval(() => {
      if (!_p9.e('p9WaitCd')) { clearInterval(_int); return; }
      tick();
    }, 1000);
  }
}

window._p9_retryConn = async function() {
  const bid = (typeof curSesBid !== 'undefined') ? curSesBid : null;
  if (!bid) return;
  _p9.toast('🔄 جاري إعادة الاتصال...', 'inf');
  try {
    if (typeof pc !== 'undefined' && pc) { pc.close(); window.pc = null; }
    /* إعادة الدخول للجلسة */
    const fn = _p9_origEnter || window.enterSession;
    if (typeof fn === 'function') await fn(bid);
  } catch(e) {
    _p9.toast('تعذرت إعادة الاتصال: ' + e.message, 'err');
  }
};

/* ══════════════════════════════════════════════════════════════════
   7. حماية من إغلاق التبويب عرضياً
   ══════════════════════════════════════════════════════════════════ */
let _p9_guardActive = false;

function _p9_beforeUnloadHandler(e) {
  const sp = _p9.e('page-session');
  if (!sp || sp.classList.contains('hidden')) return;
  e.preventDefault();
  return (e.returnValue = 'أنت في جلسة نشطة. هل أنت متأكد من الخروج؟');
}

function _p9_setupBeforeUnloadGuard() {
  if (_p9_guardActive) return;
  _p9_guardActive = true;
  window.addEventListener('beforeunload', _p9_beforeUnloadHandler);
}

/* إيقاف الحماية عند الإنهاء */
const _p9_origEnd = window.endSession;
window.endSession = async function() {
  _p9_guardActive = false;
  window.removeEventListener('beforeunload', _p9_beforeUnloadHandler);
  _p9.e('p9StudentNote')?.remove();
  return typeof _p9_origEnd === 'function' ? _p9_origEnd.apply(window, arguments) : undefined;
};

/* ══════════════════════════════════════════════════════════════════
   8. مؤشر جودة الاتصال في شريط الجلسة
   ══════════════════════════════════════════════════════════════════ */
function _p9_enhanceSesBar() {
  const sesbar = document.querySelector('.sesbar');
  if (!sesbar || sesbar.dataset.p9q) return;
  sesbar.dataset.p9q = '1';

  if (_p9.e('p9Quality')) return;

  const badge = document.createElement('div');
  badge.id = 'p9Quality';
  badge.style.cssText = `
    font-size:.71rem;font-weight:700;color:#10b981;
    background:rgba(16,185,129,.13);
    border:1px solid rgba(16,185,129,.28);
    border-radius:50px;padding:4px 10px;
    white-space:nowrap;display:flex;align-items:center;gap:5px;
    transition:all .4s;
  `;
  badge.innerHTML = `<span style="width:7px;height:7px;border-radius:50%;background:currentColor;display:inline-block;animation:pulse-active 1.8s infinite"></span><span id="p9QualTxt">متصل</span>`;
  sesbar.appendChild(badge);

  let _qInt = setInterval(async () => {
    const peerConn = (typeof pc !== 'undefined') ? pc : null;
    if (!peerConn || !badge.isConnected) { clearInterval(_qInt); return; }
    try {
      const stats = await peerConn.getStats();
      let rtt = null;
      stats.forEach(r => {
        if (r.type === 'candidate-pair' && r.state === 'succeeded')
          rtt = r.currentRoundTripTime ?? r.roundTripTime ?? null;
      });
      if (rtt === null) return;
      const ms = Math.round(rtt * 1000);
      let color, label;
      if      (ms < 80)  { color = '#10b981'; label = `ممتاز ${ms}ms`; }
      else if (ms < 200) { color = '#f59e0b'; label = `جيد ${ms}ms`; }
      else               { color = '#ef4444'; label = `بطيء ${ms}ms`; }

      const t = _p9.e('p9QualTxt');
      if (t) t.textContent = label;
      badge.style.color = color;
      badge.style.background = `${color}22`;
      badge.style.borderColor = `${color}44`;
    } catch(e) {}
  }, 3000);
}

/* ══════════════════════════════════════════════════════════════════
   9. إشعار فوري للمعلم عند طلب جلسة جديدة
   ══════════════════════════════════════════════════════════════════ */
(function _p9_tutorAlert() {
  let _unsub = null;

  function _start() {
    const _CU = _p9.getCU(), _CP = _p9.getCP(), _db = _p9.getDb();
    if (!_CU || !_CP || !_db) return;
    if (!['tutor','both','admin'].includes(_CP.role)) return;
    if (_unsub) { try { _unsub(); } catch(e) {} }

    _unsub = _db.collection('bookings')
      .where('tutorId', '==', _CU.uid)
      .where('status', '==', 'pending')
      .onSnapshot(snap => {
        snap.docChanges().forEach(ch => {
          if (ch.type !== 'added') return;
          const bk  = ch.doc.data();
          const age = Date.now() - ((bk.createdAt?.seconds || 0) * 1000);
          if (age > 5000) return;
          _p9_showAlert(bk);
        });
      }, () => {});
  }

  function _p9_showAlert(bk) {
    _p9.e('p9TutorAlert')?.remove();
    const el = document.createElement('div');
    el.id = 'p9TutorAlert';
    el.style.cssText = `
      position:fixed;top:72px;left:50%;transform:translateX(-50%);
      background:linear-gradient(135deg,#064e3b,#059669);
      color:#fff;border-radius:18px;padding:14px 18px;
      display:flex;align-items:center;gap:12px;
      box-shadow:0 8px 32px rgba(5,150,105,.5);
      z-index:9999;max-width:360px;width:92%;
      font-family:'Cairo',sans-serif;font-size:.85rem;
      animation:sklBannerSlide .4s ease;
    `;
    el.innerHTML = `
      <img src="icon-192.png" style="width:40px;height:40px;border-radius:11px;flex-shrink:0"
        onerror="this.src='skillak.png'" alt="">
      <div style="flex:1">
        <div style="font-weight:800;font-size:.9rem;margin-bottom:2px">🔔 طلب جلسة جديد!</div>
        <div style="opacity:.85;font-size:.76rem">
          من: <strong>${bk.studentName || 'طالب'}</strong>
          · ${bk.date || ''} ${bk.timeLbl || bk.time || ''}
        </div>
      </div>
      <button onclick="this.closest('#p9TutorAlert').remove();_p9.go('dashboard');setTimeout(()=>typeof dNav==='function'&&dNav('sessions'),250)"
        style="background:rgba(255,255,255,.18);border:none;color:#fff;
               border-radius:10px;padding:7px 13px;cursor:pointer;
               font-family:'Cairo',sans-serif;font-size:.78rem;font-weight:700;white-space:nowrap">
        راجع ←
      </button>
      <button onclick="this.closest('#p9TutorAlert').remove()"
        style="background:none;border:none;color:rgba(255,255,255,.5);cursor:pointer;font-size:1.1rem;padding:3px">✕</button>
    `;
    document.body.appendChild(el);

    /* صوت إشعار */
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      [880, 660].forEach((freq, i) => {
        const osc = ctx.createOscillator(), g = ctx.createGain();
        osc.connect(g); g.connect(ctx.destination);
        osc.frequency.value = freq;
        g.gain.setValueAtTime(.25, ctx.currentTime + i*.15);
        g.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + i*.15 + .25);
        osc.start(ctx.currentTime + i*.15);
        osc.stop(ctx.currentTime + i*.15 + .25);
      });
    } catch(e) {}

    setTimeout(() => el.isConnected && el.remove(), 9000);
  }

  /* ربط مع دورة حياة تسجيل الدخول */
  const _prev = window.updNavU;
  window.updNavU = function() {
    if (typeof _prev === 'function') _prev();
    setTimeout(_start, 1200);
  };
  setTimeout(_start, 2500);
})();

/* ══════════════════════════════════════════════════════════════════
   10. CSS الطبقة الأمنية لإخفاء زر الإنهاء عن الطالب
   ══════════════════════════════════════════════════════════════════ */
(function _p9_css() {
  const s = document.createElement('style');
  s.textContent = `
    /* إخفاء زر الإنهاء عن الطالب — CSS كطبقة ثانية */
    [data-student-view="1"] #endBtn,
    [data-student-view="1"] #endBtn ~ .clbl,
    [data-student-view="1"] .cwrap:has(#endBtn) {
      display: none !important;
    }
    [data-student-view="1"] #studentExitWrap {
      display: flex !important;
    }

    /* زر مغادرة الطالب */
    #studentExitBtn {
      background: linear-gradient(135deg,#d97706,#f59e0b) !important;
      box-shadow: 0 4px 16px rgba(245,158,11,.38) !important;
      width: 52px !important;
      height: 52px !important;
    }
    #studentExitBtn:active { transform: scale(.88) !important; }
    #studentExitWrap .clbl {
      color: #fbbf24 !important;
      font-weight: 700 !important;
    }

    /* تحسين sesbar */
    .sesbar {
      background: linear-gradient(90deg,#06080f,#0d1a2e) !important;
      border-bottom: 1px solid rgba(13,110,117,.18) !important;
    }

    /* تحسين sesctrls */
    .sesctrls {
      background: linear-gradient(180deg,#0b0c1c,#0f1120) !important;
      border-top: 1px solid rgba(255,255,255,.06) !important;
    }

    /* إظهار تسميات الأزرار */
    @media (min-width: 481px) {
      .clbl { display: block !important; }
    }

  `;
  document.head.appendChild(s);
})();

/* ══════════════════════════════════════════════════════════════════
   BOOT — إخفاء زر الإنهاء افتراضياً حتى نعرف الدور
   ══════════════════════════════════════════════════════════════════ */
window.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    const endWrap = _p9.e('endBtn')?.closest?.('.cwrap');
    const exitWrap = _p9.e('studentExitWrap');
    if (endWrap) endWrap.style.display = 'none';
    if (exitWrap) exitWrap.style.display = 'flex';
  }, 400);
});





/* ══════════════════════════════════════════════════════════════════
   Support chat photo sync + single PWA banner
   ══════════════════════════════════════════════════════════════════ */
(function _skillakSupportChatPhotoSync() {
  let syncTimer = null;

  function safePhoto() {
    try {
      return (window.supportChatPhoto || window.skillakSupportChatPhoto || '').trim();
    } catch (_) {
      return '';
    }
  }

  function ensureSupportPreview() {
    const img = document.getElementById('supportChatPhotoPreview');
    if (img) {
      const p = safePhoto() || 'skillak.png';
      if (img.getAttribute('src') !== p) img.src = p;
      img.alt = safePhoto() ? 'صورة الشات' : 'لوجو المنصة';
    }
    const inp = document.getElementById('supportChatPhotoInput');
    if (inp && document.activeElement !== inp) inp.value = safePhoto();
  }

  const tryInject = () => {
    const adCon = document.getElementById('adCon');
    if (!adCon || document.getElementById('supportChatPhotoBox')) return;
    const card = document.createElement('div');
    card.id = 'supportChatPhotoBox';
    card.className = 'card';
    card.style.cssText = 'margin-top:14px;border-radius:18px;overflow:hidden';
    adCon.prepend(card);
    ensureSupportPreview();
  };

  const prevAdTab = window.adTab;
  window.adTab = async function(tab, el) {
    const res = typeof prevAdTab === 'function' ? await prevAdTab(tab, el) : undefined;
    if (tab === 'commission' || tab === 'users') {
      setTimeout(() => {
        tryInject();
        ensureSupportPreview();
      }, 250);
    }
    return res;
  };

  window.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
      tryInject();
      ensureSupportPreview();
    }, 600);
    syncTimer = setInterval(ensureSupportPreview, 2000);
  });

  if (typeof window.saveSupportChatPhoto !== 'function') {
    window.saveSupportChatPhoto = async function() {
      const inp = document.getElementById('supportChatPhotoInput');
      const val = String(inp?.value || '').trim();
      if (typeof CP !== 'undefined' && CP?.role !== 'admin') {
        if (typeof showT === 'function') showT('الصلاحية للمدير فقط', 'err');
        return;
      }
      try {
        await db.collection('settings').doc('platform').set({
          supportChatPhoto: val,
          supportChatPhotoUpdatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          updatedBy: CU?.uid || null
        }, { merge: true });
        window.supportChatPhoto = val;
        if (typeof showT === 'function') showT('✅ تم تحديث صورة الشات', 'suc');
      } catch (e) {
        if (typeof showT === 'function') showT('تعذر حفظ صورة الشات: ' + e.message, 'err');
      }
    };
  }
})();

/* ── Single PWA banner coordination ── */
(function _skillakSingleInstallBanner() {
  try {
    sessionStorage.removeItem('p9_install_banner_seen');
  } catch (_) {}

  const seenKey = 'skillak_install_once';
  const bannerId = 'p9InstallBanner';
  const isStandalone = window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone;
  if (isStandalone) return;

  let deferred = null;
  let bannerShown = false;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e;
    // prevent the earlier banner from patch_final from showing twice
    try { window._p9_deferredPrompt = null; } catch (_) {}
    if (!bannerShown && !sessionStorage.getItem(seenKey)) {
      setTimeout(showBanner, 700);
    }
  });

  function closeBanner() {
    sessionStorage.setItem(seenKey, '1');
    document.getElementById(bannerId)?.remove();
  }

  function showBanner() {
    if (bannerShown || document.getElementById(bannerId) || sessionStorage.getItem(seenKey) === '1' || isStandalone) return;
    bannerShown = true;
    const bn = document.createElement('div');
    bn.id = bannerId;
    bn.className = 'pwa-early-banner';
    bn.innerHTML = `
      <img src="icon-192.png" class="pwa-banner-icon" alt="Skillak" onerror="this.src='skillak.png'">
      <div class="pwa-banner-text">
        <div class="pwa-banner-title">تثبيت Skillak كتطبيق</div>
        <div class="pwa-banner-sub">تثبيت الآن أو لاحقاً — تجربة أسرع على الهاتف والكمبيوتر</div>
      </div>
      <button class="pwa-banner-btn" id="p9EarlyInstallBtn">تثبيت الآن</button>
      <button class="pwa-banner-later" id="p9EarlyLaterBtn">لاحقاً</button>
    `;
    document.body.appendChild(bn);

    document.getElementById('p9EarlyLaterBtn')?.addEventListener('click', closeBanner);
    document.getElementById('p9EarlyInstallBtn')?.addEventListener('click', async () => {
      try {
        if (deferred) {
          deferred.prompt();
          const { outcome } = await deferred.userChoice;
          deferred = null;
          if (outcome === 'accepted' && typeof showT === 'function') showT('✅ تم تثبيت Skillak بنجاح! 🎉', 'suc');
          closeBanner();
          return;
        }
      } catch (e) {}

      const msg = 'التثبيت متاح عندما يدعم المتصفح PWA. افتح الموقع عبر Chrome أو Edge ثم اضغط تثبيت مرة أخرى.';
      if (typeof showT === 'function') showT(msg, 'inf');
      const hint = document.createElement('div');
      hint.id = 'p9InstallHint';
      hint.className = 'pwa-install-hint';
      hint.innerHTML = `<div style="display:flex;align-items:center;gap:10px;flex:1"><strong>⚠️</strong><span>${msg}</span></div><button id="p9InstallHintClose" style="background:rgba(255,255,255,.14);border:none;color:#fff;border-radius:10px;padding:8px 12px;cursor:pointer;font-weight:700">حسناً</button>`;
      document.body.appendChild(hint);
      document.getElementById('p9InstallHintClose')?.addEventListener('click', () => hint.remove());
      setTimeout(() => hint.isConnected && hint.remove(), 7000);
    });

    setTimeout(() => { if (document.getElementById(bannerId)) closeBanner(); }, 15000);
  }

  const ready = () => setTimeout(showBanner, 700);
  if (document.readyState === 'complete' || document.readyState === 'interactive') ready();
  else window.addEventListener('DOMContentLoaded', ready, { once: true });

  // Suppress the older patch_final banner so only one appears
  try {
    const originalShow = window._p9_showInstallBanner;
    window._p9_showInstallBanner = function() {
      if (document.getElementById(bannerId) || sessionStorage.getItem(seenKey) === '1') return;
      if (typeof originalShow === 'function') return originalShow();
    };
  } catch (_) {}
})();

/* ===== END patch_v9.js ===== */


/* ===== BEGIN patch_fix_refund.js ===== */
/* ══════════════════════════════════════════════════════════════
   Skillak — patch_fix_refund.js  v1.0
   1. إصلاح كامل لمنطق استرداد المبلغ بعد تحويله للمعلم
   2. تحسينات بصرية واحترافية لزر الاسترداد ولوحة الإدارة
   ══════════════════════════════════════════════════════════════ */

(function _skillakRefundFix() {
  'use strict';

  /* ── انتظر تحميل Firebase ── */
  function waitForFirebase(cb, tries) {
    tries = tries || 0;
    if (typeof db !== 'undefined' && typeof firebase !== 'undefined') { cb(); return; }
    if (tries > 60) return;
    setTimeout(() => waitForFirebase(cb, tries + 1), 250);
  }

  waitForFirebase(function () {

    /* ══════════════════════════════════════════════════════════
       1. إصلاح دالة adminRefundBk الأصلية
       - خصم ما استلمه المعلم فعلاً (net) من محفظته
       - إعادة المبلغ الكامل (total) للطالب
       - تحديث حالة الحجز إلى refunded
       - إرسال إشعارات لكلا الطرفين
    ══════════════════════════════════════════════════════════ */
    window.adminRefundBk = async function adminRefundBk(bid, studentId, _legacyAmt) {
      try {
        /* ── جلب بيانات الحجز ── */
        const bkSnap = await db.collection('bookings').doc(bid).get();
        if (!bkSnap.exists) { _toast('لم يتم العثور على الحجز', 'err'); return; }
        const bk = { id: bid, ...bkSnap.data() };

        /* ── حساب المبالغ الصحيحة ── */
        const price      = Number(bk.price      || 0);
        const studentFee = Number(bk.studentFee || bk.fee || 0);
        const tutorFee   = Number(bk.tutorFee   || 0);
        // ما دفعه الطالب = price + studentFee
        const refundToStudent = Number(bk.total || bk.totalDue || (price + studentFee) || 0);
        // ما استلمه المعلم = price - tutorFee
        const deductFromTutor = Number(bk.tutorNetAmount || bk.net || (price - tutorFee) || 0);

        if (!(refundToStudent > 0)) {
          _toast('لا يوجد مبلغ صالح للاسترداد', 'err');
          return;
        }

        const paidToTutor = !!(bk.adminConfirmed || bk.paidToTutorAt || bk.tutorPaidAt);

        /* ── رسالة التأكيد ── */
        const confirmMsg = paidToTutor
          ? `⚠️ تأكيد الاسترداد:\n\n✅ سيُضاف للطالب: ${refundToStudent.toFixed(2)} ج.م\n❌ سيُخصم من المعلم: ${deductFromTutor.toFixed(2)} ج.م\n\nهل تريد المتابعة؟`
          : `⚠️ تأكيد الاسترداد:\n\n✅ سيُعاد للطالب: ${refundToStudent.toFixed(2)} ج.م\n(لم يتم تحويل مبلغ للمعلم بعد)\n\nهل تريد المتابعة؟`;

        if (!confirm(confirmMsg)) return;

        const actualStudentId = bk.studentId || studentId;
        const actualTutorId   = bk.tutorId   || null;

        /* ── تنفيذ المعاملة ── */
        await db.runTransaction(async tx => {
          const bkRef = db.collection('bookings').doc(bid);

          /* طالب — إضافة المبلغ */
          const sRef  = db.collection('wallets').doc(actualStudentId);
          const sSnap = await tx.get(sRef);
          const sBal  = sSnap.exists ? Number(sSnap.data().balance || 0) : 0;
          tx.set(sRef, { balance: +(sBal + refundToStudent).toFixed(2), userId: actualStudentId }, { merge: true });

          /* معلم — خصم المبلغ (فقط إذا كان قد استلمه) */
          if (paidToTutor && actualTutorId && deductFromTutor > 0) {
            const tRef  = db.collection('wallets').doc(actualTutorId);
            const tSnap = await tx.get(tRef);
            const tBal  = tSnap.exists ? Number(tSnap.data().balance || 0) : 0;
            const newBal = +(tBal - deductFromTutor).toFixed(2);
            tx.set(tRef, { balance: newBal, userId: actualTutorId }, { merge: true });
          }

          /* تحديث الحجز */
          tx.set(bkRef, {
            status:               'refunded',
            financeState:         paidToTutor ? 'transferred_then_refunded' : 'refunded_before_transfer',
            refundedAt:           firebase.firestore.FieldValue.serverTimestamp(),
            refundToStudentAmt:   +refundToStudent.toFixed(2),
            refundFromTutorAmt:   paidToTutor ? +deductFromTutor.toFixed(2) : 0,
            refundToStudent:      true,
            refundFromTutor:      paidToTutor,
            lastUpdatedAt:        firebase.firestore.FieldValue.serverTimestamp()
          }, { merge: true });
        });

        /* ── سجل معاملات الطالب ── */
        await db.collection('transactions').add({
          userId:      actualStudentId,
          type:        'credit',
          kind:        'refund',
          amount:      +refundToStudent.toFixed(2),
          currency:    'EGP',
          description: paidToTutor
            ? 'استرداد كامل — قرار الإدارة (بعد تحويل المعلم)'
            : 'استرداد — قرار الإدارة',
          bookingId:   bid,
          status:      'completed',
          createdAt:   firebase.firestore.FieldValue.serverTimestamp()
        });

        /* ── سجل معاملات المعلم (إذا كان قد استلم) ── */
        if (paidToTutor && actualTutorId && deductFromTutor > 0) {
          await db.collection('transactions').add({
            userId:      actualTutorId,
            type:        'debit',
            kind:        'refund_deduction',
            amount:      +deductFromTutor.toFixed(2),
            currency:    'EGP',
            description: 'خصم استرداد — قرار الإدارة بإعادة المبلغ للطالب',
            bookingId:   bid,
            status:      'completed',
            createdAt:   firebase.firestore.FieldValue.serverTimestamp()
          }).catch(() => {});
        }

        /* ── إشعار للطالب ── */
        if (actualStudentId) {
          const threadId = actualTutorId
            ? [actualStudentId, actualTutorId].sort().join('_')
            : null;
          if (threadId) {
            db.collection('messages').add({
              threadId,
              senderId:      'system',
              senderName:    'Skillak',
              senderPhoto:   '',
              receiverId:    actualStudentId,
              receiverName:  bk.studentName || '',
              text:          `✅ تم استرداد مبلغ ${refundToStudent.toFixed(2)} ج.م لمحفظتك بقرار من إدارة Skillak.`,
              read:          false,
              isSystemNotif: true,
              bookingId:     bid,
              createdAt:     firebase.firestore.FieldValue.serverTimestamp()
            }).catch(() => {});
          }
        }

        /* ── إشعار للمعلم ── */
        if (paidToTutor && actualTutorId) {
          const threadId = [actualStudentId, actualTutorId].sort().join('_');
          db.collection('messages').add({
            threadId,
            senderId:      'system',
            senderName:    'Skillak',
            senderPhoto:   '',
            receiverId:    actualTutorId,
            receiverName:  bk.tutorName || '',
            text:          `⚠️ تم خصم مبلغ ${deductFromTutor.toFixed(2)} ج.م من محفظتك بقرار استرداد من إدارة Skillak للحجز بتاريخ ${bk.date || ''}.`,
            read:          false,
            isSystemNotif: true,
            bookingId:     bid,
            createdAt:     firebase.firestore.FieldValue.serverTimestamp()
          }).catch(() => {});
        }

        _toast(
          paidToTutor
            ? `✅ تم استرداد ${refundToStudent.toFixed(2)} ج.م للطالب وخصم ${deductFromTutor.toFixed(2)} ج.م من المعلم`
            : `✅ تم استرداد ${refundToStudent.toFixed(2)} ج.م للطالب`,
          'suc'
        );

        /* تحديث عرض الإدارة */
        if (typeof adTab === 'function') {
          adTab('bookings', document.querySelector('.adminTab[onclick*="bookings"]'));
        }

      } catch (e) {
        console.error('[Refund Fix]', e);
        _toast('خطأ في الاسترداد: ' + (e.message || e), 'err');
      }
    };

    /* ══════════════════════════════════════════════════════════
       2. تحسين عرض الحجوزات في لوحة الإدارة
       - إظهار زر "إرجاع للطالب" حتى بعد التحويل
       - تمييز الحالات المالية بألوان واضحة
    ══════════════════════════════════════════════════════════ */
    const _rfx_prevAdTab = window.adTab;
    window.adTab = async function (tab, el) {
      const res = typeof _rfx_prevAdTab === 'function' ? await _rfx_prevAdTab(tab, el) : undefined;
      if (tab === 'bookings') {
        setTimeout(_rfx_enhanceBookingsTable, 350);
      }
      return res;
    };

    function _rfx_enhanceBookingsTable() {
      const tbody = document.querySelector('#adCon table tbody');
      if (!tbody) return;

      /* ── إضافة زر استرداد للصفوف المدفوعة المكتملة ── */
      const rows = tbody.querySelectorAll('tr');
      rows.forEach(row => {
        if (row.querySelector('.rfx-refund-injected')) return;

        const lastTd = row.querySelector('td:last-child');
        if (!lastTd) return;

        /* استخرج bid من الأزرار الموجودة */
        let bid = null, studentId = null, totalAmt = 0;
        row.querySelectorAll('button[onclick]').forEach(btn => {
          const oc = btn.getAttribute('onclick') || '';
          /* adminPayTutor('bid','tutorId',price,fee) */
          const mPay = oc.match(/adminPayTutor\(['"]([^'"]+)['"]/);
          /* adminRefundBk('bid','studentId',amt) */
          const mRef = oc.match(/adminRefundBk\(['"]([^'"]+)['"],\s*['"]([^'"]+)['"],\s*([\d.]+)\)/);
          if (mPay) bid = mPay[1];
          if (mRef) { bid = mRef[1]; studentId = mRef[2]; totalAmt = parseFloat(mRef[3]) || 0; }
        });
        if (!bid) return;

        /* هل تحوّل للمعلم؟ (نلاحظ نص "تم التحويل" أو وجود ✓) */
        const isPaid = !!(
          row.querySelector('[style*="--green"]') ||
          row.textContent.includes('تم التحويل') ||
          row.textContent.includes('✓ تم التحويل')
        );

        /* هل مسترد بالفعل؟ */
        const isRefunded = row.textContent.includes('مسترد') || row.textContent.includes('↩️');

        if (isPaid && !isRefunded && studentId) {
          /* إضافة زر استرداد موضّح */
          const refundBtn = document.createElement('button');
          refundBtn.className = 'btn btn-o btn-xs rfx-refund-injected';
          refundBtn.style.cssText = 'background:linear-gradient(135deg,#dc2626,#b91c1c);color:#fff;border:none;font-weight:700;gap:4px;display:inline-flex;align-items:center';
          refundBtn.innerHTML = '↩️ استرداد للطالب';
          refundBtn.onclick = () => window.adminRefundBk(bid, studentId, totalAmt);
          lastTd.appendChild(refundBtn);
        }

        /* تحديث شارة الحالة إذا كانت مسترد */
        if (isRefunded) {
          const pills = row.querySelectorAll('.pill');
          pills.forEach(p => {
            if (p.textContent.includes('تم التحويل') && !p.textContent.includes('مسترد')) {
              p.textContent = '↩️ مُسترد بعد التحويل';
              p.className = 'pill';
              p.style.cssText = 'background:#fef3c7;color:#b45309;font-weight:700;border:1px solid #fbbf24;border-radius:100px;padding:3px 10px;font-size:.72rem';
            }
          });
        }
      });
    }

    /* ══════════════════════════════════════════════════════════
       3. تحسين عرض حالات الحجز في لوحة تحكم الطالب/المعلم
       - إضافة نص "مسترد بعد التحويل" بدلاً من "مسترد" فقط
    ══════════════════════════════════════════════════════════ */
    const _rfx_origRenderSessions = window.renderSessions;
    if (typeof _rfx_origRenderSessions === 'function') {
      window.renderSessions = function renderSessions(list, role) {
        const result = _rfx_origRenderSessions(list, role);
        /* بعد الرندر نحدث الشارات */
        setTimeout(() => {
          document.querySelectorAll('.pill').forEach(p => {
            if (p.textContent.trim() === '↩️ مسترد') {
              const card = p.closest('[data-bid]');
              if (card) {
                const bkData = list?.find?.(b => b.id === card.dataset.bid);
                if (bkData?.refundFromTutor) {
                  p.textContent = '↩️ مسترد (بعد التحويل)';
                  p.style.background = '#fef3c7';
                  p.style.color = '#b45309';
                }
              }
            }
          });
        }, 200);
        return result;
      };
    }

    /* ══════════════════════════════════════════════════════════
       4. إضافة CSS تحسينات التصميم
    ══════════════════════════════════════════════════════════ */
    const style = document.createElement('style');
    style.id = 'skillak-rfx-styles';
    style.textContent = `
/* ── زر الاسترداد ── */
.rfx-refund-injected {
  margin-top: 4px !important;
  border-radius: 8px !important;
  padding: 5px 11px !important;
  font-size: .75rem !important;
  cursor: pointer;
  transition: transform .15s, opacity .15s;
  white-space: nowrap;
}
.rfx-refund-injected:hover { opacity: .85; transform: scale(1.03); }

/* ── شارة "مسترد بعد التحويل" ── */
.pill-refunded-transferred {
  background: #fef3c7;
  color: #b45309;
  border: 1px solid #fbbf24;
  border-radius: 100px;
  padding: 3px 10px;
  font-size: .72rem;
  font-weight: 700;
  white-space: nowrap;
}

/* ══ تحسينات الاستجابة العامة ══ */

/* ── الجداول في الإدارة ── */
#adCon .dsec { overflow-x: auto; -webkit-overflow-scrolling: touch; }
#adCon table {
  width: 100%;
  border-collapse: collapse;
  font-size: .82rem;
}
#adCon table th {
  background: linear-gradient(135deg, rgba(13,110,117,.12), rgba(13,110,117,.06));
  color: var(--teal, #0d6e75);
  font-weight: 700;
  padding: 10px 12px;
  white-space: nowrap;
  border-bottom: 2px solid rgba(13,110,117,.15);
  position: sticky;
  top: 0;
  z-index: 2;
}
#adCon table td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--border, #e5e7eb);
  vertical-align: middle;
}
#adCon table tr:hover td { background: rgba(13,110,117,.03); }

/* ── صفحة الإدارة على الموبايل ── */
@media (max-width: 768px) {
  #page-admin > div { padding: 18px 4% !important; }
  #page-admin h1.st { font-size: 1.4rem !important; }
  #adCon table th, #adCon table td { padding: 8px 9px !important; font-size: .74rem !important; }
  .adminTab { font-size: .74rem !important; padding: 6px 10px !important; }
}

/* ── بطاقات الجلسات ── */
.bkcard {
  border-radius: 16px;
  border: 1.5px solid var(--border, #e5e7eb);
  padding: 16px;
  transition: box-shadow .2s, border-color .2s;
  background: var(--white, #fff);
}
.bkcard:hover { box-shadow: 0 6px 24px rgba(13,110,117,.1); border-color: rgba(13,110,117,.25); }

/* ── تحسين Hero على الموبايل ── */
@media (max-width: 640px) {
  .hero { padding: 24px 5% 36px !important; }
  .htitle { font-size: 1.9rem !important; line-height: 1.2 !important; }
  .hg { grid-template-columns: 1fr !important; gap: 28px !important; }
  .hfcwrap { display: none !important; }
  .hstats { grid-template-columns: 1fr 1fr !important; gap: 12px !important; }
}

/* ── تحسين صفحة الاستكشاف ── */
@media (max-width: 640px) {
  .tgrid { grid-template-columns: 1fr !important; gap: 14px !important; }
  .exp { padding: 16px 4% !important; }
  .fbar { gap: 10px !important; }
  .fgrp { min-width: unset !important; flex: 1 1 45% !important; }
}

/* ── تحسين لوحة التحكم ── */
@media (max-width: 768px) {
  .dashlay { flex-direction: column !important; }
  .sidebar { width: 100% !important; border-left: none !important; border-bottom: 1.5px solid var(--border) !important; padding: 14px !important; }
  .sbnav { display: flex !important; gap: 8px !important; flex-wrap: wrap !important; overflow-x: auto !important; }
  .sbnavitem { padding: 7px 13px !important; border-radius: 100px !important; white-space: nowrap !important; font-size: .8rem !important; }
  .dashcon { padding: 16px 14px !important; }
}

/* ── تحسين صفحة المحفظة ── */
@media (max-width: 640px) {
  .walwrap { padding: 16px 4% 80px !important; }
  .walcard { padding: 20px 18px !important; }
  .walamt { font-size: 2rem !important; }
  .amt-grid { grid-template-columns: 1fr 1fr !important; gap: 8px !important; }
  .pay-tabs { gap: 6px !important; flex-wrap: wrap !important; }
  .pay-tab { flex: 1 1 calc(50% - 6px) !important; font-size: .75rem !important; padding: 9px 8px !important; }
}

/* ── تحسين الشريط العلوي ── */
@media (max-width: 480px) {
  .navbar { padding: 0 14px !important; height: 54px !important; }
  .logo span { font-size: 1.15rem !important; }
  .nav-r .wchip { padding: 4px 9px !important; font-size: .74rem !important; }
}

/* ── تحسين بطاقات المعلمين ── */
.tc {
  border-radius: 18px;
  overflow: hidden;
  transition: transform .2s, box-shadow .2s;
  background: var(--white, #fff);
  border: 1.5px solid var(--border, #e5e7eb);
}
.tc:hover { transform: translateY(-3px); box-shadow: 0 10px 32px rgba(13,110,117,.13); }

/* ── خلفية بديلة للأقسام ── */
section:nth-child(even) { background: var(--cream, #f9fafb); }

/* ── تحسين الـ steps ── */
@media (max-width: 768px) {
  .steps { grid-template-columns: 1fr !important; max-width: 400px !important; margin: 0 auto !important; }
}

/* ── تحسين الـ modals ── */
@media (max-width: 480px) {
  .modal { margin: 8px !important; border-radius: 18px !important; }
  .mi { padding: 20px 16px !important; }
}

/* ── تحسين صفحة الشات ── */
@media (max-width: 640px) {
  .chatlay { flex-direction: column !important; height: auto !important; min-height: calc(100vh - 54px) !important; }
  .cpanel { width: 100% !important; max-height: 35vh !important; border-left: none !important; border-bottom: 1.5px solid var(--border) !important; }
  .chatwin { flex: 1 !important; }
}

/* ── تحسين لوحة إدارة — الإحصائيات ── */
.srow { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; }
.ad-card {
  background: var(--white, #fff);
  border-radius: 16px;
  padding: 18px 16px;
  border: 1.5px solid var(--border, #e5e7eb);
  text-align: center;
  transition: box-shadow .2s;
}
.ad-card:hover { box-shadow: 0 4px 18px rgba(0,0,0,.07); }
.ad-card .num { font-family: 'Fraunces', serif; font-size: 1.8rem; font-weight: 900; color: var(--teal, #0d6e75); margin: 6px 0; }

/* ── لوحة إدارة — جدول محسّن ── */
@media (max-width: 900px) {
  #adCon table thead { display: none; }
  #adCon table tr {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
    border: 1.5px solid var(--border, #e5e7eb);
    border-radius: 14px;
    padding: 12px;
    margin-bottom: 12px;
    background: var(--white, #fff);
  }
  #adCon table td {
    border: none !important;
    padding: 4px 6px !important;
    font-size: .78rem !important;
  }
  #adCon table td:last-child { grid-column: 1 / -1; }
}

/* ── تأثيرات احترافية ── */
.btn { transition: background .15s, transform .1s, box-shadow .15s !important; }
.btn:active { transform: scale(.97) !important; }

/* ── Splash screen محسّن ── */
.skl-splash-logo img {
  filter: drop-shadow(0 8px 32px rgba(13,110,117,.45));
}

/* ── حالة "مسترد بعد التحويل" في قائمة الحجوزات ── */
.bk-status-refunded-transferred {
  background: linear-gradient(135deg, #fef3c7, #fffbeb);
  color: #92400e;
  border: 1px solid #fbbf24;
  border-radius: 8px;
  padding: 4px 10px;
  font-size: .76rem;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
    `;
    if (!document.getElementById('skillak-rfx-styles')) {
      document.head.appendChild(style);
    }

    console.log('✅ Skillak refund fix patch loaded — v1.0');
  });

  /* ── helper ── */
  function _toast(msg, type) {
    if (typeof showT === 'function') { showT(msg, type); return; }
    if (type === 'err') console.error(msg); else console.log(msg);
  }

})();

/* ===== END patch_fix_refund.js ===== */


/* ===== BEGIN patch_master.js ===== */
/* ════════════════════════════════════════════════════════════════════
   SKILLAK — patch_master.js  v6.0
   ════════════════════════════════════════════════════════════════════
   ملاحظة هامة:
   - الإعلانات (loadDashAnnouncements، Story Viewer) ← skillak_hotfix.js
   - هذا الملف يتولى: Admin Panel + Financial + Auth + Guest Mode
   ════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  function waitFor(fn, cb, ms, n) {
    ms = ms || 150; n = n === undefined ? 100 : n;
    if (fn()) return cb();
    if (!n) return;
    setTimeout(function () { waitFor(fn, cb, ms, n - 1); }, ms);
  }
  function $id(id) { return document.getElementById(id); }
  function showT(m, t) { if (typeof window.showT === 'function') window.showT(m, t); }
  function r2(n) { return Math.round(Number(n || 0) * 100) / 100; }
  function egp(n) { return r2(n).toFixed(2) + ' ج.م'; }
  function esc(v) {
    return String(v || '').replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function fts() { return firebase.firestore.FieldValue.serverTimestamp(); }

  waitFor(
    function () { return typeof firebase !== 'undefined' && typeof db !== 'undefined'; },
    boot
  );

  function boot() {
    patch_calcFees();
    patch_txList();
    patch_tutorEarnings();
    patch_adminPanel();
    patch_go();
    initGuestMode();

    firebase.auth().onAuthStateChanged(function (user) {
      if (user) {
        setTimeout(function () {
          patch_emailPwd();
          patch_chatAvatars();
          startNotifListener(user.uid);
          toggleGuestMode(true, user.uid);
        }, 600);
      } else {
        if (_notifOff) { try { _notifOff(); } catch(e){} _notifOff = null; }
        toggleGuestMode(false, null);
      }
    });

    console.log('[SKL patch_master v6] ✅');
  }

  /* ══════════════════════════════════════════════════════════
     01. إخفاء / إظهار الاستكشاف قبل / بعد تسجيل الدخول
  ══════════════════════════════════════════════════════════ */
  function initGuestMode() { toggleGuestMode(false, null); }

  function toggleGuestMode(loggedIn, uid) {
    var nlEx  = $id('nlExplore');  if (nlEx)  nlEx.style.display  = loggedIn ? '' : 'none';
    var mobEx = $id('mobExplore'); if (mobEx) mobEx.style.display = loggedIn ? '' : 'none';
    var bnEx  = $id('bnExplore');  if (bnEx)  bnEx.style.display  = loggedIn ? '' : 'none';
    var fs    = $id('featSection'); if (fs)   fs.style.display    = loggedIn ? 'block' : 'none';
    var hfc   = $id('heroFloatCards'); if (hfc) hfc.style.display = loggedIn ? 'flex' : 'none';

    if (loggedIn && uid) {
      realtimeBal(uid);
      realtimePhoto(uid);
      /* الإعلانات تُحمَّل من skillak_hotfix.js عبر onAuthStateChanged */
    }
  }

  /* ══════════════════════════════════════════════════════════
     02. patch go() — hooks بدون كسر الأصلي
  ══════════════════════════════════════════════════════════ */
  function patch_go() {
    waitFor(function () { return typeof window.go === 'function'; }, function () {
      var _orig = window.go;
      window.go = function (name) {
        var res = _orig.apply(this, arguments);

        /* لوحة التحكم: اطلب الإعلانات من skillak_hotfix */
        if (name === 'dashboard') {
          /* الإعلانات يُعيد تحميلها skillak_hotfix.js من خلال onSnapshot الحي */
        }

        /* صفحة تعديل الملف: أضف قسم الأمان */
        if (name === 'editProfile') {
          setTimeout(_drawSec, 500);
        }

        return res;
      };
    });
  }

  /* ══════════════════════════════════════════════════════════
     03. تحديث فوري للرصيد وصورة المستخدم
  ══════════════════════════════════════════════════════════ */
  function realtimeBal(uid) {
    db.collection('wallets').doc(uid).onSnapshot(function(sn){
      if(!sn.exists) return;
      var bal = Number(sn.data().balance || 0);
      window.walBal = bal;
      ['nwAmt','wBal','wdBal'].forEach(function(id){
        var el = $id(id); if (!el) return;
        el.textContent = id === 'nwAmt' ? (bal.toFixed(2) + ' ج.م') : bal.toFixed(2);
      });
    }, function(){});
  }

  function realtimePhoto(uid) {
    db.collection('users').doc(uid).onSnapshot(function(sn){
      if(!sn.exists) return;
      var d = sn.data();
      if (window.CP) window.CP = Object.assign({}, window.CP, d);
      var nav = $id('navAv'); if (!nav) return;
      nav.innerHTML = d.photo
        ? '<img src="' + esc(d.photo) + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%">'
        : (d.name ? d.name[0] : '');
    }, function(){});
  }

  /* ══════════════════════════════════════════════════════════
     04. صور المستخدمين في الشات
  ══════════════════════════════════════════════════════════ */
  function patch_chatAvatars() {
    window._sklBubble = function(m, uid) {
      var mine = m.senderId === uid;
      var dt   = (m.createdAt && m.createdAt.toDate) ? m.createdAt.toDate() : new Date();
      var time = dt.toLocaleTimeString('ar', {hour:'2-digit', minute:'2-digit'});
      var tick = mine ? (m.read ? '<span class="rtick" style="color:#53d391">✓✓</span>'
                                : '<span style="color:rgba(0,0,0,.35);font-size:.7rem">✓</span>') : '';
      var photo = '', name = '';
      if (mine) { photo = (window.CP && window.CP.photo) || ''; name = (window.CP && window.CP.name) || ''; }
      else {
        photo = m.senderPhoto || ''; name = m.senderName || '';
        var ku = window.allKnownUsers && window.allKnownUsers[m.senderId];
        if (ku) { if (ku.photo) photo = ku.photo; if (ku.name) name = ku.name; }
      }
      var av = photo
        ? '<img src="' + esc(photo) + '" style="width:34px;height:34px;border-radius:50%;object-fit:cover;flex-shrink:0;border:2px solid rgba(255,255,255,.6)" onerror="this.style.display=\'none\'">'
        : '<div style="width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,#1565c0,#42a5f5);color:#fff;display:flex;align-items:center;justify-content:center;font-size:.78rem;font-weight:800;flex-shrink:0">' + esc((name||'?')[0]) + '</div>';
      var sndLbl = (!mine && name)
        ? '<div class="msender" style="font-size:.72rem;font-weight:700;color:var(--teal);margin-bottom:2px">' + esc(name) + '</div>' : '';
      var imgTag = m.imageUrl
        ? '<img src="' + esc(m.imageUrl) + '" style="max-width:200px;border-radius:10px;margin-bottom:4px;display:block" loading="lazy" onerror="this.style.display=\'none\'">' : '';
      return '<div class="mrow ' + (mine?'mine':'theirs') + '" style="display:flex;align-items:flex-end;gap:7px;' + (mine?'flex-direction:row-reverse':'') + ';margin-bottom:6px">'
        + av + '<div class="mbub ' + (mine?'mine':'theirs') + '">' + sndLbl + imgTag
        + '<div class="mtext">' + esc(m.text||'') + '</div>'
        + '<div class="mtime" style="display:flex;align-items:center;gap:4px;justify-content:flex-end"><span>' + time + '</span>' + tick + '</div>'
        + '</div></div>';
    };
  }

  /* ══════════════════════════════════════════════════════════
     05. الإشعارات الفورية (رسائل + حجوزات)
  ══════════════════════════════════════════════════════════ */
  var _notifOff = null, _notifReady = false;

  function startNotifListener(uid) {
    if (_notifOff) { try { _notifOff(); } catch(e){} _notifOff = null; }
    _notifReady = false;

    /* رسائل شات جديدة */
    var msgReady = false;
    db.collection('messages').where('receiverId','==',uid).where('read','==',false)
      .orderBy('createdAt','desc').limit(50)
      .onSnapshot(function(snap) {
        snap.docChanges().forEach(function(ch){
          if (ch.type !== 'added' || !msgReady) return;
          var m = ch.doc.data();
          if (window.curChatUid === m.senderId) return;
          var nm = m.senderName || 'مستخدم';
          showT('💬 ' + nm + ': ' + (m.text||'').slice(0,55), 'inf');
          _push('💬 ' + nm, (m.text||'').slice(0,80)); _bump();
        });
        msgReady = true;
      }, function(){});

    /* حجوزات جديدة للمعلم */
    var bkReady = false;
    db.collection('bookings').where('tutorId','==',uid).where('status','==','pending')
      .onSnapshot(function(snap){
        snap.docChanges().forEach(function(ch){
          if (ch.type !== 'added' || !bkReady) return;
          var b = ch.doc.data();
          showT('📚 حجز جديد من ' + (b.studentName||'طالب'), 'inf');
          _push('📚 حجز جديد', (b.studentName||'طالب') + ' · ' + (b.date||''));
        });
        bkReady = true;
      }, function(){});
  }

  function _push(title, body) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    try { new Notification(title, {body:body, icon:'./icon-192.png'}); } catch(e){}
  }
  function _bump() {
    var el = $id('msgBadge'); if (!el) return;
    var c = parseInt(el.textContent) || 0;
    el.textContent = (c+1) > 99 ? '99+' : String(c+1);
    el.classList.remove('hidden');
  }

  /* ══════════════════════════════════════════════════════════
     06. تغيير البريد + كلمة المرور
  ══════════════════════════════════════════════════════════ */
  function patch_emailPwd() {
    /* reauth آمن */
    async function reauth(pass) {
      var user = firebase.auth().currentUser;
      if (!user || !user.email) throw new Error('يجب تسجيل الدخول أولاً');
      var Cred = firebase.auth.EmailAuthProvider.credential(user.email, pass);
      await user.reauthenticateWithCredential(Cred);
    }

    window.doChangeEmail = async function () {
      var email = _fv('epNewEmail').trim();
      var pass  = _fv('epCurPwd4Em');
      var msg   = $id('epEmailMsg'), btn = $id('epEmailBtn');
      if (!email.includes('@')) { _fMsg(msg,'أدخل بريدًا إلكترونياً صحيحًا','err'); return; }
      if (!pass) { _fMsg(msg,'أدخل كلمة مرورك الحالية للتحقق','err'); return; }
      _ld(btn,1);
      try {
        await reauth(pass);
        await firebase.auth().currentUser.updateEmail(email);
        await db.collection('users').doc(firebase.auth().currentUser.uid).update({email:email});
        _fMsg(msg,'✅ تم تغيير البريد الإلكتروني','suc');
        showT('✅ تم تغيير البريد الإلكتروني','suc');
        _clr(['epNewEmail','epCurPwd4Em']);
      } catch(e) { _fMsg(msg,'❌ '+_authErr(e),'err'); }
      finally { _ld(btn,0); }
    };

    /* doChangePwd: هذه الدالة تُكتب هنا لكن skillak_hotfix.js قد تكتبها بعدنا */
    /* نتأكد أنها لا تُكسَر بأن skillak_hotfix.js هو المرجع النهائي */
    if (!window._pwdPatched) {
      window._pwdPatched = true;
      window.doChangePwd = async function () {
        var cur = _fv('epCurPwd'), nw = _fv('epNewPwd'), cnf = _fv('epConfPwd');
        var msg = $id('epPwdMsg'), btn = $id('epPwdBtn');
        if (!cur)          { _fMsg(msg,'أدخل كلمة مرورك الحالية','err'); return; }
        if (nw.length < 6) { _fMsg(msg,'كلمة المرور الجديدة 6 أحرف على الأقل','err'); return; }
        if (nw !== cnf)    { _fMsg(msg,'كلمتا المرور غير متطابقتين','err'); return; }
        _ld(btn,1);
        try {
          await reauth(cur);
          await firebase.auth().currentUser.updatePassword(nw);
          _fMsg(msg,'✅ تم تغيير كلمة المرور','suc');
          showT('✅ تم تغيير كلمة المرور','suc');
          _clr(['epCurPwd','epNewPwd','epConfPwd']);
        } catch(e) { _fMsg(msg,'❌ '+_authErr(e),'err'); }
        finally { _ld(btn,0); }
      };
    }

    function _fv(id) { var el=$id(id); return el?el.value:''; }
    function _clr(ids) { ids.forEach(function(id){var el=$id(id);if(el)el.value='';}); }
    function _ld(btn,on) { if(btn){btn.disabled=!!on;btn.textContent=on?'جاري...':(btn.dataset.label||'حفظ');} }
    function _fMsg(el,txt,type) {
      if(!el)return;el.textContent=txt;
      el.style.cssText='display:block;font-size:.82rem;padding:8px 12px;border-radius:10px;margin-bottom:8px;'
        +(type==='suc'?'background:rgba(16,185,129,.1);color:#059669'
          :type==='err'?'background:rgba(239,68,68,.1);color:#dc2626'
          :'background:rgba(21,101,192,.1);color:#1565c0');
      if(type!=='inf')setTimeout(function(){if(el)el.style.display='none';},6000);
    }
    function _authErr(e) {
      return ({
        'auth/wrong-password':'كلمة المرور الحالية غير صحيحة',
        'auth/email-already-in-use':'هذا البريد مستخدم بالفعل',
        'auth/invalid-email':'البريد غير صالح',
        'auth/requires-recent-login':'سجّل الخروج وأعد الدخول ثم حاول مجدداً',
        'auth/too-many-requests':'محاولات كثيرة — انتظر قليلاً',
        'auth/network-request-failed':'تحقق من اتصالك بالإنترنت',
        'auth/invalid-credential':'بيانات الاعتماد غير صحيحة',
      })[e.code] || e.message || 'حدث خطأ';
    }
  }

  /* ── حقن قسم الأمان في صفحة تعديل الملف ── */
  function _drawSec() {
    if ($id('_sklSec')) return;
    var pg = $id('page-editProfile'); if (!pg) return;
    var wrap = pg.querySelector('.editwrap') || pg;
    var sec = document.createElement('div');
    sec.id = '_sklSec'; sec.style.marginTop = '22px';
    sec.innerHTML = `<div class="card">
  <div class="ch"><span class="ct">🔐 الأمان وبيانات الدخول</span></div>
  <div class="cb" style="display:grid;gap:20px">
    <div>
      <div style="font-weight:800;font-size:.92rem;margin-bottom:10px">📧 تغيير البريد الإلكتروني</div>
      <div class="fg"><label>كلمة المرور الحالية (للتحقق) *</label>
        <input type="password" id="epCurPwd4Em" placeholder="أدخل كلمة مرورك الحالية" autocomplete="current-password"/></div>
      <div class="fg"><label>البريد الإلكتروني الجديد *</label>
        <input type="email" id="epNewEmail" placeholder="example@email.com" dir="ltr" autocomplete="email"/></div>
      <div id="epEmailMsg" style="display:none"></div>
      <button id="epEmailBtn" data-label="تغيير البريد" class="btn btn-p btn-sm" onclick="doChangeEmail()">📧 تغيير البريد</button>
    </div>
    <hr style="border:none;border-top:1px solid var(--border)"/>
    <div>
      <div style="font-weight:800;font-size:.92rem;margin-bottom:10px">🔑 تغيير كلمة المرور</div>
      <div class="fg"><label>كلمة المرور الحالية *</label>
        <input type="password" id="epCurPwd" placeholder="كلمة مرورك الحالية" autocomplete="current-password"/></div>
      <div class="fr" style="gap:12px">
        <div class="fg"><label>كلمة المرور الجديدة *</label>
          <input type="password" id="epNewPwd" placeholder="6 أحرف على الأقل" autocomplete="new-password"/></div>
        <div class="fg"><label>تأكيد كلمة المرور *</label>
          <input type="password" id="epConfPwd" placeholder="أعد كلمة المرور" autocomplete="new-password"/></div>
      </div>
      <div id="epPwdMsg" style="display:none"></div>
      <button id="epPwdBtn" data-label="تغيير كلمة المرور" class="btn btn-p btn-sm" onclick="doChangePwd()">🔑 تغيير كلمة المرور</button>
    </div>
  </div>
</div>`;
    wrap.appendChild(sec);
  }

  /* ══════════════════════════════════════════════════════════
     07. calcBookingFees دقيق
  ══════════════════════════════════════════════════════════ */
  function patch_calcFees() {
    window.calcBookingFees = function(price) {
      var base  = Math.max(0, Number(price||0));
      var sRate = Math.max(0, Number(window.studentCommissionRate !== undefined ? window.studentCommissionRate : 5));
      var tRate = Math.max(0, Number(window.tutorCommissionRate   !== undefined ? window.tutorCommissionRate   : 5));
      var sFee  = r2(base * sRate / 100), tFee = r2(base * tRate / 100);
      return { price:base, studentFee:sFee, tutorFee:tFee,
               platformFee:r2(sFee+tFee), totalDue:r2(base+sFee), tutorNet:r2(base-tFee) };
    };
  }

  /* ══════════════════════════════════════════════════════════
     08. سجل المعاملات الكامل
  ══════════════════════════════════════════════════════════ */
  function patch_txList() {
    waitFor(function(){return typeof window.loadTxList==='function';}, function(){
      window.loadTxList = async function() {
        var el = $id('txList'), uid = firebase.auth().currentUser && firebase.auth().currentUser.uid;
        if (!el || !uid) return;
        el.innerHTML = '<div style="padding:28px;text-align:center"><div class="spin" style="margin:0 auto"></div></div>';
        var [ws,txSnap,bk1,bk2] = await Promise.all([
          db.collection('wallets').doc(uid).get().catch(function(){return null;}),
          db.collection('transactions').where('userId','==',uid).orderBy('createdAt','desc').get().catch(function(){return{docs:[]};}),
          db.collection('bookings').where('studentId','==',uid).get().catch(function(){return{docs:[]};}),
          db.collection('bookings').where('tutorId','==',uid).get().catch(function(){return{docs:[]};}),
        ]);
        if (ws&&ws.exists) {
          window.walBal = Number(ws.data().balance||0);
          var wb=$id('wBal');if(wb)wb.textContent=window.walBal.toFixed(2);
          var nw=$id('nwAmt');if(nw)nw.textContent=window.walBal.toFixed(2)+' ج.م';
          var wd=$id('wdBal');if(wd)wd.textContent=window.walBal.toFixed(2)+' ج.م';
        }
        var isTutor = window.CP && ['tutor','both','admin','teacher','معلم'].includes(String(window.CP.role || '').toLowerCase());
        if (typeof window._sklSyncWithdrawVisibility === 'function') window._sklSyncWithdrawVisibility(isTutor);
        else { var wCard = $id('withdrawCard'); if(wCard) wCard.style.display = isTutor ? 'block' : 'none'; }
        if (isTutor && typeof window.loadWdHistory==='function') window.loadWdHistory();

        var allTxs = txSnap.docs.map(function(d){return Object.assign({id:d.id},d.data());});
        var bks = [...bk1.docs,...bk2.docs].map(function(d){return Object.assign({id:d.id},d.data());});
        var sBks = bks.filter(function(b){return b.studentId===uid&&b.status==='completed';});
        var totalIn  = allTxs.filter(function(t){return t.type==='credit'&&String(t.kind||'').toLowerCase()==='topup'&&t.status==='approved';}).reduce(function(s,t){return s+Number(t.amount||0);},0);
        var totalOut = allTxs.filter(function(t){return t.type==='debit'&&String(t.kind||'').toLowerCase()==='withdrawal'&&t.status==='approved';}).reduce(function(s,t){return s+Number(t.amount||0);},0);
        var totalSpend = sBks.reduce(function(s,b){return s+r2(Number(b.totalDue||b.total||(Number(b.price||0)+Number(b.studentFee||b.fee||0))));},0);

        var sumEl = $id('_txSum');
        if (!sumEl) {
          sumEl = document.createElement('div'); sumEl.id = '_txSum';
          sumEl.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-bottom:14px;background:rgba(21,101,192,.05);border:1px solid var(--border);border-radius:16px;padding:14px';
          if (el.parentElement) el.parentElement.insertBefore(sumEl, el);
        }
        sumEl.innerHTML = [{ic:'💳',l:'إجمالي الشحن',v:egp(totalIn)},{ic:'📚',l:'إجمالي الإنفاق',v:egp(totalSpend)},{ic:'🏦',l:'إجمالي السحب',v:egp(totalOut)},{ic:'💰',l:'الرصيد الحالي',v:egp(window.walBal||0)}]
          .map(function(x){return'<div style="text-align:center"><div style="font-size:1.2rem">'+x.ic+'</div><div style="font-family:\'Fraunces\',serif;font-size:1.1rem;font-weight:900">'+x.v+'</div><div style="font-size:.7rem;color:var(--muted);margin-top:2px">'+x.l+'</div></div>';}).join('');

        var rows = [];
        allTxs.filter(function(t){var k=String(t.kind||'').toLowerCase();return k==='topup'||k==='withdrawal';}).forEach(function(t){rows.push(Object.assign({_rt:'tx'},t));});
        sBks.forEach(function(b){var due=r2(Number(b.totalDue||b.total||(Number(b.price||0)+Number(b.studentFee||b.fee||0)))),sFee=r2(Number(b.studentFee||b.fee||0));rows.push({_rt:'bk',type:'debit',kind:'booking',amount:due,price:Number(b.price||0),studentFee:sFee,tutorFee:r2(Number(b.tutorFee||0)),description:'جلسة مع '+esc(b.tutorName||'معلم')+' · '+(b.date||'')+' '+(b.timeLbl||b.time||''),status:'completed',bookingId:b.id,createdAt:b.createdAt});});
        bks.filter(function(b){return b.tutorId===uid&&b.status==='completed'&&(b.adminConfirmed||b.paidToTutorAt);}).forEach(function(b){var tFee=r2(Number(b.tutorFee||b.fee||0));rows.push({_rt:'earn',type:'credit',kind:'earnings',amount:r2(Number(b.price||0)-tFee),price:Number(b.price||0),tutorFee:tFee,description:'أرباح جلسة مع '+esc(b.studentName||'طالب')+' · '+(b.date||''),status:'approved',bookingId:b.id,createdAt:b.createdAt});});
        bks.filter(function(b){return b.tutorId===uid&&b.status==='completed'&&!(b.adminConfirmed||b.paidToTutorAt);}).forEach(function(b){var tFee=r2(Number(b.tutorFee||b.fee||0));rows.push({_rt:'earn_p',type:'credit',kind:'earnings',amount:r2(Number(b.price||0)-tFee),price:Number(b.price||0),tutorFee:tFee,description:'أرباح معلقة · '+esc(b.studentName||'طالب')+' · '+(b.date||''),status:'pending',bookingId:b.id,createdAt:b.createdAt});});
        rows.sort(function(a,b){return((b.createdAt&&b.createdAt.seconds)||0)-((a.createdAt&&a.createdAt.seconds)||0);});
        if (!rows.length) { el.innerHTML='<div class="empty" style="padding:40px"><div class="emptyic">📭</div><p>لا توجد معاملات بعد</p></div>'; return; }
        el.innerHTML = rows.map(function(row){
          var k=String(row.kind||'').toLowerCase(),isIn=row.type==='credit',isPend=row._rt==='earn_p';
          var dt=(row.createdAt&&row.createdAt.toDate)?row.createdAt.toDate().toLocaleDateString('ar-SA',{year:'numeric',month:'short',day:'numeric'}):'—';
          var ic=row._rt==='earn'||row._rt==='earn_p'?'💰':row._rt==='bk'?'📚':(isIn?'💳':'💸');
          var badge=row._rt==='bk'?'<span class="pill pca">✅ مخصوم</span>':row._rt==='earn'?'<span class="pill pc">✅ محوَّل</span>':isPend?'<span class="pill pp">⏳ الإدارة</span>':{pending:'<span class="pill pp">⏳</span>',approved:'<span class="pill pc">✅</span>',rejected:'<span class="pill pca">❌</span>'}[row.status]||'';
          var extra=row._rt==='bk'?'<div style="font-size:.72rem;color:var(--muted);margin-top:2px">سعر: '+egp(row.price)+' + عمولتك: '+egp(row.studentFee)+' = الإجمالي: '+egp(row.amount)+'</div>':row._rt==='earn'||isPend?'<div style="font-size:.72rem;color:var(--muted);margin-top:2px">السعر: '+egp(row.price)+' − عمولتك: '+egp(row.tutorFee)+' = صافيك: '+egp(row.amount)+(isPend?' <span style="color:#f59e0b;font-weight:700">(بانتظار التحويل)</span>':'')+'</div>':'';
          return '<div class="txitem"><div style="display:flex;align-items:center;gap:12px"><div class="txic '+(isIn&&!isPend?'cr':'db')+'" style="font-size:1.1rem">'+ic+'</div><div><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><div style="font-weight:700;font-size:.84rem">'+esc(row.description||'—')+'</div>'+badge+'</div>'+extra+'<div style="font-size:.71rem;color:var(--muted);margin-top:2px">'+dt+'</div></div></div><div style="font-weight:900;font-size:.95rem;'+(isPend?'color:#f59e0b':isIn?'color:var(--green)':'color:var(--red)')+'">'+( isIn&&!isPend?'+':'−')+row.amount.toFixed(2)+' ج.م</div></div>';
        }).join('');
      };
    });
  }

  /* ══════════════════════════════════════════════════════════
     09. أرباح المعلم بعد تأكيد الإدارة
  ══════════════════════════════════════════════════════════ */
  function patch_tutorEarnings() {
    waitFor(function(){return typeof window.rdEarnings==='function';}, function(){
      window.rdEarnings = async function(el) {
        if (!el) return;
        var uid = firebase.auth().currentUser && firebase.auth().currentUser.uid;
        if (!uid) return;
        el.innerHTML = '<div style="padding:28px;text-align:center"><div class="spin" style="margin:0 auto"></div></div>';
        var [bkSnap,ws] = await Promise.all([
          db.collection('bookings').where('tutorId','==',uid).get().catch(function(){return{docs:[]};}) ,
          db.collection('wallets').doc(uid).get().catch(function(){return null;})
        ]);
        var all  = bkSnap.docs.map(function(d){return Object.assign({id:d.id},d.data());});
        var comp = all.filter(function(b){return b.status==='completed';});
        var paid = comp.filter(function(b){return b.adminConfirmed||b.paidToTutorAt;});
        var pend = comp.filter(function(b){return!(b.adminConfirmed||b.paidToTutorAt);});
        var paidNet  = paid.reduce(function(s,b){return s+r2(Number(b.price||0)-Number(b.tutorFee||b.fee||0));},0);
        var pendNet  = pend.reduce(function(s,b){return s+r2(Number(b.price||0)-Number(b.tutorFee||b.fee||0));},0);
        var tFeeSum  = comp.reduce(function(s,b){return s+Number(b.tutorFee||b.fee||0);},0);
        var grossRev = comp.reduce(function(s,b){return s+r2(Number(b.price||0)+Number(b.studentFee||b.fee||0));},0);
        var bal = ws&&ws.exists ? Number(ws.data().balance||0) : 0;
        var sc = function(ic,lbl,v,c){return '<div class="sc"><div class="scic">'+ic+'</div><div class="scval" style="font-size:1.3rem;color:'+(c||'var(--ink)')+'">'+v+'</div><div class="sclbl">'+lbl+'</div></div>';};
        el.innerHTML = '<div class="dashph" style="margin-bottom:20px">💰 الأرباح والإيرادات</div>'
          + (pend.length ? '<div style="background:#fff8e1;border:1px solid #f4d06f;border-radius:14px;padding:12px 16px;margin-bottom:14px;font-size:.83rem;color:#78350f">⚠️ '+pend.length+' جلسة بانتظار تحويل المدير. تُضاف بعد التأكيد.</div>' : '')
          + '<div class="srow" style="margin-bottom:20px">'
          + sc('💵','الإيرادات الإجمالية (ما دفعه الطلاب)',egp(grossRev),'#1565c0')
          + sc('✅','أرباح مُحوَّلة (بعد تأكيد الإدارة)',egp(paidNet),'#059669')
          + sc('⏳','أرباح بانتظار الإدارة',egp(pendNet),'#f59e0b')
          + sc('📉','عمولة المنصة (خُصمت)',egp(tFeeSum),'#ef4444')
          + sc('💳','رصيد المحفظة',egp(bal),'#7c3aed')
          + sc('📊','جلسات مكتملة',comp.length,'')
          + '</div>'
          + '<div style="margin-bottom:18px;display:flex;gap:10px;flex-wrap:wrap">'
          + '<button class="btn btn-p" onclick="dNav(\'withdraw\')" style="background:linear-gradient(135deg,#065f46,#10b981)">🏦 طلب سحب الأرباح</button>'
          + '<button class="btn btn-gh" onclick="go(\'wallet\')">💳 شحن المحفظة</button></div>'
          + '<div class="dsec" style="overflow-x:auto">'
          + (comp.length
              ? '<table class="dtbl"><thead><tr><th>الطالب</th><th>التاريخ</th><th>سعر الجلسة</th><th>عمولة الطالب</th><th>إجمالي الطالب</th><th>عمولة المعلم</th><th>صافي المعلم</th><th>الحالة</th></tr></thead><tbody>'
                + comp.map(function(b){
                    var price=Number(b.price||0),sFee=Number(b.studentFee||b.fee||0),tFee=Number(b.tutorFee||0),net=r2(price-tFee),tot=r2(price+sFee),isPaid=b.adminConfirmed||b.paidToTutorAt;
                    return '<tr><td><strong>'+esc(b.studentName||'—')+'</strong></td>'
                      +'<td style="font-size:.78rem;white-space:nowrap">'+esc(b.date||'—')+'<br><span style="color:var(--muted);font-size:.7rem">'+esc(b.timeLbl||b.time||'')+'</span></td>'
                      +'<td style="font-weight:700">'+egp(price)+'</td><td style="color:#f59e0b">'+egp(sFee)+'</td>'
                      +'<td style="color:var(--red);font-weight:700">'+egp(tot)+'</td><td style="color:#f59e0b">'+egp(tFee)+'</td>'
                      +'<td style="color:var(--green);font-weight:800">'+egp(net)+'</td>'
                      +'<td>'+(isPaid?'<span class="pill pc">✓ مُحوَّل</span>':'<span class="pill pp">⏳ الإدارة</span>')+'</td></tr>';
                  }).join('')
                + '</tbody></table>'
              : '<div style="text-align:center;padding:32px;color:var(--muted)">لا توجد جلسات مكتملة بعد</div>')
          + '</div>';
      };
    });
  }

  /* ══════════════════════════════════════════════════════════
     10. Admin Panel — إعلانات + عمليات مالية
  ══════════════════════════════════════════════════════════ */
  function patch_adminPanel() {

    window.adminConfirmBk = async function(bid) {
      var sn = await db.collection('bookings').doc(bid).get().catch(function(){return null;});
      if (!sn||!sn.exists) { showT('الحجز غير موجود','err'); return; }
      var bk = sn.data();
      if (bk.adminConfirmed||bk.paidToTutorAt) { showT('تم التحويل مسبقاً','err'); return; }
      if (bk.status!=='completed') { showT('الجلسة لم تكتمل','err'); return; }
      var price=Number(bk.price||bk.total||0),tFee=Number(bk.tutorFee||bk.fee||0),net=r2(price-tFee);
      if (!bk.tutorId) { showT('معرّف المعلم مفقود','err'); return; }
      if (net<=0) { showT('المبلغ الصافي يجب أن يكون أكبر من صفر','err'); return; }
      if (!confirm('تحويل '+egp(net)+' لمحفظة المعلم؟\n('+egp(price)+' − عمولة '+egp(tFee)+')')) return;
      try {
        await db.runTransaction(async function(tx) {
          var wRef=db.collection('wallets').doc(bk.tutorId),wSn=await tx.get(wRef);
          var bal=wSn.exists?Number(wSn.data().balance||0):0;
          tx.set(wRef,{balance:r2(bal+net),userId:bk.tutorId},{merge:true});
          tx.update(db.collection('bookings').doc(bid),{adminConfirmed:true,paidToTutorAt:fts()});
        });
        var ts=fts();
        await Promise.all([
          db.collection('transactions').add({userId:bk.tutorId,type:'credit',kind:'earnings',amount:net,description:'أرباح مُعتمدة · '+egp(price)+' − عمولة '+egp(tFee),bookingId:bid,createdAt:ts}),
          db.collection('notifications').add({toUid:bk.tutorId,title:'💰 تم تحويل أرباحك',message:'تم إضافة '+egp(net)+' لمحفظتك',read:false,isAdmin:true,link:'wallet',createdAt:ts}),
        ]);
        showT('✅ تم تحويل '+egp(net)+' لمحفظة المعلم','suc'); _reloadBk();
      } catch(e) { showT('❌ '+e.message,'err'); }
    };

    window.adminRefundBk = async function(bid, studentId, amount) {
      var amt = r2(Number(amount||0));
      if (!confirm('إرجاع '+egp(amt)+' لمحفظة الطالب؟\n(سيُخصم من محفظة المعلم إذا حُوّلت أرباحه)')) return;
      try {
        var bkSnap = await db.collection('bookings').doc(bid).get();
        if (!bkSnap.exists) { showT('الحجز غير موجود','err'); return; }
        var bk = bkSnap.data(), tutorId = bk.tutorId;
        await db.runTransaction(async function(tx) {
          var sRef = db.collection('wallets').doc(studentId);
          var reads = [tx.get(sRef), tx.get(db.collection('bookings').doc(bid))];
          var tRef = tutorId ? db.collection('wallets').doc(tutorId) : null;
          if (tRef) reads.push(tx.get(tRef));
          var results = await Promise.all(reads);
          var sBal = results[0].exists ? Number(results[0].data().balance||0) : 0;
          var tBal = tRef && results[2] && results[2].exists ? Number(results[2].data().balance||0) : 0;
          tx.set(sRef, {balance:r2(sBal+amt),userId:studentId}, {merge:true});
          if (tRef && (bk.adminConfirmed||bk.paidToTutorAt)) {
            var deduct = Math.min(amt, tBal);
            if (deduct>0) tx.set(tRef, {balance:r2(tBal-deduct),userId:tutorId}, {merge:true});
          }
          tx.update(db.collection('bookings').doc(bid), {status:'refunded',adminRefundedAt:fts(),refundAmount:amt});
        });
        var ts = fts();
        var ops = [
          db.collection('transactions').add({userId:studentId,type:'credit',kind:'refund',amount:amt,description:'استرداد بقرار الإدارة · '+egp(amt),bookingId:bid,createdAt:ts}),
          db.collection('notifications').add({toUid:studentId,title:'↩️ استرداد مبلغ',message:'تم إضافة '+egp(amt)+' لمحفظتك',read:false,isAdmin:true,link:'wallet',createdAt:ts}),
        ];
        if (tutorId && (bk.adminConfirmed||bk.paidToTutorAt)) {
          ops.push(db.collection('transactions').add({userId:tutorId,type:'debit',kind:'refund',amount:amt,description:'خصم استرداد للطالب · '+egp(amt),bookingId:bid,createdAt:ts}));
          ops.push(db.collection('notifications').add({toUid:tutorId,title:'📤 خصم استرداد',message:'تم خصم '+egp(amt)+' من محفظتك استرداداً للطالب',read:false,isAdmin:true,createdAt:ts}));
        }
        await Promise.all(ops);
        showT('✅ تم إرجاع '+egp(amt)+' للطالب' + (tutorId&&(bk.adminConfirmed||bk.paidToTutorAt)?' وخصمه من المعلم':''), 'suc');
        _reloadBk();
      } catch(e) { showT('❌ '+e.message,'err'); }
    };

    window.skl_transferToStudent = async function(bid, tutorId, studentId, amount) {
      var amt = r2(Number(amount||0));
      if (!confirm('تحويل '+egp(amt)+' من محفظة المعلم إلى محفظة الطالب؟')) return;
      try {
        await db.runTransaction(async function(tx) {
          var tRef=db.collection('wallets').doc(tutorId), sRef=db.collection('wallets').doc(studentId);
          var [tSn,sSn] = await Promise.all([tx.get(tRef),tx.get(sRef)]);
          var tBal=tSn.exists?Number(tSn.data().balance||0):0, sBal=sSn.exists?Number(sSn.data().balance||0):0;
          if (tBal < amt) throw new Error('رصيد المعلم غير كافٍ ('+egp(tBal)+')');
          tx.set(tRef, {balance:r2(tBal-amt),userId:tutorId}, {merge:true});
          tx.set(sRef, {balance:r2(sBal+amt),userId:studentId}, {merge:true});
          tx.update(db.collection('bookings').doc(bid), {transferredToStudent:true,transferredAt:fts()});
        });
        var ts = fts();
        await Promise.all([
          db.collection('transactions').add({userId:tutorId,type:'debit',kind:'transfer',amount:amt,description:'تحويل إداري للطالب · '+egp(amt),bookingId:bid,createdAt:ts}),
          db.collection('transactions').add({userId:studentId,type:'credit',kind:'transfer',amount:amt,description:'تحويل إداري من المعلم · '+egp(amt),bookingId:bid,createdAt:ts}),
          db.collection('notifications').add({toUid:tutorId,title:'💸 تحويل من رصيدك',message:'تم تحويل '+egp(amt)+' للطالب',read:false,isAdmin:true,createdAt:ts}),
          db.collection('notifications').add({toUid:studentId,title:'💰 تم إضافة رصيد',message:'تم إضافة '+egp(amt)+' من المعلم',read:false,isAdmin:true,createdAt:ts}),
        ]);
        showT('✅ تم تحويل '+egp(amt)+' من المعلم للطالب','suc'); _reloadBk();
      } catch(e) { showT('❌ '+e.message,'err'); }
    };

    /* لوحة إدارة الإعلانات */
    window.renderAdminAnnouncements = function() {
      var con = $id('adCon');
      if (!con) return;
      con.innerHTML = '<div style="padding:40px;text-align:center"><div class="spin" style="margin:0 auto"></div></div>';

      Promise.all([
        db.collection('users').get().catch(function(){return{docs:[]};}) ,
        db.collection('adminBroadcasts').orderBy('createdAt','desc').limit(30).get().catch(function(){return{docs:[]};})
      ]).then(function(res){
        var users    = res[0].docs.map(function(d){return Object.assign({id:d.id},d.data());});
        var prevList = res[1].docs.map(function(d){return Object.assign({id:d.id},d.data());});
        var tutors   = users.filter(function(u){return u.role==='tutor'||u.role==='both';});
        var students = users.filter(function(u){return u.role==='learner'||u.role==='both';});

        con.innerHTML = '<div style="max-width:960px;margin:0 auto">'

          /* Header */
          + '<div style="background:linear-gradient(135deg,#0a1a3a,#0d47a1,#1565c0);border-radius:20px;padding:22px 26px;margin-bottom:22px;display:flex;align-items:center;gap:16px;color:#fff">'
          + '<div style="width:56px;height:56px;border-radius:50%;background:rgba(249,115,22,.28);border:2px solid rgba(249,115,22,.6);display:flex;align-items:center;justify-content:center;font-size:1.5rem;flex-shrink:0">📢</div>'
          + '<div><div style="font-weight:900;font-size:1.1rem">مركز الإعلانات الرسمية</div>'
          + '<div style="opacity:.75;font-size:.82rem;margin-top:2px">'+users.length+' مستخدم · '+tutors.length+' معلم · '+students.length+' طالب</div></div>'
          + '</div>'

          /* نموذج إنشاء */
          + '<div style="background:var(--white,#fff);border:1px solid var(--border,#ddd);border-radius:20px;padding:24px;margin-bottom:20px">'
          + '<div style="font-weight:800;font-size:.95rem;margin-bottom:18px;display:flex;align-items:center;gap:8px"><span>✍️</span> إنشاء إعلان جديد</div>'
          + '<div style="display:grid;gap:14px">'
          + _fld('text','_annTitle','عنوان الإعلان *','مثال: تحديث مهم في المنصة')
          + _fld('textarea','_annBody','محتوى الإعلان *','تفاصيل الإعلان...',4)
          + _fld('url','_annImg','🖼️ رابط صورة (اختياري)','https://example.com/image.jpg')
          + _fld('url','_annLink','🔗 رابط خارجي (اختياري)','https://...')
          + '<div><label style="font-weight:700;font-size:.82rem;display:block;margin-bottom:10px">📌 إرسال إلى</label>'
          + '<div style="display:flex;gap:10px;flex-wrap:wrap">'
          + [{v:'all',l:'الجميع',cnt:users.length,ic:'👥',c:'#1565c0'},{v:'tutor',l:'المعلمون',cnt:tutors.length,ic:'👨‍🏫',c:'#059669'},{v:'learner',l:'الطلاب',cnt:students.length,ic:'👩‍🎓',c:'#f97316'}]
            .map(function(t){
              return '<label onclick="_annTarget=\''+t.v+'\';document.querySelectorAll(\'._aTL\').forEach(function(x){x.style.outline=\'none\'});this.style.outline=\'2.5px solid '+t.c+'\'" class="_aTL" style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:10px 16px;border:1.5px solid var(--border,#ddd);border-radius:12px;font-size:.85rem;background:var(--cream,#f4f7fc);flex:1;min-width:110px">'
                +'<span>'+t.ic+'</span><div><div style="font-weight:700">'+t.l+'</div>'
                +'<div style="font-size:.72rem;color:'+t.c+';font-weight:700">'+t.cnt+' مستخدم</div></div></label>';
            }).join('')
          + '</div></div></div>'
          + '<div style="margin-top:16px;display:flex;gap:10px;align-items:center">'
          + '<button onclick="sklSendAnn()" class="btn btn-p" id="_annSendBtn" style="min-width:160px;font-weight:800">📤 إرسال الإعلان</button>'
          + '<button onclick="[\'_annTitle\',\'_annBody\',\'_annImg\',\'_annLink\'].forEach(function(id){var el=document.getElementById(id);if(el)el.value=\'\'})" class="btn btn-gh">🗑 مسح</button>'
          + '</div>'
          + '<div id="_annMsg" style="display:none;margin-top:12px;padding:10px 14px;border-radius:10px;font-size:.83rem"></div>'
          + '</div>'

          /* جدول سجل الإعلانات */
          + '<div style="background:var(--white,#fff);border:1px solid var(--border,#ddd);border-radius:20px;overflow:hidden">'
          + '<div style="padding:16px 22px;border-bottom:1px solid var(--border,#ddd);display:flex;align-items:center;justify-content:space-between">'
          + '<div style="font-weight:800;font-size:.95rem">📋 سجل الإعلانات</div>'
          + '<span style="background:rgba(21,101,192,.1);color:#1565c0;border-radius:20px;padding:2px 12px;font-size:.75rem;font-weight:700">'+prevList.length+'</span></div>'
          + (prevList.length
            ? '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse"><thead><tr style="background:var(--cream,#f4f7fc)">'
              + ['العنوان','المحتوى','الفئة','المُرسَل إليهم','الصورة','التاريخ','حذف'].map(function(h){return '<th style="padding:10px 14px;text-align:right;font-weight:700;font-size:.78rem;white-space:nowrap">'+h+'</th>';}).join('')
              + '</tr></thead><tbody>'
              + prevList.map(function(n,i){
                  var dt=n.createdAt&&n.createdAt.toDate?n.createdAt.toDate().toLocaleDateString('ar-EG',{year:'numeric',month:'short',day:'numeric'}):'—';
                  var tc={'all':'#1565c0','tutor':'#059669','learner':'#f97316'}[n.target]||'#666';
                  var tl={'all':'الجميع','tutor':'المعلمون','learner':'الطلاب'}[n.target]||n.target||'—';
                  return '<tr style="border-top:1px solid var(--border,#ddd);'+(i%2?'background:var(--cream,#f4f7fc)':'')+'"><td style="padding:12px 14px;font-weight:700;font-size:.84rem;max-width:160px">'+esc(n.title||'—')+'</td><td style="padding:12px 14px;font-size:.79rem;color:var(--muted,#888);max-width:220px">'+esc((n.message||'').slice(0,90))+'</td><td style="padding:12px 14px;text-align:center"><span style="background:'+tc+'22;color:'+tc+';border-radius:20px;padding:3px 10px;font-size:.74rem;font-weight:700">'+esc(tl)+'</span></td><td style="padding:12px 14px;text-align:center;font-weight:800;color:#1565c0">'+(n.sentCount||0)+'</td><td style="padding:12px 14px;text-align:center">'+(n.imageUrl?'<img src="'+esc(n.imageUrl)+'" style="width:40px;height:40px;object-fit:cover;border-radius:8px" onerror="this.style.display=\'none\'">':'<span style="color:#aaa;font-size:.75rem">—</span>')+'</td><td style="padding:12px 14px;font-size:.77rem;color:#888;white-space:nowrap">'+esc(dt)+'</td><td style="padding:12px 14px;text-align:center"><button onclick="sklDelAnn(\''+n.id+'\',this)" style="background:rgba(239,68,68,.1);color:#ef4444;border:none;border-radius:8px;padding:5px 10px;cursor:pointer;font-size:.75rem;font-family:inherit">🗑</button></td></tr>';
                }).join('')
              + '</tbody></table></div>'
            : '<div style="text-align:center;padding:48px;color:#aaa"><div style="font-size:2.5rem;margin-bottom:10px">📭</div><p>لا توجد إعلانات سابقة</p></div>')
          + '</div></div>';

        window._annTarget = 'all';
      }).catch(function(e){
        if(con) con.innerHTML='<div style="padding:24px;color:red">خطأ: '+esc(e.message)+'</div>';
      });
    };

    /* إرسال إعلان جديد — يُكتب في adminBroadcasts مباشرةً */
    window.sklSendAnn = async function() {
      var titleEl=$id('_annTitle'), bodyEl=$id('_annBody'), imgEl=$id('_annImg'), linkEl=$id('_annLink');
      var msgEl=$id('_annMsg'), sendBtn=$id('_annSendBtn');
      var title  = titleEl ? titleEl.value.trim() : '';
      var body   = bodyEl  ? bodyEl.value.trim()  : '';
      var imgUrl = imgEl   ? imgEl.value.trim()   : '';
      var lnk    = linkEl  ? linkEl.value.trim()  : '';
      var target = String(window._annTarget || 'all').toLowerCase();
      if (target === 'everyone' || target === 'public') target = 'all';
      if (!title) { _annMsg(msgEl,'أدخل عنوان الإعلان','err'); return; }
      if (!body)  { _annMsg(msgEl,'أدخل محتوى الإعلان','err'); return; }

      /* عدد المستخدمين المستهدفين للإحصاء */
      var uSnap = await db.collection('users').get().catch(function(){return{docs:[]};});
      var cnt = uSnap.docs.filter(function(d){
        var u=d.data();
        if(target==='all')return true;
        if(target==='tutor')return u.role==='tutor'||u.role==='both';
        if(target==='learner')return u.role==='learner'||u.role==='both';
        return false;
      }).length;

      if (sendBtn) { sendBtn.disabled=true; sendBtn.textContent='⏳ جاري الإرسال...'; }
      _annMsg(msgEl,'⏳ يتم الإرسال...','inf');
      try {
        await db.collection('adminBroadcasts').add({
          title:title, message:body, imageUrl:imgUrl||'', link:lnk||'',
          target:target, audience:target, to:target, group:target, sentCount:cnt,
          sentBy: firebase.auth().currentUser && firebase.auth().currentUser.uid,
          active: true,
          createdAt: fts()
        });
        _annMsg(msgEl,'✅ تم نشر الإعلان لـ '+cnt+' مستخدم','suc');
        showT('✅ الإعلان أُرسل','suc');
        if(titleEl)titleEl.value=''; if(bodyEl)bodyEl.value='';
        if(imgEl)imgEl.value=''; if(linkEl)linkEl.value='';
        setTimeout(window.renderAdminAnnouncements, 1400);
      } catch(e) { _annMsg(msgEl,'❌ '+e.message,'err'); }
      finally { if(sendBtn){sendBtn.disabled=false;sendBtn.textContent='📤 إرسال الإعلان';} }
    };

    /* حذف إعلان */
    window.sklDelAnn = async function(id, btn) {
      if (!confirm('حذف هذا الإعلان من الإدارة وجميع المستخدمين؟')) return;
      if (btn) btn.disabled = true;
      try {
        await db.collection('adminBroadcasts').doc(id).delete();
        showT('تم الحذف','suc'); setTimeout(window.renderAdminAnnouncements, 600);
      } catch(e) { showT('خطأ: '+e.message,'err'); if(btn) btn.disabled=false; }
    };

    /* تاب الإعلانات في Admin */
    waitFor(function(){return typeof window.adTab==='function';}, function(){
      var _orig = window.adTab;
      window.adTab = async function(tab, el) {
        if (tab === 'announcements') {
          document.querySelectorAll('.adminTab').forEach(function(t){t.className='btn btn-gh btn-sm adminTab';});
          if (el) el.className = 'btn btn-p btn-sm adminTab';
          window.renderAdminAnnouncements(); return;
        }
        var res = await _orig.apply(this, arguments);
        if (tab === 'bookings') setTimeout(_injectTransferBtns, 150);
        return res;
      };
    });

    function _fld(type,id,lbl,ph,rows) {
      var inp = type==='textarea'
        ? '<textarea id="'+id+'" rows="'+(rows||3)+'" placeholder="'+esc(ph)+'" style="width:100%;padding:11px 14px;border-radius:12px;border:1.5px solid var(--border,#ddd);font-size:.88rem;font-family:inherit;background:var(--cream,#f4f7fc);resize:vertical;line-height:1.6;box-sizing:border-box"></textarea>'
        : '<input type="'+type+'" id="'+id+'" placeholder="'+esc(ph)+'" '+(type==='url'?'dir="ltr"':'')+' style="width:100%;padding:11px 14px;border-radius:12px;border:1.5px solid var(--border,#ddd);font-size:.9rem;font-family:inherit;background:var(--cream,#f4f7fc);box-sizing:border-box"/>';
      return '<div><label style="font-weight:700;font-size:.82rem;display:block;margin-bottom:6px">'+esc(lbl)+'</label>'+inp+'</div>';
    }
    function _annMsg(el,txt,type) {
      if(!el) return; el.textContent=txt;
      var s={suc:'background:rgba(16,185,129,.1);color:#059669',err:'background:rgba(239,68,68,.1);color:#dc2626',inf:'background:rgba(21,101,192,.1);color:#1565c0'};
      el.style.cssText='display:block;padding:10px 14px;border-radius:10px;font-size:.83rem;margin-top:12px;'+(s[type]||s.inf);
      if(type!=='inf') setTimeout(function(){if(el)el.style.display='none';},5000);
    }
  }

  function _injectTransferBtns() {
    document.querySelectorAll('[onclick*="adminConfirmBk"]').forEach(function(btn){
      if (btn.dataset.tInj) return; btn.dataset.tInj='1';
      var m=btn.getAttribute('onclick').match(/adminConfirmBk\('([^']+)'\)/); if(!m) return;
      var bid=m[1], tb=document.createElement('button');
      tb.className='btn btn-o btn-xs'; tb.style.marginRight='4px'; tb.textContent='↔ للطالب';
      tb.title='تحويل مبلغ من محفظة المعلم للطالب';
      tb.onclick = async function() {
        var bkSn = await db.collection('bookings').doc(bid).get().catch(function(){return null;});
        if (!bkSn||!bkSn.exists) { showT('الحجز غير موجود','err'); return; }
        var bk = bkSn.data();
        var inp = prompt('المبلغ (ج.م):', r2(Number(bk.totalDue||bk.total||bk.price||0)).toString());
        if (inp===null) return;
        var amt = parseFloat(inp);
        if (isNaN(amt)||amt<=0) { showT('مبلغ غير صحيح','err'); return; }
        window.skl_transferToStudent(bid, bk.tutorId, bk.studentId, amt);
      };
      btn.parentNode.insertBefore(tb, btn.nextSibling);
    });
  }

  function _reloadBk() {
    if (typeof window.adTab === 'function')
      window.adTab('bookings', document.querySelector('.adminTab[onclick*="bookings"]') || document.querySelector('.adminTab'));
  }

})();

/* ===== END patch_master.js ===== */


/* ===== BEGIN skillak_hotfix.js ===== */
/* ══════════════════════════════════════════════════════════════════════
   skillak_hotfix.js — v5.0  (نظيف — بدون تكرار)
   ══════════════════════════════════════════════════════════════════════
   - الإعلانات ثابتة أعلى لوحة التحكم (sklAnnBar فوق dashlay في HTML)
   - تُحمَّل من adminBroadcasts مباشرةً عبر onSnapshot حي
   - تظهر فقط بعد تسجيل الدخول
   - doFgt / doChangePwd / p4ChangeEmail مُصلَّحة
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ─── UTIL ────────────────────────────────────────────────────── */
  function byId(id) { return document.getElementById(id); }
  function esc(v) {
    return String(v||'').replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function showToast(msg, type) {
    if (typeof window.showT === 'function') window.showT(msg, type);
  }
  function waitFor(fn, cb, ms, n) {
    ms = ms||120; n = n===undefined?120:n;
    if (fn()) return cb();
    if (!n) return;
    setTimeout(function(){ waitFor(fn,cb,ms,n-1); }, ms);
  }
  function currentUser() {
    return window.firebase && window.firebase.auth && window.firebase.auth().currentUser;
  }



function normalizeTarget(v) {
  v = String(v || 'all').trim().toLowerCase();
  if (['all', 'everyone', 'any', 'public', 'الجميع', 'الكل', 'عام', 'عامة'].includes(v)) return 'all';
  if (['tutor', 'teacher', 'teachers', 'معلم', 'المعلم', 'المعلمين', 'معلمون', 'مدرس', 'المدرسين'].includes(v)) return 'tutor';
  if (['learner', 'student', 'students', 'طلاب', 'الطلاب', 'متعلم', 'المتعلمين', 'متعلمين', 'دارس', 'الدارسين'].includes(v)) return 'learner';
  return v;
}

function normalizeRole(v) {
  v = String(v || '').trim().toLowerCase();
  if (['teacher', 'teachers', 'tutor', 'معلم', 'مدرس', 'المعلم'].includes(v)) return 'tutor';
  if (['student', 'students', 'learner', 'طلاب', 'الطلاب', 'متعلم', 'المتعلم'].includes(v)) return 'learner';
  if (['both', 'dual', 'combined', 'learner/tutor', 'tutor/learner', 'معلم/طالب', 'طالب/معلم', 'الاثنان'].includes(v)) return 'both';
  if (['admin', 'manager', 'administrator', 'مدير', 'الإدارة'].includes(v)) return 'admin';
  return v;
}

function currentRole() {
  var u = currentUser();
  var raw = (window.CP && (window.CP.role || window.CP.userType || window.CP.type)) || (u && u.role) || '';
  return normalizeRole(raw);
}

function getBroadcastTarget(item) {
  return normalizeTarget(
    item && (
      item.target ||
      item.audience ||
      item.to ||
      item.group ||
      item.recipient ||
      item.toRole ||
      item.targetRole ||
      item.role ||
      item.for ||
      item.visibility ||
      'all'
    )
  );
}

function roleMatchesTarget(role, target) {
  role = normalizeRole(role);
  target = normalizeTarget(target);
  if (!role) return false;
  if (role === 'admin') return true;
  if (target === 'all') return true;
  if (target === 'tutor') return role === 'tutor' || role === 'both';
  if (target === 'learner') return role === 'learner' || role === 'both';
  return true;
}

function shouldShowBroadcast(item) {
  return roleMatchesTarget(currentRole(), getBroadcastTarget(item));
}

function normalizeImageUrl(url) {
  url = String(url || '').trim();
  if (!url) return '';
  if (url.startsWith('data:image/')) return url;
  if (url.startsWith('blob:')) return url;
  if (/drive\.google\.com|docs\.google\.com/.test(url)) {
    var m = url.match(/\/d\/([a-zA-Z0-9_-]+)/)
      || url.match(/[?&]id=([a-zA-Z0-9_-]+)/)
      || url.match(/\/uc\?id=([a-zA-Z0-9_-]+)/)
      || url.match(/\/thumbnail\?id=([a-zA-Z0-9_-]+)/)
      || url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (m && m[1]) return 'https://drive.google.com/thumbnail?id=' + m[1] + '&sz=w1600';
  }
  if (/lh3\.googleusercontent\.com|googleusercontent\.com/.test(url)) return url;
  if (/dropbox\.com/.test(url)) return url.replace('?dl=0', '?raw=1');
  if (url.startsWith('gs://')) return '';
  return url.replace(/\s/g, '%20');
}

function getBroadcastImage(item) {
  var raw = item && (
    item.imageUrl || item.image || item.photo || item.img || item.mediaUrl ||
    item.banner || item.cover || item.picture || item.poster || item.thumb || ''
  );
  return normalizeImageUrl(raw);
}


  /* ─── ANNOUNCEMENT BAR ────────────────────────────────────────── */
  var _annUnsub = null;
  var _annItems = [];
  var _annRole = '';
  var _storyIdx = 0;

  function _norm(v) {
    return String(v || '').trim().toLowerCase();
  }

  function _currentRole() {
    if (window.CP && window.CP.role) return _norm(window.CP.role);
    if (_annRole) return _annRole;
    return '';
  }

  function _isTutorLike(role) {
    role = _norm(role);
    return ['tutor', 'both', 'admin', 'teacher', 'معلم', 'معلم/طالب'].includes(role);
  }

  function _isLearnerLike(role) {
    role = _norm(role);
    return ['learner', 'both', 'admin', 'student', 'متعلم', 'طالب'].includes(role);
  }

  function _matchesTarget(target, role) {
    target = _norm(target) || 'all';
    role = _norm(role);
    if (target === 'all') return true;
    if (target === 'tutor') return _isTutorLike(role);
    if (target === 'learner') return _isLearnerLike(role);
    return true;
  }

  function _resolveAnnImage(url) {
    var u = String(url || '').trim();
    if (!u) return '';
    if (/^data:image\//i.test(u)) return u;
    // Firebase Storage — direct, no proxy needed
    if (/firebasestorage\.googleapis\.com/i.test(u)) return u;
    // Same-origin or relative — no proxy needed
    if (u.startsWith('/') || u.startsWith(window.location.origin)) return u;

    // Google Drive — extract file ID, build canonical thumbnail URL
    var m = u.match(/\/file\/d\/([a-zA-Z0-9_-]+)/i)
          || u.match(/[?&]id=([a-zA-Z0-9_-]+)/i)
          || u.match(/\/d\/([a-zA-Z0-9_-]+)/i);
    if (m && m[1] && /drive\.google\.com/i.test(u)) {
      var driveUrl = 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(m[1]) + '&sz=w800';
      return '/api/img-proxy?url=' + encodeURIComponent(driveUrl);
    }

    // Dropbox
    if (/dropbox\.com/i.test(u)) {
      var dbUrl = u.replace(/\?dl=0/i, '?raw=1').replace(/\?dl=1/i, '?raw=1');
      return '/api/img-proxy?url=' + encodeURIComponent(dbUrl);
    }

    // Any other external image — proxy it to avoid CORS
    if (/^https?:\/\//i.test(u)) {
      return '/api/img-proxy?url=' + encodeURIComponent(u);
    }

    return u;
  }

  function _safeImgHtml(url, cls) {
    if (!url) return '<div class="' + cls + ' is-fallback"></div>';
    return '<img class="' + cls + '-img" src="' + esc(url) + '" alt=""'
      + ' loading="lazy" referrerpolicy="no-referrer" crossorigin="anonymous"'
      + ' onerror="var p=this.parentElement;this.remove();if(p&&p.classList)p.classList.add(\'is-fallback\')">';
  }

  function initAnnouncements(uid) {
    if (_annUnsub) { try { _annUnsub(); } catch(_){} _annUnsub = null; }

    function startListener() {
      _annUnsub = db.collection('adminBroadcasts')
        .orderBy('createdAt', 'desc')
        .limit(20)
        .onSnapshot(function(snap) {
          _annItems = snap.docs.map(function(d){ return Object.assign({ id: d.id }, d.data()); });
          renderAnnBar();
        }, function(err) {
          console.warn('[Skillak] announcements error:', err.message || err);
        });
    }

    if (_currentRole()) {
      startListener();
      return;
    }

    if (uid) {
      db.collection('users').doc(uid).get().then(function(s) {
        if (s.exists && s.data() && s.data().role) _annRole = _norm(s.data().role);
        startListener();
        renderAnnBar();
      }).catch(function() {
        startListener();
      });
      return;
    }

    startListener();
  }

  function renderAnnBar() {
    var bar = byId('sklAnnBar');
    if (!bar) return;

    var role = _currentRole();
    if (!role) {
      bar.style.display = 'none';
      window._sklAnnItems = [];
      return;
    }

    var items = _annItems.filter(function(item) {
      return _matchesTarget(item.target, role);
    });

    if (!items.length) {
      bar.style.display = 'none';
      bar.innerHTML = '';
      window._sklAnnItems = [];
      return;
    }

    window._sklAnnItems = items;
    bar.className = 'skl-ann-bar';
    bar.style.cssText = [
      'display:block',
      'width:100%',
      'padding:0',
      'box-sizing:border-box',
      'background:transparent'
    ].join(';');

    var unread = items.length;

    bar.innerHTML =
      '<section class="skl-ann-shell">'
      + '<div class="skl-ann-head">'
      +   '<div class="skl-ann-title-wrap">'
      +     '<div class="skl-ann-ic">📢</div>'
      +     '<div style="min-width:0">'
      +       '<div class="skl-ann-title">الإعلانات</div>'
      +       '<div class="skl-ann-sub">آخر التحديثات والتنبيهات المهمة</div>'
      +     '</div>'
      +   '</div>'
      +   (unread ? '<span class="skl-ann-badge">' + unread + ' إعلان</span>' : '')
      + '</div>'
      + '<div class="skl-ann-track">'
      +   items.map(function(item, idx) {
          var img = _resolveAnnImage(item.imageUrl || item.image || item.img || item.photo || item.cover || '');
          var targetLabel = ({all:'الجميع', tutor:'المعلمون', learner:'الطلاب'})[_norm(item.target)] || 'الجميع';
          var dt = item.createdAt && item.createdAt.toDate ? item.createdAt.toDate().toLocaleDateString('ar-EG', { year:'numeric', month:'short', day:'numeric' }) : '';
          var mediaClass = img ? 'skl-ann-media' : 'skl-ann-media is-fallback';
          var cardClick = item.link
            ? 'window.open(\'' + esc(item.link).replace(/'/g,"\\'") + '\',\'_blank\',\'noopener,noreferrer\');event.stopPropagation()'
            : '_sklOpenStory(' + idx + ')';
          return '<article class="skl-ann-card" onclick="' + cardClick + '" style="cursor:pointer">'
            + (img ? '<div class="' + mediaClass + '">' + _safeImgHtml(img, 'skl-ann-media') + '</div>' : '<div class="' + mediaClass + '"></div>')
            + '<div class="skl-ann-overlay">'
            +   '<div class="skl-ann-topline">'
            +     '<span class="skl-ann-chip">' + esc(targetLabel) + '</span>'
            +     (dt ? '<span class="skl-ann-date">' + esc(dt) + '</span>' : '')
            +   '</div>'
            +   '<div class="skl-ann-card-title">' + esc(item.title || 'إعلان رسمي') + '</div>'
            +   '<div class="skl-ann-card-text">' + esc(String(item.message || '').slice(0, 140)) + '</div>'
            +   (item.link ? '<a class="skl-ann-link" href="' + esc(item.link) + '" target="_blank" rel="noopener" onclick="event.stopPropagation()">🔗 معرفة المزيد</a>' : '')
            + '</div>'
            + '</article>';
        }).join('')
      + '</div>'
      + '</section>';
  }

  window.refreshAnnouncements = renderAnnBar;

  /* ── تخزين الإعلانات المقروءة في localStorage ── */
  function _getReadSet() {
    try { return JSON.parse(localStorage.getItem('_sklAnnRead') || '{}'); } catch(_) { return {}; }
  }
  function _saveReadSet(obj) {
    try { localStorage.setItem('_sklAnnRead', JSON.stringify(obj)); } catch(_){}
  }

  window._sklOpenStory = window.sklOpenStory = function(idx) {
    _storyIdx = idx || 0;
    var v = byId('sklStoryViewer');
    if (!v) return;
    v.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    _renderStory();

    var items = window._sklAnnItems || _annItems;
    if (items[_storyIdx]) {
      var s = _getReadSet(); s[items[_storyIdx].id] = true; _saveReadSet(s);
    }
  };

  window.sklCloseStory = function() {
    var v = byId('sklStoryViewer');
    if (v) v.style.display = 'none';
    document.body.style.overflow = '';
    document.onkeydown = null;
  };

  window.sklStoryNav = function(dir) {
    var items = window._sklAnnItems || _annItems;
    if (!items.length) return;
    _storyIdx = (_storyIdx + dir + items.length) % items.length;
    _renderStory();
  };

  function _renderStory() {
    var items = window._sklAnnItems || _annItems;
    if (!items.length) { window.sklCloseStory(); return; }

    var item = items[_storyIdx];
    var prog = byId('sklStoryProg');
    var con  = byId('sklStoryContent');
    if (!prog || !con) return;

    var img = _resolveAnnImage(item.imageUrl || item.image || item.img || item.photo || item.cover || '');
    var dt  = item.createdAt && item.createdAt.toDate
      ? item.createdAt.toDate().toLocaleDateString('ar-EG', { year:'numeric', month:'long', day:'numeric' }) : '';
    var targetLabel = ({all:'الجميع', tutor:'المعلمون', learner:'الطلاب'})[_norm(item.target)] || 'الجميع';

    prog.innerHTML = items.map(function(_, i) {
      return '<div class="skl-story-seg ' + (i === _storyIdx ? 'is-active' : (i < _storyIdx ? 'is-done' : '')) + '"></div>';
    }).join('');

    con.innerHTML =
      '<div class="skl-story-shell">'
      +   '<div class="skl-story-media ' + (img ? '' : 'is-fallback') + '">' 
      +     (img ? '<img class="skl-story-img" src="' + esc(img) + '" alt="" loading="eager" referrerpolicy="no-referrer" crossorigin="anonymous" onerror="var p=this.parentElement;this.remove();if(p&&p.classList)p.classList.add(\'is-fallback\')">' : '')
      +   '</div>'
      +   '<div class="skl-story-body">'
      +     '<div class="skl-story-meta">'
      +       '<span class="skl-story-chip">' + esc(targetLabel) + '</span>'
      +       (dt ? '<span class="skl-story-date">' + esc(dt) + '</span>' : '')
      +     '</div>'
      +     '<h3 class="skl-story-title">' + esc(item.title || '') + '</h3>'
      +     '<div class="skl-story-text">' + esc(item.message || '') + '</div>'
      +     (item.link ? '<a href="' + esc(item.link) + '" target="_blank" rel="noopener" class="skl-story-link">🔗 معرفة المزيد</a>' : '')
      +   '</div>'
      + '</div>';

    document.onkeydown = function(e) {
      var v = byId('sklStoryViewer');
      if (!v || v.style.display === 'none') return;
      if (e.key === 'ArrowLeft')  window.sklStoryNav(1);
      if (e.key === 'ArrowRight') window.sklStoryNav(-1);
      if (e.key === 'Escape')     window.sklCloseStory();
    };

    var sx = null;
    con.ontouchstart = function(e){ sx = e.touches[0].clientX; };
    con.ontouchend = function(e){
      if (sx === null) return;
      var dx = e.changedTouches[0].clientX - sx;
      if (Math.abs(dx) > 50) window.sklStoryNav(dx > 0 ? 1 : -1);
      sx = null;
    };
  }

  /* ─── PASSWORD RESET (doFgt) ──────────────────────────────────── */
  /* ─── PASSWORD RESET (doFgt) ──────────────────────────────────── */  /* ─── PASSWORD RESET (doFgt) ──────────────────────────────────── */
  window.doFgt = async function () {
    try {
      var emailEl = byId('liE');
      var email = emailEl ? emailEl.value.trim() : '';

      if (!email || !email.includes('@')) {
        var prompted = prompt('أدخل بريدك الإلكتروني لإرسال رابط إعادة تعيين كلمة المرور:');
        if (!prompted) return;
        email = prompted.trim();
        if (!email.includes('@')) { showToast('أدخل بريدًا صحيحًا', 'err'); return; }
        if (emailEl) emailEl.value = email;
      }

      var fgtBtn = byId('fgtBtn');
      if (fgtBtn) { fgtBtn.style.pointerEvents = 'none'; fgtBtn.textContent = '⏳ جاري الإرسال...'; }

      await firebase.auth().sendPasswordResetEmail(email);

      showToast('✅ تم إرسال رابط إعادة التعيين إلى ' + email, 'suc');

      /* أظهر رسالة نجاح في الـ modal */
      var msgEl = byId('liMsg');
      if (msgEl) {
        msgEl.textContent = '📧 تم إرسال رابط إعادة تعيين كلمة المرور إلى ' + email;
        msgEl.style.cssText = 'display:block;color:#059669;background:rgba(16,185,129,.1);padding:10px 14px;border-radius:10px;font-size:.83rem;margin-top:8px';
      }
    } catch (e) {
      var map = {
        'auth/user-not-found'       : 'لا يوجد حساب بهذا البريد الإلكتروني',
        'auth/invalid-email'        : 'البريد الإلكتروني غير صالح',
        'auth/too-many-requests'    : 'محاولات كثيرة — انتظر دقيقة',
        'auth/network-request-failed': 'تحقق من الاتصال بالإنترنت',
      };
      var msg = map[e.code] || e.message || 'حدث خطأ';
      showToast('❌ ' + msg, 'err');
    } finally {
      var fgtBtn2 = byId('fgtBtn');
      if (fgtBtn2) { fgtBtn2.style.pointerEvents = ''; fgtBtn2.textContent = 'نسيت كلمة المرور؟'; }
    }
  };

  /* ─── CHANGE PASSWORD (doChangePwd) ──────────────────────────── */
  window.doChangePwd = async function () {
    var cur  = _fv('epCurPwd');
    var nw   = _fv('epNewPwd');
    var cnf  = _fv('epConfPwd');
    var msg  = byId('epPwdMsg');
    var btn  = byId('epPwdBtn');

    if (!cur)          { _showMsg(msg,'أدخل كلمة مرورك الحالية','err'); return; }
    if (nw.length < 6) { _showMsg(msg,'كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل','err'); return; }
    if (nw !== cnf)    { _showMsg(msg,'كلمتا المرور الجديدتان غير متطابقتين','err'); return; }

    _setBtnLoad(btn, true, 'تغيير كلمة المرور');
    try {
      await _reauth(cur);
      await firebase.auth().currentUser.updatePassword(nw);
      _showMsg(msg,'✅ تم تغيير كلمة المرور بنجاح','suc');
      showToast('✅ تم تغيير كلمة المرور','suc');
      _clearFields(['epCurPwd','epNewPwd','epConfPwd']);
    } catch(e) {
      _showMsg(msg,'❌ ' + _authErr(e),'err');
    } finally {
      _setBtnLoad(btn, false, 'تغيير كلمة المرور');
    }
  };

  /* ─── CHANGE EMAIL (doChangeEmail) ───────────────────────────── */
  window.doChangeEmail = async function () {
    var email = _fv('epNewEmail').trim();
    var pass  = _fv('epCurPwd4Em');
    var msg   = byId('epEmailMsg');
    var btn   = byId('epEmailBtn');

    if (!email.includes('@')) { _showMsg(msg,'أدخل بريدًا إلكترونياً صحيحًا','err'); return; }
    if (!pass) { _showMsg(msg,'أدخل كلمة مرورك الحالية للتحقق','err'); return; }

    _setBtnLoad(btn, true, 'تغيير البريد');
    try {
      await _reauth(pass);
      await firebase.auth().currentUser.updateEmail(email);
      await db.collection('users').doc(firebase.auth().currentUser.uid).update({email:email});
      _showMsg(msg,'✅ تم تغيير البريد الإلكتروني بنجاح','suc');
      showToast('✅ تم تغيير البريد الإلكتروني','suc');
      _clearFields(['epNewEmail','epCurPwd4Em']);
    } catch(e) {
      _showMsg(msg,'❌ ' + _authErr(e),'err');
    } finally {
      _setBtnLoad(btn, false, 'تغيير البريد');
    }
  };

  /* ─── AUTH HELPERS ────────────────────────────────────────────── */
  async function _reauth(pass) {
    var user = firebase.auth().currentUser;
    if (!user || !user.email) throw new Error('يجب تسجيل الدخول أولاً');
    var Cred = firebase.auth.EmailAuthProvider.credential(user.email, pass);
    await user.reauthenticateWithCredential(Cred);
  }

  function _fv(id)  { var el=byId(id); return el?el.value:''; }
  function _clearFields(ids) { ids.forEach(function(id){var el=byId(id);if(el)el.value='';}); }
  function _setBtnLoad(btn, on, label) {
    if (!btn) return;
    btn.disabled = !!on;
    btn.textContent = on ? 'جاري...' : (label || btn.dataset.label || 'حفظ');
  }
  function _showMsg(el, txt, type) {
    if (!el) return;
    el.textContent = txt;
    el.style.cssText = 'display:block;font-size:.82rem;padding:8px 12px;border-radius:10px;margin-bottom:8px;'
      + (type==='suc' ? 'background:rgba(16,185,129,.1);color:#059669'
         : type==='err' ? 'background:rgba(239,68,68,.1);color:#dc2626'
         : 'background:rgba(21,101,192,.1);color:#1565c0');
    if (type !== 'inf') setTimeout(function(){if(el)el.style.display='none';}, 6000);
  }
  function _authErr(e) {
    return ({
      'auth/wrong-password'        : 'كلمة المرور الحالية غير صحيحة',
      'auth/email-already-in-use'  : 'هذا البريد مستخدم بالفعل',
      'auth/invalid-email'         : 'البريد الإلكتروني غير صالح',
      'auth/requires-recent-login' : 'سجّل الخروج وأعد الدخول ثم حاول',
      'auth/too-many-requests'     : 'محاولات كثيرة — انتظر قليلاً',
      'auth/network-request-failed': 'تحقق من اتصالك بالإنترنت',
      'auth/invalid-credential'    : 'بيانات الاعتماد غير صحيحة',
      'auth/user-not-found'        : 'لا يوجد حساب بهذا البريد',
    })[e.code] || e.message || 'حدث خطأ';
  }

  /* ─── BOOT ────────────────────────────────────────────────────── */
  waitFor(
    function(){ return typeof firebase !== 'undefined' && typeof db !== 'undefined'; },
    function() {
      firebase.auth().onAuthStateChanged(function(user) {
        if (user) {
          initAnnouncements(user.uid);
          setTimeout(renderAnnBar, 450);
          setTimeout(renderAnnBar, 1200);
        } else {
          if (_annUnsub) { try{_annUnsub();}catch(_){} _annUnsub=null; }
          var bar = byId('sklAnnBar');
          if (bar) bar.style.display = 'none';
        }
      });
    }
  );

  /* عرّف window.loadDashAnnouncements للتوافق مع patch_master */
  window.loadDashAnnouncements = function(uid) {
    /* لا شيء — initAnnouncements يعمل تلقائياً عبر onAuthStateChanged */
    setTimeout(renderAnnBar, 250);
  };

  window.refreshAnnouncements = function() {
    renderAnnBar();
  };

  setInterval(function () {
    if (_annItems.length) renderAnnBar();
  }, 2500);

})();

/* ===== END skillak_hotfix.js ===== */


/* ===== BEGIN skillak_ads_top_fix.js ===== */
/* ══════════════════════════════════════════════════════
   skillak_ads_top_fix.js — v2 (stub)
   الإصلاح الحقيقي صار في index.html:
   sklAnnBar خارج dashCon مباشرةً في HTML
   → لا نحتاج نقله بعد الآن
   ══════════════════════════════════════════════════════ */
(function () {
  'use strict';
  /* لا شيء هنا — إصلاح موضع sklAnnBar صار في HTML مباشرةً */
  /* هذا الملف محفوظ فقط لأن sw.js يخزّنه في الكاش */
  console.log('[Skillak] skillak_ads_top_fix: stub — bar position fixed in HTML');
})();

/* ===== END skillak_ads_top_fix.js ===== */


/* ===== BEGIN ultra_pro_v3.js ===== */

// ===== SKILLAK ULTRA PRO V3 =====

(function(){

  // تحسين ظهور العناصر
  function animate(){
    document.querySelectorAll('.card,.tc,.profsec,.bksb,.tc2').forEach((el,i)=>{
      if(!el.classList.contains('fade-up')){
        setTimeout(()=>{
          el.classList.add('fade-up');
        },i*40);
      }
    });
  }

  window.addEventListener('load',animate);

  // تحسين الصور
  document.querySelectorAll('img').forEach(img=>{
    img.loading='lazy';
    img.decoding='async';
  });

  // إزالة التكرارات في الهاتف
  function removeDuplicateBlocks(){
    if(window.innerWidth > 768) return;

    const ids = new Set();

    document.querySelectorAll('[id]').forEach(el=>{
      if(ids.has(el.id)){
        el.remove();
      }else{
        ids.add(el.id);
      }
    });
  }

  removeDuplicateBlocks();

  // تحسين الضغط على الأزرار
  document.querySelectorAll('.btn').forEach(btn=>{
    btn.addEventListener('click',()=>{
      btn.style.transform='scale(.96)';

      setTimeout(()=>{
        btn.style.transform='';
      },150);
    });
  });

})();

/* ===== END ultra_pro_v3.js ===== */


/* ===== BEGIN next_level_v4.js ===== */

// ===== SKILLAK NEXT LEVEL V4 =====

(function(){

  // تحسين الأداء البصري
  const reveal = () => {
    document.querySelectorAll('.tc,.card,.profsec').forEach(el=>{
      const rect = el.getBoundingClientRect();

      if(rect.top < window.innerHeight - 80){
        el.style.opacity = '1';
        el.style.transform = 'translateY(0)';
      }
    });
  };

  document.querySelectorAll('.tc,.card,.profsec').forEach(el=>{
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    el.style.transition = 'all .5s ease';
  });

  window.addEventListener('scroll', reveal);
  window.addEventListener('load', reveal);

  // تحسين الإحساس كتطبيق
  if(window.innerWidth < 768){
    document.body.style.webkitTapHighlightColor='transparent';
  }

  // تحسين الـtoast — safe wrapper
  const oldShowT = window.showT;

  if(oldShowT){
    window.showT = function(msg,type){
      try { oldShowT(msg,type); } catch(_) {
        // oldShowT crashed (toast element not in DOM yet) — already handled internally
      }
      setTimeout(()=>{
        try {
          const t = document.querySelector('.toast,.tst,.notify');
          if(t){
            t.style.backdropFilter='blur(18px)';
            t.style.border='1px solid rgba(255,255,255,.12)';
          }
        } catch(_) {}
      },20);
    }
  }

})();

/* ===== END next_level_v4.js ===== */


/* ===== BEGIN elite_v5.js ===== */

// ===== SKILLAK ELITE V5 =====

(function(){

  // تحسين الأداء
  const optimizeImages = ()=>{
    document.querySelectorAll('img').forEach(img=>{
      img.loading='lazy';
      img.decoding='async';
    });
  };

  optimizeImages();

  // تأثير عند التمرير
  const observer = new IntersectionObserver(entries=>{
    entries.forEach(entry=>{
      if(entry.isIntersecting){
        entry.target.style.opacity='1';
        entry.target.style.transform='translateY(0)';
      }
    });
  },{
    threshold:.08
  });

  document.querySelectorAll('.tc,.card,.profsec,.tc2').forEach(el=>{
    el.style.opacity='0';
    el.style.transform='translateY(25px)';
    el.style.transition='all .55s ease';
    observer.observe(el);
  });

  // تحسين تجربة التطبيق
  if(window.innerWidth < 768){
    document.body.classList.add('mobile-app-mode');
  }

  // إصلاح overflow
  document.querySelectorAll('*').forEach(el=>{
    if(el.scrollWidth > window.innerWidth + 40){
      el.style.maxWidth='100%';
    }
  });

  // تحسين التنقل
  window.addEventListener('load',()=>{
    window.scrollTo(0,0);
  });

})();

/* ===== END elite_v5.js ===== */


/* ===== BEGIN ultimate_v6.js ===== */

// ===== SKILLAK ULTIMATE V6 =====

(function(){

  // تحسين الحركة عند الدخول
  const elements = document.querySelectorAll('.card,.tc,.profsec,.step,.cc,.tc2');

  const io = new IntersectionObserver((entries)=>{
    entries.forEach(entry=>{
      if(entry.isIntersecting){
        entry.target.style.opacity='1';
        entry.target.style.transform='translateY(0)';
      }
    });
  },{
    threshold:.08
  });

  elements.forEach((el,i)=>{
    el.style.opacity='0';
    el.style.transform='translateY(30px)';
    el.style.transition='all .6s cubic-bezier(.22,1,.36,1)';
    io.observe(el);
  });

  // تحسين الصور
  document.querySelectorAll('img').forEach(img=>{
    img.loading='lazy';
    img.decoding='async';

    img.addEventListener('error',()=>{
      img.style.opacity='.4';
    });
  });

  // تحسين اللمس على الهاتف
  if(window.innerWidth < 768){

    document.querySelectorAll('.btn,.card,.tc').forEach(el=>{
      el.style.webkitTapHighlightColor='transparent';
    });

  }

  // تحسين الـscroll
  let lastY = window.scrollY;

  window.addEventListener('scroll',()=>{
    const nav = document.querySelector('.navbar');

    if(!nav) return;

    if(window.scrollY > 20){
      nav.style.boxShadow='0 8px 30px rgba(0,0,0,.12)';
    }else{
      nav.style.boxShadow='';
    }

    lastY = window.scrollY;
  });

  // تحسين التحميل
  window.addEventListener('load',()=>{
    document.body.classList.add('app-loaded');
  });

})();

/* ===== END ultimate_v6.js ===== */
