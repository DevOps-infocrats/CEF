import React from 'react';
import fiberforceLogo from '@/assets/letter/fiberforce_logo.png';
import watermark from '@/assets/letter/watermark.png';
import stampSignature from '@/assets/letter/stamp_signature.png';
import { ClickToEditText } from './InteractiveOfferLetter';

export interface LoiLetterContent {
  date?: string;
  cand_name?: string;
  cand_address?: string;
  cand_mobile?: string;
  cand_email?: string;
  cand_aadhaar?: string;
  subject?: string;
  salutation?: string;
  p_intro?: string;
  p_location?: string;
  p_start_date?: string;
  p_comp_header?: string;
  monthly_salary?: string;
  performance_incentive?: string;
  mis_allowance?: string;
  total_salary?: string;
  p_perf_note?: string;
  p_reserve_note?: string;
  p_transfer_h?: string;
  p_transfer_b?: string;
  p_compliance_h?: string;
  p_compliance_b?: string;

  // Page 2
  p_acceptance_h?: string;
  p_acceptance_b1?: string;
  p_acceptance_b2?: string;
  p_acceptance_b3?: string;
  yours_faithfully?: string;
  for_company?: string;
  authorized_signatory?: string;
  cand_acceptance_title?: string;
  cand_acceptance_text?: string;
  cand_sig_label?: string;
  cand_name_label?: string;
  cand_date_label?: string;

  footer_address?: string;
  [key: string]: any;
}

interface InteractiveLetterOfIntentProps {
  page: number;
  content: LoiLetterContent;
  onTextChange: (key: string, newText: string) => void;
  loiFields: Record<string, any>;
  onFieldChange: (field: string, value: string) => void;
}

