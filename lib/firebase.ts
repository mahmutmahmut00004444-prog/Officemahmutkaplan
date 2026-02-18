
import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

// ⚠️ هام جداً:
// يجب عليك الذهاب إلى Firebase Console -> Project Settings -> General
// ونسخ إعدادات "SDK setup and configuration" ولصقها هنا بدلاً من القيم الفارغة.
// الـ service_account.json الذي أرسلته سابقاً هو للسيرفر فقط، أما هذا الكود فهو للمتصفح ويحتاج Config مختلف.

const firebaseConfig = {
  apiKey: "YOUR_API_KEY_HERE", // استبدل هذا
  authDomain: "officemtk-5fdb8.firebaseapp.com",
  projectId: "officemtk-5fdb8",
  storageBucket: "officemtk-5fdb8.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID_HERE", // استبدل هذا
  appId: "YOUR_APP_ID_HERE" // استبدل هذا
};

let messaging: any = null;

try {
  // التحقق من أننا في بيئة المتصفح قبل التهيئة
  if (typeof window !== 'undefined') {
    const app = initializeApp(firebaseConfig);
    messaging = getMessaging(app);
  }
} catch (error) {
  console.error("Firebase initialization failed:", error);
}

export { messaging };

// دالة طلب الإذن والحصول على التوكن
export const requestForToken = async () => {
  if (!messaging) return null;
  try {
    const currentToken = await getToken(messaging, { 
      // يفضل إضافة VAPID Key هنا من إعدادات Cloud Messaging > Web configuration
      // vapidKey: 'YOUR_VAPID_KEY' 
    });
    
    if (currentToken) {
      console.log('FCM Token:', currentToken);
      // ملاحظة: في تطبيق حقيقي، يجب إرسال هذا التوكن إلى قاعدة البيانات لربطه بالمستخدم
      return currentToken;
    } else {
      console.log('No registration token available. Request permission to generate one.');
      return null;
    }
  } catch (err) {
    console.log('An error occurred while retrieving token. ', err);
    return null;
  }
};

// دالة الاستماع للرسائل أثناء فتح التطبيق
export const onMessageListener = () =>
  new Promise((resolve) => {
    if (!messaging) return;
    onMessage(messaging, (payload) => {
      resolve(payload);
    });
  });
