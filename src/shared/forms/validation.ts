import { zodResolver } from '@hookform/resolvers/zod';
import type { FieldValues } from 'react-hook-form';
import type { z } from 'zod';

export function createFormResolver<TInput extends FieldValues, TOutput>(
  schema: z.ZodType<TOutput, TInput>,
) {
  return zodResolver(schema);
}
