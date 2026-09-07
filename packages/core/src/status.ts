/**
 * KobeanTest Status & Badge Semantic Mappings
 * WCAG AAA compliant styling and iconography tokens.
 */

import type { ExecutionStatus, Priority } from './types.ts';

export interface StatusDescriptor {
  status: ExecutionStatus;
  label: string;
  icon: 'CheckCircle2' | 'AlertCircle' | 'Ban' | 'MinusCircle';
  colorHex: string;
  badgeClass: string;
}

export const EXECUTION_STATUS_MAP: Record<ExecutionStatus, StatusDescriptor> = {
  passed: {
    status: 'passed',
    label: 'Passed',
    icon: 'CheckCircle2',
    colorHex: '#10B981',
    badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  },
  failed: {
    status: 'failed',
    label: 'Failed',
    icon: 'AlertCircle',
    colorHex: '#F43F5E',
    badgeClass: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
  },
  blocked: {
    status: 'blocked',
    label: 'Blocked',
    icon: 'Ban',
    colorHex: '#F59E0B',
    badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  },
  skipped: {
    status: 'skipped',
    label: 'Skipped',
    icon: 'MinusCircle',
    colorHex: '#64748B',
    badgeClass: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20',
  },
};

export interface PriorityDescriptor {
  priority: Priority;
  label: string;
  badgeClass: string;
}

export const PRIORITY_MAP: Record<Priority, PriorityDescriptor> = {
  low: {
    priority: 'low',
    label: 'Low',
    badgeClass: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20',
  },
  medium: {
    priority: 'medium',
    label: 'Medium',
    badgeClass: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  },
  high: {
    priority: 'high',
    label: 'High',
    badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  },
  critical: {
    priority: 'critical',
    label: 'Critical',
    badgeClass: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
  },
};
