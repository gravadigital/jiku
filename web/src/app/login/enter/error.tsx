'use client';
import React from 'react';
import type { CustomError } from '@/shared/types';

export default function ErrorPage({ error }: { readonly error: CustomError }) {
  return (
    <>
      <h1>Error</h1>
      <p>{error.message}</p>
    </>
  );
}
