
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { CircleType, OfficeRecord, FamilyMember, CIRCLE_NAMES, LoggedInUser, OfficeUser } from '../types';

interface OfficeFormProps {
  onSave: (record: OfficeRecord) => Promise<void>;
  onGoBack: () => void; 
  initialData?: OfficeRecord;
  persistentData?: { affiliation: string; tableNumber: string; circleType: CircleType };
  isEditMode?: boolean;
  loggedInUser: LoggedInUser | null; 
  allOfficeUsers?: OfficeUser[]; 
  formatCurrency: (amount: number | string | undefined) => string;
  showToast: (message: string, type: 'success' | 'error') => void;
}

interface FamilyMemberInput extends Omit<FamilyMember, 'fullName'> {
  firstName: string;
  fatherGrandfatherName: string;
}

const OfficeForm: React.FC<OfficeFormProps> = ({ onSave, onGoBack, initialData, persistentData, isEditMode = false, loggedInUser, allOfficeUsers, formatCurrency, showToast }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Toggle State for Phone (Default Closed)
  const [showPhone, setShowPhone] = useState(!!initialData?.headPhone);

  const isAdmin = loggedInUser?.role === 'ADMIN';
  const isOfficeUser = loggedInUser?.role === 'OFFICE';
  const officeAffiliation = isOfficeUser ? loggedInUser.username : initialData?.affiliation || persistentData?.affiliation || '';

  const isRecordFinalized = useMemo(() => {
    if (isEditMode && initialData && isOfficeUser && loggedInUser?.username === initialData.affiliation) {
      return initialData.isUploaded || initialData.isBooked;
    }
    return false;
  }, [isEditMode, initialData, isOfficeUser, loggedInUser?.username]);

  const isDisabled = isSubmitting || isRecordFinalized;

  const getInitialFamily = (): FamilyMemberInput[] => {
    if (!initialData || !initialData.familyMembers) return [];
    return initialData.familyMembers.map(m => {
      const parts = m.fullName.trim().split(/\s+/);
      return {
        ...m,
        firstName: parts[0] || '',
        fatherGrandfatherName: parts.slice(1).join(' ')
      };
    });
  };

  const initialFormState = {
    // If editing, use existing. If new, start with NULL (user must select).
    circleType: initialData?.circleType || persistentData?.circleType || null,
    headFullName: initialData?.headFullName || '',
    headSurname: initialData?.headSurname || '',
    headMotherName: initialData?.headMotherName || '',
    headDob: initialData?.headDob || '',
    headPhone: initialData?.headPhone || '',
    affiliation: officeAffiliation, 
    tableNumber: initialData?.tableNumber || persistentData?.tableNumber || '',
    bookingImage: initialData?.bookingImage || '', 
  };

  const [formData, setFormData] = useState<any>(initialFormState);
  const [familyMembers, setFamilyMembers] = useState<FamilyMemberInput[]>(getInitialFamily());

  useEffect(() => {
    if (isOfficeUser && loggedInUser?.username) {
      setFormData((prev: any) => ({ ...prev, affiliation: loggedInUser.username }));
    }
  }, [isOfficeUser, loggedInUser?.username]);


  const formatDob = (value: string) => {
    const digits = value.replace(/\D/g, '');
    let formatted = '';
    if (digits.length > 0) {
      formatted += digits.substring(0, 4);
      if (digits.length > 4) {
        formatted += '-' + digits.substring(4, 6);
        if (digits.length > 6) {
          formatted += '-' + digits.substring(6, 8);
        }
      }
    }
    return formatted;
  };

  const getFirstTwoNames = (name: string) => {
    const parts = name.trim().split(/\s+/);
    return parts.slice(0, 2).join(' ').trim();
  };

  const getFatherAndGrandfather = (name: string) => {
    const parts = name.trim().split(/\s+/);
    return parts.slice(1, 4).join(' ').trim();
  };

  const handleRelationshipChange = (index: number, relationship: string) => {
    const updated = [...familyMembers];
    const member = { ...updated[index], relationship };
    
    if (relationship === 'ابن' || relationship === 'ابنة') {
      member.fatherGrandfatherName = getFirstTwoNames(formData.headFullName);
      member.surname = formData.headSurname;
      const wife = familyMembers.find(m => m.relationship === 'زوجة');
      if (wife && wife.firstName) {
        member.motherName = `${wife.firstName} ${wife.fatherGrandfatherName}`.trim(); 
      } else {
        member.motherName = '';
      }
    } 
    else if (relationship === 'أخ' || relationship === 'أخت') {
      member.fatherGrandfatherName = getFatherAndGrandfather(formData.headFullName);
      member.surname = formData.headSurname;
      member.motherName = formData.headMotherName;
    } 
    else if (relationship === 'زوجة') {
      member.surname = '';
      member.fatherGrandfatherName = '';
      member.motherName = '';
    }
    else {
      member.fatherGrandfatherName = '';
      member.motherName = '';
      member.surname = ''; 
    }

    updated[index] = member;
    setFamilyMembers(updated);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isDisabled) return; 

    // Validation: Circle Type is mandatory
    if (!formData.circleType) {
      showToast("يرجى اختيار الدائرة", 'error');
      return;
    }

    if (!formData.affiliation) {
      showToast("يرجى اختيار المكتب", 'error');
      return;
    }

    setIsSubmitting(true);

    try {
      const finalFamily: FamilyMember[] = familyMembers.map(m => ({
        ...m,
        id: m.id || `MEM-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        fullName: `${m.firstName.trim()} ${m.fatherGrandfatherName.trim()}`.trim(),
      }));

      const recordId = initialData?.id || `OFF-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

      await onSave({
        id: recordId,
        ...formData,
        familyMembers: finalFamily,
        createdAt: initialData?.createdAt || Date.now()
      });

      if (!isEditMode) {
        setFormData((prev: any) => ({
          ...prev,
          headFullName: '',
          headSurname: '',
          headMotherName: '',
          headDob: '',
          headPhone: '',
          bookingImage: ''
          // NOTE: We do NOT reset circleType here, so it persists.
        }));
        setFamilyMembers([]);
        window.scrollTo({ top: 300, behavior: 'smooth' }); 
      }
    } catch (err) {
      console.error("Save failed:", err);
      showToast("حدث خطأ أثناء الحفظ", 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCountChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const count = parseInt(e.target.value);
    const updated = [...familyMembers];
    if (count > familyMembers.length) {
      for (let i = familyMembers.length; i < count; i++) {
        updated.push({
          id: `MEM-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          relationship: '', firstName: '', fatherGrandfatherName: '', surname: '', motherName: '', dob: ''
        });
      }
    } else {
      updated.splice(count);
    }
    setFamilyMembers(updated);
  };

  const updateMember = (index: number, field: keyof FamilyMemberInput, value: string) => {
    const updated = [...familyMembers];
    if (field === 'dob') {
      updated[index] = { ...updated[index], [field]: formatDob(value) } as FamilyMemberInput;
    } else {
      updated[index] = { ...updated[index], [field]: value } as FamilyMemberInput;
    }
    setFamilyMembers(updated);
  };

  const inputClasses = `w-full p-3.5 text-sm bg-white border-2 border-slate-300 rounded-xl focus:border-indigo-600 outline-none font-bold transition-all placeholder:text-slate-400 disabled:opacity-50 ${isRecordFinalized ? 'bg-slate-100 cursor-not-allowed' : ''}`;
  const labelClasses = `flex items-center justify-between text-[11px] mb-1 font-black text-slate-700 uppercase tracking-tight`;
  const optionalBadge = <span className="text-[9px] font-black text-slate-300 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100 mr-2 lowercase">اختياري</span>;

  return (
    <div className="relative">
      <div className="absolute top-0 right-0 z-10 p-2">
        <button 
          onClick={onGoBack}
          className="p-3 bg-white text-slate-600 rounded-full shadow-lg border border-slate-100 hover:bg-slate-50 hover:text-slate-800 transition-all active:scale-95 flex items-center justify-center"
          aria-label="رجوع"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
      </div>
      <form onSubmit={handleFormSubmit} className="space-y-6 pb-10 mt-16">
        <div className="bg-white p-6 rounded-[2rem] shadow-xl border-2 border-slate-900 space-y-6 overflow-hidden relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-bl-full -mr-16 -mt-16 opacity-50"></div>
          <div className="relative">
            <div className="flex items-center gap-2 mb-6">
               <div className="w-2 h-6 bg-indigo-600 rounded-full"></div>
               <h3 className="text-lg font-black text-slate-900 tracking-tighter">{isEditMode ? 'تعديل إعدادات المكتب' : 'إعدادات المكتب'}</h3>
            </div>
            
            {/* Phone Toggle for Office Form */}
            <div className="flex flex-wrap gap-2 mb-4 border-b border-slate-100 pb-4">
               <button type="button" onClick={() => setShowPhone(!showPhone)} className={`px-4 py-2 rounded-lg text-[10px] font-black border-2 transition-all ${showPhone ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                  {showPhone ? '✅ رقم الهاتف مفعل' : 'تفعيل رقم الهاتف'}
               </button>
            </div>

            {isRecordFinalized && (
              <div className="bg-amber-50 border border-amber-200 text-amber-700 font-bold text-xs p-3 rounded-xl mb-4 flex items-center gap-2 justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>
                <span>تم رفع أو حجز هذا السجل. لا يمكن تعديل بياناته.</span>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className={labelClasses}>
                  اختيار الدائرة (إجباري)
                  {!formData.circleType && <span className="text-red-500 text-[10px] mr-2">(يرجى الاختيار)</span>}
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                  {Object.values(CircleType).map((type) => (
                    <button disabled={isDisabled} key={type} type="button" onClick={() => setFormData({...formData, circleType: type})} className={`py-3 px-1 rounded-xl border-2 transition-all font-black text-[10px] ${formData.circleType === type ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>{CIRCLE_NAMES[type]}</button>
                  ))}
                </div>
              </div>
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className={labelClasses}>اسم المكتب</label>
                  {isAdmin ? (
                    <select
                      disabled={isDisabled}
                      className={inputClasses}
                      value={formData.affiliation}
                      onChange={e => setFormData({...formData, affiliation: e.target.value})}
                    >
                      <option value="">اختر المكتب من القائمة...</option>
                      {allOfficeUsers?.map(office => (
                        <option key={office.id} value={office.office_name}>
                          {office.office_name}
                        </option>
                      ))}
                      {!allOfficeUsers?.some(o => o.office_name === formData.affiliation) && formData.affiliation && (
                        <option value={formData.affiliation}>{formData.affiliation}</option>
                      )}
                    </select>
                  ) : (
                    <input 
                      disabled={true}
                      readOnly={true} 
                      type="text" 
                      className={`${inputClasses} bg-slate-100 cursor-not-allowed`} 
                      value={formData.affiliation} 
                      placeholder="اسم المكتب" 
                    />
                  )}
                </div>
                <div className="space-y-1">
                  <label className={labelClasses}><span>رقم الوجبة</span>{optionalBadge}</label>
                  <input disabled={isDisabled} type="text" className={inputClasses} value={formData.tableNumber} onChange={e => setFormData({...formData, tableNumber: e.target.value})} placeholder="الوجبة" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 md:p-8 rounded-[2rem] shadow-md border-2 border-slate-900 space-y-6 relative overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 relative">
              <div className="space-y-1">
                <label className={labelClasses}>الاسم الكامل للمراجع</label>
                <input disabled={isDisabled} autoFocus={!isEditMode} type="text" className={inputClasses} value={formData.headFullName} onChange={e => setFormData({...formData, headFullName: e.target.value})} placeholder="الاسم الرباعي" />
              </div>
              <div className="space-y-1">
                <label className={labelClasses}>اللقب الرئيسي</label>
                <input disabled={isDisabled} type="text" className={inputClasses} value={formData.headSurname} onChange={e => setFormData({...formData, headSurname: e.target.value})} placeholder="اللقب" />
              </div>
              <div className="space-y-1">
                <label className={labelClasses}>اسم الأم</label>
                <input disabled={isDisabled} type="text" className={inputClasses} value={formData.headMotherName} onChange={e => setFormData({...formData, headMotherName: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className={labelClasses}>تاريخ التولد</label>
                <input disabled={isDisabled} type="text" inputMode="numeric" className={inputClasses} value={formData.headDob} onChange={e => setFormData({...formData, headDob: formatDob(e.target.value)})} placeholder="YYYY-MM-DD" maxLength={10} />
              </div>
              
              {showPhone && (
                <div className="space-y-1 animate-scale-up">
                  <label className={labelClasses}>رقم الهاتف</label>
                  <input disabled={isDisabled} type="tel" className={inputClasses} value={formData.headPhone} onChange={e => setFormData({...formData, headPhone: e.target.value})} placeholder="07xxxxxxxx" />
                </div>
              )}

              <div className="space-y-1">
                <label className={labelClasses}>عدد أفراد الأسرة</label>
                <select disabled={isDisabled} className={inputClasses} value={familyMembers.length} onChange={handleCountChange}>
                  {[0,1,2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n}>{n} أفراد</option>)}
                </select>
              </div>
          </div>
        </div>

        {familyMembers.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-slate-800 font-black text-sm px-2 uppercase tracking-widest">أفراد الأسرة</h3>
            <div className="grid grid-cols-1 gap-4">
              {familyMembers.map((m, i) => (
                <div key={m.id} className="bg-white p-5 rounded-2xl border-r-8 border-blue-700 shadow-md space-y-5 border-2 border-slate-900 transition-all">
                  <div className="flex items-center gap-3 border-b-2 border-slate-50 pb-2">
                      <span className="w-8 h-8 rounded-lg bg-blue-700 flex items-center justify-center text-white font-black text-xs">{i+1}</span>
                      <span className="font-black text-slate-800 text-sm">بيانات الفرد</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <label className={labelClasses}>صلة القرابة</label>
                      <select disabled={isDisabled} className={inputClasses} value={m.relationship} onChange={e => handleRelationshipChange(i, e.target.value)}>
                        <option value="">اختر الصلة...</option>
                        <option value="زوجة">زوجة</option>
                        <option value="ابن">ابن</option>
                        <option value="ابنة">ابنة</option>
                        <option value="أخ">أخ</option>
                        <option value="أخت">أخت</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className={labelClasses}>الاسم الأول</label>
                      <input disabled={isDisabled} type="text" className={inputClasses} value={m.firstName} onChange={e => updateMember(i, 'firstName', e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <label className={`${labelClasses} text-blue-800`}>الأب والجد</label>
                      <input disabled={isDisabled} type="text" className={`${inputClasses} bg-slate-50`} value={m.fatherGrandfatherName} onChange={e => updateMember(i, 'fatherGrandfatherName', e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <label className={labelClasses}><span>اللقب</span>{optionalBadge}</label>
                      <input disabled={isDisabled} type="text" className={`${inputClasses} ${m.surname === formData.headSurname && m.relationship !== 'زوجة' ? 'bg-blue-50/50' : ''}`} value={m.surname} onChange={e => updateMember(i, 'surname', e.target.value)} placeholder={m.relationship === 'زوجة' ? "ادخل لقب الزوجة" : "تلقائي..."} />
                    </div>
                    <div className="space-y-1">
                      <label className={labelClasses}>اسم الأم</label>
                      <input disabled={isDisabled} type="text" className={`${inputClasses} bg-slate-50`} value={m.motherName} onChange={e => updateMember(i, 'motherName', e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <label className={labelClasses}>تاريخ التولد</label>
                      <input disabled={isDisabled} type="text" inputMode="numeric" className={inputClasses} value={m.dob} onChange={e => updateMember(i, 'dob', e.target.value)} placeholder="YYYY-MM-DD" maxLength={10} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-8 mb-10 flex gap-3">
          <button 
            type="submit" 
            disabled={isDisabled}
            className={`w-full bg-indigo-700 text-white py-5 rounded-2xl font-black text-lg active:scale-95 transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 ${isDisabled ? 'opacity-70' : ''}`}
          >
            {isSubmitting ? (
              <div className="flex items-center gap-2">
                <svg className="animate-spin h-6 w-6 text-white" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>جاري الحفظ...</span>
              </div>
            ) : (isEditMode ? 'تحديث البيانات' : 'حفظ البيانات')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default OfficeForm;
