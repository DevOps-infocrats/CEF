export interface LocationState {
  id: string;
  name: string;
  code?: string | null;
  is_active: boolean;
  districts_count?: number;
  created_at?: string;
}

export interface LocationDistrict {
  id: string;
  state_id: string;
  state_name?: string | null;
  name: string;
  code?: string | null;
  is_active: boolean;
  blocks_count?: number;
  created_at?: string;
}

export interface LocationBlock {
  id: string;
  district_id: string;
  district_name?: string | null;
  name: string;
  code?: string | null;
  is_active: boolean;
  created_at?: string;
}

export interface ImportSummary {
  state: string;
  state_id?: string;
  total_districts: number;
  total_blocks: number;
  created_districts: number;
  skipped_districts: number;
  created_blocks: number;
  skipped_blocks: number;
  invalid_records: number;
  errors: string[];
  dry_run: boolean;
}
