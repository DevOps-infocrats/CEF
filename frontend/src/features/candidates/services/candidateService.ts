import { apiClient } from '@/api/apiClient';
import {
  CandidateApplicationResponse,
  ApplicationsListResponse,
  CandidateDocument,
  DocumentCategory,
  ApplicationRole,
  CreateRolePayload,
  UpdateRolePayload,
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

  getMyApplications: async (): Promise<ApplicationsListResponse> => {
    const response = await apiClient.get<
      ApiResponse<CandidateApplicationResponse[] | ApplicationsListResponse>
    >('/applications');
    const rawData = response.data.data;
    if (Array.isArray(rawData)) {
      return {
        total: rawData.length,
        applications: rawData,
      };
    }
    return rawData;
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

