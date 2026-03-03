import { useState, useRef } from 'react';
import { Upload, FileText, Download, Eye, RotateCw } from 'lucide-react';
import { useToast } from '../../../../context/ToastContext';
import { useATSData } from '../../../../context/ATSDataContext';

const ResumeCard = ({ candidate }) => {
    const { uploadResume } = useATSData();
    const { addToast } = useToast();
    const fileInputRef = useRef(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isDragging, setIsDragging] = useState(false);

    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (file) handleUpload(file);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) handleUpload(file);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleUpload = async (file) => {
        // Validate
        const validTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
        if (!validTypes.includes(file.type)) {
            addToast('Invalid file type. Please upload PDF, DOC, or DOCX.', 'error');
            return;
        }
        if (file.size > 5 * 1024 * 1024) { // 5MB limit
            addToast('File is too large (max 5MB).', 'error');
            return;
        }

        setIsUploading(true);
        try {
            await uploadResume(file, candidate.id);
            addToast('Resume uploaded successfully!', 'success');
        } catch (err) {
            console.error(err);
            addToast('Failed to upload resume.', 'error');
        } finally {
            setIsUploading(false);
        }
    };

    const formatFileSize = (bytes) => {
        if (!bytes) return 'Unknown size';
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    const hasResume = !!candidate.resumeUrl;

    return (
        <div className="p-4 bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-sm">
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-[var(--text-primary)]">Resume</h3>
                {hasResume && (
                    <button
                        className="p-1 rounded text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                        onClick={() => fileInputRef.current.click()}
                        title="Replace Resume"
                    >
                        <RotateCw size={16} />
                    </button>
                )}
            </div>

            <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                accept=".pdf,.doc,.docx"
                onChange={handleFileSelect}
            />

            {hasResume ? (
                <div className="flex flex-col gap-4">
                    <div className="flex items-start gap-3 p-3 bg-[var(--bg-tertiary)] rounded-lg">
                        <div className="p-2 bg-[var(--bg-surface)] rounded text-[var(--accent)]">
                            <FileText size={24} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-sm text-[var(--text-primary)] truncate" title={candidate.resumeName || 'Resume'}>
                                {candidate.resumeName || 'Resume'}
                            </h4>
                            <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                                <span>{formatFileSize(candidate.resumeSize)}</span>
                                <span className="opacity-50">•</span>
                                <span>{new Date(candidate.resumeUploadedAt || candidate.updatedAt).toLocaleDateString()}</span>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <a
                            href={candidate.resumeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-[var(--text-primary)] bg-[var(--bg-tertiary)] rounded-lg hover:bg-[var(--bg-tertiary)]/80 transition-colors"
                        >
                            <Eye size={16} /> View
                        </a>
                        <a
                            href={candidate.resumeUrl}
                            download
                            className="flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-[var(--text-primary)] bg-[var(--bg-tertiary)] rounded-lg hover:bg-[var(--bg-tertiary)]/80 transition-colors"
                        >
                            <Download size={16} /> Download
                        </a>
                    </div>
                </div>
            ) : (
                <div
                    className={`border-2 border-dashed border-[var(--border-secondary)] rounded-lg p-6 text-center cursor-pointer transition-colors hover:border-[var(--accent)] hover:bg-[var(--accent)]/5 ${isDragging ? 'border-[var(--accent)] bg-[var(--accent)]/5' : ''}`}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onClick={() => fileInputRef.current.click()}
                >
                    {isUploading ? (
                        <div className="flex flex-col items-center gap-2 text-[var(--accent)]">
                            <div className="animate-spin rounded-full h-5 w-5 border-2 border-[var(--accent)] border-t-transparent" />
                            <span className="text-sm font-medium">Uploading...</span>
                        </div>
                    ) : (
                        <>
                            <div className="text-[var(--text-secondary)] mb-2 flex justify-center">
                                <Upload size={24} />
                            </div>
                            <p className="text-sm font-medium text-[var(--text-primary)] mb-1">
                                Click or drag file to upload
                            </p>
                            <p className="text-xs text-[var(--text-secondary)]">
                                PDF, DOC, DOCX (Max 5MB)
                            </p>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default ResumeCard;
