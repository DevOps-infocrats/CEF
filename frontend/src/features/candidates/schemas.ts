import { z } from 'zod';

export const candidateApplicationSchema = z
  .object({
    hero_category: z.enum(['Hero 1', 'Hero 2']).optional().default('Hero 1'),
    role_applied: z.string().optional().default('HDD Operate'),

    // Personal Information
    full_name: z
      .string()
      .max(120, 'Full name cannot exceed 120 characters')
      .refine((val) => !val || /^[a-zA-Z\s.'-]+$/.test(val), {
        message: 'Full name contains invalid characters',
      })
      .optional()
      .or(z.literal('')),
    mobile_number: z
      .string()
      .refine((val) => !val || /^[6-9]\d{9}$/.test(val.replace(/\s+/g, '')), {
        message: 'Mobile number must be a valid 10-digit Indian number',
      })
      .optional()
      .or(z.literal('')),
    email: z
      .string()
      .max(120, 'Email cannot exceed 120 characters')
      .refine((val) => !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val), {
        message: 'Please enter a valid email address',
      })
      .optional()
      .or(z.literal('')),
    aadhaar_number: z
      .string()
      .refine((val) => !val || /^\d{12}$/.test(val.replace(/\s+/g, '')), {
        message: 'Aadhaar number must be exactly 12 digits',
      })
      .optional()
      .or(z.literal('')),
    pan_number: z
      .string()
      .transform((val) => (val ? val.toUpperCase().trim() : ''))
      .refine((val) => !val || /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(val), {
        message: 'Invalid PAN format (e.g. ABCDE1234F)',
      })
      .optional()
      .or(z.literal('')),

    // Current Address
    current_address_line1: z.string().max(255).optional().or(z.literal('')),
    current_address_line2: z.string().max(255).optional().or(z.literal('')),
    current_city: z.string().max(100).optional().or(z.literal('')),
    current_state: z.string().max(100).optional().or(z.literal('')),
    current_pin_code: z
      .string()
      .refine((val) => !val || /^\d{6}$/.test(val.replace(/\s+/g, '')), {
        message: 'PIN Code must be exactly 6 digits',
      })
      .optional()
      .or(z.literal('')),
    current_country: z.string().default('India').optional().or(z.literal('')),

    // Permanent Address
    is_permanent_same: z.boolean().default(false),
    permanent_address_line1: z.string().max(255).optional().or(z.literal('')),
    permanent_address_line2: z.string().max(255).optional().or(z.literal('')),
    permanent_city: z.string().max(100).optional().or(z.literal('')),
    permanent_state: z.string().max(100).optional().or(z.literal('')),
    permanent_pin_code: z
      .string()
      .refine((val) => !val || /^\d{6}$/.test(val.replace(/\s+/g, '')), {
        message: 'Permanent PIN Code must be exactly 6 digits',
      })
      .optional()
      .or(z.literal('')),
    permanent_country: z.string().default('India').optional().or(z.literal('')),

    // Bank Details
    account_holder_name: z.string().max(120).optional().or(z.literal('')),
    bank_name: z.string().max(120).optional().or(z.literal('')),
    account_number: z
      .string()
      .refine((val) => !val || /^\d{9,18}$/.test(val.replace(/\s+/g, '')), {
        message: 'Account number must be between 9 and 18 digits',
      })
      .optional()
      .or(z.literal('')),
    confirm_account_number: z.string().optional().or(z.literal('')),
    ifsc_code: z
      .string()
      .transform((val) => (val ? val.toUpperCase().trim() : ''))
      .refine((val) => !val || /^[A-Z]{4}0[A-Z0-9]{6}$/.test(val), {
        message: 'Invalid IFSC code format (e.g. SBIN0001234)',
      })
      .optional()
      .or(z.literal('')),
    branch_name: z.string().max(120).optional().or(z.literal('')),

    // Step 4: Location Details
    circle: z.string().max(100).optional().or(z.literal('')),
    district: z.string().optional().default(''),
    block: z.string().optional().default(''),
    district_ids: z.array(z.string()).optional().default([]),
    block_ids: z.array(z.string()).optional().default([]),

    // Step 4: Salary Details
    current_salary: z
      .union([z.string(), z.number(), z.undefined()])
      .optional()
      .refine(
        (val) => {
          if (val === undefined || val === '' || val === null) return true;
          const num = Number(val);
          return !isNaN(num) && num >= 0;
        },
        { message: 'Current salary must be a non-negative amount' }
      )
      .transform((val) => (val === '' || val === undefined || val === null ? undefined : Number(val))),
    asking_salary: z
      .union([z.string(), z.number(), z.undefined()])
      .optional()
      .refine(
        (val) => {
          if (val === undefined || val === '' || val === null) return true;
          const num = Number(val);
          return !isNaN(num) && num >= 0;
        },
        { message: 'Asking salary must be a non-negative amount' }
      )
      .transform((val) => (val === '' || val === undefined || val === null ? undefined : Number(val))),
    negotiated_salary: z
      .union([z.string(), z.number(), z.undefined()])
      .optional()
      .refine(
        (val) => {
          if (val === undefined || val === '' || val === null) return true;
          const num = Number(val);
          return !isNaN(num) && num >= 0;
        },
        { message: 'Negotiated salary must be a non-negative amount' }
      )
      .transform((val) => (val === '' || val === undefined || val === null ? undefined : Number(val))),
  })
  .superRefine((data, ctx) => {
    // Only check bank account match if both account numbers are entered
    const acc = data.account_number ? data.account_number.trim() : '';
    const confirm = data.confirm_account_number ? data.confirm_account_number.trim() : '';
    if (acc && confirm && acc !== confirm) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Account numbers do not match',
        path: ['confirm_account_number'],
      });
    }
  });

export type CandidateApplicationFormInput = z.input<typeof candidateApplicationSchema>;
export type CandidateApplicationFormOutput = z.output<typeof candidateApplicationSchema>;
