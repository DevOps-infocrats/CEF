import React from 'react';
import { Modal } from '@/components/Modal';
import { CandidateDocument } from '@/features/candidates/types';
import { ExternalLink, Download, FileText, AlertCircle } from 'lucide-react';

interface DocumentPreviewModalProps {
  document: CandidateDocument | null;
  isOpen: boolean;
  onClose: () => void;
}

export const DocumentPreviewModal: React.FC<DocumentPreviewModalProps> = ({
  document,
  isOpen,
  onClose,
}) => {
  if (!document) return null;

  const downloadUrl = `/api/v1/applications/documents/${document.id}`;
  const isImage =
    document.content_type.startsWith('image/') ||
    /\.(png|jpe?g)$/i.test(document.original_filename);
  const isPdf =
    document.content_type === 'application/pdf' ||
    /\.pdf$/i.test(document.original_filename);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Document Inspection — ${document.original_filename}`}
      maxWidth="xl"
    >
      <div className="space-y-4">
        {/* Document Metadata Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
          <div className="space-y-0.5">
            <span className="text-slate-500 font-medium">Category:</span>
            <span className="ml-1.5 font-bold text-slate-800 uppercase tracking-wider">
              {document.category.replace(/_/g, ' ')}
            </span>
          </div>
          <div className="space-y-0.5">
            <span className="text-slate-500 font-medium">Size:</span>
            <span className="ml-1.5 font-semibold text-slate-800">
              {(document.file_size / (1024 * 1024)).toFixed(2)} MB
            </span>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold text-xs transition-colors shadow-xs"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Open in New Tab</span>
            </a>
            <a
              href={downloadUrl}
              download={document.original_filename}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg font-semibold text-xs transition-colors shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download File</span>
            </a>
          </div>
        </div>

        {/* Preview Frame */}
        <div className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-900/5 min-h-[450px] max-h-[600px] flex items-center justify-center">
          {isImage ? (
            <img
              src={downloadUrl}
              alt={document.original_filename}
              className="max-h-[580px] w-auto object-contain mx-auto rounded-lg shadow-sm"
              loading="lazy"
            />
          ) : isPdf ? (
            <iframe
              src={`${downloadUrl}#toolbar=0`}
              title={document.original_filename}
              className="w-full h-[550px] border-none"
            />
          ) : (
            <div className="p-12 text-center space-y-3">
              <FileText className="w-12 h-12 text-slate-400 mx-auto" />
              <p className="text-sm font-semibold text-slate-700">
                Preview not available in embedded viewer
              </p>
              <p className="text-xs text-slate-500">
                Please download or open the file directly in a new browser tab to inspect its contents.
              </p>
              <a
                href={downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold text-xs transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Open Document</span>
              </a>
            </div>
          )}
        </div>

        {/* Security / Compliance Notice */}
        <div className="flex items-start gap-2 p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl text-xs text-indigo-900">
          <AlertCircle className="w-4 h-4 text-indigo-700 flex-shrink-0 mt-0.5" />
          <p>
            <strong>HR Compliance & Verification:</strong> Ensure you have thoroughly inspected the document legitimacy, watermark, expiry, and signature before marking this item as Done.
          </p>
        </div>
      </div>
    </Modal>
  );
};
