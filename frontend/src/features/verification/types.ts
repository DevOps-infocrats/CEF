import { CandidateDocument, HeroCategory, RoleApplied } from '../candidates/types';

export type VerificationItemStatus = 'PENDING' | 'DONE' | 'REJECTED';

export type ApplicationOverallStatus =
  | 'PENDING_VERIFICATION'
  | 'IN_PROGRESS'
  | 'VERIFICATION_COMPLETE'
  | 'NEEDS_CORRECTION'
  | 'APPROVED'
  | 'REJECTED'
  | string;

export interface VerificationProgress {
  total_items: number;
  completed_items: number;
  mandatory_items: number;
  completed_mandatory_items: number;
  percentage: number;
}

export interface CandidateVerificationItem {
  id: string;
  application_id: string;
  document_id?: string | null;
  item_key: string;
  item_label: string;
  item_category: 'personal' | 'address' | 'location' | 'bank' | 'salary' | 'document' | string;
  is_mandatory: boolean;
  status: VerificationItemStatus;
  verified_by_id?: string | null;
  verified_by_name?: string | null;
  verified_at?: string | null;
  remarks?: string | null;
  created_at: string;
  updated_at: string;
}

export interface VerificationApplication {
  id: string;
  application_number: string;
  user_id: string;
  hero_category: HeroCategory;
  role_applied: RoleApplied;
  full_name: string;
  mobile_number: string;
  mobile_number_masked?: string;
  email: string;
  aadhaar_number?: string;
  aadhaar_masked?: string;
  aadhaar_number_masked?: string;
  pan_number?: string;
  pan_masked?: string;
  pan_number_masked?: string;

  // Current Address
  current_address_line1: string;
  current_address_line2?: string;
  current_city: string;
  current_state: string;
  current_pincode?: string;
  current_pin_code?: string;
  current_country: string;

  // Permanent Address
  is_permanent_same: boolean;
  permanent_address_line1: string;
  permanent_address_line2?: string;
  permanent_city: string;
  permanent_state: string;
  permanent_pincode?: string;
  permanent_pin_code?: string;
  permanent_country: string;

  // Bank Details
  account_holder_name: string;
  bank_name: string;
  account_number?: string;
  account_number_masked?: string;
  account_masked?: string;
  ifsc_code: string;
  branch_name?: string;

  // Location & Salary
  circle: string;
  district: string;
  block: string;
  selected_districts?: Array<{ id: string | null; name: string }>;
  selected_blocks?: Array<{ id: string | null; name: string; district_id?: string | null; district_name?: string | null }>;
  current_salary: string | number;
  asking_salary: string | number;
  negotiated_salary?: string | number | null;

  // Documents
  documents?: CandidateDocument[];

  // Verification Checklist & Progress
  verification_items?: CandidateVerificationItem[];
  verification_progress: VerificationProgress;

  status: ApplicationOverallStatus;
  reviewed_by_id?: string | null;
  reviewed_by_name?: string | null;
  reviewed_at?: string | null;
  rejection_reason?: string | null;
  created_at: string;
  updated_at: string;
}

export interface VerificationChecklistResponse {
  application_id: string;
  application_number: string;
  application_status: ApplicationOverallStatus;
  verification_progress: VerificationProgress;
  verification_items: CandidateVerificationItem[];
}

export interface VerificationActionResponse {
  item: CandidateVerificationItem;
  application_status: ApplicationOverallStatus;
  verification_progress: VerificationProgress;
}

export interface BulkVerificationActionResponse {
  application_status: ApplicationOverallStatus;
  verification_progress: VerificationProgress;
  verification_items: CandidateVerificationItem[];
  marked_done_count: number;
  marked_done_keys: string[];
  ineligible_items: Array<{ item_key: string; item_label: string; reason: string }>;
}

export interface BulkCandidateActionResponse {
  total_requested: number;
  approved_count?: number;
  rejected_count?: number;
  failed_count: number;
  successful_ids: string[];
  failed_items: Array<{
    id: string;
    application_number: string;
    candidate_name?: string;
    reason: string;
  }>;
}

