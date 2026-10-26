import React, { useRef, useState, useEffect } from 'react';
import fiberforceLogo from '@/assets/letter/fiberforce_logo.png';
import watermark from '@/assets/letter/watermark.png';
import stampSignature from '@/assets/letter/stamp_signature.png';

interface ClickToEditTextProps {
  value: string;
  onSave: (val: string) => void;
  className?: string;
  multiline?: boolean;
  style?: React.CSSProperties;
  tagName?: 'span' | 'p' | 'div' | 'h1' | 'h2' | 'h3' | 'h4' | 'td';
}

export const ClickToEditText: React.FC<ClickToEditTextProps> = ({
  value,
  onSave,
  className = '',
  multiline = false,
  style,
  tagName = 'span',
}) => {
  const ref = useRef<HTMLElement | null>(null);
  const [isFocused, setIsFocused] = useState(false);

  const setRef = (el: HTMLElement | null) => {
    ref.current = el;
    if (el && !isFocused && el.innerText !== (value ?? '')) {
      el.innerText = value ?? '';
    }
  };

  useEffect(() => {
    if (ref.current && !isFocused) {
      if (ref.current.innerText !== (value ?? '')) {
        ref.current.innerText = value ?? '';
      }
    }
  }, [value, isFocused]);

  const handleBlur = () => {
    setIsFocused(false);
    if (ref.current) {
      const newText = ref.current.innerText.trim();
      if (newText !== (value ?? '').trim()) {
        onSave(newText);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!multiline && e.key === 'Enter') {
      e.preventDefault();
      ref.current?.blur();
    } else if (e.key === 'Escape') {
      if (ref.current) {
        ref.current.innerText = value ?? '';
      }
      ref.current?.blur();
    }
  };

  const Component = tagName as any;
  const displayClass = tagName === 'span' && !multiline ? 'inline-block' : 'block';

  return (
    <Component
      ref={setRef}
      contentEditable
      suppressContentEditableWarning
      onFocus={() => setIsFocused(true)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      style={style}
      title="Click to edit text directly"
      className={`transition-all duration-150 cursor-text outline-none rounded-xs px-0.5 ${displayClass} ${
        isFocused
          ? 'bg-amber-50/95 ring-2 ring-indigo-400 text-slate-900 shadow-xs'
          : 'hover:bg-indigo-50/60 hover:outline-dashed hover:outline-1 hover:outline-indigo-300'
      } ${className}`}
    />
  );
};

export interface OfferLetterContent {
  // Page 1
  reference_number?: string;
  current_date?: string;
  cand_name_line?: string;
  cand_mobile_line?: string;
  subject?: string;
  salutation?: string;
  p10?: string;
  p11?: string;
  p13?: string;
  p14?: string;
  p16?: string;
  p19?: string;
  yours_faithfully?: string;
  received_accepted?: string;
  hr_dept?: string;
  company_name?: string;
  signature_line?: string;
  footer_address?: string;

  // Pages 2-4 (Annexure I)
  annex1_title?: string;
  annex1_subtitle?: string;
  annex1_cand_name?: string;
  annex1_s1_h?: string;
  annex1_s1_b?: string;
  annex1_s2_h?: string;
  annex1_s2_b?: string;
  annex1_s3_h?: string;
  annex1_s3_b?: string;
  annex1_s4_h?: string;
  annex1_s4_b?: string;
  annex1_s5_h?: string;
  annex1_s5_b1?: string;
  annex1_s5_b2?: string;
  annex1_s5_b3?: string;
  annex1_s5_b4?: string;
  annex1_s6_h?: string;
  annex1_s6_b1?: string;
  annex1_s6_b2?: string;
  annex1_s7_h?: string;
  annex1_s7_b1?: string;
  annex1_s7_b2?: string;
  annex1_s7_b3?: string;
  annex1_s7_b4?: string;
  annex1_s7_b5?: string;
  annex1_s8_h?: string;
  annex1_s8_b?: string;
  annex1_s9_h?: string;
  annex1_s9_b?: string;
  annex1_s10_h?: string;
  annex1_s10_b?: string;
  annex1_s11_h?: string;
  annex1_s11_b?: string;
  annex1_s12_h?: string;
  annex1_s12_b?: string;
  annex1_s13_h?: string;
  annex1_s13_sub1?: string;
  annex1_s13_b1?: string;
  annex1_s13_b2?: string;
  annex1_s13_b3?: string;
  annex1_s13_b4?: string;
  annex1_s13_sub2?: string;
  annex1_s13_b5?: string;
  annex1_s13_b6?: string;
  annex1_s13_b7?: string;
  annex1_s13_b8?: string;
  annex1_s14_b1?: string;
  annex1_s14_b2?: string;
  annex1_s14_b3?: string;
  annex1_s14_b4?: string;
  annex1_s14_b5?: string;
  annex1_s15_h?: string;
  annex1_s15_b?: string;

  // Page 5 (Annexure II)
  annex2_title?: string;
  annex2_name?: string;
  annex2_note1?: string;
  annex2_note2?: string;
  annex2_note3?: string;

  [key: string]: any;
}

interface InteractiveOfferLetterProps {
  page: number;
  content: OfferLetterContent;
  onTextChange: (key: string, newText: string) => void;
  offerFields: Record<string, any>;
  onFieldChange: (field: string, value: string) => void;
}

export const InteractiveOfferLetter: React.FC<InteractiveOfferLetterProps> = ({
  page,
  content,
  onTextChange,
  offerFields,
  onFieldChange,
}) => {
  const candName = offerFields.candidate_full_name || 'Setu Jat';
  const candMobile = offerFields.candidate_mobile || '9571024426';
  const approvedRole = offerFields.approved_role_name || 'HDD - Tracker';
  const approvedLoc = offerFields.approved_location || 'Rajasthan, Ajmer';
  const joiningDate = offerFields.joining_date || '01/10/2026';
  const refNum = offerFields.reference_number || 'FFPL/RAJ/2026-26/10/000100';
  const curDate = offerFields.current_date || '20th Oct, 2026';

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

      {/* Top Header with FiberForce Logo - Preserved Exact Header */}
      <div className="relative z-10 flex items-start justify-between pb-6 border-b border-slate-100">
        <div className="pt-2">
          <ClickToEditText
            value={content.header_tag || 'Official Employment Document'}
            onSave={(val) => onTextChange('header_tag', val)}
            className="text-[10px] font-sans font-semibold tracking-widest text-slate-400 uppercase"
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

      {/* PAGE 1: Offer Letter Appointment Body */}
      {page === 1 && (
        <div className="relative z-10 space-y-4 pt-4 text-slate-800">
          {/* Reference & Date Header */}
          <div className="flex items-center justify-between text-xs font-semibold">
            <div className="flex items-center gap-1">
              <ClickToEditText
                value={content.ref_label || 'Ref:'}
                onSave={(val) => onTextChange('ref_label', val)}
                className="text-slate-700"
              />
              <ClickToEditText
                value={content.reference_number || refNum}
                onSave={(val) => {
                  onTextChange('reference_number', val);
                  onFieldChange('reference_number', val);
                }}
                className="font-mono font-bold text-slate-800"
              />
            </div>
            <div className="flex items-center gap-1">
              <ClickToEditText
                value={content.date_label || 'Date:'}
                onSave={(val) => onTextChange('date_label', val)}
                className="text-slate-700"
              />
              <ClickToEditText
                value={content.current_date || curDate}
                onSave={(val) => {
                  onTextChange('current_date', val);
                  onFieldChange('current_date', val);
                }}
                className="font-medium text-slate-800"
              />
            </div>
          </div>

          {/* Recipient Details */}
          <div className="pt-2 text-xs leading-normal">
            <ClickToEditText
              value={content.to_label || 'To,'}
              onSave={(val) => onTextChange('to_label', val)}
              className="font-semibold text-slate-700 block mb-0.5"
            />
            <div className="mt-0.5 flex items-center gap-1">
              <ClickToEditText
                value={content.cand_name_label || 'Name:'}
                onSave={(val) => onTextChange('cand_name_label', val)}
                className="text-slate-700 font-normal"
              />
              <ClickToEditText
                value={content.cand_name_line || `Mr. ${candName}`}
                onSave={(val) => {
                  onTextChange('cand_name_line', val);
                  onFieldChange('candidate_full_name', val.replace(/^(Mr\.|Ms\.|Mrs\.)\s*/i, ''));
                }}
                className="font-semibold text-slate-900"
              />
            </div>
            <div className="mt-0.5 flex items-center gap-1">
              <ClickToEditText
                value={content.cand_mobile_label || 'Mobile:'}
                onSave={(val) => onTextChange('cand_mobile_label', val)}
                className="text-slate-700 font-normal"
              />
              <ClickToEditText
                value={content.cand_mobile_line || `+91 ${candMobile}`}
                onSave={(val) => {
                  onTextChange('cand_mobile_line', val);
                  onFieldChange('candidate_mobile', val.replace(/^\+91\s*/, ''));
                }}
                className="text-slate-800"
              />
            </div>
          </div>

          {/* Subject Line */}
          <div className="pt-2 pb-1 text-center sm:text-left">
            <ClickToEditText
              value={content.subject || 'Re: Offer letter'}
              onSave={(val) => onTextChange('subject', val)}
              className="font-bold underline text-slate-900 text-[14px]"
            />
          </div>

          {/* Salutation */}
          <div className="pt-1">
            <ClickToEditText
              value={content.salutation || `Dear Mr. ${candName},`}
              onSave={(val) => onTextChange('salutation', val)}
              className="font-semibold text-slate-900"
            />
          </div>

          {/* Paragraph 1 */}
          <p className="text-justify leading-relaxed">
            <ClickToEditText
              value={
                content.p10 && !content.p10.includes('Behrunda 2 Rajasthan')
                  ? content.p10
                  : `You will be happy to know that you have been appointed as a ${approvedRole} in our Organization. Presently you will be posted in ${approvedLoc} your services may be transferred to any location within India subject to business requirements. Your remunerations will be as per Annexure- II.`
              }
              onSave={(val) => onTextChange('p10', val)}
              multiline
              tagName="span"
              className="w-full text-justify"
            />
          </p>

          {/* Paragraph 2 */}
          <p className="text-justify leading-relaxed">
            <ClickToEditText
              value={
                content.p11 ||
                'The revisions in your salary will not be automatic but will be subject to satisfactory work, regular attendance, good conduct and performance appraisal by your managers as per company policy.'
              }
              onSave={(val) => onTextChange('p11', val)}
              multiline
              tagName="span"
              className="w-full text-justify"
            />
          </p>

          {/* Paragraph 3 */}
          <p className="text-justify leading-relaxed">
            <ClickToEditText
              value={
                content.p13 ||
                'Your appointment will be subject to the terms and conditions as set out in Annexure-I which are enclosed herewith.'
              }
              onSave={(val) => onTextChange('p13', val)}
              multiline
              tagName="span"
              className="w-full text-justify"
            />
          </p>

          {/* Paragraph 4 */}
          <p className="text-justify leading-relaxed">
            <ClickToEditText
              value={
                content.p14 ||
                'Please sign and return the duplicate copy of this letter as token of your acceptance of the appointment & the terms and conditions mentioned in the Annexure.'
              }
              onSave={(val) => onTextChange('p14', val)}
              multiline
              tagName="span"
              className="w-full text-justify"
            />
          </p>

          {/* Joining Date Line */}
          <p className="text-justify font-semibold leading-relaxed">
            <ClickToEditText
              value={content.p16 || `You are requested to join on or before Dated: ${joiningDate}.`}
              onSave={(val) => {
                onTextChange('p16', val);
                const match = val.match(/\d{2}\/\d{2}\/\d{4}/);
                if (match) onFieldChange('joining_date', match[0]);
              }}
              multiline
              tagName="span"
              className="w-full"
            />
          </p>

          {/* Closing sentence */}
          <p className="pt-1">
            <ClickToEditText
              value={content.p19 || 'We look forward to working together with you.'}
              onSave={(val) => onTextChange('p19', val)}
              tagName="span"
            />
          </p>

          {/* Signatures & Stamp Block */}
          <div className="pt-6 grid grid-cols-2 gap-8 items-start">
            {/* Left Column: Employer Signoff with Stamp */}
            <div className="space-y-1">
              <ClickToEditText
                value={content.yours_faithfully || 'Yours faithfully,'}
                onSave={(val) => onTextChange('yours_faithfully', val)}
                className="font-medium"
              />
              <div className="py-1">
                <img
                  src={stampSignature}
                  alt="Authorized Stamp & Signature"
                  className="w-32 h-auto object-contain pointer-events-none select-none filter contrast-125"
                />
              </div>
              <div>
                <ClickToEditText
                  value={content.hr_dept || 'HR Department'}
                  onSave={(val) => onTextChange('hr_dept', val)}
                  className="font-semibold text-slate-800 text-xs block"
                />
                <ClickToEditText
                  value={content.company_name || 'For, Fiber Force Private Limited'}
                  onSave={(val) => onTextChange('company_name', val)}
                  className="font-bold text-slate-900 text-xs block"
                />
              </div>
            </div>

            {/* Right Column: Candidate Acknowledgment */}
            <div className="space-y-1 sm:text-right">
              <ClickToEditText
                value={content.received_accepted || 'Received & Accepted:'}
                onSave={(val) => onTextChange('received_accepted', val)}
                className="font-medium"
              />
              <div className="h-14 flex items-end justify-start sm:justify-end">
                <span className="text-[11px] text-slate-400 italic">
                  [Candidate Signature]
                </span>
              </div>
              <div>
                <ClickToEditText
                  value={content.signature_line || 'Signature: ___________________'}
                  onSave={(val) => onTextChange('signature_line', val)}
                  className="font-medium text-xs text-slate-700"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PAGE 2: Annexure I (Part 1) */}
      {page === 2 && (
        <div className="relative z-10 space-y-3.5 pt-4 text-slate-800">
          <div className="text-center pb-2">
            <ClickToEditText
              value={content.annex1_title || 'Annexure I'}
              onSave={(val) => onTextChange('annex1_title', val)}
              className="text-base font-bold uppercase tracking-wider block text-slate-900"
            />
            <ClickToEditText
              value={content.annex1_subtitle || 'Terms and Conditions of appointment'}
              onSave={(val) => onTextChange('annex1_subtitle', val)}
              className="text-xs font-semibold text-slate-600 block mt-0.5"
            />
            <ClickToEditText
              value={content.annex1_cand_name || `Name:  Mr. ${candName}`}
              onSave={(val) => onTextChange('annex1_cand_name', val)}
              className="text-xs font-bold text-slate-800 block mt-1"
            />
          </div>

          <div>
            <ClickToEditText
              value={content.annex1_s1_h || 'Service subject to rules'}
              onSave={(val) => onTextChange('annex1_s1_h', val)}
              className="font-bold text-xs uppercase block text-slate-900"
            />
            <ClickToEditText
              value={
                content.annex1_s1_b ||
                'Your service would be governed by the Company’s rules and regulations for the time being in force and as applicable from time to time.'
              }
              onSave={(val) => onTextChange('annex1_s1_b', val)}
              multiline
              className="text-justify w-full block mt-0.5 text-xs"
            />
          </div>

          <div>
            <ClickToEditText
              value={content.annex1_s2_h || 'Probation'}
              onSave={(val) => onTextChange('annex1_s2_h', val)}
              className="font-bold text-xs uppercase block text-slate-900"
            />
            <ClickToEditText
              value={
                content.annex1_s2_b ||
                'You will be on probation for a period of six months and will be confirmed after the period, if your work and conduct are found satisfactory. The management reserves the right either to extend the probationary period or to dispense with your services at any time during the period by a written notice of 5(Five) days if your performance or conduct, at the discretion of the Management, does not come up to its expectations.'
              }
              onSave={(val) => onTextChange('annex1_s2_b', val)}
              multiline
              className="text-justify w-full block mt-0.5 text-xs"
            />
          </div>

          <div>
            <ClickToEditText
              value={content.annex1_s3_h || 'Provident Fund & ESI'}
              onSave={(val) => onTextChange('annex1_s3_h', val)}
              className="font-bold text-xs uppercase block text-slate-900"
            />
            <ClickToEditText
              value={content.annex1_s3_b || 'Provident Fund as per the prevailing Act wherever applicable.'}
              onSave={(val) => onTextChange('annex1_s3_b', val)}
              className="text-justify w-full block mt-0.5 text-xs"
            />
          </div>

          <div>
            <ClickToEditText
              value={content.annex1_s4_h || 'Transfer'}
              onSave={(val) => onTextChange('annex1_s4_h', val)}
              className="font-bold text-xs uppercase block text-slate-900"
            />
            <ClickToEditText
              value={content.annex1_s4_b || 'You will be liable to be transferred to anywhere in India to our other business units.'}
              onSave={(val) => onTextChange('annex1_s4_b', val)}
              className="text-justify w-full block mt-0.5 text-xs"
            />
          </div>

          <div>
            <ClickToEditText
              value={content.annex1_s5_h || 'Transfer & Mobility Clause'}
              onSave={(val) => onTextChange('annex1_s5_h', val)}
              className="font-bold text-xs uppercase block text-slate-900"
            />
            <ClickToEditText
              value={
                content.annex1_s5_b1 ||
                'Your services are transferable to any office, project site, client location, subsidiary, associate company, branch, or business unit of the Company anywhere in India or abroad.'
              }
              onSave={(val) => onTextChange('annex1_s5_b1', val)}
              multiline
              className="text-justify w-full block mt-0.5 text-xs"
            />
            <ClickToEditText
              value={
                content.annex1_s5_b2 ||
                'You may also be required to work from customer premises, remote locations, field offices, or operational sites depending upon business requirements.'
              }
              onSave={(val) => onTextChange('annex1_s5_b2', val)}
              multiline
              className="text-justify w-full block mt-1 text-xs"
            />
            <ClickToEditText
              value={
                content.annex1_s5_b3 ||
                'Any kind of Transfer Charges/ Transportation charges are not applicable and will not be borne by Company.'
              }
              onSave={(val) => onTextChange('annex1_s5_b3', val)}
              multiline
              className="text-justify w-full block mt-1 text-xs"
            />
            <ClickToEditText
              value={
                content.annex1_s5_b4 ||
                'Reimbursement of Joining Ticket (Air/ Train/Bus) – Any kind of reimbursement of Joining Ticket (Air/ Train/Bus) will not be borne by company.'
              }
              onSave={(val) => onTextChange('annex1_s5_b4', val)}
              multiline
              className="text-justify w-full block mt-1 text-xs"
            />
          </div>

          <div>
            <ClickToEditText
              value={content.annex1_s6_h || 'Intellectual Property Rights (IPR)'}
              onSave={(val) => onTextChange('annex1_s6_h', val)}
              className="font-bold text-xs uppercase block text-slate-900"
            />
            <ClickToEditText
              value={
                content.annex1_s6_b1 ||
                'Any invention, development, process improvement, software, documentation, design, database, report, innovation, or work product developed by the Employee during employment and relating to the Company’s business shall remain the sole and exclusive property of the Company.'
              }
              onSave={(val) => onTextChange('annex1_s6_b1', val)}
              multiline
              className="text-justify w-full block mt-0.5 text-xs"
            />
            <ClickToEditText
              value={
                content.annex1_s6_b2 ||
                'The Employee hereby irrevocably assigns all intellectual property rights arising from such work to the Company'
              }
              onSave={(val) => onTextChange('annex1_s6_b2', val)}
              multiline
              className="text-justify w-full block mt-1 text-xs"
            />
          </div>
        </div>
      )}

      {/* PAGE 3: Annexure I (Part 2) */}
      {page === 3 && (
        <div className="relative z-10 space-y-3.5 pt-4 text-slate-800">
          <div>
            <ClickToEditText
              value={content.annex1_s7_h || 'Moonlighting / Dual Employment Clause'}
              onSave={(val) => onTextChange('annex1_s7_h', val)}
              className="font-bold text-xs uppercase block text-slate-900"
            />
            <ClickToEditText
              value={
                content.annex1_s7_b1 ||
                'During the term of employment with the Company, the Employee shall devote full working time, attention, and abilities to the duties assigned by the Company.'
              }
              onSave={(val) => onTextChange('annex1_s7_b1', val)}
              multiline
              className="text-justify w-full block mt-0.5 text-xs"
            />
            <ClickToEditText
              value={
                content.annex1_s7_b2 ||
                'The Employee shall not, without prior written approval of the Company: engage in any other employment, occupation, consultancy, freelancing, profession, trade, or business activity, whether part-time or full-time; provide services directly or indirectly to any competitor, customer, vendor, or business associate of the Company; undertake any activity that may create conflict of interest, impact performance, compromise confidentiality, or adversely affect the Company’s business interests.'
              }
              onSave={(val) => onTextChange('annex1_s7_b2', val)}
              multiline
              className="text-justify w-full block mt-1 text-xs"
            />
            <ClickToEditText
              value={
                content.annex1_s7_b3 ||
                'Any unauthorized dual employment or moonlighting shall constitute misconduct and may result in disciplinary action, including termination of employment, recovery of losses, and legal proceedings, wherever applicable.'
              }
              onSave={(val) => onTextChange('annex1_s7_b3', val)}
              multiline
              className="text-justify w-full block mt-1 text-xs"
            />
            <ClickToEditText
              value={
                content.annex1_s7_b4 ||
                'The Employee shall immediately disclose to the Company any external assignment, directorship, partnership, advisory role, or commercial interest undertaken during the course of employment.'
              }
              onSave={(val) => onTextChange('annex1_s7_b4', val)}
              multiline
              className="text-justify w-full block mt-1 text-xs"
            />
            <ClickToEditText
              value={
                content.annex1_s7_b5 ||
                'Any violation shall constitute serious misconduct and may lead to disciplinary action including immediate termination, legal proceedings, and recovery of damages.'
              }
              onSave={(val) => onTextChange('annex1_s7_b5', val)}
              multiline
              className="text-justify w-full block mt-1 text-xs"
            />
          </div>

          <div>
            <ClickToEditText
              value={content.annex1_s8_h || 'Non-Solicit Clause'}
              onSave={(val) => onTextChange('annex1_s8_h', val)}
              className="font-bold text-xs uppercase block text-slate-900"
            />
            <ClickToEditText
              value={
                content.annex1_s8_b ||
                'During employment and for a period of 12 months after cessation of employment, the Employee shall not directly or indirectly: solicit Company employees for alternate employment; solicit or divert customers, vendors, or business partners; or interfere with existing business relationships of the Company.'
              }
              onSave={(val) => onTextChange('annex1_s8_b', val)}
              multiline
              className="text-justify w-full block mt-0.5 text-xs"
            />
          </div>

          <div>
            <ClickToEditText
              value={content.annex1_s9_h || 'Leaves and other service benefits'}
              onSave={(val) => onTextChange('annex1_s9_h', val)}
              className="font-bold text-xs uppercase block text-slate-900"
            />
            <ClickToEditText
              value={
                content.annex1_s9_b ||
                'You will be entitled for Leave, holidays and other service benefits as per the rules framed by the company and as may be applicable to you.'
              }
              onSave={(val) => onTextChange('annex1_s9_b', val)}
              className="text-justify w-full block mt-0.5 text-xs"
            />
          </div>

          <div>
            <ClickToEditText
              value={content.annex1_s10_h || 'Certificate and Testimonials'}
              onSave={(val) => onTextChange('annex1_s10_h', val)}
              className="font-bold text-xs uppercase block text-slate-900"
            />
            <ClickToEditText
              value={
                content.annex1_s10_b ||
                'Certified copies of your certificates and testimonials including the proof of your age, together, proof of your address along with 2 Passport size photographs may please be submitted at the time of joining for our records.'
              }
              onSave={(val) => onTextChange('annex1_s10_b', val)}
              className="text-justify w-full block mt-0.5 text-xs"
            />
          </div>

          <div>
            <ClickToEditText
              value={content.annex1_s11_h || 'Status'}
              onSave={(val) => onTextChange('annex1_s11_h', val)}
              className="font-bold text-xs uppercase block text-slate-900"
            />
            <ClickToEditText
              value={
                content.annex1_s11_b ||
                'You should keep the Company informed about any change in your address and your marital status.'
              }
              onSave={(val) => onTextChange('annex1_s11_b', val)}
              className="text-justify w-full block mt-0.5 text-xs"
            />
          </div>

          <div>
            <ClickToEditText
              value={content.annex1_s12_h || 'Secrecy'}
              onSave={(val) => onTextChange('annex1_s12_h', val)}
              className="font-bold text-xs uppercase block text-slate-900"
            />
            <ClickToEditText
              value={
                content.annex1_s12_b ||
                'You shall, at all times, maintain complete secrecy about the Company’s business affairs, inventions, secret processes, schemes, information to which you have access and the like which may come to your knowledge during the period of your employment. You shall keep and render faithful account of all the properties of the Company’s entrusted to you in the course of your employment with the Company.'
              }
              onSave={(val) => onTextChange('annex1_s12_b', val)}
              multiline
              className="text-justify w-full block mt-0.5 text-xs"
            />
          </div>
        </div>
      )}

      {/* PAGE 4: Annexure I (Part 3) */}
      {page === 4 && (
        <div className="relative z-10 space-y-3 pt-4 text-slate-800">
          <div>
            <ClickToEditText
              value={content.annex1_s13_h || 'Separation'}
              onSave={(val) => onTextChange('annex1_s13_h', val)}
              className="font-bold text-xs uppercase block text-slate-900"
            />
            <ClickToEditText
              value={content.annex1_s13_sub1 || 'Co-terminus Employment Clause'}
              onSave={(val) => onTextChange('annex1_s13_sub1', val)}
              className="font-semibold text-xs text-slate-800 block mt-1"
            />
            <ClickToEditText
              value={
                content.annex1_s13_b1 ||
                'The Employee acknowledges and agrees that his/her employment is project-specific and co-terminus with the continuation of the project, contract, assignment, or business engagement for which the Employee has been hired.'
              }
              onSave={(val) => onTextChange('annex1_s13_b1', val)}
              multiline
              className="text-justify w-full block mt-0.5 text-xs"
            />
            <ClickToEditText
              value={
                content.annex1_s13_b2 ||
                'The employment shall automatically stand terminated upon: a) completion, closure, suspension, reduction, or termination of the said project/contract by the Client/Principal Employer; or b) discontinuation or reduction of services requiring the Employee’s role; or c) expiry/non-renewal/termination of the underlying contract between the Company and its Client.'
              }
              onSave={(val) => onTextChange('annex1_s13_b2', val)}
              multiline
              className="text-justify w-full block mt-1 text-xs"
            />
            <ClickToEditText
              value={
                content.annex1_s13_b3 ||
                'Such cessation of employment shall not be treated as retrenchment under applicable labour laws, and no separate notice pay or compensation shall be payable except statutory dues, if any, applicable under law.'
              }
              onSave={(val) => onTextChange('annex1_s13_b3', val)}
              multiline
              className="text-justify w-full block mt-1 text-xs"
            />
            <ClickToEditText
              value={
                content.annex1_s13_b4 ||
                'The Employee further agrees that posting, transfer, redeployment, or continuation in any alternate assignment shall be solely at the discretion of the Company, subject to business requirements and availability of work.'
              }
              onSave={(val) => onTextChange('annex1_s13_b4', val)}
              multiline
              className="text-justify w-full block mt-1 text-xs"
            />
          </div>

          <div>
            <ClickToEditText
              value={content.annex1_s13_sub2 || 'Separation / Notice Period Clause'}
              onSave={(val) => onTextChange('annex1_s13_sub2', val)}
              className="font-semibold text-xs text-slate-800 block mt-1"
            />
            <ClickToEditText
              value={
                content.annex1_s13_b5 ||
                'Either party may terminate the employment by providing written notice as under: The Employee may resign from employment by giving 60 (Sixty) days’ prior written notice to the Company. The Company may terminate the employment by giving 30 (Thirty) days’ prior written notice or salary in lieu of notice, either wholly or partially, at its discretion.'
              }
              onSave={(val) => onTextChange('annex1_s13_b5', val)}
              multiline
              className="text-justify w-full block mt-0.5 text-xs"
            />
            <ClickToEditText
              value={
                content.annex1_s13_b6 ||
                'The Company may, at its sole discretion: Waive part or full notice period; Accept payment in lieu of shortfall in notice period from the Employee; or Relieve the Employee earlier based on business requirements, subject to satisfactory handover of duties, company assets, documents, data, and completion of all exit formalities.'
              }
              onSave={(val) => onTextChange('annex1_s13_b6', val)}
              multiline
              className="text-justify w-full block mt-1 text-xs"
            />
            <ClickToEditText
              value={
                content.annex1_s13_b7 ||
                'During the notice period, the Employee shall continue to diligently perform assigned duties and support transition and knowledge transfer activities.'
              }
              onSave={(val) => onTextChange('annex1_s13_b7', val)}
              multiline
              className="text-justify w-full block mt-1 text-xs"
            />
            <ClickToEditText
              value={
                content.annex1_s13_b8 ||
                'Notwithstanding the above, the Company reserves the right to terminate employment with immediate effect without notice or compensation in cases involving misconduct, fraud, breach of confidentiality, conflict of interest, violation of Company policies, or any act causing reputational or financial harm to the Company.'
              }
              onSave={(val) => onTextChange('annex1_s13_b8', val)}
              multiline
              className="text-justify w-full block mt-1 text-xs"
            />
          </div>

          <div>
            <ClickToEditText
              value={
                content.annex1_s14_b1 ||
                'During the period of employment with the Company, you shall not engage in any other profession or business and shall endeavor best to promote the Company’s interests.'
              }
              onSave={(val) => onTextChange('annex1_s14_b1', val)}
              multiline
              className="text-justify w-full block text-xs"
            />
            <ClickToEditText
              value={
                content.annex1_s14_b2 ||
                'During the period of your employment, you shall not, without the written authority of the Company publish any written articles or deliver any talk on any subject related to your profession.'
              }
              onSave={(val) => onTextChange('annex1_s14_b2', val)}
              multiline
              className="text-justify w-full block mt-1 text-xs"
            />
            <ClickToEditText
              value={
                content.annex1_s14_b3 ||
                'The Public holidays observed by the Company are subject to change from time to time. You will be entitled to paid holidays during the calendar year, which will be declared at the beginning of each year.'
              }
              onSave={(val) => onTextChange('annex1_s14_b3', val)}
              multiline
              className="text-justify w-full block mt-1 text-xs"
            />
            <ClickToEditText
              value={
                content.annex1_s14_b4 ||
                'You should not involve directly or indirectly in such activity which shall damages the dignity, image & property of company or his client.'
              }
              onSave={(val) => onTextChange('annex1_s14_b4', val)}
              multiline
              className="text-justify w-full block mt-1 text-xs"
            />
            <ClickToEditText
              value={
                content.annex1_s14_b5 ||
                'The facilities, amenities and leave granted to employees in excess of the statutory requirements do not form part of the conditions of service and subject to change at the discretion of the management.'
              }
              onSave={(val) => onTextChange('annex1_s14_b5', val)}
              multiline
              className="text-justify w-full block mt-1 text-xs"
            />
          </div>

          <div>
            <ClickToEditText
              value={content.annex1_s15_h || 'PLI (If applicable)'}
              onSave={(val) => onTextChange('annex1_s15_h', val)}
              className="font-bold text-xs uppercase block text-slate-900"
            />
            <ClickToEditText
              value={
                content.annex1_s15_b ||
                'Performance Linked Incentive is a variable component of the compensation and will be calculated on Financial Year basis and payable on yearly in the organization on basis of fulfilling the criteria of KPI matrix. PLI is payable subject to employee being on the rolls of the company and not serving notice period on the date of disbursement of PLI. In case of leaving the organization before 1 year or separated by employer for any reason, employee will not be entitled for claiming any PLI. PLI is also subject to Income Tax rules in force from time to time.'
              }
              onSave={(val) => onTextChange('annex1_s15_b', val)}
              multiline
              className="text-justify w-full block mt-0.5 text-xs"
            />
          </div>
        </div>
      )}

      {/* PAGE 5: Annexure II (Salary Table Breakdown) */}
      {page === 5 && (
        <div className="relative z-10 space-y-3.5 pt-4 text-slate-800">
          <div className="text-center pb-2">
            <ClickToEditText
              value={content.annex2_title || 'Annexure – II'}
              onSave={(val) => onTextChange('annex2_title', val)}
              className="text-base font-bold uppercase tracking-wider block text-slate-900"
            />
            <ClickToEditText
              value={content.annex2_name || `Name: Mr. ${candName}`}
              onSave={(val) => onTextChange('annex2_name', val)}
              className="text-xs font-semibold text-slate-700 block mt-0.5"
            />
          </div>

          {/* Salary Breakdown Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse border border-slate-300 font-sans">
              <thead>
                <tr className="bg-slate-100/90 text-slate-800 font-bold border-b border-slate-300">
                  <th className="border border-slate-300 px-3 py-1.5 text-left w-2/5">
                    <ClickToEditText
                      value={content.th_heads || 'Heads'}
                      onSave={(val) => onTextChange('th_heads', val)}
                    />
                  </th>
                  <th className="border border-slate-300 px-3 py-1.5 text-right w-1/5">
                    <ClickToEditText
                      value={content.th_monthly || 'Monthly (₹)'}
                      onSave={(val) => onTextChange('th_monthly', val)}
                    />
                  </th>
                  <th className="border border-slate-300 px-3 py-1.5 text-right w-1/5">
                    <ClickToEditText
                      value={content.th_yearly || 'Yearly (₹)'}
                      onSave={(val) => onTextChange('th_yearly', val)}
                    />
                  </th>
                  <th className="border border-slate-300 px-3 py-1.5 text-left w-1/5">
                    <ClickToEditText
                      value={content.th_remarks || 'Remarks'}
                      onSave={(val) => onTextChange('th_remarks', val)}
                    />
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="bg-indigo-50/50 font-bold border-b border-slate-300">
                  <td className="border border-slate-300 px-3 py-1 text-slate-900">CTC: Annexure - A</td>
                  <td className="border border-slate-300 px-3 py-1 text-right font-mono">
                    <ClickToEditText
                      value={String(offerFields.total_ctc_monthly || offerFields.monthly_ctc || '40000')}
                      onSave={(val) => onFieldChange('total_ctc_monthly', val)}
                    />
                  </td>
                  <td className="border border-slate-300 px-3 py-1 text-right font-mono">
                    <ClickToEditText
                      value={String(offerFields.yearly_ctc || '480000')}
                      onSave={(val) => onFieldChange('yearly_ctc', val)}
                    />
                  </td>
                  <td className="border border-slate-300 px-3 py-1 text-slate-500 text-[11px]">Per Month/Per Year</td>
                </tr>

                <tr>
                  <td className="border border-slate-300 px-3 py-1 font-semibold text-slate-800">Basic</td>
                  <td className="border border-slate-300 px-3 py-1 text-right font-mono">
                    <ClickToEditText
                      value={String(offerFields.basic_monthly || '24000')}
                      onSave={(val) => onFieldChange('basic_monthly', val)}
                    />
                  </td>
                  <td className="border border-slate-300 px-3 py-1 text-right font-mono">
                    <ClickToEditText
                      value={String(offerFields.basic_yearly || '288000')}
                      onSave={(val) => onFieldChange('basic_yearly', val)}
                    />
                  </td>
                  <td className="border border-slate-300 px-3 py-1 text-slate-400"></td>
                </tr>

                <tr>
                  <td className="border border-slate-300 px-3 py-1 font-semibold text-slate-800">HRA</td>
                  <td className="border border-slate-300 px-3 py-1 text-right font-mono">
                    <ClickToEditText
                      value={String(offerFields.hra_monthly || '0')}
                      onSave={(val) => onFieldChange('hra_monthly', val)}
                    />
                  </td>
                  <td className="border border-slate-300 px-3 py-1 text-right font-mono">
                    <ClickToEditText
                      value={String(offerFields.hra_yearly || '0')}
                      onSave={(val) => onFieldChange('hra_yearly', val)}
                    />
                  </td>
                  <td className="border border-slate-300 px-3 py-1 text-slate-400"></td>
                </tr>

                <tr>
                  <td className="border border-slate-300 px-3 py-1 font-semibold text-slate-800">Conveyance Allowance</td>
                  <td className="border border-slate-300 px-3 py-1 text-right font-mono">
                    <ClickToEditText
                      value={String(offerFields.conveyance_monthly || '0')}
                      onSave={(val) => onFieldChange('conveyance_monthly', val)}
                    />
                  </td>
                  <td className="border border-slate-300 px-3 py-1 text-right font-mono">
                    <ClickToEditText
                      value={String(offerFields.conveyance_yearly || '0')}
                      onSave={(val) => onFieldChange('conveyance_yearly', val)}
                    />
                  </td>
                  <td className="border border-slate-300 px-3 py-1 text-slate-400"></td>
                </tr>

                <tr>
                  <td className="border border-slate-300 px-3 py-1 font-semibold text-slate-800">Others Allowances</td>
                  <td className="border border-slate-300 px-3 py-1 text-right font-mono">
                    <ClickToEditText
                      value={String(offerFields.other_allowance_monthly || '12000')}
                      onSave={(val) => onFieldChange('other_allowance_monthly', val)}
                    />
                  </td>
                  <td className="border border-slate-300 px-3 py-1 text-right font-mono">
                    <ClickToEditText
                      value={String(offerFields.other_allowance_yearly || '144000')}
                      onSave={(val) => onFieldChange('other_allowance_yearly', val)}
                    />
                  </td>
                  <td className="border border-slate-300 px-3 py-1 text-slate-400"></td>
                </tr>

                <tr>
                  <td className="border border-slate-300 px-3 py-1 font-semibold text-slate-800">Medical Allowance</td>
                  <td className="border border-slate-300 px-3 py-1 text-right font-mono">
                    <ClickToEditText
                      value={String(offerFields.medical_monthly || '45')}
                      onSave={(val) => onFieldChange('medical_monthly', val)}
                    />
                  </td>
                  <td className="border border-slate-300 px-3 py-1 text-right font-mono">
                    <ClickToEditText
                      value={String(offerFields.medical_yearly || '540')}
                      onSave={(val) => onFieldChange('medical_yearly', val)}
                    />
                  </td>
                  <td className="border border-slate-300 px-3 py-1 text-slate-400"></td>
                </tr>

                <tr>
                  <td className="border border-slate-300 px-3 py-1 font-semibold text-slate-800">Advance Bonus</td>
                  <td className="border border-slate-300 px-3 py-1 text-right font-mono">
                    <ClickToEditText
                      value={String(offerFields.bonus_monthly || '2000')}
                      onSave={(val) => onFieldChange('bonus_monthly', val)}
                    />
                  </td>
                  <td className="border border-slate-300 px-3 py-1 text-right font-mono">
                    <ClickToEditText
                      value={String(offerFields.bonus_yearly || '24000')}
                      onSave={(val) => onFieldChange('bonus_yearly', val)}
                    />
                  </td>
                  <td className="border border-slate-300 px-3 py-1 text-slate-400"></td>
                </tr>

                <tr>
                  <td className="border border-slate-300 px-3 py-1 font-semibold text-slate-800">Advance Gratuity</td>
                  <td className="border border-slate-300 px-3 py-1 text-right font-mono">
                    <ClickToEditText
                      value={String(offerFields.gratuity_monthly || '1154')}
                      onSave={(val) => onFieldChange('gratuity_monthly', val)}
                    />
                  </td>
                  <td className="border border-slate-300 px-3 py-1 text-right font-mono">
                    <ClickToEditText
                      value={String(offerFields.gratuity_yearly || '13848')}
                      onSave={(val) => onFieldChange('gratuity_yearly', val)}
                    />
                  </td>
                  <td className="border border-slate-300 px-3 py-1 text-slate-400"></td>
                </tr>

                <tr className="bg-slate-50 font-bold border-t border-b border-slate-300">
                  <td className="border border-slate-300 px-3 py-1 text-slate-900">Gross Salary</td>
                  <td className="border border-slate-300 px-3 py-1 text-right font-mono">
                    <ClickToEditText
                      value={String(offerFields.gross_monthly || offerFields.monthly_salary || '40000')}
                      onSave={(val) => onFieldChange('gross_monthly', val)}
                    />
                  </td>
                  <td className="border border-slate-300 px-3 py-1 text-right font-mono">
                    <ClickToEditText
                      value={String(offerFields.gross_yearly || '480000')}
                      onSave={(val) => onFieldChange('gross_yearly', val)}
                    />
                  </td>
                  <td className="border border-slate-300 px-3 py-1 text-slate-400"></td>
                </tr>

                <tr>
                  <td className="border border-slate-300 px-3 py-1 font-semibold text-slate-800">Employee PF Contribution</td>
                  <td className="border border-slate-300 px-3 py-1 text-right font-mono">
                    <ClickToEditText
                      value={String(offerFields.emp_pf_monthly || '0')}
                      onSave={(val) => onFieldChange('emp_pf_monthly', val)}
                    />
                  </td>
                  <td className="border border-slate-300 px-3 py-1 text-right font-mono">
                    <ClickToEditText
                      value={String(offerFields.emp_pf_yearly || '0')}
                      onSave={(val) => onFieldChange('emp_pf_yearly', val)}
                    />
                  </td>
                  <td className="border border-slate-300 px-3 py-1 text-slate-400"></td>
                </tr>

                <tr>
                  <td className="border border-slate-300 px-3 py-1 font-semibold text-slate-800">GPA Insurance</td>
                  <td className="border border-slate-300 px-3 py-1 text-right font-mono">
                    <ClickToEditText
                      value={String(offerFields.gpa_monthly || '45')}
                      onSave={(val) => onFieldChange('gpa_monthly', val)}
                    />
                  </td>
                  <td className="border border-slate-300 px-3 py-1 text-right font-mono">
                    <ClickToEditText
                      value={String(offerFields.gpa_yearly || '540')}
                      onSave={(val) => onFieldChange('gpa_yearly', val)}
                    />
                  </td>
                  <td className="border border-slate-300 px-3 py-1 text-slate-500 text-[11px]">As per actual</td>
                </tr>

                <tr className="bg-slate-50 border-t border-b border-slate-300">
                  <td className="border border-slate-300 px-3 py-1 font-bold text-slate-900">Net Deductions (Total)</td>
                  <td className="border border-slate-300 px-3 py-1 text-right font-mono font-bold text-rose-600">
                    <ClickToEditText
                      value={String(offerFields.deductions_monthly || '45')}
                      onSave={(val) => onFieldChange('deductions_monthly', val)}
                    />
                  </td>
                  <td className="border border-slate-300 px-3 py-1 text-right font-mono font-bold text-rose-600">
                    <ClickToEditText
                      value={String(offerFields.deductions_yearly || '540')}
                      onSave={(val) => onFieldChange('deductions_yearly', val)}
                    />
                  </td>
                  <td className="border border-slate-300 px-3 py-1 text-slate-400"></td>
                </tr>

                <tr className="bg-emerald-50/70 font-bold border-b border-slate-300">
                  <td className="border border-slate-300 px-3 py-1.5 text-emerald-950">Net Take Home</td>
                  <td className="border border-slate-300 px-3 py-1.5 text-right font-mono text-emerald-800">
                    <ClickToEditText
                      value={String(offerFields.take_home_monthly || offerFields.net_take_home_monthly || '39955')}
                      onSave={(val) => {
                        onFieldChange('take_home_monthly', val);
                        onFieldChange('net_take_home_monthly', val);
                      }}
                    />
                  </td>
                  <td className="border border-slate-300 px-3 py-1.5 text-right font-mono text-emerald-800">
                    <ClickToEditText
                      value={String(offerFields.take_home_yearly || offerFields.net_take_home_yearly || '479460')}
                      onSave={(val) => {
                        onFieldChange('take_home_yearly', val);
                        onFieldChange('net_take_home_yearly', val);
                      }}
                    />
                  </td>
                  <td className="border border-slate-300 px-3 py-1.5 text-emerald-900 text-[11px]">Monthly in-hand</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Notes Below Salary Table */}
          <div className="pt-2 space-y-1 text-xs text-slate-600">
            <div>
              •{' '}
              <ClickToEditText
                value={content.annex2_note1 || 'Income Tax will be deducted monthly subject to actual every month.'}
                onSave={(val) => onTextChange('annex2_note1', val)}
                className="inline-block"
              />
            </div>
            <div>
              •{' '}
              <ClickToEditText
                value={content.annex2_note2 || 'Prohibitory Deductions: - As per standard as applicable.'}
                onSave={(val) => onTextChange('annex2_note2', val)}
                className="inline-block"
              />
            </div>
            <div>
              •{' '}
              <ClickToEditText
                value={content.annex2_note3 || 'Mediclaim as per Policy – Payable as per usage'}
                onSave={(val) => onTextChange('annex2_note3', val)}
                className="inline-block"
              />
            </div>
          </div>
        </div>
      )}

      {/* Official Registered Office Footer on All Pages */}
      <div className="relative z-10 pt-10 mt-12 border-t border-slate-200 text-center text-[11px] text-slate-500">
        <ClickToEditText
          value={content.footer_address || defaultFooter}
          onSave={(val) => onTextChange('footer_address', val)}
          className="text-center w-full block text-slate-500 leading-normal"
        />
      </div>
    </div>
  );
};
