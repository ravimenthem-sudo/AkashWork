import React from 'react';
import { X } from 'lucide-react';

const Modal = ({ isOpen, onClose, title, children, size = 'md', footer }) => {
    if (!isOpen) return null;

    const sizeClasses = {
        sm: 'max-w-sm',
        md: 'max-w-md',
        lg: 'max-w-lg',
        xl: 'max-w-xl',
        full: 'max-w-full'
    };

    return (
        <React.Fragment>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
                <div
                    className={`bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl shadow-2xl w-full ${sizeClasses[size] || 'max-w-md'} flex flex-col max-h-[90vh]`}
                    onClick={e => e.stopPropagation()}
                >
                    <div className="flex items-center justify-between p-6 border-b border-[var(--border-primary)] shrink-0">
                        <h3 className="text-xl font-semibold text-[var(--text-primary)]">{title}</h3>
                        <button
                            className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors"
                            onClick={onClose}
                        >
                            <X size={20} />
                        </button>
                    </div>
                    <div className="p-6 overflow-y-auto custom-scrollbar grow">
                        {children}
                    </div>
                    {footer && (
                        <div className="p-6 border-t border-[var(--border-primary)] bg-[var(--bg-secondary)] rounded-b-xl shrink-0">
                            {footer}
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                .max-w-sm { max-width: 24rem; }
                .max-w-md { max-width: 32rem; }
                .max-w-lg { max-width: 48rem; }
                .max-w-xl { max-width: 64rem; }
            `}</style>
        </React.Fragment>
    );
};

export default Modal;
