import { z } from 'zod';

export const candidateApplicationSchema = z
  .object({
    hero_category: z.enum(['Hero 1', 'Hero 2'], {
      required_error: 'Hero category is required',
    }),
    role_applied: z.string().min(1, 'Role selection is required'),

    // Personal Information
    full_name: z
      .string()
      .min(2, 'Full name must be at least 2 characters')
      .max(120, 'Full name cannot exceed 120 characters')
      .regex(/^[a-zA-Z\s.'-]+$/, 'Full name contains invalid characters'),
    mobile_number: z
      .string()
      .regex(/^[6-9]\d{9}$/, 'Mobile number must be a valid 10-digit Indian number'),
    email: z
      .string()
      .email('Please enter a valid email address')
      .max(120, 'Email cannot exceed 120 characters'),
    aadhaar_number: z
      .string()
      .regex(/^\d{12}$/, 'Aadhaar number must be exactly 12 digits'),
    pan_number: z
      .string()
      .transform((val) => val.toUpperCase().trim())
      .pipe(
        z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Invalid PAN format (e.g. ABCDE1234F)')
      ),

    // Current Address
    current_address_line1: z
      .string()
      .min(3, 'Address Line 1 is required')
      .max(255, 'Address Line 1 cannot exceed 255 characters'),
    current_address_line2: z.string().max(255).optional(),
    current_city: z
      .string()
      .min(2, 'City is required')
      .max(100, 'City cannot exceed 100 characters'),
    current_state: z
      .string()
      .min(2, 'State is required')
      .max(100, 'State cannot exceed 100 characters'),
    current_pin_code: z
      .string()
      .regex(/^\d{6}$/, 'PIN Code must be exactly 6 digits'),
    current_country: z
      .string()
      .min(2, 'Country is required')
      .default('India'),

    // Permanent Address
    is_permanent_same: z.boolean().default(false),
    permanent_address_line1: z.string().optional(),
    permanent_address_line2: z.string().max(255).optional(),
    permanent_city: z.string().optional(),
    permanent_state: z.string().optional(),
    permanent_pin_code: z.string().optional(),
    permanent_country: z.string().default('India'),

    // Bank Details
    account_holder_name: z
      .string()
      .min(2, 'Account Holder Name is required')
      .max(120, 'Account Holder Name cannot exceed 120 characters'),
    bank_name: z
      .string()
      .min(2, 'Bank Name is required')
      .max(120, 'Bank Name cannot exceed 120 characters'),
    account_number: z
      .string()
      .regex(/^\d{9,18}$/, 'Account number must be between 9 and 18 digits'),
    confirm_account_number: z
      .string()
      .min(1, 'Please confirm your account number'),
    ifsc_code: z
      .string()
      .transform((val) => val.toUpperCase().trim())
      .pipe(
        z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Invalid IFSC code format (e.g. SBIN0001234)')
      ),
    branch_name: z.string().max(120).optional(),

    // Step 4: Location Details
    circle: z
      .string()
      .min(2, 'Circle name is required (at least 2 characters)')
      .max(100, 'Circle cannot exceed 100 characters'),
    district: z.string().optional().default(''),
    block: z.string().optional().default(''),
    district_ids: z.array(z.string()).optional().default([]),
    block_ids: z.array(z.string()).optional().default([]),

    // Step 4: Salary Details
    current_salary: z
      .union([z.string(), z.number()])
      .refine(
        (val) => {
          const num = Number(val);
          return !isNaN(num) && num >= 0;
        },
        { message: 'Current salary must be a non-negative amount' }
      )
      .transform((val) => Number(val)),
    asking_salary: z
      .union([z.string(), z.number()])
      .refine(
        (val) => {
          const num = Number(val);
          return !isNaN(num) && num >= 0;
        },
        { message: 'Asking salary must be a non-negative amount' }
      )
      .transform((val) => Number(val)),
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
    // Permanent Address validation if not same
    if (!data.is_permanent_same) {
      if (!data.permanent_address_line1 || data.permanent_address_line1.trim().length < 3) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Permanent Address Line 1 is required when not same as current',
          path: ['permanent_address_line1'],
        });
      }
      if (!data.permanent_city || data.permanent_city.trim().length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Permanent City is required',
          path: ['permanent_city'],
        });
      }
      if (!data.permanent_state || data.permanent_state.trim().length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Permanent State is required',
          path: ['permanent_state'],
        });
      }
      if (!data.permanent_pin_code || !/^\d{6}$/.test(data.permanent_pin_code)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Permanent PIN Code must be exactly 6 digits',
          path: ['permanent_pin_code'],
        });
      }
    }

    // Bank account confirmation match
    if (data.account_number !== data.confirm_account_number) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Account numbers do not match',
        path: ['confirm_account_number'],
      });
    }

    // District & Block multi-select validation
    if ((!data.district_ids || data.district_ids.length === 0) && (!data.district || data.district.trim().length < 2)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Please select at least one district',
        path: ['district_ids'],
      });
    }

    if ((!data.block_ids || data.block_ids.length === 0) && (!data.block || data.block.trim().length < 2)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Please select at least one block',
        path: ['block_ids'],
      });
    }
  });

export type CandidateApplicationFormInput = z.input<typeof candidateApplicationSchema>;
export type CandidateApplicationFormOutput = z.output<typeof candidateApplicationSchema>;
