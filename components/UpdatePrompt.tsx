
import React, { useEffect, useState } from 'react';

const UpdatePrompt: React.FC = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [lastChecked, setLastChecked] = useState(Date.now());
  const [countdown, setCountdown] = useState(60); // 60 seconds countdown
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);

  useEffect(() => {
    // Check if we just updated
    const wasUpdated = sessionStorage.getItem('app_updated_flag');
    if (wasUpdated === 'true') {
      setShowSuccessMessage(true);
      sessionStorage.removeItem('app_updated_flag');
      // Hide success message after 5 seconds
      setTimeout(() => setShowSuccessMessage(false), 5000);
    }

    if ((import.meta as any).env.DEV) return;

    const getMainScriptSrc = (html: string) => {
      const match = html.match(/src="(\/assets\/index-[^"]+\.js)"/);
      return match ? match[1] : null;
    };

    const checkVersion = async () => {
      try {
        const response = await fetch(`/?t=${Date.now()}`, { cache: 'no-store' });
        const newHtml = await response.text();
        const newScript = getMainScriptSrc(newHtml);
        const currentScriptTag = document.querySelector('script[src*="/assets/index-"]');
        const currentScript = currentScriptTag ? currentScriptTag.getAttribute('src') : null;

        if (newScript && currentScript && newScript !== currentScript) {
          console.log('Update detected:', { current: currentScript, new: newScript });
          setUpdateAvailable(true);
        }
      } catch (error) {
        console.error('Failed to check for updates:', error);
      }
    };

    checkVersion();
    const interval = setInterval(checkVersion, 60 * 1000);

    const handleFocus = () => {
        if (Date.now() - lastChecked > 60000) { 
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

  // Handle Countdown and Auto-Update
  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    if (updateAvailable && countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    } else if (updateAvailable && countdown === 0) {
      handleUpdate();
    }
    return () => clearInterval(timer);
  }, [updateAvailable, countdown]);

  const handleUpdate = () => {
    if ('caches' in window) {
      caches.keys().then((names) => {
        names.forEach((name) => {
          caches.delete(name);
        });
      });
    }
    sessionStorage.setItem('app_updated_flag', 'true');
    window.location.reload();
  };

  return (
    <>
      {/* Update Available Modal with Countdown */}
      {updateAvailable && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/95 backdrop-blur-md p-4 animate-scale-up">
          <div className="bg-white p-8 rounded-[2.5rem] w-full max-w-md text-center border-4 border-red-600 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-red-50 rounded-bl-full -mr-10 -mt-10 opacity-50"></div>
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-orange-50 rounded-tr-full -ml-10 -mb-10 opacity-50"></div>
            
            <div className="relative z-10">
                <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner animate-bounce">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg>
                </div>
                
                <h2 className="text-2xl font-black text-slate-900 mb-2">تحديث إجباري</h2>
                <div className="bg-red-50 p-4 rounded-2xl border border-red-100 mb-6">
                  <p className="text-red-700 font-bold text-sm leading-relaxed">
                  تم اكتشاف تحديثات هامة في النظام.
                  <br />
                  <span className="font-black text-red-800">سيتم تحديث التطبيق تلقائياً خلال:</span>
                  </p>
                  <div className="text-4xl font-black text-red-600 mt-2">{countdown}</div>
                  <p className="text-[10px] text-red-400 font-bold">ثانية</p>
                </div>

                <button 
                onClick={handleUpdate}
                className="w-full py-4 bg-red-600 text-white rounded-2xl font-black text-lg shadow-xl shadow-red-200 hover:bg-red-700 active:scale-95 transition-all flex items-center justify-center gap-3"
                >
                <span>تحديث الآن فوراً</span>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Message After Update */}
      {showSuccessMessage && (
        <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-[10000] animate-scale-up">
          <div className="bg-emerald-600 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 border-2 border-emerald-400">
            <div className="bg-white text-emerald-600 rounded-full p-1">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <div>
              <p className="font-black text-sm">تم تحديث التطبيق بنجاح</p>
              <p className="text-[10px] font-bold text-emerald-100">أنت تستخدم أحدث نسخة من النظام الآن</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default UpdatePrompt;
