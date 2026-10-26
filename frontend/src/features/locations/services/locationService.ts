import { apiClient } from '@/api/apiClient';
import { LocationState, LocationDistrict, LocationBlock, ImportSummary } from '../types';

interface ApiResponse<T> {
  data: T;
  message: string;
  status_code: number;
}

export const locationService = {
  // States / Circles
  getStates: async (all: boolean = false): Promise<LocationState[]> => {
    const res = await apiClient.get<ApiResponse<LocationState[]>>('/locations/states', {
      params: all ? { all: 'true' } : {},
    });
    return res.data.data;
  },

  createState: async (payload: { name: string; code?: string; is_active?: boolean }): Promise<LocationState> => {
    const res = await apiClient.post<ApiResponse<LocationState>>('/locations/states', payload);
    return res.data.data;
  },

  updateState: async (
    stateId: string,
    payload: { name?: string; code?: string; is_active?: boolean }
  ): Promise<LocationState> => {
    const res = await apiClient.put<ApiResponse<LocationState>>(`/locations/states/${stateId}`, payload);
    return res.data.data;
  },

  // Districts
  getDistricts: async (stateId: string, all: boolean = false): Promise<LocationDistrict[]> => {
    if (!stateId) return [];
    const res = await apiClient.get<ApiResponse<LocationDistrict[]>>(`/locations/states/${stateId}/districts`, {
      params: all ? { all: 'true' } : {},
    });
    return res.data.data;
  },

  createDistrict: async (
    stateId: string,
    payload: { name: string; code?: string; is_active?: boolean }
  ): Promise<LocationDistrict> => {
    const res = await apiClient.post<ApiResponse<LocationDistrict>>(`/locations/states/${stateId}/districts`, payload);
    return res.data.data;
  },

  updateDistrict: async (
    districtId: string,
    payload: { name?: string; code?: string; is_active?: boolean }
  ): Promise<LocationDistrict> => {
    const res = await apiClient.put<ApiResponse<LocationDistrict>>(`/locations/districts/${districtId}`, payload);
    return res.data.data;
  },

  // Blocks
  getBlocks: async (params: { districtIds?: string[]; stateId?: string; all?: boolean }): Promise<LocationBlock[]> => {
    const queryParams: Record<string, string> = {};
    if (params.districtIds && params.districtIds.length > 0) {
      queryParams.district_ids = params.districtIds.join(',');
    }
    if (params.stateId) {
      queryParams.state_id = params.stateId;
    }
    if (params.all) {
      queryParams.all = 'true';
    }

    if (!queryParams.district_ids && !queryParams.state_id) {
      return [];
    }

    const res = await apiClient.get<ApiResponse<LocationBlock[]>>('/locations/blocks', {
      params: queryParams,
    });
    return res.data.data;
  },

  createBlock: async (
    districtId: string,
    payload: { name: string; code?: string; is_active?: boolean }
  ): Promise<LocationBlock> => {
    const res = await apiClient.post<ApiResponse<LocationBlock>>(`/locations/districts/${districtId}/blocks`, payload);
    return res.data.data;
  },

  updateBlock: async (
    blockId: string,
    payload: { name?: string; code?: string; is_active?: boolean }
  ): Promise<LocationBlock> => {
    const res = await apiClient.put<ApiResponse<LocationBlock>>(`/locations/blocks/${blockId}`, payload);
    return res.data.data;
  },

  // Excel Importer
  importExcel: async (formData: FormData): Promise<ImportSummary> => {
    const res = await apiClient.post<ApiResponse<ImportSummary>>('/locations/import', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return res.data.data;
  },
};
