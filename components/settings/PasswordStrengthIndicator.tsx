'use client';

import { useMemo } from 'react';
import { Check, X } from 'lucide-react';

interface PasswordStrengthIndicatorProps {
  password: string;
  username?: string;
  email?: string;
}

interface Requirement {
  label: string;
  test: (pwd: string, username?: string, email?: string) => boolean;
}

const PASSWORD_MIN_LENGTH = 12;

const requirements: Requirement[] = [
  {
    label: `At least ${PASSWORD_MIN_LENGTH} characters`,
    test: (pwd) => pwd.length >= PASSWORD_MIN_LENGTH
  },
  {
    label: 'At least one uppercase letter',
    test: (pwd) => /[A-Z]/.test(pwd)
  },
  {
    label: 'At least one lowercase letter',
    test: (pwd) => /[a-z]/.test(pwd)
  },
  {
    label: 'At least one digit',
    test: (pwd) => /\d/.test(pwd)
  },
  {
    label: 'At least one special character (!@#$%^&*...)',
    test: (pwd) => /[!@#$%^&*()\-_=+\[\]{};:'",.<>/?|\\`~]/.test(pwd)
  },
  {
    label: 'Must not contain username',
    test: (pwd, username) => {
      if (!username) return true;
      return !pwd.toLowerCase().includes(username.toLowerCase());
    }
  },
  {
    label: 'Must not contain email local-part',
    test: (pwd, username, email) => {
      if (!email) return true;
      const local = email.split('@')[0].toLowerCase();
      return !pwd.toLowerCase().includes(local);
    }
  }
];

export default function PasswordStrengthIndicator({ 
  password, 
  username = '', 
  email = '' 
}: PasswordStrengthIndicatorProps) {
  const results = useMemo(() => {
    return requirements.map(req => ({
      label: req.label,
      passed: req.test(password, username, email)
    }));
  }, [password, username, email]);

  const passedCount = results.filter(r => r.passed).length;
  const totalCount = results.length;
  const percentage = (passedCount / totalCount) * 100;

  const getStrengthColor = () => {
    if (percentage === 100) return 'text-green-400';
    if (percentage >= 70) return 'text-yellow-400';
    if (percentage >= 40) return 'text-orange-400';
    return 'text-red-400';
  };

  const getStrengthLabel = () => {
    if (percentage === 100) return 'Strong';
    if (percentage >= 70) return 'Good';
    if (percentage >= 40) return 'Fair';
    return 'Weak';
  };

  const getBarColor = () => {
    if (percentage === 100) return 'bg-green-500';
    if (percentage >= 70) return 'bg-yellow-500';
    if (percentage >= 40) return 'bg-orange-500';
    return 'bg-red-500';
  };

  if (!password) return null;

  return (
    <div className="mt-2 space-y-3">
      {/* Strength Bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted">Password Strength</span>
          <span className={`font-medium ${getStrengthColor()}`}>
            {getStrengthLabel()} ({passedCount}/{totalCount})
          </span>
        </div>
        <div className="h-2 bg-card-hover rounded-full overflow-hidden">
          <div 
            className={`h-full transition-all duration-300 ${getBarColor()}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      {/* Requirements List */}
      <div className="space-y-1">
        {results.map((result, index) => (
          <div 
            key={index}
            className="flex items-start gap-2 text-xs"
          >
            {result.passed ? (
              <Check className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
            ) : (
              <X className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            )}
            <span className={result.passed ? 'text-green-400' : 'text-muted'}>
              {result.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}