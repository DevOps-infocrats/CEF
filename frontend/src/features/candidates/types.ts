export type HeroCategory = 'Hero 1' | 'Hero 2';

export type RoleApplied = 'HDD Operate' | 'HDD Tracker' | 'HDD Helper' | string;

export interface ApplicationRole {
  id: string;
  name: string;
  code?: string | null;
  description?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateRolePayload {
  name: string;
  code?: string;
  description?: string;
  is_active?: boolean;
}

export interface UpdateRolePayload {
  name?: string;
  code?: string;
  description?: string;
  is_active?: boolean;
}

export type DocumentCategory =
  | 'aadhaar_card'
  | 'pan_card'
  | 'bank_passbook'
  | 'cancelled_cheque'
  | 'marksheet_10th'
  | 'marksheet_12th'
  | 'previous_employment';

export interface CandidateDocument {
  id: string;
  application_id?: string | null;
  category: DocumentCategory;
  original_filename: string;
  content_type: string;
  file_size: number;
  uploaded_at: string;
}

export interface CandidateApplicationFormData {
  hero_category: HeroCategory;
  role_applied: RoleApplied;

  // Personal Information
  full_name: string;
  mobile_number: string;
  email: string;
  aadhaar_number: string;
  pan_number: string;

  // Current Address
  current_address_line1: string;
  current_address_line2?: string;
  current_city: string;
  current_state: string;
  current_pin_code: string;
  current_country: string;

  // Permanent Address
  is_permanent_same: boolean;
  permanent_address_line1: string;
  permanent_address_line2?: string;
  permanent_city: string;
  permanent_state: string;
  permanent_pin_code: string;
  permanent_country: string;

  // Bank Details
  account_holder_name: string;
  bank_name: string;
  account_number: string;
  confirm_account_number: string;
  ifsc_code: string;
  branch_name?: string;

  // Step 4: Location Details
  circle: string;
  district?: string;
  block?: string;
  district_ids?: string[];
  block_ids?: string[];

  // Step 4: Salary Details
  current_salary: number | string;
  asking_salary: number | string;
  negotiated_salary?: number | string;
}

export interface CandidateApplicationResponse {
  id: string;
  application_number: string;
  user_id: string;
  hero_category: HeroCategory;
  role_applied: RoleApplied;
  full_name: string;
  mobile_number: string;
  email: string;
  aadhaar_number_masked: string;
  pan_number_masked: string;
  current_address_line1: string;
  current_address_line2?: string;
  current_city: string;
  current_state: string;
  current_pin_code: string;
  current_country: string;
  is_permanent_same: boolean;
  permanent_address_line1: string;
  permanent_address_line2?: string;
  permanent_city: string;
  permanent_state: string;
  permanent_pin_code: string;
  permanent_country: string;
  account_holder_name: string;
  bank_name: string;
  account_number_masked: string;
  ifsc_code: string;
  branch_name?: string;

  // Step 4: Location & Salary Details
  circle: string;
  district: string;
  block: string;
  district_ids?: string[];
  block_ids?: string[];
  selected_districts?: Array<{ id: string | null; name: string }>;
  selected_blocks?: Array<{ id: string | null; name: string; district_id?: string | null; district_name?: string | null }>;
  current_salary: string | number;
  asking_salary: string | number;
  negotiated_salary?: string | number | null;

  // Step 5: Uploaded Documents
  documents?: CandidateDocument[];

  joining_date?: string | null;
  offer_letter_status?: string | null;
  offer_letter_released_at?: string | null;
  offer_letter_released_by_name?: string | null;
  site_joining_status?: 'NOT_JOINED' | 'PENDING' | 'JOINED';
  site_joining_date?: string | null;
  site_joining_updated_by_id?: string | null;
  site_joining_updated_by_name?: string | null;
  site_joining_updated_at?: string | null;
  site_joining_notes?: string | null;
  enrollment_completed?: boolean;
  status: string;
  created_by_id?: string | null;
  created_by_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CandidateFilterParams {
  candidate_name?: string;
  hr_name?: string;
  created_by_id?: string;
  start_date?: string;
  end_date?: string;
  status?: string;
}

export interface ApplicationCreator {
  id: string;
  name: string;
  email: string;
}

export interface ApplicationsListResponse {
  total: number;
  applications: CandidateApplicationResponse[];
}
