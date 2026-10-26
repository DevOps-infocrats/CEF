import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { locationService } from '../services/locationService';

export const useStates = (all: boolean = false) => {
  return useQuery({
    queryKey: ['location-states', { all }],
    queryFn: () => locationService.getStates(all),
    staleTime: 5 * 60 * 1000,
  });
};

export const useDistricts = (stateId: string, all: boolean = false) => {
  return useQuery({
    queryKey: ['location-districts', stateId, { all }],
    queryFn: () => locationService.getDistricts(stateId, all),
    enabled: Boolean(stateId),
    staleTime: 5 * 60 * 1000,
  });
};

export const useBlocks = (params: { districtIds?: string[]; stateId?: string; all?: boolean }) => {
  const idsKey = (params.districtIds || []).sort().join(',');
  return useQuery({
    queryKey: ['location-blocks', idsKey, params.stateId, { all: params.all }],
    queryFn: () => locationService.getBlocks(params),
    enabled: Boolean((params.districtIds && params.districtIds.length > 0) || params.stateId),
    staleTime: 5 * 60 * 1000,
  });
};

export const useCreateState = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: locationService.createState,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['location-states'] });
    },
  });
};

export const useUpdateState = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ stateId, payload }: { stateId: string; payload: { name?: string; code?: string; is_active?: boolean } }) =>
      locationService.updateState(stateId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['location-states'] });
    },
  });
};

export const useCreateDistrict = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ stateId, payload }: { stateId: string; payload: { name: string; code?: string; is_active?: boolean } }) =>
      locationService.createDistrict(stateId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['location-districts'] });
      queryClient.invalidateQueries({ queryKey: ['location-states'] });
    },
  });
};

export const useUpdateDistrict = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ districtId, payload }: { districtId: string; payload: { name?: string; code?: string; is_active?: boolean } }) =>
      locationService.updateDistrict(districtId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['location-districts'] });
    },
  });
};

export const useCreateBlock = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ districtId, payload }: { districtId: string; payload: { name: string; code?: string; is_active?: boolean } }) =>
      locationService.createBlock(districtId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['location-blocks'] });
      queryClient.invalidateQueries({ queryKey: ['location-districts'] });
    },
  });
};

export const useUpdateBlock = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ blockId, payload }: { blockId: string; payload: { name?: string; code?: string; is_active?: boolean } }) =>
      locationService.updateBlock(blockId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['location-blocks'] });
    },
  });
};

export const useImportLocationExcel = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (formData: FormData) => locationService.importExcel(formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['location-states'] });
      queryClient.invalidateQueries({ queryKey: ['location-districts'] });
      queryClient.invalidateQueries({ queryKey: ['location-blocks'] });
    },
  });
};
