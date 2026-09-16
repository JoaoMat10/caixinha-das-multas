import { z } from 'zod';

import { isValidUsername } from '@/shared/rules/username';
import { adminPhotoMaxBytes } from '@/domains/admin/rules/photoProcessing';

export const adminUserSchema = z.object({
  username: z
    .string()
    .trim()
    .refine(
      isValidUsername,
      'Usa 3 a 32 letras minúsculas, números, ponto, hífen ou underscore.',
    ),
  displayName: z.string().trim().min(1, 'Indica o nome apresentado.').max(120),
});

export const adminTeamSchema = z.object({
  name: z.string().trim().min(1, 'Indica o nome da equipa.').max(120),
});

export const adminPasswordResetSchema = z.object({
  userId: z.uuid(),
  idempotencyKey: z.uuid(),
});

export const adminSeasonSchema = z
  .object({
    name: z.string().trim().min(1, 'Indica o nome da época.').max(80),
    startsOn: z.string(),
    endsOn: z.string(),
  })
  .refine(
    ({ startsOn, endsOn }) => !startsOn || !endsOn || startsOn <= endsOn,
    {
      message: 'A data final não pode ser anterior à data inicial.',
    },
  );

export const adminMemberSchema = z
  .object({
    memberType: z.enum(['player', 'staff']),
    shirtNumber: z.number().int().min(1).max(999).nullable(),
    staffFunction: z.string().trim().max(120).nullable(),
  })
  .superRefine((value, context) => {
    if (value.memberType === 'player' && value.shirtNumber === null) {
      context.addIssue({
        code: 'custom',
        message: 'O jogador exige número de camisola.',
      });
    }
    if (value.memberType === 'staff' && !value.staffFunction) {
      context.addIssue({
        code: 'custom',
        message: 'A equipa técnica exige uma função.',
      });
    }
  });

const allowedPhotoTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
export function validateAdminPhoto(file: File) {
  if (!allowedPhotoTypes.has(file.type))
    throw new Error('Usa uma imagem JPEG, PNG ou WebP.');
  if (file.size > adminPhotoMaxBytes)
    throw new Error('A fotografia não pode exceder 5 MiB.');
}
