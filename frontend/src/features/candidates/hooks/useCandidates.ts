import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { candidateService } from '../services/candidateService';
import { CandidateApplicationFormOutput } from '../schemas';
import { DocumentCategory, CreateRolePayload, UpdateRolePayload, CandidateFilterParams } from '../types';
import { useToast } from '@/components/Toast';

export const CANDIDATES_QUERY_KEY = ['candidate-applications'];
export const APPLICATION_CREATORS_QUERY_KEY = ['candidate-application-creators'];
export const STAGED_DOCS_QUERY_KEY = ['candidate-staged-documents'];

export const useMyApplications = (
  filtersOrOptions?: CandidateFilterParams | { enabled?: boolean },
  options?: { enabled?: boolean }
) => {
  let filters: CandidateFilterParams | undefined = undefined;
  let enabled: boolean | undefined = undefined;

  if (filtersOrOptions) {
    if (
      'enabled' in filtersOrOptions &&
      Object.keys(filtersOrOptions).length === 1 &&
      typeof (filtersOrOptions as any).enabled === 'boolean'
    ) {
      enabled = (filtersOrOptions as any).enabled;
    } else {
      filters = filtersOrOptions as CandidateFilterParams;
      enabled = options?.enabled;
    }
  }

  return useQuery({
    queryKey: [...CANDIDATES_QUERY_KEY, filters || {}],
    queryFn: () => candidateService.getMyApplications(filters),
    placeholderData: (previousData) => previousData,
    staleTime: 1000 * 60 * 2, // 2 minutes
    enabled: enabled !== undefined ? enabled : true,
  });
};

export const useApplicationCreators = () => {
  return useQuery({
    queryKey: APPLICATION_CREATORS_QUERY_KEY,
    queryFn: () => candidateService.getApplicationCreators(),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

export const useDownloadCandidatesReport = () => {
  const { success, error } = useToast();
  return useMutation({
    mutationFn: (filters?: CandidateFilterParams) => candidateService.downloadExcelReport(filters),
    onSuccess: () => {
      success('Candidate report downloaded successfully.');
    },
    onError: (err: any) => {
      error(err?.response?.data?.message || 'Failed to download candidate report.');
    },
  });
};

export const useApplicationDetail = (id: string | null) => {
  return useQuery({
    queryKey: [...CANDIDATES_QUERY_KEY, id],
    queryFn: () => (id ? candidateService.getApplicationById(id) : null),
    enabled: !!id,
  });
};

export const useCreateApplication = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CandidateApplicationFormOutput) =>
      candidateService.createApplication(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CANDIDATES_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: STAGED_DOCS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: APPLICATION_CREATORS_QUERY_KEY });
    },
  });
};

export const useUpdateApplication = () => {
  const queryClient = useQueryClient();
  const { success, error } = useToast();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Partial<CandidateApplicationFormOutput>;
    }) => candidateService.updateApplication(id, data),
    onSuccess: (savedApp) => {
      queryClient.invalidateQueries({ queryKey: CANDIDATES_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: [...CANDIDATES_QUERY_KEY, savedApp.id] });
      queryClient.invalidateQueries({ queryKey: ['verification-applications-list'] });
      queryClient.invalidateQueries({ queryKey: ['application-detail', savedApp.id] });
      success(`Application ${savedApp.application_number} updated successfully.`);
    },
    onError: (err: any) => {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        'Failed to update application.';
      error(msg);
    },
  });
};

export const useStagedDocuments = () => {
  return useQuery({
    queryKey: STAGED_DOCS_QUERY_KEY,
    queryFn: () => candidateService.getStagedDocuments(),
    staleTime: 1000 * 60, // 60 seconds cache
  });
};

export const useUploadDocument = () => {
  const queryClient = useQueryClient();
  const { success, error } = useToast();

  return useMutation({
    mutationFn: ({ file, category }: { file: File; category: DocumentCategory }) =>
      candidateService.uploadDocument(file, category),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: STAGED_DOCS_QUERY_KEY });
      success(`${data.original_filename} uploaded successfully.`);
    },
    onError: (err: any) => {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Document upload failed. Please try again.';
      error(msg);
    },
  });
};

export const useDeleteDocument = () => {
  const queryClient = useQueryClient();
  const { info, error } = useToast();

  return useMutation({
    mutationFn: (docId: string) => candidateService.deleteDocument(docId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: STAGED_DOCS_QUERY_KEY });
      info('Document removed.');
    },
    onError: (err: any) => {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to remove document.';
      error(msg);
    },
  });
};

export const ROLES_QUERY_KEY = ['application-roles'];

export const useActiveRoles = () => {
  return useQuery({
    queryKey: [...ROLES_QUERY_KEY, 'active'],
    queryFn: () => candidateService.getActiveRoles(),
    staleTime: 1000 * 60 * 5, // 5 mins
  });
};

export const useAllRoles = () => {
  return useQuery({
    queryKey: [...ROLES_QUERY_KEY, 'all'],
    queryFn: () => candidateService.getAllRoles(),
  });
};

export const useCreateRole = (onSuccessCb?: () => void) => {
  const queryClient = useQueryClient();
  const { success, error } = useToast();

  return useMutation({
    mutationFn: (data: CreateRolePayload) =>
      candidateService.createRole(data),
    onSuccess: (role) => {
      queryClient.invalidateQueries({ queryKey: ROLES_QUERY_KEY });
      success(`Role '${role.name}' created successfully.`);
      if (onSuccessCb) onSuccessCb();
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || 'Failed to create role.';
      error(msg);
    },
  });
};

export const useUpdateRole = (onSuccessCb?: () => void) => {
  const queryClient = useQueryClient();
  const { success, error } = useToast();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateRolePayload }) =>
      candidateService.updateRole(id, data),
    onSuccess: (role) => {
      queryClient.invalidateQueries({ queryKey: ROLES_QUERY_KEY });
      success(`Role '${role.name}' updated successfully.`);
      if (onSuccessCb) onSuccessCb();
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || 'Failed to update role.';
      error(msg);
    },
  });
};

export const useToggleRoleActive = () => {
  const queryClient = useQueryClient();
  const { success, error } = useToast();

  return useMutation({
    mutationFn: (id: string) => candidateService.toggleRoleActive(id),
    onSuccess: (role) => {
      queryClient.invalidateQueries({ queryKey: ROLES_QUERY_KEY });
      const status = role.is_active ? 'activated' : 'deactivated';
      success(`Role '${role.name}' ${status}.`);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || 'Failed to update role status.';
      error(msg);
    },
  });
};

