
import React, { useEffect, useRef } from 'react';

// Define a type for action items
export interface ActionMenuItem {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  isDestructive?: boolean;
  tooltip?: string;
  isSeparator?: false; // Explicitly mark as not a separator or omit
}

// Define a type for separator items
export interface SeparatorMenuItem {
  isSeparator: true;
}

// ContextMenuItem is a union of action items and separator items
export type ContextMenuItem = ActionMenuItem | SeparatorMenuItem;

interface ContextMenuModalProps {
  isOpen: boolean;
  onClose: () => void;
  menuItems: ContextMenuItem[];
  title?: string;
  description?: string;
  warningMessage?: string; // New prop for warning message
}

const ContextMenuModal: React.FC<ContextMenuModalProps> = ({ isOpen, onClose, menuItems, title, description, warningMessage }) => {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
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
    <div 
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-scale-up"
      onClick={onClose} // Close when clicking outside the modal content
    >
      <div 
        ref={modalRef}
        className="bg-white p-6 rounded-[2rem] w-full max-w-lg max-h-[90vh] flex flex-col text-center border-2 border-slate-900 shadow-2xl relative"
        onClick={e => e.stopPropagation()} // Prevent closing when clicking inside the modal content
      >
        <div className="absolute top-0 right-0 z-10 p-2"> {/* Added for consistent positioning */}
            <button 
                onClick={onClose}
                className="p-3 bg-white text-slate-600 rounded-full shadow-lg border border-slate-100 hover:bg-slate-50 hover:text-slate-800 transition-all active:scale-95 flex items-center justify-center"
                aria-label="إغلاق"
            >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            </button>
        </div>
        {title && <h3 className="text-2xl font-black mb-2 text-slate-900 pt-4" dangerouslySetInnerHTML={{ __html: title }}></h3>}
        {description && <p className="text-slate-500 mb-4 font-bold text-sm">{description}</p>}
        
        {warningMessage && (
          <div className="bg-amber-50 border border-amber-200 text-amber-700 font-bold text-xs p-3 rounded-xl mb-4 flex items-center gap-2 justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>
            <span>{warningMessage}</span>
          </div>
        )}

        <div className="flex flex-col gap-1 text-base font-extrabold text-slate-700 flex-1 overflow-y-auto custom-scrollbar">
          {menuItems.map((item, index) => {
            // Check if item is a separator
            if ('isSeparator' in item && item.isSeparator) {
              return <div key={index} className="border-t border-slate-100 my-1"></div>;
            }
            
            // Safe cast since we handled separator case
            const actionItem = item as ActionMenuItem;

            return (
              <button
                key={index}
                onClick={() => {
                  if (!actionItem.disabled) {
                    actionItem.onClick();
                    onClose();
                  }
                }}
                disabled={actionItem.disabled}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-right transition-all group hover:bg-slate-100 active:scale-[0.98] ${actionItem.isDestructive ? 'text-red-600 hover:bg-red-50' : ''} disabled:opacity-50 disabled:cursor-not-allowed`}
                title={actionItem.tooltip || actionItem.label}
              >
                {actionItem.label}
                {actionItem.disabled && actionItem.tooltip && (
                  <span className="text-[10px] text-red-400 font-bold mr-auto">
                    (غير متاح)
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ContextMenuModal;
