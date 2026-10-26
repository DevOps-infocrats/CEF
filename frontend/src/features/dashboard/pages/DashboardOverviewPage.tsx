import React from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  UserCheck,
  FileClock,
  PlusCircle,
  FileDown,
  ShieldCheck,
  UserPlus,
} from 'lucide-react';
import { useCurrentUser } from '@/features/auth/hooks/useAuth';
import { GlassCard } from '@/components/GlassCard';
import { GlassButton } from '@/components/GlassButton';
import { EmptyState } from '@/components/EmptyState';
import { useMyApplications } from '@/features/candidates/hooks/useCandidates';

export const DashboardOverviewPage: React.FC = () => {
  const { data: user } = useCurrentUser();
  const { data: myAppsData, isLoading } = useMyApplications();

  const applications = myAppsData?.applications || [];

  const verifiedCount = applications.filter(
    (c) => c.status === 'VERIFICATION_COMPLETE' || c.status === 'COMPLETE'
  ).length;

  const underReviewCount = applications.filter(
    (c) =>
      c.status === 'PENDING' ||
      c.status === 'PENDING_VERIFICATION' ||
      c.status === 'IN_PROGRESS' ||
      c.status === 'SUBMITTED'
  ).length;

  const metrics = [
    {
      title: 'Total Candidates Registered',
      value: isLoading ? '...' : applications.length.toString(),
      change: 'Active candidate records',
      icon: Users,
      badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    },
    {
      title: 'Verified Candidates',
      value: isLoading ? '...' : verifiedCount.toString(),
      change: 'Eligibility & documents cleared',
      icon: UserCheck,
      badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    },
    {
      title: 'Forms Under Review',
      value: isLoading ? '...' : underReviewCount.toString(),
      change: 'Pending verification queue',
      icon: FileClock,
      badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
    },
  ];

  return (
    <div className="space-y-8 animate-fade-in max-w-7xl mx-auto">
      {/* Welcome Banner */}
      <GlassCard variant="glow" className="relative overflow-hidden p-8 bg-white border-indigo-200 shadow-md">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-800 text-xs font-bold border border-indigo-200">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
              <span>Candidate Enrollment Form (CEF) Portal</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
              Welcome, {user?.first_name || 'Admin'}
            </h1>
            <p className="text-xs md:text-sm text-slate-600 max-w-2xl leading-relaxed">
              Candidate Enrollment Form processing, verification queues, and candidate records.
              All active records from the database will display in real time.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link to="/candidates">
              <GlassButton
                variant="primary"
                leftIcon={<PlusCircle className="w-4 h-4" />}
              >
                New Application
              </GlassButton>
            </Link>
            <GlassButton
              variant="secondary"
              leftIcon={<FileDown className="w-4 h-4" />}
              onClick={() => {
                if (applications.length === 0) {
                  alert('No candidate enrollment records exist to export yet.');
                } else {
                  alert(`Exporting summary for ${applications.length} candidate applications.`);
                }
              }}
            >
              Export Report
            </GlassButton>
          </div>
        </div>

        {/* Ambient Corner Glow in soft indigo */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-indigo-100/50 to-indigo-50/0 rounded-full blur-3xl pointer-events-none" />
      </GlassCard>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {metrics.map((m, idx) => {
          const Icon = m.icon;
          return (
            <GlassCard
              key={idx}
              variant="interactive"
              className="p-5 bg-white border-slate-200/80 hover:border-indigo-300 shadow-xs hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600">{m.title}</span>
                <div className={`p-2 rounded-xl border ${m.badgeColor}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-4">
                <p className="text-2xl font-bold text-slate-900 tracking-tight">{m.value}</p>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <span className="text-[11px] text-slate-500 font-medium">{m.change}</span>
                </div>
              </div>
            </GlassCard>
          );
        })}
      </div>

      {/* Candidate Enrollment Submissions Section */}
      <GlassCard className="p-6 bg-white/95 border-slate-200/80 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight">
              Candidate Enrollment Applications
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Active candidate submissions undergoing document verification and status approval.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">Total Enrolled: {applications.length}</span>
          </div>
        </div>

        {applications.length === 0 ? (
          <EmptyState
            icon={<UserPlus className="w-8 h-8 text-indigo-600" />}
            title="No Candidate Enrollment Forms Yet"
            description="There are currently no candidates enrolled in the system. When candidates register or submit enrollment forms, their records and verification status will appear here."
            action={
              <Link to="/candidates">
                <GlassButton variant="primary" size="sm" leftIcon={<PlusCircle className="w-3.5 h-3.5" />}>
                  Create First Application
                </GlassButton>
              </Link>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 uppercase font-semibold text-[11px] tracking-wider">
                  <th className="pb-3 px-3">Application Ref</th>
                  <th className="pb-3 px-3">Candidate Name</th>
                  <th className="pb-3 px-3">Hero & Role</th>
                  <th className="pb-3 px-3">Documents</th>
                  <th className="pb-3 px-3">Status</th>
                  <th className="pb-3 px-3 text-right">Submitted Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {applications.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-slate-50 transition-colors group cursor-pointer"
                  >
                    <td className="py-4 px-3 font-mono text-indigo-700 font-semibold">
                      <Link to={`/documents/${item.id}`} className="hover:underline">
                        {item.application_number}
                      </Link>
                    </td>
                    <td className="py-4 px-3 font-semibold text-slate-900">
                      <div>{item.full_name}</div>
                      <div className="text-[10px] text-slate-500 font-normal">{item.email}</div>
                    </td>
                    <td className="py-4 px-3 text-slate-700">
                      <span className="font-medium text-slate-800">{item.hero_category}</span>
                      <span className="text-slate-400 mx-1">•</span>
                      <span className="text-indigo-700 font-medium">{item.role_applied}</span>
                    </td>
                    <td className="py-4 px-3 text-slate-700">
                      {item.documents?.length || 0} files
                    </td>
                    <td className="py-4 px-3">
                      <span className="inline-block px-2.5 py-1 rounded-full text-[10px] font-semibold border bg-emerald-50 text-emerald-800 border-emerald-200">
                        {item.status || 'SUBMITTED'}
                      </span>
                    </td>
                    <td className="py-4 px-3 text-right text-slate-500 font-mono">
                      {item.created_at
                        ? new Date(item.created_at).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>
    </div>
  );
};
