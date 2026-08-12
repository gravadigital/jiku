import { ValidationError } from 'yup';

export const transformYupErrors = (errors: ValidationError): Record<string, string> => {
  const validationErrors: Record<string, string> = {};

  errors.inner.forEach((error: any) => {
    if (error.path !== null) {
      const [firstError] = error.errors;
      validationErrors[error.path] = firstError;
    }
  });

  return validationErrors;
};
