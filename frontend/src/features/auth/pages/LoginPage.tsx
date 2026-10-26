import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { User as UserIcon, Lock, ArrowRight, ShieldAlert, Eye, EyeOff } from 'lucide-react';
import { loginSchema, LoginFormData } from '../schemas';
import { useLogin } from '../hooks/useAuth';
import { GlassCard } from '@/components/GlassCard';
import { GlassInput } from '@/components/GlassInput';
import { GlassButton } from '@/components/GlassButton';

export const LoginPage: React.FC = () => {
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const loginMutation = useLogin();

  const onSubmit = (data: LoginFormData) => {
    loginMutation.mutate({
      email: data.email.trim(),
      password: data.password,
    });
  };

  return (
    <GlassCard variant="glow" className="bg-white border-indigo-200 shadow-xl shadow-indigo-950/5">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">
          Sign In to Portal
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Access your Candidate Enrollment Form, verification review, and candidate records.
        </p>
      </div>

      {loginMutation.isError && (
        <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5">
          <ShieldAlert className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-rose-700 leading-relaxed font-medium">
            {((loginMutation.error as any)?.response?.data?.message) || 'Authentication failed. Please verify your User ID and password.'}
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <GlassInput
          label="User ID or Email"
          type="text"
          placeholder="e.g. Admin or candidate email"
          autoComplete="username"
          leftIcon={<UserIcon className="w-4 h-4 text-indigo-600" />}
          error={errors.email?.message}
          {...register('email')}
        />

        <GlassInput
          label="Password"
          type={showPassword ? 'text' : 'password'}
          placeholder="••••••••••••"
          autoComplete="current-password"
          leftIcon={<Lock className="w-4 h-4 text-indigo-600" />}
          rightIcon={
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="p-1 text-slate-400 hover:text-indigo-700 transition-colors focus:outline-none"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          }
          error={errors.password?.message}
          {...register('password')}
        />

        <div className="flex items-center justify-between text-xs pt-1">
          <label className="flex items-center gap-2 cursor-pointer text-slate-600 hover:text-slate-900 select-none">
            <input
              type="checkbox"
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span>Remember session</span>
          </label>
          <a
            href="#forgot"
            onClick={(e) => {
              e.preventDefault();
              alert('Please contact the CEF Enrollment Administrator to reset credentials.');
            }}
            className="text-indigo-600 hover:text-indigo-700 font-medium"
          >
            Forgot password?
          </a>
        </div>

        <GlassButton
          type="submit"
          variant="primary"
          size="lg"
          className="w-full mt-2"
          isLoading={loginMutation.isPending}
          rightIcon={<ArrowRight className="w-4 h-4" />}
        >
          Sign In
        </GlassButton>
      </form>

      <div className="mt-6 pt-5 border-t border-slate-100 text-center">
        <p className="text-xs text-slate-500">
          New candidate applicant?{' '}
          <Link
            to="/register"
            className="text-indigo-600 hover:text-indigo-700 font-semibold underline underline-offset-4"
          >
            Candidate Registration
          </Link>
        </p>
      </div>
    </GlassCard>
  );
};
