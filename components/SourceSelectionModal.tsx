
import React, { useEffect, useState } from 'react';
import { BookingSource } from '../types';

interface SourceSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  sources: BookingSource[];
  onSelectSource: (sourceId: string | null) => void;
  title: string;
}

const SourceSelectionModal: React.FC<SourceSelectionModalProps> = ({
  isOpen,
  onClose,
  sources,
  onSelectSource,
  title,
}) => {
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.classList.add('overflow-hidden');
    } else {
      document.removeEventListener('keydown', handleEscape);
      document.body.classList.remove('overflow-hidden');
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.classList.remove('overflow-hidden');
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-scale-up" onClick={onClose}>
      <div className="bg-white p-6 rounded-[2rem] w-full max-w-md flex flex-col text-center border-2 border-slate-900 shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-xl font-black mb-4 text-slate-900">{title}</h3>
        <p className="text-slate-500 font-bold text-sm mb-4">يرجى تحديد المصدر الذي تم رفع المعاملة عليه</p>

        <div className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto custom-scrollbar mb-6 p-1">
          <button
            onClick={() => setSelectedSourceId(null)}
            className={`w-full text-right px-4 py-3 rounded-xl transition-all border-2 ${selectedSourceId === null ? 'bg-slate-800 text-white border-slate-800' : 'bg-slate-50 text-slate-700 border-slate-200'}`}
          >
            <span className="font-black text-sm">بدون مصدر (رفع عام)</span>
          </button>
          
          {sources.map((source) => (
            <button
              key={source.id}
              onClick={() => setSelectedSourceId(source.id)}
              className={`w-full text-right px-4 py-3 rounded-xl transition-all border-2 ${selectedSourceId === source.id ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-700 border-slate-200'}`}
            >
              <span className="font-black text-sm">{source.sourceName}</span>
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <button onClick={() => onSelectSource(selectedSourceId)} className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-black shadow-lg active:scale-95 transition-all">تأكيد الرفع</button>
          <button onClick={onClose} className="flex-1 bg-slate-100 text-slate-500 py-3 rounded-xl font-black">إلغاء</button>
        </div>
      </div>
    </div>
  );
};

export default SourceSelectionModal;
