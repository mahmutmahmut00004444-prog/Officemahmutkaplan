
import React, { useRef, useState, useMemo, useEffect } from 'react';
import { Reviewer, CIRCLE_NAMES, CircleType, LoggedInUser, FamilyMember, BookingSource } from '../types';
import ContextMenuModal, { ContextMenuItem } from './ContextMenuModal';
import SourceSelectionModal from './SourceSelectionModal';
import SplitFamilyModal from './SplitFamilyModal';
import LastUploadsModal from './LastUploadsModal'; // Import new component
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { supabase } from '../lib/supabase';
import { GoogleGenAI } from '@google/genai';

interface ReviewerTableProps {
  reviewers: Reviewer[];
  globalNameFrequency: Record<string, number>;
  onDelete: (id: string) => void;
  onUpdate: (reviewer: Reviewer) => void;
  onUpdateDirect?: (id: string, imageData: string) => Promise<void>;
  onToggleBooking?: (id: string, currentState: boolean, currentSourceId: string | null) => void;
  onUploadAndBook?: (id: string, imageData: string, type: 'reviewer' | 'office', bookingDate?: string) => Promise<void>;
  onToggleUploadStatus?: (id: string, currentState: boolean, currentSourceId: string | null) => void;
  onDeleteMember: (reviewerId: string, memberId: string) => void;
  onResetAll?: () => Promise<void>;
  loggedInUser: LoggedInUser | null;
  showToast: (message: string, type: 'success' | 'error') => void;
  bookingSources: BookingSource[];
  formatCurrency: (amount: number | string | undefined) => string;
  onBulkToggleUploadStatus: (ids: string[], status: boolean, sourceId?: string | null) => Promise<void>;
  onBulkDelete: (ids: string[]) => Promise<void>;
}

type UploadStatusFilter = 'ALL' | 'UPLOADED' | 'NOT_UPLOADED';
type BookingStatusFilter = 'ALL' | 'BOOKED' | 'NOT_BOOKED';

interface CurrentContextMenuData {
  type: 'head' | 'member';
  record?: Reviewer;
  member?: FamilyMember;
  parentRecord?: Reviewer;
}

