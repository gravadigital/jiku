'use client';
import React from 'react';
import type { CustomError } from '@/shared/types';

export default function ErrorPage({ error: _error }: { readonly error: CustomError }) {
  return (
    <>
      <h1>Error</h1>
      <p>Error inesperado</p>
    </>
  );
}
