import { apiClient } from '@/api/apiClient';
import { ApiResponse } from '@/features/auth/types';
import { MasterTemplate, CandidateLettersData, CandidateLetterDto } from '../types';

export const letterService = {
  getMasterTemplate: async (templateType: 'letter_of_intent' | 'offer_letter'): Promise<MasterTemplate> => {
    const res = await apiClient.get<ApiResponse<MasterTemplate>>(`/letters/templates/${templateType}`);
    return res.data.data;
  },

  uploadMasterTemplate: async (
    templateType: 'letter_of_intent' | 'offer_letter',
    file: File
  ): Promise<MasterTemplate> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await apiClient.post<ApiResponse<MasterTemplate>>(
      `/letters/templates/${templateType}/upload`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return res.data.data;
  },

  getCandidateLetters: async (appId: string): Promise<CandidateLettersData> => {
    const res = await apiClient.get<ApiResponse<CandidateLettersData>>(`/applications/${appId}/letters`);
    return res.data.data;
  },

  updateCandidateLetter: async (
    appId: string,
    letterType: 'letter_of_intent' | 'offer_letter',
    fieldValues: Record<string, any>,
    revisedFile?: File,
    textEdits?: Record<string, string>,
    paragraphs?: Record<string, string>,
    tableCells?: Record<string, string>
  ): Promise<CandidateLetterDto> => {
    if (revisedFile) {
      const formData = new FormData();
      formData.append('file', revisedFile);
      formData.append('field_values', JSON.stringify(fieldValues));
      if (textEdits) formData.append('text_edits', JSON.stringify(textEdits));
      if (paragraphs) formData.append('paragraphs', JSON.stringify(paragraphs));
      if (tableCells) formData.append('table_cells', JSON.stringify(tableCells));
      const res = await apiClient.patch<ApiResponse<CandidateLetterDto>>(
        `/applications/${appId}/letters/${letterType}`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );
      return res.data.data;
    }

    const res = await apiClient.patch<ApiResponse<CandidateLetterDto>>(
      `/applications/${appId}/letters/${letterType}`,
      {
        field_values: fieldValues,
        text_edits: textEdits,
        paragraphs: paragraphs,
        table_cells: tableCells,
      }
    );
    return res.data.data;
  },

  updateJoiningDate: async (
    appId: string,
    joiningDate: string
  ): Promise<{ application_id: string; joining_date: string }> => {
    const res = await apiClient.patch<ApiResponse<{ application_id: string; joining_date: string }>>(
      `/applications/${appId}/joining-date`,
      { joining_date: joiningDate }
    );
    return res.data.data;
  },

  sendCandidateLetters: async (
    appId: string,
    forceResend: boolean = false,
    documentScope: string = 'both'
  ): Promise<{ success: boolean; message: string; recipient: string; sent_at: string }> => {
    const res = await apiClient.post<ApiResponse<any>>(
      `/applications/${appId}/letters/send`,
      { force_resend: forceResend, document_scope: documentScope }
    );
    return res.data.data;
  },

  previewCandidateEmail: async (
    appId: string,
    documentScope: string = 'both'
  ): Promise<{
    subject: string;
    html: string;
    text: string;
    recipient: string;
    candidate_name: string;
    application_number: string;
    role_applied: string;
    attachments: string[];
  }> => {
    const res = await apiClient.get<ApiResponse<any>>(
      `/applications/${appId}/letters/email-preview?document_scope=${documentScope}`
    );
    return res.data.data;
  },

  getSmtpStatus: async (
    testEmail?: string
  ): Promise<{
    success: boolean;
    mode: 'smtp' | 'not_configured' | 'smtp_error';
    message: string;
    config: {
      host: string | null;
      port: number;
      user: string | null;
      sender_email: string;
    };
  }> => {
    const url = testEmail
      ? `/letters/smtp-status?test_email=${encodeURIComponent(testEmail)}`
      : `/letters/smtp-status`;
    const res = await apiClient.get<ApiResponse<any>>(url);
    return res.data.data;
  },
};
