import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { Mail, Lock, User as UserIcon, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { registerSchema, RegisterFormData } from '../schemas';
import { useRegister } from '../hooks/useAuth';
import { GlassCard } from '@/components/GlassCard';
import { GlassInput } from '@/components/GlassInput';
import { GlassButton } from '@/components/GlassButton';

export const RegisterPage: React.FC = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      username: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  const registerMutation = useRegister();

  const onSubmit = (data: RegisterFormData) => {
    registerMutation.mutate(data);
  };

  return (
    <GlassCard variant="glow" className="bg-white border-indigo-200 shadow-xl shadow-indigo-950/5">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">
          Candidate Registration
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Create an account to submit your Candidate Enrollment Form and track application status.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5">
        <div className="grid grid-cols-2 gap-3">
          <GlassInput
            label="First Name"
            placeholder="Aarav"
            leftIcon={<UserIcon className="w-4 h-4 text-indigo-600" />}
            error={errors.firstName?.message}
            {...register('firstName')}
          />
          <GlassInput
            label="Last Name"
            placeholder="Sharma"
            error={errors.lastName?.message}
            {...register('lastName')}
          />
        </div>

        <GlassInput
          label="Choose Username / User ID"
          placeholder="e.g. aarav2026"
          leftIcon={<UserIcon className="w-4 h-4 text-indigo-600" />}
          error={errors.username?.message}
          {...register('username')}
        />

        <GlassInput
          label="Email Address"
          type="email"
          placeholder="aarav@example.com"
          autoComplete="email"
          leftIcon={<Mail className="w-4 h-4 text-indigo-600" />}
          error={errors.email?.message}
          {...register('email')}
        />

        <GlassInput
          label="Password"
          type={showPassword ? 'text' : 'password'}
          placeholder="••••••••••••"
          autoComplete="new-password"
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

        <GlassInput
          label="Confirm Password"
          type={showConfirmPassword ? 'text' : 'password'}
          placeholder="••••••••••••"
          autoComplete="new-password"
          leftIcon={<Lock className="w-4 h-4 text-indigo-600" />}
          rightIcon={
            <button
              type="button"
              onClick={() => setShowConfirmPassword((prev) => !prev)}
              className="p-1 text-slate-400 hover:text-indigo-700 transition-colors focus:outline-none"
              aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
            >
              {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          }
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />

        <div className="pt-2">
          <GlassButton
            type="submit"
            variant="primary"
            size="lg"
            className="w-full"
            isLoading={registerMutation.isPending}
            rightIcon={<ArrowRight className="w-4 h-4" />}
          >
            Create Candidate Account
          </GlassButton>
        </div>
      </form>

      <div className="mt-6 pt-5 border-t border-slate-100 text-center">
        <p className="text-xs text-slate-500">
          Already registered?{' '}
          <Link
            to="/login"
            className="text-indigo-600 hover:text-indigo-700 font-semibold underline underline-offset-4"
          >
            Sign in to existing account
          </Link>
        </p>
      </div>
    </GlassCard>
  );
};
