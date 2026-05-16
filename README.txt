Skillak-Hub — نسخة منظمة مع جلسات Google Meet

الهيكل:
- index.html
- manifest.webmanifest
- sw.js
- assets/styles/main.css
- assets/scripts/main.js
- assets/scripts/meet-session.js
- server.js
- package.json
- icon-192.png
- icon-512.png
- skillak.png

ملاحظات:
- تم الاحتفاظ بالنظام القديم كنسخة احتياطية في حال لم يتم تشغيل السيرفر.
- نظام Google Meet يحتاج تشغيل server.js مع بيانات OAuth الخاصة بـ Google Workspace.
- إذا لم يكن السيرفر/الاعتماد جاهزًا، يعود المشروع تلقائيًا إلى سلوك الجلسات القديم.
