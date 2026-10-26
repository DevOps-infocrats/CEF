export interface PlaceholderMapping {
  placeholder: string;
  label: string;
  description: string;
}

export interface MasterTemplate {
  id: string;
  template_type: 'letter_of_intent' | 'offer_letter';
  name: string;
  filename: string;
  version: number;
  is_active: boolean;
  file_exists?: boolean;
  file_size?: number;
  field_mappings: PlaceholderMapping[];
  download_url: string;
  created_at: string;
  updated_at?: string;
}

export interface CandidateLetterDto {
  id: string;
  letter_type: 'letter_of_intent' | 'offer_letter';
  version: number;
  status: 'DRAFT' | 'FINAL' | 'SENT' | 'FAILED';
  docx_url: string;
  pdf_url: string;
  inline_pdf_url?: string;
  page_count?: number;
  field_values: Record<string, any>;
  last_edited_at?: string | null;
  sent_at?: string | null;
  email_recipient?: string | null;
  email_status?: 'SENT' | 'FAILED' | 'PENDING' | null;
  email_error?: string | null;
}

export interface CandidateLettersData {
  application: {
    id: string;
    application_number: string;
    full_name: string;
    email: string;
    mobile_number: string;
    role_applied: string;
    status: string;
    district: string;
    circle: string;
    current_state: string;
    negotiated_salary?: number | null;
  };
  letter_of_intent: CandidateLetterDto;
  offer_letter: CandidateLetterDto;
}
