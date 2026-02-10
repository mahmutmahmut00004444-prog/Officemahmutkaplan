
import React, { useMemo, useState } from 'react';
import { OfficeRecord, OfficeUser, OfficeSettlement, CircleType, BookingSource, Reviewer, SettlementTransaction, CIRCLE_NAMES } from '../types';

interface AccountsBlogProps {
  officeRecords: OfficeRecord[];
  allOfficeUsers: OfficeUser[];
  settlements: OfficeSettlement[];
  
  // New props for Sources
  bookingSources: BookingSource[];
  allReviewers: Reviewer[];
  sourceSettlements: SettlementTransaction[];

  onGoBack: () => void;
  formatCurrency: (amount: number | string | undefined) => string;
  onOpenSettleOffice?: (office: OfficeUser) => void;
  onOpenSettleSource?: (source: BookingSource, balance: number) => void;
}

type TabType = 'OFFICES' | 'SOURCES';

export default function AccountsBlog({ 
  officeRecords, 
  allOfficeUsers, 
  settlements,
  bookingSources,
  allReviewers,
  sourceSettlements,
  onGoBack, 
  formatCurrency,
  onOpenSettleOffice,
  onOpenSettleSource
}: AccountsBlogProps) {

  const [activeTab, setActiveTab] = useState<TabType>('OFFICES');

  // --- منطق حسابات المكاتب (الديون التي لنا بذمة المكاتب) ---
  const officesData = useMemo(() => {
    return allOfficeUsers.map(office => {
      // فقط الحجوزات غير المؤرشفة هي التي تشكل الدين الحالي
      const officeBookings = officeRecords.filter(r => 
        r.affiliation === office.office_name && (r.isBooked || !!r.bookingImage) && !r.isArchived
      );

      // تهيئة عداد الدوائر
      const circleCounts: Record<string, number> = {};
      Object.values(CircleType).forEach(type => circleCounts[type] = 0);

      const totalRevenue = officeBookings.reduce((sum, r) => {
        // زيادة عداد الدائرة
        if (circleCounts[r.circleType] !== undefined) {
          circleCounts[r.circleType]++;
        } else {
          // Fallback if type somehow doesn't match enum
          circleCounts[CircleType.OTHERS] = (circleCounts[CircleType.OTHERS] || 0) + 1;
        }

        let price = 0;
        if (r.circleType === CircleType.RIGHT_MOSUL) price = r.bookedPriceRightMosul || office.priceRightMosul || 0;
        else if (r.circleType === CircleType.LEFT_MOSUL) price = r.bookedPriceLeftMosul || office.priceLeftMosul || 0;
        else if (r.circleType === CircleType.HAMMAM_ALALIL) price = r.bookedPriceHammamAlAlil || office.priceHammamAlAlil || 0;
        else if (r.circleType === CircleType.ALSHOURA) price = r.bookedPriceAlShoura || office.priceAlShoura || 0;
        else if (r.circleType === CircleType.BAAJ) price = r.bookedPriceBaaj || office.priceBaaj || 0;
        else price = r.bookedPriceOthers || office.priceOthers || 0;
        return sum + Number(price);
      }, 0);

      const totalPaid = settlements
        .filter(s => s.office_id === office.id)
        .reduce((sum, s) => sum + s.amount, 0);

      // حساب الرصيد: اذا المدفوع اكبر او يساوي المطلوب، الرصيد صفر
      const rawBalance = totalRevenue - totalPaid;
      const balance = rawBalance <= 0 ? 0 : rawBalance;

      return {
        ...office,
        registrationDate: office.created_at, // تاريخ تسجيل المكتب
        bookingsCount: officeBookings.length,
        totalRevenue,
        totalPaid,
        balance,
        circleCounts // إضافة إحصائيات الدوائر
      };
    }).sort((a, b) => b.balance - a.balance);
  }, [allOfficeUsers, officeRecords, settlements]);

  // --- منطق حسابات المصادر (الديون التي للمصادر بذمتنا) ---
  const sourcesData = useMemo(() => {
    return bookingSources.map(source => {
      // الحجوزات المرتبطة بهذا المصدر (من المراجعين ومن سجلات المكاتب) غير المؤرشفة
      const linkedReviewers = allReviewers.filter(r => r.bookedSourceId === source.id && !r.isArchived);
      const linkedOffices = officeRecords.filter(o => o.bookedSourceId === source.id && !o.isArchived);
      const allLinkedItems = [...linkedReviewers, ...linkedOffices];
      
      const totalCount = allLinkedItems.length;

      // تهيئة عداد الدوائر
      const circleCounts: Record<string, number> = {};
      Object.values(CircleType).forEach(type => circleCounts[type] = 0);

      // حساب المبلغ المستحق للمصدر
      const totalRevenue = allLinkedItems.reduce((sum, item) => {
        // زيادة عداد الدائرة
        if (item.circleType && circleCounts[item.circleType] !== undefined) {
          circleCounts[item.circleType]++;
        }

        let price = 0;
        // نستخدم السعر المثبت في السجل (لأنه يمثل تكلفة المصدر وقت الحجز) أو سعر المصدر الحالي
        if (item.circleType === CircleType.RIGHT_MOSUL) price = item.bookedPriceRightMosul || source.priceRightMosul || 0;
        else if (item.circleType === CircleType.LEFT_MOSUL) price = item.bookedPriceLeftMosul || source.priceLeftMosul || 0;
        else if (item.circleType === CircleType.HAMMAM_ALALIL) price = item.bookedPriceHammamAlAlil || source.priceHammamAlAlil || 0;
        else if (item.circleType === CircleType.ALSHOURA) price = item.bookedPriceAlShoura || source.priceAlShoura || 0;
        else if (item.circleType === CircleType.BAAJ) price = item.bookedPriceBaaj || source.priceBaaj || 0;
        else price = item.bookedPriceOthers || source.priceOthers || 0;
        return sum + Number(price);
      }, 0);

      // المبالغ التي سددناها للمصدر
      const totalPaid = sourceSettlements
        .filter(s => s.source_id === source.id)
        .reduce((sum, s) => sum + s.amount, 0);

      // الرصيد المتبقي (الذي يطلبه المصدر منا) - اذا سددنا الكل يصفر
      const rawBalance = totalRevenue - totalPaid;
      const balance = rawBalance <= 0 ? 0 : rawBalance;

      return {
        ...source,
        registrationDate: source.createdAt, // تاريخ تسجيل المصدر
        bookingsCount: totalCount,
        totalRevenue, // المبلغ الكلي المطلوب للمصدر
        totalPaid,    // المبلغ الواصل للمصدر
        balance,      // الباقي للمصدر
        circleCounts  // إضافة إحصائيات الدوائر
      };
    }).sort((a, b) => b.balance - a.balance);
  }, [bookingSources, allReviewers, officeRecords, sourceSettlements]);

  // تحديد البيانات والإجماليات بناءً على التبويب النشط
  const currentData = activeTab === 'OFFICES' ? officesData : sourcesData;
  const grandTotalRevenue = currentData.reduce((acc, curr: any) => acc + curr.totalRevenue, 0);
  const grandTotalPaid = currentData.reduce((acc, curr: any) => acc + curr.totalPaid, 0);
  const grandTotalBalance = currentData.reduce((acc, curr: any) => acc + curr.balance, 0); // مجموع الأرصدة بعد التصفير
  const grandTotalBookings = currentData.reduce((acc, curr: any) => acc + curr.bookingsCount, 0);

  // حساب المجاميع الكلية لكل دائرة
  const grandTotalCircles: Record<string, number> = {};
  Object.values(CircleType).forEach(type => {
    grandTotalCircles[type] = currentData.reduce((acc, curr: any) => acc + (curr.circleCounts[type] || 0), 0);
  });

  const formatDate = (dateValue: string | number | undefined) => {
    if (!dateValue) return { date: '—', time: '' };
    const date = new Date(dateValue);
    return {
      date: date.toLocaleDateString('en-GB', { year: 'numeric', month: '2-digit', day: '2-digit' }),
      time: date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
    };
  };

  return (
    <div className="max-w-[95%] mx-auto space-y-6 pb-40 animate-scale-up">
      <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border-2 border-slate-900 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4">
          <button onClick={onGoBack} className="p-3 bg-white text-slate-600 rounded-full shadow-lg border border-slate-100 hover:bg-slate-50 transition-all">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="m15 18-6-6 6-6"/></svg>
          </button>
        </div>

        <div className="pt-8">
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-3xl font-black text-slate-900">مدونة الحسابات المركزية</h2>
            <span className="bg-blue-600 text-white text-[10px] px-3 py-1 rounded-full font-black">Admin View</span>
          </div>
          <p className="text-slate-500 font-bold mb-8">تقرير شامل ومفصل عن الأرصدة والحجوزات</p>

          {/* Tab Switcher */}
          <div className="flex bg-slate-100 p-1.5 rounded-2xl mb-8 w-fit border-2 border-slate-200">
            <button 
              onClick={() => setActiveTab('OFFICES')}
              className={`px-6 py-3 rounded-xl text-sm font-black transition-all flex items-center gap-2 ${activeTab === 'OFFICES' ? 'bg-white text-blue-700 shadow-md scale-105' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <span>🏢 حسابات المكاتب (لنا)</span>
            </button>
            <button 
              onClick={() => setActiveTab('SOURCES')}
              className={`px-6 py-3 rounded-xl text-sm font-black transition-all flex items-center gap-2 ${activeTab === 'SOURCES' ? 'bg-white text-indigo-700 shadow-md scale-105' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <span>⚡ حسابات المصادر (علينا)</span>
            </button>
          </div>

          {/* بطاقات الملخص العام */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
            <div className="bg-slate-900 text-white p-6 rounded-[2rem] shadow-lg relative overflow-hidden">
              <div className="absolute -left-4 -bottom-4 w-24 h-24 bg-white/10 rounded-full"></div>
              <p className="text-[10px] font-black text-slate-400 uppercase mb-1">
                {activeTab === 'OFFICES' ? 'إجمالي الديون (لنا)' : 'إجمالي المستحقات (علينا)'}
              </p>
              <p className="text-3xl font-black">{formatCurrency(grandTotalRevenue)}</p>
            </div>
            <div className="bg-emerald-600 text-white p-6 rounded-[2rem] shadow-lg relative overflow-hidden">
              <div className="absolute -left-4 -bottom-4 w-24 h-24 bg-white/10 rounded-full"></div>
              <p className="text-[10px] font-black text-emerald-200 uppercase mb-1">إجمالي المسدد (واصل)</p>
              <p className="text-3xl font-black">{formatCurrency(grandTotalPaid)}</p>
            </div>
            <div className={`p-6 rounded-[2rem] shadow-lg relative overflow-hidden text-white ${activeTab === 'OFFICES' ? 'bg-red-600' : 'bg-orange-600'}`}>
              <div className="absolute -left-4 -bottom-4 w-24 h-24 bg-white/10 rounded-full"></div>
              <p className={`text-[10px] font-black uppercase mb-1 ${activeTab === 'OFFICES' ? 'text-red-200' : 'text-orange-200'}`}>
                 {activeTab === 'OFFICES' ? 'الرصيد المتبقي (بذمة المكاتب)' : 'الرصيد المتبقي (بذمتنا للمصادر)'}
              </p>
              <p className="text-3xl font-black">{formatCurrency(grandTotalBalance)}</p>
            </div>
            <div className="bg-white border-2 border-slate-200 p-6 rounded-[2rem] shadow-sm">
              <p className="text-[10px] font-black text-slate-400 uppercase mb-1">إجمالي عدد الحجوزات</p>
              <p className="text-3xl font-black text-blue-700">{grandTotalBookings}</p>
            </div>
          </div>

          {/* جدول الحسابات */}
          <div className="table-container rounded-[2rem] border-2 border-slate-900 overflow-hidden shadow-xl bg-white">
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-right border-collapse min-w-[1400px]">
                <thead>
                  <tr className="bg-slate-900 text-white">
                    <th className="p-4 text-xs font-black text-center w-12 border-l border-slate-800">ت</th>
                    <th className="p-4 text-xs font-black min-w-[150px] border-l border-slate-800">{activeTab === 'OFFICES' ? 'اسم المكتب' : 'اسم المصدر'}</th>
                    <th className="p-4 text-xs font-black text-center w-32 border-l border-slate-800">تاريخ التسجيل</th>
                    
                    {/* أعمدة الدوائر */}
                    <th className="p-2 text-[10px] font-black text-center bg-slate-800 border-l border-slate-700">أيمن</th>
                    <th className="p-2 text-[10px] font-black text-center bg-slate-800 border-l border-slate-700">أيسر</th>
                    <th className="p-2 text-[10px] font-black text-center bg-slate-800 border-l border-slate-700">حمام</th>
                    <th className="p-2 text-[10px] font-black text-center bg-slate-800 border-l border-slate-700">شورة</th>
                    <th className="p-2 text-[10px] font-black text-center bg-slate-800 border-l border-slate-700">بعاج</th>
                    <th className="p-2 text-[10px] font-black text-center bg-slate-800 border-l border-slate-700">أخرى</th>

                    <th className="p-4 text-xs font-black text-center w-24 border-l border-slate-800">المجموع (عدد)</th>
                    <th className="p-4 text-xs font-black text-center min-w-[140px] border-l border-slate-800">المبلغ الكلي (المطلوب)</th>
                    <th className="p-4 text-xs font-black text-center min-w-[140px] border-l border-slate-800">المبلغ المسدد (واصل)</th>
                    <th className="p-4 text-xs font-black text-center min-w-[140px] border-l border-slate-800">الرصيد الحالي (باقي)</th>
                    <th className="p-4 text-xs font-black text-center min-w-[100px]">خيارات</th>
                  </tr>
                </thead>
                <tbody className="text-sm font-bold text-slate-700">
                  {currentData.map((item: any, idx: number) => {
                    const { date, time } = formatDate(item.registrationDate);
                    return (
                      <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                        <td className="p-4 text-center text-slate-400 text-xs border-l border-slate-100">{idx + 1}</td>
                        <td className="p-4 border-l border-slate-100">
                          <div className="flex flex-col">
                            <span className="font-black text-slate-900">{activeTab === 'OFFICES' ? item.office_name : item.sourceName}</span>
                            <span className="text-[10px] text-slate-400 font-bold" dir="ltr">{activeTab === 'OFFICES' ? (item.phone_number || '') : (item.phoneNumber || '')}</span>
                          </div>
                        </td>
                        
                        <td className="p-4 text-center border-l border-slate-100">
                          <div className="flex flex-col items-center">
                            <span className="text-[11px] font-black text-slate-600">{date}</span>
                            <span className="text-[9px] font-bold text-slate-400">{time}</span>
                          </div>
                        </td>

                        {/* بيانات الدوائر */}
                        <td className="p-2 text-center text-xs border-l border-slate-100 bg-slate-50/50">{item.circleCounts[CircleType.RIGHT_MOSUL] || '-'}</td>
                        <td className="p-2 text-center text-xs border-l border-slate-100 bg-slate-50/50">{item.circleCounts[CircleType.LEFT_MOSUL] || '-'}</td>
                        <td className="p-2 text-center text-xs border-l border-slate-100 bg-slate-50/50">{item.circleCounts[CircleType.HAMMAM_ALALIL] || '-'}</td>
                        <td className="p-2 text-center text-xs border-l border-slate-100 bg-slate-50/50">{item.circleCounts[CircleType.ALSHOURA] || '-'}</td>
                        <td className="p-2 text-center text-xs border-l border-slate-100 bg-slate-50/50">{item.circleCounts[CircleType.BAAJ] || '-'}</td>
                        <td className="p-2 text-center text-xs border-l border-slate-100 bg-slate-50/50">{item.circleCounts[CircleType.OTHERS] || '-'}</td>

                        <td className="p-4 text-center border-l border-slate-100">
                          <span className="bg-slate-100 text-slate-700 px-3 py-1 rounded-lg text-xs font-black border border-slate-200">{item.bookingsCount}</span>
                        </td>
                        <td className="p-4 text-center text-blue-700 font-black border-l border-slate-100 whitespace-nowrap text-sm" dir="ltr">{formatCurrency(item.totalRevenue)}</td>
                        <td className="p-4 text-center text-emerald-600 font-black border-l border-slate-100 whitespace-nowrap text-sm" dir="ltr">{formatCurrency(item.totalPaid)}</td>
                        <td className="p-4 text-center whitespace-nowrap border-l border-slate-100">
                          <span className={`px-4 py-2 rounded-xl font-black text-xs border block w-fit mx-auto ${item.balance > 0 ? (activeTab === 'OFFICES' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-orange-50 text-orange-700 border-orange-200') : 'bg-emerald-100 text-emerald-700 border-emerald-200'}`} dir="ltr">
                            {item.balance === 0 ? '0 دينار (خالص)' : formatCurrency(item.balance)}
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          <button 
                            onClick={() => {
                              if (activeTab === 'OFFICES') {
                                onOpenSettleOffice?.(item);
                              } else {
                                onOpenSettleSource?.(item, item.balance);
                              }
                            }}
                            className={`px-4 py-2 rounded-xl font-black text-xs text-white shadow-md active:scale-95 transition-all flex items-center gap-1 mx-auto ${activeTab === 'OFFICES' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-orange-600 hover:bg-orange-700'}`}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12V7H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14v4"/><path d="M3 5v14c0 1.1.9 2 2 2h16v-5"/><path d="M18 12a2 2 0 0 0-2 2c0 1.1.9 2 2 2h4v-4h-4z"/></svg>
                            <span>تسديد</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {currentData.length === 0 && (
                    <tr>
                      <td colSpan={15} className="p-10 text-center text-slate-400 font-black text-lg italic bg-slate-50">
                        لا توجد بيانات حالياً
                      </td>
                    </tr>
                  )}
                </tbody>
                {currentData.length > 0 && (
                  <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                    <tr>
                      <td colSpan={3} className="p-4 font-black text-slate-900 text-center border-l border-slate-200">المجموع الكلي</td>
                      
                      {/* مجاميع الدوائر */}
                      <td className="p-2 text-center font-black text-xs text-slate-600 border-l border-slate-200">{grandTotalCircles[CircleType.RIGHT_MOSUL]}</td>
                      <td className="p-2 text-center font-black text-xs text-slate-600 border-l border-slate-200">{grandTotalCircles[CircleType.LEFT_MOSUL]}</td>
                      <td className="p-2 text-center font-black text-xs text-slate-600 border-l border-slate-200">{grandTotalCircles[CircleType.HAMMAM_ALALIL]}</td>
                      <td className="p-2 text-center font-black text-xs text-slate-600 border-l border-slate-200">{grandTotalCircles[CircleType.ALSHOURA]}</td>
                      <td className="p-2 text-center font-black text-xs text-slate-600 border-l border-slate-200">{grandTotalCircles[CircleType.BAAJ]}</td>
                      <td className="p-2 text-center font-black text-xs text-slate-600 border-l border-slate-200">{grandTotalCircles[CircleType.OTHERS]}</td>

                      <td className="p-4 font-black text-slate-900 text-center border-l border-slate-200">{grandTotalBookings}</td>
                      <td className="p-4 font-black text-blue-700 text-center border-l border-slate-200 whitespace-nowrap" dir="ltr">{formatCurrency(grandTotalRevenue)}</td>
                      <td className="p-4 font-black text-emerald-600 text-center border-l border-slate-200 whitespace-nowrap" dir="ltr">{formatCurrency(grandTotalPaid)}</td>
                      <td className={`p-4 font-black text-center whitespace-nowrap ${activeTab === 'OFFICES' ? 'text-red-600' : 'text-orange-600'}`} dir="ltr">{formatCurrency(grandTotalBalance)}</td>
                      <td className="p-4"></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
