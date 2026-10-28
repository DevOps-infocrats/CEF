import { apiClient } from '@/api/apiClient';
import {
  CandidateApplicationResponse,
  ApplicationsListResponse,
  CandidateDocument,
  DocumentCategory,
  ApplicationRole,
  CreateRolePayload,
  UpdateRolePayload,
  CandidateFilterParams,
  ApplicationCreator,
} from '../types';
import { CandidateApplicationFormOutput } from '../schemas';

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

export const candidateService = {
  createApplication: async (
    data: CandidateApplicationFormOutput
  ): Promise<CandidateApplicationResponse> => {
    const response = await apiClient.post<ApiResponse<CandidateApplicationResponse>>(
      '/applications',
      data
    );
    return response.data.data;
  },

  updateApplication: async (
    id: string,
    data: Partial<CandidateApplicationFormOutput>
  ): Promise<CandidateApplicationResponse> => {
    const response = await apiClient.put<ApiResponse<CandidateApplicationResponse>>(
      `/applications/${id}`,
      data
    );
    return response.data.data;
  },

  getMyApplications: async (
    filters?: CandidateFilterParams
  ): Promise<ApplicationsListResponse> => {
    const params = new URLSearchParams();
    if (filters) {
      if (filters.candidate_name) params.append('candidate_name', filters.candidate_name);
      if (filters.hr_name) params.append('hr_name', filters.hr_name);
      if (filters.created_by_id) params.append('created_by_id', filters.created_by_id);
      if (filters.start_date) params.append('start_date', filters.start_date);
      if (filters.end_date) params.append('end_date', filters.end_date);
      if (filters.status && filters.status !== 'ALL') params.append('status', filters.status);
    }
    const query = params.toString() ? `?${params.toString()}` : '';
    const response = await apiClient.get<
      ApiResponse<CandidateApplicationResponse[] | ApplicationsListResponse>
    >(`/applications${query}`);
    const rawData = response.data.data;
    if (Array.isArray(rawData)) {
      return {
        total: rawData.length,
        applications: rawData,
      };
    }
    return rawData;
  },

  getApplicationCreators: async (): Promise<ApplicationCreator[]> => {
    const response = await apiClient.get<ApiResponse<ApplicationCreator[]>>('/applications/creators');
    return response.data.data;
  },

  downloadExcelReport: async (filters?: CandidateFilterParams): Promise<void> => {
    const params = new URLSearchParams();
    if (filters) {
      if (filters.candidate_name) params.append('candidate_name', filters.candidate_name);
      if (filters.hr_name) params.append('hr_name', filters.hr_name);
      if (filters.created_by_id) params.append('created_by_id', filters.created_by_id);
      if (filters.start_date) params.append('start_date', filters.start_date);
      if (filters.end_date) params.append('end_date', filters.end_date);
      if (filters.status && filters.status !== 'ALL') params.append('status', filters.status);
    }
    const query = params.toString() ? `?${params.toString()}` : '';
    const response = await apiClient.get(`/applications/export${query}`, {
      responseType: 'blob',
    });

    let filename = `CEF_Candidate_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
    const disposition =
      response.headers?.['content-disposition'] ||
      (typeof (response.headers as any)?.get === 'function'
        ? (response.headers as any).get('content-disposition')
        : undefined);

    if (disposition) {
      const utf8Match = disposition.match(/filename\*=UTF-8''([^;\n]+)/i);
      if (utf8Match && utf8Match[1]) {
        filename = decodeURIComponent(utf8Match[1].trim());
      } else {
        const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (match && match[1]) {
          filename = match[1].replace(/['"]/g, '').trim();
        }
      }
    }

    const blob = new Blob([response.data], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  },

  getApplicationById: async (
    id: string
  ): Promise<CandidateApplicationResponse> => {
    const response = await apiClient.get<ApiResponse<CandidateApplicationResponse>>(
      `/applications/${id}`
    );
    return response.data.data;
  },

  uploadDocument: async (
    file: File,
    category: DocumentCategory
  ): Promise<CandidateDocument> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', category);

    const response = await apiClient.post<ApiResponse<CandidateDocument>>(
      '/applications/documents/upload',
      formData
    );
    return response.data.data;
  },

  getStagedDocuments: async (): Promise<CandidateDocument[]> => {
    const response = await apiClient.get<ApiResponse<CandidateDocument[]>>(
      '/applications/documents'
    );
    return response.data.data;
  },

  deleteDocument: async (docId: string): Promise<void> => {
    await apiClient.delete(`/applications/documents/${docId}`);
  },

  getDocumentDownloadUrl: (docId: string): string => {
    return `/api/v1/applications/documents/${docId}`;
  },

  // Dynamic Designation Roles
  getActiveRoles: async (): Promise<ApplicationRole[]> => {
    const response = await apiClient.get<ApiResponse<ApplicationRole[]>>(
      '/applications/roles'
    );
    return response.data.data;
  },

  getAllRoles: async (): Promise<ApplicationRole[]> => {
    const response = await apiClient.get<ApiResponse<ApplicationRole[]>>(
      '/applications/roles?all=true'
    );
    return response.data.data;
  },

  createRole: async (data: CreateRolePayload): Promise<ApplicationRole> => {
    const response = await apiClient.post<ApiResponse<ApplicationRole>>(
      '/applications/roles',
      data
    );
    return response.data.data;
  },

  updateRole: async (id: string, data: UpdateRolePayload): Promise<ApplicationRole> => {
    const response = await apiClient.put<ApiResponse<ApplicationRole>>(
      `/applications/roles/${id}`,
      data
    );
    return response.data.data;
  },

  toggleRoleActive: async (id: string): Promise<ApplicationRole> => {
    const response = await apiClient.patch<ApiResponse<ApplicationRole>>(
      `/applications/roles/${id}/toggle-active`
    );
    return response.data.data;
  },
};

