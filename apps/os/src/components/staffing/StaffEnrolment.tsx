'use client';

/**
 * Staff Enrolment — Unified entry point that delegates to the comprehensive
 * Staff Access & Enrolment Hub (AccessControl) on the Enrol tab.
 */
import React from 'react';
import { AccessControl } from '../rbac/AccessControl';
import type { UserSession } from '../auth/AuthScreen';

interface Props {
  session?: UserSession;
  onNavigate?: (moduleKey: string) => void;
}

export const StaffEnrolment: React.FC<Props> = (props) => {
  return <AccessControl {...props} initialTab="enrol" />;
};

export default StaffEnrolment;
