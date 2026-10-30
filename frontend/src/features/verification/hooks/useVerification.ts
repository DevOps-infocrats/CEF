import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { verificationService } from '../services/verificationService';

export const VERIFICATION_LIST_QUERY_KEY = ['verification-applications-list'];
export const VERIFICATION_CHECKLIST_KEY = (appId: string) => ['verification-checklist', appId];
export const APPLICATION_DETAIL_KEY = (appId: string, unmask: boolean) => ['application-detail', appId, unmask];

export const useVerificationApplications = () => {
  return useQuery({
    queryKey: VERIFICATION_LIST_QUERY_KEY,
    queryFn: () => verificationService.getApplications(),
    staleTime: 1000 * 60, // 60 seconds
  });
};

export const useApplicationVerificationDetail = (appId: string, unmask: boolean = false) => {
  return useQuery({
    queryKey: APPLICATION_DETAIL_KEY(appId, unmask),
    queryFn: () => verificationService.getApplicationDetail(appId, unmask),
    enabled: !!appId,
    staleTime: 1000 * 60, // 60 seconds
  });
};

export const useVerificationChecklist = (appId: string) => {
  return useQuery({
    queryKey: VERIFICATION_CHECKLIST_KEY(appId),
    queryFn: () => verificationService.getChecklist(appId),
    enabled: !!appId,
    staleTime: 1000 * 60, // 60 seconds
  });
};

export const useMarkItemDone = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      applicationId,
      itemKey,
      remarks,
    }: {
      applicationId: string;
      itemKey: string;
      remarks?: string;
    }) => verificationService.markItemDone(applicationId, itemKey, remarks),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: VERIFICATION_CHECKLIST_KEY(variables.applicationId) });
      queryClient.invalidateQueries({ queryKey: ['application-detail', variables.applicationId] });
      queryClient.invalidateQueries({ queryKey: VERIFICATION_LIST_QUERY_KEY });
    },
  });
};

export const useResetItemStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      applicationId,
      itemKey,
      remarks,
    }: {
      applicationId: string;
      itemKey: string;
      remarks?: string;
    }) => verificationService.resetItemStatus(applicationId, itemKey, remarks),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: VERIFICATION_CHECKLIST_KEY(variables.applicationId) });
      queryClient.invalidateQueries({ queryKey: ['application-detail', variables.applicationId] });
      queryClient.invalidateQueries({ queryKey: VERIFICATION_LIST_QUERY_KEY });
    },
  });
};

export const useBulkMarkItemsDone = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (variables: string | { applicationId: string; itemKeys?: string[]; onlyDocuments?: boolean }) => {
      const appId = typeof variables === 'string' ? variables : variables.applicationId;
      const opts = typeof variables === 'string' ? undefined : { itemKeys: variables.itemKeys, onlyDocuments: variables.onlyDocuments };
      return verificationService.bulkMarkDone(appId, opts);
    },
    onSuccess: (_, variables) => {
      const appId = typeof variables === 'string' ? variables : variables.applicationId;
      queryClient.invalidateQueries({ queryKey: VERIFICATION_CHECKLIST_KEY(appId) });
      queryClient.invalidateQueries({ queryKey: ['application-detail', appId] });
      queryClient.invalidateQueries({ queryKey: VERIFICATION_LIST_QUERY_KEY });
    },
  });
};

export const useApproveCandidate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (applicationId: string) => verificationService.approveCandidate(applicationId),
    onSuccess: (_, applicationId) => {
      queryClient.invalidateQueries({ queryKey: VERIFICATION_CHECKLIST_KEY(applicationId) });
      queryClient.invalidateQueries({ queryKey: ['application-detail', applicationId] });
      queryClient.invalidateQueries({ queryKey: VERIFICATION_LIST_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['candidate-letters', applicationId] });
    },
  });
};

export const useBulkApproveApplications = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (applicationIds: string[]) => verificationService.bulkApproveApplications(applicationIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: VERIFICATION_LIST_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['candidate-letters'] });
    },
  });
};

export const useRejectCandidate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ applicationId, reason }: { applicationId: string; reason: string }) =>
      verificationService.rejectCandidate(applicationId, reason),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: VERIFICATION_CHECKLIST_KEY(variables.applicationId) });
      queryClient.invalidateQueries({ queryKey: ['application-detail', variables.applicationId] });
      queryClient.invalidateQueries({ queryKey: VERIFICATION_LIST_QUERY_KEY });
    },
  });
};

export const useBulkRejectApplications = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ applicationIds, reason }: { applicationIds: string[]; reason: string }) =>
      verificationService.bulkRejectApplications(applicationIds, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: VERIFICATION_LIST_QUERY_KEY });
    },
  });
};

export const useUpdateJoiningStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      applicationId,
      status,
      joining_date,
      notes,
    }: {
      applicationId: string;
      status: 'JOINED' | 'NOT_JOINED' | 'PENDING';
      joining_date?: string;
      notes?: string;
    }) =>
      verificationService.updateJoiningStatus(applicationId, {
        status,
        joining_date,
        notes,
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: VERIFICATION_LIST_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['application-detail', variables.applicationId] });
      queryClient.invalidateQueries({ queryKey: ['my-applications'] });
      queryClient.invalidateQueries({ queryKey: ['candidate-letters', variables.applicationId] });
    },
  });
};

