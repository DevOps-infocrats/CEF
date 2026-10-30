import { apiClient } from '@/api/apiClient';
import {
  VerificationApplication,
  VerificationChecklistResponse,
  VerificationActionResponse,
  BulkVerificationActionResponse,
  BulkCandidateActionResponse,
} from '../types';

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

export const verificationService = {
  /**
   * List all applications eligible for verification.
   * Admins and Reviewers receive all applications submitted in the database.
   */
  getApplications: async (): Promise<VerificationApplication[]> => {
    const response = await apiClient.get<ApiResponse<VerificationApplication[] | { applications: VerificationApplication[] }>>(
      '/applications'
    );
    const rawData = response.data.data;
    if (Array.isArray(rawData)) {
      return rawData;
    }
    if (rawData && Array.isArray((rawData as any).applications)) {
      return (rawData as any).applications;
    }
    return [];
  },

  /**
   * Fetch single application with optional unmasking for authorized HR verifiers.
   */
  getApplicationDetail: async (
    applicationId: string,
    unmask: boolean = false
  ): Promise<VerificationApplication> => {
    const query = unmask ? '?unmask=true' : '';
    const response = await apiClient.get<ApiResponse<VerificationApplication>>(
      `/applications/${applicationId}${query}`
    );
    return response.data.data;
  },

  /**
   * Retrieve checklist items and dynamic verification progress for an application.
   */
  getChecklist: async (
    applicationId: string
  ): Promise<VerificationChecklistResponse> => {
    const response = await apiClient.get<ApiResponse<VerificationChecklistResponse>>(
      `/applications/${applicationId}/verification`
    );
    return response.data.data;
  },

  /**
   * Mark an individual checklist item as Done.
   */
  markItemDone: async (
    applicationId: string,
    itemKey: string,
    remarks?: string
  ): Promise<VerificationActionResponse> => {
    const response = await apiClient.post<ApiResponse<VerificationActionResponse>>(
      `/applications/${applicationId}/verification/${itemKey}/done`,
      { remarks }
    );
    return response.data.data;
  },

  /**
   * Revert a checklist item back to Pending status.
   */
  resetItemStatus: async (
    applicationId: string,
    itemKey: string,
    remarks?: string
  ): Promise<VerificationActionResponse> => {
    const response = await apiClient.post<ApiResponse<VerificationActionResponse>>(
      `/applications/${applicationId}/verification/${itemKey}/reset`,
      { remarks }
    );
    return response.data.data;
  },

  /**
   * Mark eligible checklist items as Done in one action for the current candidate.
   * Supports optional filtering by itemKeys or onlyDocuments.
   */
  bulkMarkDone: async (
    applicationId: string,
    options?: { itemKeys?: string[]; onlyDocuments?: boolean }
  ): Promise<BulkVerificationActionResponse> => {
    const payload: Record<string, any> = {};
    if (options?.itemKeys && options.itemKeys.length > 0) {
      payload.item_keys = options.itemKeys;
    }
    if (options?.onlyDocuments !== undefined) {
      payload.only_documents = options.onlyDocuments;
    }
    const response = await apiClient.post<ApiResponse<BulkVerificationActionResponse>>(
      `/applications/${applicationId}/verification/bulk-done`,
      payload
    );
    return response.data.data;
  },

  /**
   * Final candidate approval by authorized HR reviewer.
   */
  approveCandidate: async (
    applicationId: string
  ): Promise<VerificationApplication> => {
    const response = await apiClient.post<ApiResponse<VerificationApplication>>(
      `/applications/${applicationId}/approve`
    );
    return response.data.data;
  },

  /**
   * Bulk approve multiple eligible candidate applications.
   */
  bulkApproveApplications: async (
    applicationIds: string[]
  ): Promise<BulkCandidateActionResponse> => {
    const response = await apiClient.post<ApiResponse<BulkCandidateActionResponse>>(
      '/applications/bulk-approve',
      { application_ids: applicationIds }
    );
    return response.data.data;
  },

  /**
   * Final candidate rejection by authorized HR reviewer with non-empty reason.
   */
  rejectCandidate: async (
    applicationId: string,
    reason: string
  ): Promise<VerificationApplication> => {
    const response = await apiClient.post<ApiResponse<VerificationApplication>>(
      `/applications/${applicationId}/reject`,
      { reason }
    );
    return response.data.data;
  },

  /**
   * Bulk reject multiple candidate applications with mandatory reason.
   */
  bulkRejectApplications: async (
    applicationIds: string[],
    reason: string
  ): Promise<BulkCandidateActionResponse> => {
    const response = await apiClient.post<ApiResponse<BulkCandidateActionResponse>>(
      '/applications/bulk-reject',
      { application_ids: applicationIds, reason }
    );
    return response.data.data;
  },

  /**
   * Manually update candidate site-joining status and date.
   */
  updateJoiningStatus: async (
    applicationId: string,
    data: {
      status: 'JOINED' | 'NOT_JOINED' | 'PENDING';
      joining_date?: string;
      notes?: string;
    }
  ): Promise<VerificationApplication> => {
    const response = await apiClient.post<ApiResponse<VerificationApplication>>(
      `/applications/${applicationId}/joining-status`,
      data
    );
    return response.data.data;
  },

  /**
   * Get secure download/stream URL for an attached document.
   */
  getDocumentUrl: (documentId: string): string => {
    return `/api/v1/applications/documents/${documentId}`;
  },
};
