import type { Client, CreateClientPayload } from '../types/client.types';

export const createClientClient = async (payload: CreateClientPayload): Promise<Client> => {
  let response: Response;

  try {
    response = await fetch('/api/clients', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Network error while creating client';
    throw new Error(`Network error: ${message}`);
  }

  const text = await response.text();
  let parsed: { message?: string } = { message: text };

  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = { message: text };
  }

  if (!response.ok) {
    const message = parsed.message || response.statusText || 'Unknown error';
    throw new Error(`Error creating client: ${message}`);
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Invalid JSON response from create client API');
  }
};
