import React, { useState, useRef } from 'react';
import { GlassCard } from '@/components/GlassCard';
import { GlassButton } from '@/components/GlassButton';
import { useMasterTemplate, useUploadMasterTemplate } from '@/features/letters/hooks/useLetters';
import { apiClient } from '@/api/apiClient';
import {
  FileText,
  Upload,
  Download,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Shield,
  Layers,
  FileCheck2,
  RefreshCw,
  Loader2,
  HardDrive,
  Info,
} from 'lucide-react';

interface MasterTemplateTabProps {
  templateType: 'letter_of_intent' | 'offer_letter';
  title: string;
  description: string;
  canManage: boolean;
}

export const MasterTemplateTab: React.FC<MasterTemplateTabProps> = ({
  templateType,
  title,
  description,
  canManage,
}) => {
  const { data: template, isLoading } = useMasterTemplate(templateType);
  const uploadMutation = useUploadMasterTemplate(templateType);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isDownloading, setIsDownloading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const formatFileSize = (bytes?: number) => {
    if (!bytes || bytes <= 0) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const lowerName = file.name.toLowerCase();
    const isDocx = lowerName.endsWith('.docx');
    const isPdf = lowerName.endsWith('.pdf');

    if (!isDocx && !isPdf) {
      setFeedback({
        type: 'error',
        text: 'Invalid file format. Please upload a Microsoft Word (.docx) or PDF document.',
      });
      return;
    }

    if (isPdf) {
      // In the portal's document engine, dynamic placeholder discovery and run-level population
      // require Microsoft Word (.docx) format. Candidate letters are generated and delivered as PDFs.
      setFeedback({
        type: 'error',
        text: 'The master template must be in Microsoft Word (.docx) format for dynamic candidate variable mapping. Output letters are rendered and delivered to candidates as high-fidelity PDFs.',
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setFeedback(null);
    uploadMutation.mutate(file, {
      onSuccess: (data) => {
        setFeedback({
          type: 'success',
          text: `Master template '${data.name}' upgraded to Version ${data.version} successfully. Active file is connected.`,
        });
        if (fileInputRef.current) fileInputRef.current.value = '';
      },
      onError: (err: any) => {
        setFeedback({
          type: 'error',
          text: err?.response?.data?.message || err?.message || 'Failed to upload master template.',
        });
      },
    });
  };

  const handleDownload = async () => {
    try {
      setIsDownloading(true);
      const res = await apiClient.get(`/letters/templates/${templateType}/download?t=${Date.now()}`, {
        responseType: 'blob',
      });
      const blob = (
        res.data instanceof Blob
          ? res.data
          : new Blob([res.data], {
              type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            })
      );
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      let filename = template?.filename || `${templateType}_master.docx`;
      const disposition = res.headers ? res.headers['content-disposition'] : null;
      if (disposition) {
        const match = disposition.match(/filename\*?=['"]?(?:UTF-\d['"]*)?([^;\r\n"']*)['"]?/i);
        if (match && match[1]) {
          filename = decodeURIComponent(match[1]);
        }
      }
      link.download = filename;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        text: err?.response?.data?.message || err?.message || 'Failed to download master template.',
      });
    } finally {
      setIsDownloading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-12 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        <span className="text-xs uppercase tracking-wider text-slate-400 font-mono">
          Loading {title} Template...
        </span>
      </div>
    );
  }

  const isFileMissing = template?.file_exists === false;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Banner & Metadata */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600" />
              {title}
            </h2>
            {isFileMissing ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                <AlertTriangle className="w-3.5 h-3.5" />
                File Missing on Storage
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Active Master v{template?.version || 1}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">{description}</p>
        </div>

        <div className="flex items-center gap-2.5">
          <GlassButton
            type="button"
            variant="secondary"
            onClick={handleDownload}
            disabled={isFileMissing || isDownloading}
            className="flex items-center gap-1.5 text-xs py-2 px-3.5"
          >
            {isDownloading ? (
              <Loader2 className="w-4 h-4 animate-spin text-slate-600" />
            ) : (
              <Download className="w-4 h-4 text-slate-600" />
            )}
            <span>Download Master .docx</span>
          </GlassButton>

          {canManage && (
            <div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept=".docx,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf"
                className="hidden"
                id={`upload-template-${templateType}`}
              />
              <GlassButton
                type="button"
                variant="primary"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadMutation.isPending}
                className="flex items-center gap-1.5 text-xs py-2 px-3.5"
              >
                {uploadMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Uploading...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    <span>{isFileMissing ? 'Upload to Restore Master' : 'Upload / Replace Master'}</span>
                  </>
                )}
              </GlassButton>
            </div>
          )}
        </div>
      </div>

      {/* Missing File Warning if applicable */}
      {isFileMissing && (
        <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <p className="font-semibold">Original master file is not currently found on the server storage.</p>
            <p className="text-rose-700">
              Database record exists for <strong>{template?.filename}</strong> (Version {template?.version}). Please click the <strong>Upload to Restore Master</strong> button above to reconnect your master Word document.
            </p>
          </div>
        </div>
      )}

      {/* Feedback Alert */}
      {feedback && (
        <div
          className={`p-4 rounded-xl border flex items-start gap-3 transition-all ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : feedback.type === 'info'
              ? 'bg-blue-50 border-blue-200 text-blue-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
          ) : feedback.type === 'info' ? (
            <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
          )}
          <div className="text-xs font-medium leading-relaxed">{feedback.text}</div>
        </div>
      )}

      {/* Template Details Card */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <GlassCard className="bg-slate-50/70 border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-slate-400 block">Template Version</span>
              <span className="text-sm font-bold text-slate-800">
                Version {template?.version || 1} (Master)
              </span>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="bg-slate-50/70 border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-slate-400 block">Active Master File</span>
              <span className="text-sm font-bold text-slate-800 truncate block max-w-[180px]" title={template?.filename}>
                {template?.filename || `${templateType}.docx`}
              </span>
              {template?.file_size ? (
                <span className="text-[11px] text-slate-400 font-mono">
                  {formatFileSize(template.file_size)}
                </span>
              ) : null}
            </div>
          </div>
        </GlassCard>

        <GlassCard className="bg-slate-50/70 border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              isFileMissing ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
            }`}>
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-slate-400 block">Storage Status</span>
              <span className={`text-xs font-bold block ${
                isFileMissing ? 'text-rose-700' : 'text-emerald-700'
              }`}>
                {isFileMissing ? 'Missing on Storage' : 'Connected & Active'}
              </span>
              <span className="text-[11px] text-slate-400">
                {isFileMissing ? 'Upload needed' : 'Verified on disk'}
              </span>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="bg-slate-50/70 border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-slate-400 block">Last Updated</span>
              <span className="text-sm font-bold text-slate-800">
                {template?.created_at
                  ? new Date(template.created_at).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : 'System Default'}
              </span>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Dynamic Placeholder Mappings Table */}
      <GlassCard className="border-slate-200 overflow-hidden p-0">
        <div className="p-4 bg-slate-50/80 border-b border-slate-200/80 flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 text-indigo-600" />
              Dynamic Placeholder Mappings
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              These candidate-specific fields are automatically populated into working copies when a candidate letter is opened.
            </p>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {template?.field_mappings?.length || 0} active tags
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-100/70 text-slate-600 font-semibold border-b border-slate-200">
                <th className="py-2.5 px-4 font-mono">Placeholder Tag</th>
                <th className="py-2.5 px-4">Field Label</th>
                <th className="py-2.5 px-4">Resolution Description</th>
                <th className="py-2.5 px-4">Database Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {(template?.field_mappings || []).map((m, idx) => (
                <tr key={idx} className="hover:bg-indigo-50/30 transition-colors">
                  <td className="py-2.5 px-4 font-mono text-indigo-600 font-bold bg-indigo-50/40">
                    {m.placeholder}
                  </td>
                  <td className="py-2.5 px-4 font-medium text-slate-900">{m.label}</td>
                  <td className="py-2.5 px-4 text-slate-500">{m.description}</td>
                  <td className="py-2.5 px-4">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-mono text-[11px]">
                      candidate_applications
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* Security & Immutability Notice */}
      <div className="p-3.5 rounded-xl bg-indigo-50/60 border border-indigo-100 flex items-start gap-3">
        <Shield className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-indigo-900/90 leading-relaxed">
          <strong>Master Protection Guarantee:</strong> Uploaded master files remain 100% read-only and immutable. When candidate letters are generated, the portal produces isolated working draft copies. The original master file is never modified or overwritten during candidate processing.
        </p>
      </div>
    </div>
  );
};
