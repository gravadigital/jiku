'use client';
import React from 'react';
import { ErrorPageContent } from '../ErrorPageContent';
import type { CustomError } from '@/shared/types';

export default function ErrorPage({ error }: { readonly error: CustomError }) {
  return <ErrorPageContent message={error.message} />;
}
