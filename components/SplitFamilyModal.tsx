
import React, { useState } from 'react';
import { FamilyMember } from '../types';

interface SplitFamilyModalProps {
  isOpen: boolean;
  onClose: () => void;
  members: FamilyMember[];
  currentHeadName: string;
  onConfirm: (selectedMemberIds: string[], newHeadId: string) => void;
  isProcessing: boolean;
}

const SplitFamilyModal: React.FC<SplitFamilyModalProps> = ({
  isOpen,
  onClose,
  members,
  currentHeadName,
  onConfirm,
  isProcessing
}) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [newHeadId, setNewHeadId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleToggleMember = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
      if (newHeadId === id) setNewHeadId(null);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleSetHead = (id: string) => {
    if (!selectedIds.has(id)) {
        // If selecting as head, automatically select for move
        const newSet = new Set(selectedIds);
        newSet.add(id);
        setSelectedIds(newSet);
    }
    setNewHeadId(id);
  };

  const isValid = selectedIds.size > 0 && newHeadId !== null && selectedIds.has(newHeadId);

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-scale-up" onClick={onClose}>
      <div className="bg-white p-6 rounded-[2.5rem] w-full max-w-lg border-2 border-slate-900 shadow-2xl relative flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
        <div className="text-center mb-6">
            <h3 className="text-2xl font-black text-slate-900">قسم العائلة</h3>
            <p className="text-sm font-bold text-slate-500 mt-1">العائلة الحالية: <span className="text-blue-600">{currentHeadName}</span></p>
            <p className="text-xs font-bold text-slate-400 mt-2 bg-yellow-50 p-2 rounded-xl border border-yellow-200">
                ⚠️ اختر الأفراد المراد نقلهم، ثم حدد من سيكون <u>رئيس العائلة الجديد</u> للسجل المنفصل.
            </p>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2 mb-6">
            {members.length === 0 ? (
                <p className="text-center text-slate-400 font-bold">لا يوجد أفراد في هذه العائلة للقسم.</p>
            ) : (
                members.map(member => (
                    <div 
                        key={member.id} 
                        className={`p-3 rounded-xl border-2 transition-all flex items-center justify-between ${selectedIds.has(member.id) ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-100'}`}
                    >
                        <div className="flex items-center gap-3">
                            <input 
                                type="checkbox" 
                                checked={selectedIds.has(member.id)} 
                                onChange={() => handleToggleMember(member.id)}
                                className="w-5 h-5 accent-indigo-600 rounded-lg cursor-pointer"
                            />
                            <div>
                                <p className="font-black text-xs text-slate-800">{member.fullName}</p>
                                <p className="text-[10px] text-slate-500">{member.relationship} | {member.dob}</p>
                            </div>
                        </div>
                        
                        {selectedIds.has(member.id) && (
                            <button 
                                onClick={() => handleSetHead(member.id)}
                                className={`text-[10px] px-3 py-1.5 rounded-lg font-black transition-all ${newHeadId === member.id ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-200 text-slate-500 hover:bg-slate-300'}`}
                            >
                                {newHeadId === member.id ? 'هو الرئيس الجديد ✅' : 'تعيين كرئيس'}
                            </button>
                        )}
                    </div>
                ))
            )}
        </div>

        <div className="flex gap-3 mt-auto">
            <button 
                onClick={() => newHeadId && onConfirm(Array.from(selectedIds), newHeadId)} 
                disabled={!isValid || isProcessing}
                className="flex-1 bg-indigo-600 text-white py-4 rounded-2xl font-black text-lg shadow-xl active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {isProcessing ? 'جاري الفصل...' : 'تأكيد القسم وإنشاء السجل'}
            </button>
            <button 
                onClick={onClose} 
                className="w-1/3 bg-slate-100 text-slate-500 py-4 rounded-2xl font-black active:scale-95 transition-all hover:bg-slate-200"
            >
                إلغاء
            </button>
        </div>
      </div>
    </div>
  );
};

export default SplitFamilyModal;
