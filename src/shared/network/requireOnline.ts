export const OFFLINE_WRITE_MESSAGE =
  'Esta operação exige ligação à internet. Nada foi guardado.';

export function requireOnline(
  connection: Pick<Navigator, 'onLine'> | undefined = typeof navigator ===
  'undefined'
    ? undefined
    : navigator,
) {
  if (connection?.onLine === false) throw new Error(OFFLINE_WRITE_MESSAGE);
}