export const InteractiveLetterOfIntent: React.FC<InteractiveLetterOfIntentProps> = ({
  page,
  content,
  onTextChange,
  loiFields,
  onFieldChange,
}) => {
  const candName = loiFields.candidate_full_name || loiFields.candidate_name || 'Candidate Name';
  const candAddress = loiFields.candidate_address || 'Address Details';
  const candMobile = loiFields.candidate_mobile || loiFields.mobile_number || 'Mobile Number';
  const candEmail = loiFields.candidate_email || loiFields.email || '-';
  const candAadhaar = loiFields.candidate_aadhaar || '-';
  const approvedRole = loiFields.approved_role_name || loiFields.role_applied || 'HDD Operator';
  const approvedLoc = loiFields.approved_location || 'District Location';
  const joiningDate = loiFields.joining_date || '01/11/2026';
  const curDate = loiFields.current_date || loiFields.date || new Date().toLocaleDateString('en-GB');
  const monthlySalary = loiFields.monthly_salary || '40000';
  const totalSalary = loiFields.total_salary || monthlySalary;

  const defaultFooter =
    'Registered Office: - 445, Sanjay Nagar D, Kalwar Road, Jhotwara, Jhotwara, Jaipur, Jaipur- 302012, Rajasthan';

  return (
    <div className="relative w-full max-w-[800px] mx-auto bg-white rounded-md shadow-lg border border-slate-200/90 p-8 sm:p-12 min-h-[960px] text-[13px] leading-relaxed text-slate-900 select-text font-serif">
      {/* Background Watermark - Pure Image, Pointer Events Disabled */}
      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden z-0"
        aria-hidden="true"
      >
        <img
          src={watermark}
          alt=""
          className="w-[420px] h-[420px] object-contain opacity-[0.06] transform -rotate-12 pointer-events-none select-none"
        />
      </div>

      {/* Top Header with FiberForce Logo */}
      <div className="relative z-10 flex items-start justify-between pb-6 border-b border-slate-100">
        <div className="pt-2">
          <ClickToEditText
            value={content.header_tag || 'Letter of Intent'}
            onSave={(val) => onTextChange('header_tag', val)}
            className="text-[11px] font-sans font-bold tracking-widest text-indigo-700 uppercase"
          />
        </div>
        <div className="flex-shrink-0">
          <img
            src={fiberforceLogo}
            alt="Fiber Force"
            className="w-16 h-16 object-contain pointer-events-none select-none"
          />
        </div>
      </div>

      {/* PAGE 1: LOI Body & Salary Table */}
      {page === 1 && (
        <div className="relative z-10 space-y-3.5 pt-4 text-slate-800">
          {/* Date Header */}
          <div className="flex justify-end text-xs font-semibold">
            <div className="flex items-center gap-1">
              <span className="text-slate-600">Date:</span>
              <ClickToEditText
                value={content.date || curDate}
                onSave={(val) => {
                  onTextChange('date', val);
                  onFieldChange('current_date', val);
                }}
                className="font-medium text-slate-900"
              />
            </div>
          </div>

          {/* Recipient Details */}
          <div className="text-xs leading-normal space-y-1">
            <div className="font-semibold text-slate-700">To,</div>
            <div className="flex items-center gap-1 font-bold text-slate-900">
              <span className="text-slate-600 font-normal">Mr./Ms.</span>
              <ClickToEditText
                value={content.cand_name || candName}
                onSave={(val) => {
                  onTextChange('cand_name', val);
                  onFieldChange('candidate_full_name', val);
                }}
                className="font-bold text-slate-900"
              />
            </div>
            <div className="flex items-start gap-1">
              <span className="text-slate-600 font-normal">Address:</span>
              <ClickToEditText
                value={content.cand_address || candAddress}
                onSave={(val) => {
                  onTextChange('cand_address', val);
                  onFieldChange('candidate_address', val);
                }}
                className="text-slate-800"
              />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-slate-600 font-normal">Mobile:</span>
              <ClickToEditText
                value={content.cand_mobile || candMobile}
                onSave={(val) => {
                  onTextChange('cand_mobile', val);
                  onFieldChange('candidate_mobile', val);
                }}
                className="text-slate-800"
              />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-slate-600 font-normal">Email ID:</span>
              <ClickToEditText
                value={content.cand_email || candEmail}
                onSave={(val) => {
                  onTextChange('cand_email', val);
                  onFieldChange('candidate_email', val);
                }}
                className="text-slate-800"
              />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-slate-600 font-normal">Aadhar Number:</span>
              <ClickToEditText
                value={content.cand_aadhaar || candAadhaar}
                onSave={(val) => {
                  onTextChange('cand_aadhaar', val);
                  onFieldChange('candidate_aadhaar', val);
                }}
                className="text-slate-800 font-mono"
              />
            </div>
          </div>

          {/* Subject Line */}
          <div className="pt-1 pb-1">
            <ClickToEditText
              value={content.subject || 'Subject: Offer Letter'}
              onSave={(val) => onTextChange('subject', val)}
              className="font-bold underline text-slate-900 text-[14px]"
            />
          </div>

          {/* Salutation */}
          <div>
            <ClickToEditText
              value={content.salutation || `Dear Mr. ${candName},`}
              onSave={(val) => onTextChange('salutation', val)}
              className="font-semibold text-slate-900"
            />
          </div>

          {/* Paragraph 1 - Intent & Role */}
          <p className="text-justify leading-relaxed">
            <ClickToEditText
              value={
                content.p_intro ||
                `We are pleased to inform you that Fiber Force Pvt Ltd intends to engage your services as ${approvedRole}, subject to your acceptance of the terms outlined herein and the successful completion of all pre-eligibility requirements as prescribed by the Company.`
              }
              onSave={(val) => onTextChange('p_intro', val)}
              multiline
              tagName="span"
              className="w-full text-justify"
            />
          </p>

          {/* Paragraph 2 - Location */}
          <p className="text-justify leading-relaxed">
            <ClickToEditText
              value={
                content.p_location ||
                `Your initial place of services shall be ${approvedLoc}. However, considering operational and business requirements, the Company reserves the right to reallocate any other location within in India without adversely affecting your service terms.`
              }
              onSave={(val) => onTextChange('p_location', val)}
              multiline
              tagName="span"
              className="w-full text-justify"
            />
          </p>

          {/* Start Date of Services */}
          <p className="font-semibold leading-relaxed">
            <ClickToEditText
              value={content.p_start_date || `Start Date of Services: ${joiningDate}`}
              onSave={(val) => {
                onTextChange('p_start_date', val);
                const match = val.match(/\d{2}\/\d{2}\/\d{4}/);
                if (match) onFieldChange('joining_date', match[0]);
              }}
              tagName="span"
              className="w-full text-slate-900"
            />
          </p>

          {/* Compensation Payable Header */}
          <div className="font-bold text-slate-900 pt-1">
            <ClickToEditText
              value={content.p_comp_header || 'Compensation Payable:'}
              onSave={(val) => onTextChange('p_comp_header', val)}
              className="text-slate-900"
            />
          </div>

          {/* LOI Salary Table */}
          <div className="my-2 border border-slate-300 rounded overflow-hidden">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/90 border-b border-slate-300 text-slate-800">
                  <th className="py-2 px-3 text-left font-bold border-r border-slate-300 w-2/3">Payable Head</th>
                  <th className="py-2 px-3 text-right font-bold w-1/3">Amount (INR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                <tr>
                  <td className="py-1.5 px-3 border-r border-slate-200">Monthly Salary</td>
                  <td className="py-1.5 px-3 text-right font-mono font-semibold">
                    <ClickToEditText
                      value={content.monthly_salary || monthlySalary}
                      onSave={(val) => {
                        onTextChange('monthly_salary', val);
                        onFieldChange('monthly_salary', val);
                        onFieldChange('total_salary', val);
                      }}
                      className="text-right"
                    />
                  </td>
                </tr>
                <tr>
                  <td className="py-1.5 px-3 border-r border-slate-200">Performance Incentive*</td>
                  <td className="py-1.5 px-3 text-right font-mono">
                    <ClickToEditText
                      value={content.performance_incentive || '0'}
                      onSave={(val) => onTextChange('performance_incentive', val)}
                      className="text-right"
                    />
                  </td>
                </tr>
                <tr>
                  <td className="py-1.5 px-3 border-r border-slate-200">Mis. Allowance</td>
                  <td className="py-1.5 px-3 text-right font-mono">
                    <ClickToEditText
                      value={content.mis_allowance || '0'}
                      onSave={(val) => onTextChange('mis_allowance', val)}
                      className="text-right"
                    />
                  </td>
                </tr>
                <tr className="bg-indigo-50/60 font-bold text-slate-900">
                  <td className="py-2 px-3 border-r border-slate-300">Total</td>
                  <td className="py-2 px-3 text-right font-mono text-indigo-900">
                    <ClickToEditText
                      value={content.total_salary || totalSalary}
                      onSave={(val) => onTextChange('total_salary', val)}
                      className="text-right font-bold"
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Notes */}
          <p className="text-[11px] text-slate-600 leading-relaxed italic">
            <ClickToEditText
              value={
                content.p_perf_note ||
                '*The Performance Linked Component shall be payable subject to achievement of key performance indictor (KPI/SLA) as assigned by the company.'
              }
              onSave={(val) => onTextChange('p_perf_note', val)}
              multiline
              tagName="span"
              className="w-full"
            />
          </p>

          <p className="text-[11px] text-slate-600 leading-relaxed">
            <ClickToEditText
              value={
                content.p_reserve_note ||
                'The Company reserves the right to revise, modify, suspend, or discontinue any competent of your service/ payout as per the policy & business requirement of the company.'
              }
              onSave={(val) => onTextChange('p_reserve_note', val)}
              multiline
              tagName="span"
              className="w-full"
            />
          </p>

          {/* Transferability Clause */}
          <div className="pt-1">
            <ClickToEditText
              value={content.p_transfer_h || '2. Transferability:'}
              onSave={(val) => onTextChange('p_transfer_h', val)}
              className="font-bold text-slate-900 block mb-0.5"
            />
            <ClickToEditText
              value={
                content.p_transfer_b ||
                'Your services shall be transferable and may be assigned to any location, project, client site, department, subsidiary, affiliate, associate concern, or business unit of the Company as deemed necessary by the management.'
              }
              onSave={(val) => onTextChange('p_transfer_b', val)}
              multiline
              tagName="p"
              className="text-justify leading-relaxed"
            />
          </div>

          {/* Compliance Clause */}
          <div className="pt-1">
            <ClickToEditText
              value={content.p_compliance_h || '3. Compliance with Company Policies:'}
              onSave={(val) => onTextChange('p_compliance_h', val)}
              className="font-bold text-slate-900 block mb-0.5"
            />
            <ClickToEditText
              value={
                content.p_compliance_b ||
                'You shall be required to observe and comply with all applicable Company rules, regulations, policies, procedures, safety standards, code of conduct, confidentiality obligations, and lawful instructions issued by the Company from time to time.'
              }
              onSave={(val) => onTextChange('p_compliance_b', val)}
              multiline
              tagName="p"
              className="text-justify leading-relaxed"
            />
          </div>
        </div>
      )}

      {/* PAGE 2: Acceptance & Signatures */}
      {page === 2 && (
        <div className="relative z-10 space-y-4 pt-4 text-slate-800">
          {/* Acceptance Clause */}
          <div>
            <ClickToEditText
              value={content.p_acceptance_h || '4. Acceptance:'}
              onSave={(val) => onTextChange('p_acceptance_h', val)}
              className="font-bold text-slate-900 block mb-1 text-[14px]"
            />
            <ClickToEditText
              value={
                content.p_acceptance_b1 ||
                'If the above terms are acceptable to you, kindly sign and return a copy of this Letter of Intent as a token of your acceptance.'
              }
              onSave={(val) => onTextChange('p_acceptance_b1', val)}
              multiline
              tagName="p"
              className="text-justify leading-relaxed mb-3"
            />
            <ClickToEditText
              value={
                content.p_acceptance_b2 ||
                'Failure to report for duty on or before the stipulated service start date, without prior written approval from the Company, may result in automatic withdrawal of this offer.'
              }
              onSave={(val) => onTextChange('p_acceptance_b2', val)}
              multiline
              tagName="p"
              className="text-justify leading-relaxed mb-3"
            />
            <ClickToEditText
              value={
                content.p_acceptance_b3 ||
                'We look forward to your association with Fiber Force Pvt Ltd and wish you a successful and rewarding experience with the organization.'
              }
              onSave={(val) => onTextChange('p_acceptance_b3', val)}
              multiline
              tagName="p"
              className="text-justify leading-relaxed"
            />
          </div>

          {/* Company Signatures */}
          <div className="pt-6 pb-4">
            <ClickToEditText
              value={content.yours_faithfully || 'Yours faithfully,'}
              onSave={(val) => onTextChange('yours_faithfully', val)}
              className="font-semibold text-slate-800 block"
            />
            <ClickToEditText
              value={content.for_company || 'For Fiber Force Pvt Ltd'}
              onSave={(val) => onTextChange('for_company', val)}
              className="font-bold text-slate-900 block mt-1"
            />
            <div className="py-2">
              <img
                src={stampSignature}
                alt="Authorized Signatory"
                className="w-40 h-20 object-contain pointer-events-none select-none"
              />
            </div>
            <ClickToEditText
              value={content.authorized_signatory || 'Authorized Signatory'}
              onSave={(val) => onTextChange('authorized_signatory', val)}
              className="font-semibold text-slate-700 block text-xs"
            />
          </div>

          {/* Candidate Acceptance Box */}
          <div className="mt-8 p-4 sm:p-5 border-2 border-slate-300 rounded-lg bg-slate-50/60 space-y-3">
            <ClickToEditText
              value={content.cand_acceptance_title || 'Acceptance by Candidate'}
              onSave={(val) => onTextChange('cand_acceptance_title', val)}
              className="font-bold text-slate-900 uppercase tracking-wider block text-xs border-b border-slate-200 pb-1.5"
            />
            <ClickToEditText
              value={
                content.cand_acceptance_text ||
                `I, Mr./Ms. ${candName}, have read, understood, and accepted the terms and conditions contained in this Letter of Intent and acknowledge that this document does not constitute a contract of employment.`
              }
              onSave={(val) => onTextChange('cand_acceptance_text', val)}
              multiline
              tagName="p"
              className="text-xs text-justify leading-relaxed text-slate-700"
            />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 text-xs">
              <div>
                <ClickToEditText
                  value={content.cand_sig_label || 'Signature: ______________________'}
                  onSave={(val) => onTextChange('cand_sig_label', val)}
                  className="font-medium text-slate-700"
                />
              </div>
              <div>
                <span className="text-slate-500 mr-1">Name:</span>
                <ClickToEditText
                  value={content.cand_name_label || candName}
                  onSave={(val) => onTextChange('cand_name_label', val)}
                  className="font-semibold text-slate-900"
                />
              </div>
              <div>
                <span className="text-slate-500 mr-1">Date:</span>
                <ClickToEditText
                  value={content.cand_date_label || curDate}
                  onSave={(val) => onTextChange('cand_date_label', val)}
                  className="font-mono text-slate-800"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer Address - Page Bottom */}
      <div className="relative z-10 pt-10 mt-12 border-t border-slate-100 text-center text-[10px] text-slate-400 select-text">
        <ClickToEditText
          value={content.footer_address || defaultFooter}
          onSave={(val) => onTextChange('footer_address', val)}
          className="text-slate-400 block"
        />
      </div>
    </div>
  );
};
