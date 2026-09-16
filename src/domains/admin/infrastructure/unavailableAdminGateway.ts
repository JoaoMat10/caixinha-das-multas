import type { AdminGateway } from '@/domains/admin/contracts/admin';

function unavailable(): Promise<never> {
  return Promise.reject(
    new Error('A administração não está configurada neste ambiente.'),
  );
}

export class UnavailableAdminGateway implements AdminGateway {
  loadOverview = () => unavailable();
  createUser = () => unavailable();
  updateUser = () => unavailable();
  setUserActive = () => unavailable();
  resetPassword = () => unavailable();
  saveTeam = () => unavailable();
  saveSeason = () => unavailable();
  saveMember = () => unavailable();
  uploadUserPhoto = () => unavailable();
  removeUserPhoto = () => unavailable();
}
