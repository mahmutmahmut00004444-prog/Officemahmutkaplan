
/* eslint-disable no-undef */
// هذا الملف يعمل في الخلفية لاستقبال الإشعارات عند إغلاق التطبيق
importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-messaging.js');

// ⚠️ يجب وضع نفس الإعدادات الموجودة في lib/firebase.ts هنا أيضاً
firebase.initializeApp({
  apiKey: "YOUR_API_KEY_HERE",
  authDomain: "officemtk-5fdb8.firebaseapp.com",
  projectId: "officemtk-5fdb8",
  storageBucket: "officemtk-5fdb8.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID_HERE",
  appId: "YOUR_APP_ID_HERE"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/icon.png' // تأكد من وجود أيقونة بهذا الاسم في public
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
