
import React, { useEffect, useState } from 'react';

const UpdatePrompt: React.FC = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [lastChecked, setLastChecked] = useState(Date.now());

  useEffect(() => {
    // لا تقم بالتفعيل في وضع التطوير لتجنب التحديثات المستمرة
    if ((import.meta as any).env.DEV) return;

    // دالة لاستخراج مسار السكربت الرئيسي من النص HTML
    const getMainScriptSrc = (html: string) => {
      // يبحث عن نمط Vite الافتراضي في الإنتاج: <script ... src="/assets/index-HASH.js">
      const match = html.match(/src="(\/assets\/index-[^"]+\.js)"/);
      return match ? match[1] : null;
    };

    const checkVersion = async () => {
      try {
        // جلب ملف index.html من السيرفر مع كسر الكاش
        const response = await fetch(`/?t=${Date.now()}`, { cache: 'no-store' });
        const newHtml = await response.text();
        
        // الحصول على السكربت من السيرفر
        const newScript = getMainScriptSrc(newHtml);
        
        // الحصول على السكربت الحالي من الصفحة
        const currentScriptTag = document.querySelector('script[src*="/assets/index-"]');
        const currentScript = currentScriptTag ? currentScriptTag.getAttribute('src') : null;

        // إذا وجدنا سكربت جديد ومختلف عن الحالي، نظهر النافذة
        if (newScript && currentScript && newScript !== currentScript) {
          console.log('Update detected:', { current: currentScript, new: newScript });
          setUpdateAvailable(true);
        }
      } catch (error) {
        console.error('Failed to check for updates:', error);
      }
    };

    // التحقق فوراً عند تحميل المكون
    checkVersion();

    // التحقق كل دقيقة
    const interval = setInterval(checkVersion, 60 * 1000);

    // التحقق عند عودة التركيز للنافذة (مثلاً المستخدم عاد للتبويب بعد فترة)
    const handleFocus = () => {
        if (Date.now() - lastChecked > 60000) { // تجنب التكرار السريع
            checkVersion();
            setLastChecked(Date.now());
        }
    };
    
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [lastChecked]);

  const handleUpdate = () => {
    // تفريغ الكاش وإعادة التحميل بقوة
    if ('caches' in window) {
      caches.keys().then((names) => {
        names.forEach((name) => {
          caches.delete(name);
        });
      });
    }
    window.location.reload();
  };

  if (!updateAvailable) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/95 backdrop-blur-md p-4 animate-scale-up">
      <div className="bg-white p-8 rounded-[2.5rem] w-full max-w-md text-center border-4 border-red-600 shadow-2xl relative overflow-hidden">
        {/* تأثيرات خلفية */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-red-50 rounded-bl-full -mr-10 -mt-10 opacity-50"></div>
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-orange-50 rounded-tr-full -ml-10 -mb-10 opacity-50"></div>
        
        <div className="relative z-10">
            <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner animate-bounce">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg>
            </div>
            
            <h2 className="text-2xl font-black text-slate-900 mb-4">هناك تحديث جديد</h2>
            <div className="bg-red-50 p-4 rounded-2xl border border-red-100 mb-8">
              <p className="text-red-700 font-bold text-sm leading-relaxed">
              تم إجراء تغييرات هامة على النظام.
              <br />
              <span className="font-black text-red-800 underline decoration-wavy">يجب تحديث الصفحة الآن لمتابعة العمل.</span>
              </p>
            </div>

            <button 
            onClick={handleUpdate}
            className="w-full py-5 bg-red-600 text-white rounded-2xl font-black text-xl shadow-xl shadow-red-200 hover:bg-red-700 active:scale-95 transition-all flex items-center justify-center gap-3"
            >
            <span>تحديث الصفحة الآن</span>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </button>
            
            <p className="text-[10px] text-slate-400 font-bold mt-6">سيتم إعادة تحميل النظام بأحدث نسخة</p>
        </div>
      </div>
    </div>
  );
};

export default UpdatePrompt;