export default function ReviewerTable({ 
  reviewers, 
  globalNameFrequency,
  onDelete, 
  onUpdate, 
  onToggleBooking,
  onUploadAndBook,
  onToggleUploadStatus,
  onDeleteMember,
  loggedInUser,
  showToast,
  bookingSources,
  formatCurrency,
  onBulkToggleUploadStatus,
  onBulkDelete
}: ReviewerTableProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null); 
  
  const [activeReviewerId, setActiveReviewerId] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [circleFilter, setCircleFilter] = useState<string>('ALL');
  const [uploadFilter, setUploadFilter] = useState<UploadStatusFilter>('ALL');
  const [bookingStatusFilter, setBookingStatusFilter] = useState<BookingStatusFilter>('ALL');
  const [bookingDateFilter, setBookingDateFilter] = useState<string>('');
  const [familyCountFilter, setFamilyCountFilter] = useState<string>('ALL'); 
  const [sourceFilter, setSourceFilter] = useState<string>('ALL'); 
  const [exportingType, setExportingType] = useState<'GENERAL' | 'SPECIAL' | null>(null);
  const [showStats, setShowStats] = useState(false); // Stats Toggle
  const [showDuplicatesOnly, setShowDuplicatesOnly] = useState(false); // Duplicate Filter Toggle
  
  const [isContextMenuModalOpen, setIsContextMenuModalOpen] = useState(false);
  const [currentContextMenuData, setCurrentContextMenuData] = useState<CurrentContextMenuData | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string, name: string, type: 'head' | 'member', parentId?: string } | null>(null);

  const [showSourceSelectionModal, setShowSourceSelectionModal] = useState(false);
  const [recordIdForUpload, setRecordIdForUpload] = useState<string | null>(null);

  // Split Family State
  const [showSplitModal, setShowSplitModal] = useState(false);
  const [recordToSplit, setRecordToSplit] = useState<Reviewer | null>(null);
  const [isSplitting, setIsSplitting] = useState(false);

  // Last Uploads Modal State
  const [showLastUploadsModal, setShowLastUploadsModal] = useState(false);

  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkActionType, setBulkActionType] = useState<'UPLOAD' | 'UNUPLOAD' | null>(null);
  
  const [showBulkUploadSelectedModal, setShowBulkUploadSelectedModal] = useState(false);
  const [showSpecialUploadExportModal, setShowSpecialUploadExportModal] = useState(false);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const preventClickRef = useRef(false); 
  const isSelectionMode = selectedIds.size > 0;

  const isAdmin = loggedInUser?.role === 'ADMIN';

  const bookingSourcesMap = useMemo(() => new Map(bookingSources.map(s => [s.id, s.sourceName])), [bookingSources]);

  useEffect(() => {
    if (searchQuery && tableContainerRef.current) {
        tableContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [searchQuery]);

  const filteredReviewers = useMemo(() => {
    let result = reviewers;
    const query = searchQuery.trim().toLowerCase();
    
    if (query) {
      result = result.filter(r => r.headFullName.toLowerCase().includes(query));
    }

    if (circleFilter !== 'ALL') result = result.filter(r => r.circleType === circleFilter);
    if (uploadFilter === 'UPLOADED') result = result.filter(r => r.isUploaded);
    else if (uploadFilter === 'NOT_UPLOADED') result = result.filter(r => !r.isUploaded);

    if (bookingStatusFilter === 'BOOKED') result = result.filter(r => r.isBooked || !!r.bookingImage);
    else if (bookingStatusFilter === 'NOT_BOOKED') result = result.filter(r => !r.isBooked && !r.bookingImage);
    
    if (bookingDateFilter) result = result.filter(r => r.bookingDate === bookingDateFilter);

    if (familyCountFilter !== 'ALL') {
        const count = parseInt(familyCountFilter);
        result = result.filter(r => (1 + (r.familyMembers?.length || 0)) === count);
    }

    if (sourceFilter !== 'ALL') {
        result = result.filter(r => r.uploadedSourceId === sourceFilter);
    }

    // Filter Duplicates Only
    if (showDuplicatesOnly) {
        result = result.filter(r => globalNameFrequency[r.headFullName.trim()] > 1);
    }

    return result;
  }, [reviewers, searchQuery, circleFilter, uploadFilter, bookingStatusFilter, bookingDateFilter, familyCountFilter, sourceFilter, showDuplicatesOnly, globalNameFrequency]);

  // حساب عدد المكررين الكلي
  const duplicateCountInCurrentView = useMemo(() => {
    if (showDuplicatesOnly) return filteredReviewers.length;
    return filteredReviewers.filter(r => globalNameFrequency[r.headFullName.trim()] > 1).length;
  }, [filteredReviewers, globalNameFrequency, showDuplicatesOnly]);

  const stats = useMemo(() => {
    const data: Record<CircleType, { count: number; money: number }> = {
      [CircleType.RIGHT_MOSUL]: { count: 0, money: 0 },
      [CircleType.LEFT_MOSUL]: { count: 0, money: 0 },
      [CircleType.HAMMAM_ALALIL]: { count: 0, money: 0 },
      [CircleType.ALSHOURA]: { count: 0, money: 0 },
      [CircleType.BAAJ]: { count: 0, money: 0 },
      [CircleType.OTHERS]: { count: 0, money: 0 }
    };
    filteredReviewers.forEach(record => {
      const isBooked = record.isBooked || !!record.bookingImage;
      
      let price = 0;
      if (isBooked) {
          if (record.circleType === CircleType.RIGHT_MOSUL) price = record.bookedPriceRightMosul || 0;
          else if (record.circleType === CircleType.LEFT_MOSUL) price = record.bookedPriceLeftMosul || 0;
          else if (record.circleType === CircleType.HAMMAM_ALALIL) price = record.bookedPriceHammamAlAlil || 0;
          else if (record.circleType === CircleType.ALSHOURA) price = record.bookedPriceAlShoura || 0;
          else if (record.circleType === CircleType.BAAJ) price = record.bookedPriceBaaj || 0;
          else price = record.bookedPriceOthers || 0;
      }

      if (data[record.circleType]) {
          data[record.circleType].count++;
          data[record.circleType].money += Number(price);
      }
    });
    return Object.entries(data).map(([type, val]) => ({ circleType: type as CircleType, count: val.count, money: val.money }));
  }, [filteredReviewers]);

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const startLongPress = (id: string) => {
    preventClickRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      preventClickRef.current = true;
      toggleSelection(id);
      if (navigator.vibrate) navigator.vibrate(50);
    }, 800); 
  };

  const cancelLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleRowClick = (e: React.MouseEvent, r: Reviewer) => {
    if (preventClickRef.current) {
      preventClickRef.current = false;
      return;
    }

    if (isSelectionMode) {
      e.preventDefault();
      e.stopPropagation();
      toggleSelection(r.id);
    } else {
      handleContextMenuClick(e, r, 'head');
    }
  };

  const handleBulkDeleteConfirm = async () => {
    await onBulkDelete(Array.from(selectedIds));
    setSelectedIds(new Set());
    setShowBulkDeleteModal(false);
  };

  const getEligibleIdsForBulk = (action: 'UPLOAD' | 'UNUPLOAD') => {
    return filteredReviewers
      .filter(r => !r.isBooked && !r.bookingImage) 
      .filter(r => action === 'UPLOAD' ? !r.isUploaded : r.isUploaded) 
      .map(r => r.id);
  };

  const handleBulkActionClick = (action: 'UPLOAD' | 'UNUPLOAD') => {
    setBulkActionType(action);
    setShowBulkModal(true);
  };

  const confirmBulkAction = async () => {
    if (!bulkActionType) return;
    const ids = getEligibleIdsForBulk(bulkActionType);
    if (ids.length > 0) {
      await onBulkToggleUploadStatus(ids, bulkActionType === 'UPLOAD');
    } else {
      showToast('لا توجد سجلات مطابقة للشروط لتنفيذ العملية', 'error');
    }
    setShowBulkModal(false);
    setBulkActionType(null);
  };

  const handleExportPDF = async (isSpecial: boolean = false, customRecords?: Reviewer[]) => {
    const recordsToExport = customRecords || (isSelectionMode 
        ? filteredReviewers.filter(r => selectedIds.has(r.id))
        : filteredReviewers);

    if (exportingType || recordsToExport.length === 0) return;
    const type = isSpecial ? 'SPECIAL' : 'GENERAL';
    setExportingType(type);
    
    try {
      const pdf = new jsPDF(isSpecial ? 'p' : 'l', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const MAX_ROWS_PER_PAGE = 25;
      const now = new Date();
      const dateStr = now.toLocaleDateString('en-GB');

      const tableStyle = "width: 100%; border-collapse: collapse; direction: rtl; font-family: 'Cairo', sans-serif; border: 2.5px solid #000; background-color: #ffffff; margin: 0 auto;";
      const thStyle = "border: 2px solid #000; padding: 10px 4px; font-size: 11px; background: #000000; color: white; font-weight: 900; text-align: center;";
      const tdStyle = "border: 1.5px solid #000; padding: 6px 4px; font-size: 10px; color: #000; text-align: center; font-weight: 900; background-color: #ffffff;";
      const tdRightStyle = tdStyle + " text-align: right; padding-right: 8px;";

      const headerHtmlStr = isSpecial 
        ? `<tr><th style="${thStyle}; width: 30px;">ت</th><th style="${thStyle}; width: 100px;">الدائرة</th><th style="${thStyle}; width: 220px;">الاسم الكامل</th><th style="${thStyle}; width: 90px;">اللقب</th><th style="${thStyle}; width: 80px;">الصلة</th><th style="${thStyle}; width: 160px;">اسم الأم</th><th style="${thStyle}; width: 90px;">التولد</th></tr>`
        : `<tr><th style="${thStyle}; width: 25px;">ت</th><th style="${thStyle}; width: 90px;">الدائرة</th><th style="${thStyle}; width: 60px;">الحالة</th><th style="${thStyle}; width: 60px;">الرفع</th><th style="${thStyle}; width: 160px;">الاسم الكامل</th><th style="${thStyle}; width: 90px;">اللقب</th><th style="${thStyle}; width: 60px;">الصلة</th><th style="${thStyle}; width: 140px;">اسم الأم</th><th style="${thStyle}; width: 80px;">التولد</th><th style="${thStyle}; width: 80px;">تاريخ الحجز</th><th style="${thStyle}; width: 90px;">واصل</th><th style="${thStyle}; width: 90px;">باقي</th></tr>`;

      const pages: Reviewer[][] = [[]];
      let currentRowCount = 0;
      recordsToExport.forEach(record => {
        const familySize = 1 + (record.familyMembers?.length || 0);
        if (currentRowCount + familySize > MAX_ROWS_PER_PAGE && currentRowCount > 0) {
          pages.push([record]);
          currentRowCount = familySize;
        } else {
          pages[pages.length - 1].push(record);
          currentRowCount += familySize;
        }
      });

      for (let pIdx = 0; pIdx < pages.length; pIdx++) {
        if (pIdx > 0) pdf.addPage();
        const chunk = pages[pIdx];
        const pageDiv = document.createElement('div');
        pageDiv.dir = "rtl";
        pageDiv.style.position = "absolute";
        pageDiv.style.left = "-10000px";
        pageDiv.style.top = "0";
        pageDiv.style.width = isSpecial ? "800px" : "1500px";
        pageDiv.style.padding = "30px";
        pageDiv.style.backgroundColor = "#ffffff";
        pageDiv.style.minHeight = "750px";

        let globalStartIdx = 1;
        for(let k=0; k<pIdx; k++) globalStartIdx += pages[k].length;

        const bodyHtml = chunk.map((r, idx) => {
          const globalIdx = globalStartIdx + idx;
          const isActuallyBooked = r.isBooked || !!r.bookingImage;

          const headRow = isSpecial
            ? `<tr><td style="${tdStyle}">${globalIdx}</td><td style="${tdStyle}">${CIRCLE_NAMES[r.circleType]}</td><td style="${tdRightStyle}">${r.headFullName}</td><td style="${tdStyle}">${r.headSurname || '—'}</td><td style="${tdStyle}; color: #0044ff;">رئيس</td><td style="${tdRightStyle}">${r.headMotherName}</td><td style="${tdStyle}">${r.headDob}</td></tr>`
            : `<tr><td style="${tdStyle}">${globalIdx}</td><td style="${tdStyle}">${CIRCLE_NAMES[r.circleType]}</td><td style="${tdStyle}">${isActuallyBooked ? 'محجوز' : 'غير محجوز'}</td><td style="${tdStyle}">${r.isUploaded ? 'مرفوع' : 'غير مرفوع'}</td><td style="${tdRightStyle}">${r.headFullName}</td><td style="${tdStyle}">${r.headSurname || '—'}</td><td style="${tdStyle}; color: #0044ff;">رئيس</td><td style="${tdRightStyle}">${r.headMotherName}</td><td style="${tdStyle}">${r.headDob}</td><td style="${tdStyle}">${r.bookingDate || '—'}</td><td style="${tdStyle}">${formatCurrency(r.paidAmount)}</td><td style="${tdStyle}">${formatCurrency(r.remainingAmount)}</td></tr>`;
          
          const membersRows = r.familyMembers.map(m => isSpecial
            ? `<tr><td style="${tdStyle}">—</td><td style="${tdStyle}">—</td><td style="${tdRightStyle}">${m.fullName}</td><td style="${tdStyle}">${m.surname || '—'}</td><td style="${tdStyle}">${m.relationship}</td><td style="${tdRightStyle}">${m.motherName}</td><td style="${tdStyle}">${m.dob}</td></tr>`
            : `<tr><td style="${tdStyle}">—</td><td style="${tdStyle}">—</td><td style="${tdStyle}">—</td><td style="${tdStyle}">—</td><td style="${tdRightStyle}">${m.fullName}</td><td style="${tdStyle}">${m.surname || '—'}</td><td style="${tdStyle}">${m.relationship}</td><td style="${tdRightStyle}">${m.motherName}</td><td style="${tdStyle}">${m.dob}</td><td style="${tdStyle}">—</td><td style="${tdStyle}">—</td><td style="${tdStyle}">—</td></tr>`
          ).join('');
          return headRow + membersRows;
        }).join('');

        pageDiv.innerHTML = `<div style="text-align: center; margin-bottom: 20px;"><h1 style="font-size: 22px; font-weight: 900; margin: 0; border-bottom: 3px solid #000; display: inline-block; padding-bottom: 5px;">كشف مراجعين محمود قبلان (${isSpecial ? 'نسخة خاصة' : 'نسخة عامة'})</h1><p style="font-size: 12px; font-weight: 700; margin: 10px 0;">التاريخ: ${dateStr} | الورقة: ${pIdx + 1} من ${pages.length} | المجموع: ${recordsToExport.length}</p></div><table style="${tableStyle}"><thead>${headerHtmlStr}</thead><tbody>${bodyHtml}</tbody></table>`;
        document.body.appendChild(pageDiv);
        const canvas = await html2canvas(pageDiv, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
        const imgData = canvas.toDataURL('image/png', 1.0);
        const contentWidth = pdfWidth - (margin * 2);
        let contentHeight = (canvas.height * contentWidth) / canvas.width;
        if (contentHeight > pdfHeight - (margin * 2)) contentHeight = pdfHeight - (margin * 2);
        pdf.addImage(imgData, 'PNG', margin, margin, contentWidth, contentHeight, undefined, 'FAST');
        document.body.removeChild(pageDiv);
      }
      pdf.save(`Reviewer_Records_${type}_${Date.now()}.pdf`);
    } catch (err) {
      console.error("PDF Export Error:", err);
      showToast('حدث خطأ أثناء تصدير الملف', 'error');
    }
    setExportingType(null);
    if(isSelectionMode) setSelectedIds(new Set()); 
  };

  const handleContextMenuClick = (e: React.MouseEvent, record: Reviewer | FamilyMember, type: CurrentContextMenuData['type'], parentRecord?: Reviewer) => {
    e.preventDefault();
    e.stopPropagation(); 
    if (preventClickRef.current || isSelectionMode) return;

    if (type === 'head' && record) setCurrentContextMenuData({ type: 'head', record: record as Reviewer });
    else if (type === 'member' && parentRecord) setCurrentContextMenuData({ type: 'member', member: record as FamilyMember, parentRecord: parentRecord });
    setIsContextMenuModalOpen(true);
  };

  const openSplitFamilyModal = (record: Reviewer) => {
    if (!record.familyMembers || record.familyMembers.length === 0) {
        showToast('لا يمكن قسم عائلة لا تحتوي على أفراد.', 'error');
        return;
    }
    setRecordToSplit(record);
    setShowSplitModal(true);
  };

  const handleSplitFamily = async (selectedMemberIds: string[], newHeadId: string) => {
    if (!recordToSplit) return;
    setIsSplitting(true);
    try {
        const newHeadMember = recordToSplit.familyMembers.find(m => m.id === newHeadId);
        if (!newHeadMember) throw new Error('بيانات الرئيس الجديد غير موجودة');

        const membersToMove = selectedMemberIds.filter(id => id !== newHeadId);

        // 1. Create New Reviewer
        const newReviewerPayload = {
            circle_type: recordToSplit.circleType,
            head_full_name: newHeadMember.fullName,
            head_surname: newHeadMember.surname || recordToSplit.headSurname,
            head_mother_name: newHeadMember.motherName || recordToSplit.headMotherName,
            head_dob: newHeadMember.dob,
            head_phone: '', 
            paid_amount: 0,
            remaining_amount: 0,
            created_at: new Date().toISOString()
        };

        const { data: newReviewer, error: createError } = await supabase
            .from('reviewers')
            .insert(newReviewerPayload)
            .select()
            .single();

        if (createError) throw createError;

        // 2. Move Selected Members
        if (membersToMove.length > 0) {
            const { error: moveError } = await supabase
                .from('family_members')
                .update({ reviewer_id: newReviewer.id })
                .in('id', membersToMove);
            
            if (moveError) throw moveError;
        }

        // 3. Delete the "New Head" from family_members
        const { error: deleteError } = await supabase
            .from('family_members')
            .delete()
            .eq('id', newHeadId);

        if (deleteError) throw deleteError;

        showToast('تم قسم العائلة وإنشاء سجل جديد بنجاح', 'success');
        setShowSplitModal(false);
        setRecordToSplit(null);
        window.location.reload(); 
    } catch (error: any) {
        showToast(`فشل عملية القسم: ${error.message}`, 'error');
    } finally {
        setIsSplitting(false);
    }
  };

  const downloadImage = (base64: string, name: string) => {
    const link = document.createElement('a');
    link.href = base64;
    link.download = `حجز_${name}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getContextMenuItems = (): ContextMenuItem[] => {
    if (!currentContextMenuData) return [];
    
    if (currentContextMenuData.type === 'head') {
      const r = currentContextMenuData.record!;
      const items: ContextMenuItem[] = [
        { 
          label: r.isUploaded ? '🟣 إلغاء حالة الرفع' : '🟣 تمييز كمرفوع بنجاح', 
          onClick: () => {
            if (!r.isUploaded) {
              setRecordIdForUpload(r.id);
              setShowSourceSelectionModal(true);
            } else {
              onToggleUploadStatus?.(r.id, true, null); 
            }
          } 
        },
        { label: r.isBooked ? '🟢 إلغاء النقل من السجلات المحجوزة' : '🟢 نقل الحجز إلى (السجلات المحجوزة)', onClick: () => onToggleBooking?.(r.id, !!r.isBooked, null) }
      ];

      if (r.bookingImage) {
        items.push({ label: 'تنزيل صورة الحجز', onClick: () => downloadImage(r.bookingImage!, r.headFullName) });
      }

      items.push(
        { label: 'تعديل بيانات المراجع', onClick: () => onUpdate(r) },
        { label: 'رفع صورة الحجز (تحليل ذكي ⚡)', onClick: () => { setActiveReviewerId(r.id); fileInputRef.current?.click(); } },
        { isSeparator: true },
        { label: '⚡ قسم العائلة (فصل سجل)', onClick: () => openSplitFamilyModal(r) },
        { isSeparator: true },
        { label: 'حذف السجل نهائياً', onClick: () => setDeleteConfirm({ id: r.id, name: r.headFullName, type: 'head' }), isDestructive: true }
      );
      return items;
    } else {
      const m = currentContextMenuData.member!;
      const parent = currentContextMenuData.parentRecord!;
      return [
        { label: 'حذف هذا الفرد', onClick: () => setDeleteConfirm({ id: m.id, name: m.fullName, type: 'member', parentId: parent.id }), isDestructive: true }
      ];
    }
  };

  const confirmDelete = () => {
    if (!deleteConfirm) return;
    if (deleteConfirm.type === 'head') {
      onDelete(deleteConfirm.id);
    } else if (deleteConfirm.parentId) {
      onDeleteMember(deleteConfirm.parentId, deleteConfirm.id);
    }
    setDeleteConfirm(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && activeReviewerId) {
      showToast('جاري تحليل الصورة وسحب التاريخ...', 'success');
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        let extractedDate = new Date().toLocaleDateString('en-CA');

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const model = 'gemini-3-flash-preview';
            const prompt = "Extract the appointment date (booking_date) from this image. Format: YYYY-MM-DD. Return JSON: { booking_date: string }";
            const response = await ai.models.generateContent({
                model,
                config: { responseMimeType: "application/json" },
                contents: {
                    parts: [
                        { inlineData: { mimeType: file.type, data: base64.split(',')[1] } },
                        { text: prompt }
                    ]
                }
            });
            const text = response.text?.replace(/```json/g, '').replace(/```/g, '').trim() || '{}';
            const json = JSON.parse(text);
            if (json.booking_date) extractedDate = json.booking_date;
        } catch (error) {
            console.error("Date extraction failed", error);
        }

        if (onUploadAndBook) {
          await onUploadAndBook(activeReviewerId, base64, 'reviewer', extractedDate);
        }
      };
      reader.readAsDataURL(file);
    }
    setActiveReviewerId(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="w-full pb-20">
      <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={handleFileChange} />

      {/* Split Family Modal */}
      {showSplitModal && recordToSplit && (
        <SplitFamilyModal 
            isOpen={showSplitModal}
            onClose={() => setShowSplitModal(false)}
            members={recordToSplit.familyMembers}
            currentHeadName={recordToSplit.headFullName}
            onConfirm={handleSplitFamily}
            isProcessing={isSplitting}
        />
      )}

      {/* Last Uploads Modal */}
      {showLastUploadsModal && (
        <LastUploadsModal
          isOpen={showLastUploadsModal}
          onClose={() => setShowLastUploadsModal(false)}
          reviewers={reviewers}
          bookingSources={bookingSources}
          onCancelUpload={async (id, sourceId) => {
             // Wrapper to call the prop toggle function
             if (onToggleUploadStatus) {
                await onToggleUploadStatus(id, true, sourceId); // Toggle from true to false
             }
          }}
          formatCurrency={formatCurrency}
        />
      )}

      {/* Source Selection Modal */}
      {showSourceSelectionModal && (
        <SourceSelectionModal
          isOpen={showSourceSelectionModal}
          onClose={() => { setShowSourceSelectionModal(false); setRecordIdForUpload(null); }}
          sources={bookingSources}
          title="اختيار جهة الرفع"
          onSelectSource={(sourceId) => {
            if (recordIdForUpload) {
              onToggleUploadStatus?.(recordIdForUpload, false, sourceId);
            }
            setShowSourceSelectionModal(false);
            setRecordIdForUpload(null);
          }}
        />
      )}

      {/* Bulk Upload Selected Modal */}
      {showBulkUploadSelectedModal && (
        <SourceSelectionModal
          isOpen={showBulkUploadSelectedModal}
          onClose={() => setShowBulkUploadSelectedModal(false)}
          sources={bookingSources}
          title="اختيار جهة رفع السجلات المحددة"
          onSelectSource={async (sourceId) => {
            if (selectedIds.size > 0) {
                await onBulkToggleUploadStatus(Array.from(selectedIds), true, sourceId);
                setSelectedIds(new Set()); 
            }
            setShowBulkUploadSelectedModal(false);
          }}
        />
      )}

      {/* Special Upload & Export Modal */}
      {showSpecialUploadExportModal && (
        <SourceSelectionModal
          isOpen={showSpecialUploadExportModal}
          onClose={() => setShowSpecialUploadExportModal(false)}
          sources={bookingSources}
          title="رفع وتصدير خاص للمحدد"
          onSelectSource={async (sourceId) => {
            if (sourceId && selectedIds.size > 0) {
               const recordsToProcess = reviewers.filter(r => selectedIds.has(r.id));
               await handleExportPDF(true, recordsToProcess);
               await onBulkToggleUploadStatus(Array.from(selectedIds), true, sourceId);
               setSelectedIds(new Set());
            }
            setShowSpecialUploadExportModal(false);
          }}
        />
      )}

      {previewImage && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/90 p-4" onClick={() => setPreviewImage(null)}>
          <img src={previewImage} className="max-w-full max-h-[80vh] rounded-xl border-4 border-white shadow-2xl animate-scale-up" />
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-scale-up">
          <div className="bg-white p-8 rounded-[2.5rem] w-full max-w-sm text-center border-2 border-slate-900 shadow-2xl relative overflow-hidden">
            <h3 className="text-2xl font-black mb-3 text-red-600">تأكيد الحذف</h3>
            <p className="text-slate-500 mb-8 font-bold text-sm leading-relaxed">
              هل أنت متأكد من حذف <span className="text-red-600 font-black">"{deleteConfirm.name}"</span>؟ لا يمكن التراجع عن هذا الإجراء.
            </p>
            <div className="flex flex-col gap-3">
              <button onClick={confirmDelete} className="w-full bg-red-600 text-white py-4 rounded-2xl font-black text-lg shadow-xl active:scale-95 transition-all">موافق (حذف)</button>
              <button onClick={() => setDeleteConfirm(null)} className="w-full text-slate-400 font-black py-2">إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Action Modals */}
      {showBulkModal && bulkActionType && (
        <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-scale-up">
          <div className="bg-white p-8 rounded-[2.5rem] w-full max-w-sm text-center border-2 border-slate-900 shadow-2xl relative overflow-hidden">
            <h3 className="text-2xl font-black mb-3 text-slate-800">
              {bulkActionType === 'UPLOAD' ? 'تأكيد الرفع الجماعي' : 'تأكيد إلغاء الرفع'}
            </h3>
            <p className="text-slate-500 mb-2 font-bold text-sm leading-relaxed">
              {bulkActionType === 'UPLOAD' 
                ? 'سيتم تمييز جميع الأسماء الظاهرة في القائمة (غير المحجوزة) بأنها "مرفوعة".' 
                : 'سيتم إلغاء حالة الرفع عن جميع الأسماء الظاهرة في القائمة (غير المحجوزة).'}
            </p>
            <div className="bg-slate-100 p-3 rounded-xl mb-6">
              <p className="text-[11px] font-black text-slate-600">عدد السجلات المتأثرة: <span className="text-lg text-blue-600">{getEligibleIdsForBulk(bulkActionType).length}</span></p>
            </div>
            <div className="flex flex-col gap-3">
              <button onClick={confirmBulkAction} className={`w-full py-4 rounded-2xl font-black text-lg shadow-xl active:scale-95 transition-all text-white ${bulkActionType === 'UPLOAD' ? 'bg-fuchsia-600' : 'bg-slate-700'}`}>
                {bulkActionType === 'UPLOAD' ? 'نعم، رفع الجميع' : 'نعم، إلغاء رفع الجميع'}
              </button>
              <button onClick={() => { setShowBulkModal(false); setBulkActionType(null); }} className="w-full text-slate-400 font-black py-2">إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {showBulkDeleteModal && (
        <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-scale-up">
          <div className="bg-white p-8 rounded-[2.5rem] w-full max-w-sm text-center border-2 border-slate-900 shadow-2xl relative overflow-hidden">
            <h3 className="text-2xl font-black mb-3 text-red-600">حذف المحدد</h3>
            <p className="text-slate-500 mb-4 font-bold text-sm leading-relaxed">
              سيتم حذف <span className="text-lg text-red-600 font-black">{selectedIds.size}</span> سجلات بشكل نهائي.
            </p>
            <div className="flex flex-col gap-3">
              <button onClick={handleBulkDeleteConfirm} className="w-full bg-red-600 text-white py-4 rounded-2xl font-black text-lg shadow-xl active:scale-95 transition-all">تأكيد الحذف</button>
              <button onClick={() => setShowBulkDeleteModal(false)} className="w-full text-slate-400 font-black py-2">إلغاء</button>
            </div>
          </div>
        </div>
      )}

      <ContextMenuModal 
        isOpen={isContextMenuModalOpen} 
        onClose={() => setIsContextMenuModalOpen(false)} 
        menuItems={getContextMenuItems()} 
        title={currentContextMenuData?.type === 'head' ? currentContextMenuData.record?.headFullName : currentContextMenuData?.member?.fullName} 
      />

      <div className="bg-white p-3 rounded-2xl border-2 border-slate-900 shadow-sm mb-4">
        {/* Toolbar UI */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 border-b border-slate-100 pb-4">
           <div className="flex items-center gap-4">
             <div className="text-slate-900 font-black text-xs italic flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
                سجلات محمود قبلان
             </div>
             
             <label className="flex items-center gap-3 cursor-pointer group">
                <div className={`w-12 h-6 rounded-full relative transition-colors ${showStats ? 'bg-indigo-600' : 'bg-slate-200'}`}>
                  <input type="checkbox" checked={showStats} onChange={e => setShowStats(e.target.checked)} className="sr-only" />
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${showStats ? 'right-7' : 'right-1'}`}></div>
                </div>
                <span className="font-black text-slate-800 text-xs italic">عرض الاحصائيات</span>
             </label>

             {duplicateCountInCurrentView > 0 && (
                <button 
                  onClick={() => setShowDuplicatesOnly(!showDuplicatesOnly)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all active:scale-95 ${showDuplicatesOnly ? 'bg-red-600 text-white border-red-700 shadow-md' : 'bg-red-50 text-red-700 border-red-100 hover:bg-red-100'}`}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>
                  <span className="text-[10px] font-black">
                    {showDuplicatesOnly ? 'إلغاء فلتر التكرار' : `تنبيه: ${duplicateCountInCurrentView} مكرر (اضغط للعرض)`}
                  </span>
                </button>
             )}
           </div>

           <div className="flex flex-wrap items-center gap-2 justify-start md:justify-end w-full md:w-auto">
              {isSelectionMode ? (
                <>
                  {isAdmin && (
                    <button onClick={() => setShowSpecialUploadExportModal(true)} className="h-9 bg-emerald-700 text-white px-3 rounded-lg text-[10px] font-black active:scale-95 transition-all shadow-sm flex items-center gap-1 animate-scale-up">
                       <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 13 7 8"/><line x1="12" x2="12" y1="13" y2="1"/></svg>
                       رفع وتصدير خاص ({selectedIds.size})
                    </button>
                  )}
                  {isAdmin && (
                    <button onClick={() => setShowBulkUploadSelectedModal(true)} className="h-9 bg-fuchsia-600 text-white px-3 rounded-lg text-[10px] font-black active:scale-95 transition-all shadow-sm flex items-center gap-1 animate-scale-up">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 13 7 8"/><line x1="12" x2="12" y1="13" y2="1"/></svg>
                        رفع المحدد ({selectedIds.size})
                    </button>
                  )}
                  <button onClick={() => setShowBulkDeleteModal(true)} className="h-9 bg-red-600 text-white px-3 rounded-lg text-[10px] font-black active:scale-95 transition-all shadow-sm flex items-center gap-1 animate-scale-up">
                     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                     حذف المحدد ({selectedIds.size})
                  </button>
                  <button onClick={() => handleExportPDF(true)} disabled={exportingType !== null} className="h-9 bg-indigo-700 text-white px-3 rounded-lg text-[10px] font-black active:scale-95 transition-all disabled:opacity-50 animate-scale-up">تصدير PDF (خاص) للمحدد</button>
                  <button onClick={() => setSelectedIds(new Set())} className="h-9 bg-slate-200 text-slate-600 px-3 rounded-lg text-[10px] font-black active:scale-95 transition-all">إلغاء التحديد</button>
                </>
              ) : (
                <>
                  <button onClick={() => setShowLastUploadsModal(true)} className="h-9 bg-purple-600 text-white px-3 rounded-lg text-[10px] font-black active:scale-95 transition-all shadow-sm flex items-center gap-1 animate-scale-up hover:bg-purple-700">
                     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
                     سجل المرفوعات (آخر ما تم رفعه)
                  </button>
                  <div className="hidden md:block w-[1px] h-9 bg-slate-200 mx-1"></div>
                  <button onClick={() => handleBulkActionClick('UPLOAD')} className="h-9 bg-fuchsia-600 text-white px-3 rounded-lg text-[10px] font-black active:scale-95 transition-all shadow-sm flex items-center gap-1">
                     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 13 7 8"/><line x1="12" x2="12" y1="13" y2="1"/></svg>
                     رفع الجميع
                  </button>
                  <button onClick={() => handleBulkActionClick('UNUPLOAD')} className="h-9 bg-slate-200 text-slate-600 px-3 rounded-lg text-[10px] font-black active:scale-95 transition-all shadow-sm flex items-center gap-1 hover:bg-slate-300">
                     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                     إلغاء رفع الجميع
                  </button>
                  <div className="hidden md:block w-[1px] h-9 bg-slate-200 mx-1"></div>
                  <button onClick={() => handleExportPDF(false)} disabled={exportingType !== null} className="h-9 bg-slate-900 text-white px-3 rounded-lg text-[10px] font-black active:scale-95 transition-all disabled:opacity-50">تصدير PDF (عام)</button>
                  <button onClick={() => handleExportPDF(true)} disabled={exportingType !== null} className="h-9 bg-indigo-700 text-white px-3 rounded-lg text-[10px] font-black active:scale-95 transition-all disabled:opacity-50">تصدير PDF (خاص)</button>
                </>
              )}
           </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2 items-center">
          <input type="text" placeholder="بحث بالاسم الكامل..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full h-9 px-4 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-black outline-none" />
          <select value={circleFilter} onChange={e => setCircleFilter(e.target.value)} className="h-9 px-1 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-black outline-none cursor-pointer">
            <option value="ALL">جميع الدوائر</option>
            {Object.values(CircleType).map(t => <option key={t} value={t}>{CIRCLE_NAMES[t]}</option>)}
          </select>
          <select value={familyCountFilter} onChange={e => setFamilyCountFilter(e.target.value)} className="h-9 px-1 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-black outline-none cursor-pointer">
            <option value="ALL">عدد النفرات (الكل)</option>
            {[1,2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n}>{n} أفراد</option>)}
          </select>
          
          <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)} className="h-9 px-1 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-black outline-none cursor-pointer">
            <option value="ALL">فلتر جهة الرفع</option>
            {bookingSources.map(s => <option key={s.id} value={s.id}>{s.sourceName}</option>)}
          </select>

          <select value={uploadFilter} onChange={e => setUploadFilter(e.target.value as UploadStatusFilter)} className="h-9 px-1 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-black outline-none cursor-pointer">
            <option value="ALL">الكل (رفع)</option>
            <option value="UPLOADED">مرفوع</option>
            <option value="NOT_UPLOADED">غير مرفوع</option>
          </select>
          <select value={bookingStatusFilter} onChange={e => setBookingStatusFilter(e.target.value as BookingStatusFilter)} className="h-9 px-1 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-black outline-none cursor-pointer">
            <option value="ALL">الكل (حجز)</option>
            <option value="BOOKED">محجوز</option>
            <option value="NOT_BOOKED">غير محجوز</option>
          </select>
          <input type="date" value={bookingDateFilter} onChange={e => setBookingDateFilter(e.target.value)} className="h-9 px-2 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-black outline-none" />
          <button onClick={() => {setSearchQuery(''); setCircleFilter('ALL'); setUploadFilter('ALL'); setBookingStatusFilter('ALL'); setBookingDateFilter(''); setFamilyCountFilter('ALL'); setSourceFilter('ALL'); setShowDuplicatesOnly(false);}} className="h-9 bg-slate-200 text-slate-600 rounded-lg text-[10px] font-black">إعادة تعيين</button>
        </div>
      </div>

      {/* Stats Grid */}
      {showStats && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 mb-6 animate-scale-up">
          {stats.map(item => (
            <div key={item.circleType} className={`p-3 rounded-xl border-2 transition-all hover:shadow-md ${item.count > 0 ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-100 opacity-60'}`}>
              <p className="text-[10px] font-black text-indigo-700 uppercase mb-1 truncate">{CIRCLE_NAMES[item.circleType]}</p>
              <div className="flex flex-col">
                <span className="text-xl font-black text-indigo-900 leading-none">{item.count}</span>
                <span className="text-[9px] font-black text-emerald-600 mt-1">{formatCurrency(item.money)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div ref={tableContainerRef} className="table-container">
        <table className="responsive-table">
          <thead>
            <tr className="bg-slate-900 text-white text-[11px]">
              <th className="w-8">ت</th>
              <th className="w-24">الدائرة</th>
              <th className="text-right px-2">الاسم</th>
              <th className="w-20">اللقب</th>
              <th className="text-right px-2">الأم</th>
              <th className="w-18">التولد</th>
              <th className="w-14">الصلة</th>
              <th className="w-24">الهاتف</th>
              <th className="w-18">الحالة للحجز</th>
              <th className="w-24">مصدر الحجز</th>
              <th className="w-18">الحالة للرفع</th>
              <th className="w-24">جهة الرفع</th>
              <th className="w-24">سعر الحجز</th>
              <th className="w-32">تاريخ تقييد الاسم</th>
              <th className="w-24">تاريخ الحجز</th>
              <th className="w-32">صورة الحجز</th>
            </tr>
          </thead>
          <tbody>
            {filteredReviewers.map((r, idx) => {
              const isActuallyBooked = r.isBooked || !!r.bookingImage;
              const isDuplicate = globalNameFrequency[r.headFullName.trim()] > 1;
              const isUploaded = r.isUploaded;
              const currentPrice = 
                (r.circleType === CircleType.RIGHT_MOSUL ? r.bookedPriceRightMosul :
                r.circleType === CircleType.LEFT_MOSUL ? r.bookedPriceLeftMosul :
                r.circleType === CircleType.HAMMAM_ALALIL ? r.bookedPriceHammamAlAlil :
                r.circleType === CircleType.ALSHOURA ? r.bookedPriceAlShoura :
                r.circleType === CircleType.BAAJ ? r.bookedPriceBaaj :
                r.bookedPriceOthers) || 0;

              const isSelected = selectedIds.has(r.id);
              const uploadedSource = bookingSourcesMap.get(r.uploadedSourceId || '') || '-';
              const bookedSource = bookingSourcesMap.get(r.bookedSourceId || '') || (isActuallyBooked ? 'يدوي' : '-');

              let rowClasses = `bg-white cursor-pointer transition-colors select-none border-b border-slate-200`;
              
              if (isSelected) {
                rowClasses = `bg-blue-50 outline outline-2 outline-blue-600 -outline-offset-2 select-none cursor-pointer border-b border-blue-200`;
              } else if (isActuallyBooked) {
                rowClasses = `has-booking cursor-pointer transition-colors select-none border-b border-green-200`;
              } else if (isUploaded) {
                rowClasses = `bg-fuchsia-100 cursor-pointer transition-colors select-none border-b border-fuchsia-200`;
              } else if (isDuplicate) {
                rowClasses = `bg-red-100 cursor-pointer transition-colors select-none border-b border-red-200`;
              }

              const textClass = isSelected ? 'text-black' : 'text-slate-900';

              return (
                <React.Fragment key={r.id}>
                  <tr 
                    className={rowClasses} 
                    onContextMenu={(e) => e.preventDefault()}
                    onClick={(e) => handleRowClick(e, r)} 
                    onMouseDown={() => startLongPress(r.id)}
                    onMouseUp={cancelLongPress}
                    onMouseLeave={cancelLongPress}
                    onTouchStart={() => startLongPress(r.id)}
                    onTouchEnd={cancelLongPress}
                  >
                    <td className={`font-black ${textClass}`}>
                        {isSelectionMode ? (
                          <div className="flex items-center justify-center">
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${isSelected ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-300'}`}>
                              {isSelected && <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="4"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                            </div>
                          </div>
                        ) : idx + 1}
                    </td>
                    <td className={`font-black text-[9px] ${isSelected ? 'text-black' : 'text-slate-600'}`}>{CIRCLE_NAMES[r.circleType]}</td>
                    <td className={`text-right font-black px-2 text-[11px] truncate max-w-[130px] ${isDuplicate && !isSelected ? 'text-red-700 underline decoration-wavy decoration-red-600' : 'text-slate-950'} ${textClass}`}>{r.headFullName}</td>
                    <td className={`font-black text-[10px] text-slate-950 ${textClass}`}>{r.headSurname || '—'}</td>
                    <td className={`text-right font-black px-2 text-[10px] truncate max-w-[100px] text-slate-950 ${textClass}`}>{r.headMotherName}</td>
                    <td className={`text-center font-black text-[10px] text-slate-950 ${textClass}`} dir="ltr">{r.headDob}</td>
                    <td className="text-center"><span className="bg-slate-800 text-white text-[8px] font-black px-1.5 py-0.5 rounded">رئيس</span></td>
                    <td className={`text-center font-black text-[10px] text-slate-950 ${textClass}`} dir="ltr">{r.headPhone}</td>
                    
                    {/* Status Columns */}
                    <td><span className={`px-1.5 py-0.5 rounded text-[8px] font-black text-white ${isActuallyBooked ? 'bg-green-600' : 'bg-red-600'}`}>{isActuallyBooked ? 'محجوز' : 'غير محجوز'}</span></td>
                    <td className="text-[9px] font-bold text-blue-700">{bookedSource}</td>
                    <td><span className={`px-1.5 py-0.5 rounded text-[8px] font-black text-white ${isUploaded ? 'bg-fuchsia-600' : 'bg-slate-400'}`}>{isUploaded ? 'مرفوع' : 'غير مرفوع'}</span></td>
                    <td className="text-[9px] font-bold text-fuchsia-700">{uploadedSource}</td>
                    
                    <td className={`text-[10px] font-black ${isSelected ? 'text-black' : 'text-emerald-700'}`}>{formatCurrency(currentPrice)}</td>
                    <td className="text-center text-[9px] font-bold text-slate-500" dir="ltr">
                      {new Date(r.createdAt).toLocaleString('en-GB', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })}
                    </td>
                    <td className={`text-center font-black text-[10px] ${isSelected ? 'text-black' : 'text-blue-700'}`}>{r.bookingDate || '—'}</td>
                    <td className="text-center">
                        {r.bookingImage ? (
                             <button onClick={(e) => { e.stopPropagation(); setPreviewImage(r.bookingImage!); }} className="w-10 h-10 rounded-lg border border-green-600 bg-white shadow-sm overflow-hidden mx-auto"><img src={r.bookingImage} className="w-full h-full object-cover" /></button>
                          ) : <div className="text-slate-200">📷</div>}
                    </td>
                  </tr>
                  {r.familyMembers.map(m => (
                    <tr key={m.id} className={`${isActuallyBooked && !isSelected ? 'bg-green-50' : ''} ${isUploaded && !isSelected ? 'bg-fuchsia-50' : ''} ${isDuplicate && !isSelected ? 'bg-red-50' : ''} ${isSelected ? 'bg-blue-50' : ''} border-b border-slate-50 text-[10px] cursor-pointer select-none`} onClick={(e) => handleContextMenuClick(e, m, 'member', r)} onContextMenu={(e) => handleContextMenuClick(e, m, 'member', r)}>
                      <td colSpan={2}></td>
                      <td className={`text-right font-black px-2 pr-6 ${isSelected ? 'text-black' : 'text-slate-700'}`}>{m.fullName}</td>
                      <td className={`font-black ${isSelected ? 'text-black' : 'text-slate-600'}`}>{m.surname || '—'}</td>
                      <td className={`text-right font-black px-2 ${isSelected ? 'text-black' : 'text-slate-600'}`}>{m.motherName}</td>
                      <td className={`text-center font-black ${isSelected ? 'text-black' : 'text-slate-600'}`} dir="ltr">{m.dob}</td>
                      <td className="text-center"><span className="bg-slate-100 text-slate-500 text-[8px] font-black px-1.5 py-0.5 rounded">{m.relationship}</span></td>
                      <td colSpan={9}></td>
                    </tr>
                  ))}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
