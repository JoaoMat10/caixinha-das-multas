import { z } from 'zod';

export const passwordSchema = z
  .string()
  .min(6, 'A password deve ter pelo menos 6 caracteres.')
  .regex(/[a-z]/, 'A password deve incluir uma letra minúscula.')
  .regex(/[A-Z]/, 'A password deve incluir uma letra maiúscula.')
  .regex(/[0-9]/, 'A password deve incluir um número.');

export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, 'Indica a password atual.'),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((value) => value.newPassword !== value.currentPassword, {
    message: 'A nova password deve ser diferente da atual.',
    path: ['newPassword'],
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: 'As passwords não coincidem.',
    path: ['confirmPassword'],
  });

export type PasswordChangeForm = z.infer<typeof passwordChangeSchema>;
