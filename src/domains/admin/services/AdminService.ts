import type {
  AdminGateway,
  CreateAdminUser,
  SaveAdminMember,
  SaveAdminSeason,
  SaveAdminTeam,
  ResetAdminPassword,
  UpdateAdminUser,
} from '@/domains/admin/contracts/admin';
import {
  adminMemberSchema,
  adminPasswordResetSchema,
  adminSeasonSchema,
  adminTeamSchema,
  adminUserSchema,
  validateAdminPhoto,
} from '@/domains/admin/rules/adminValidation';
import { processAdminPhoto } from '@/domains/admin/rules/photoProcessing';
import { requireOnline } from '@/shared/network/requireOnline';

export class AdminService {
  constructor(private readonly gateway: AdminGateway) {}

  loadOverview() {
    return this.gateway.loadOverview();
  }

  createUser(input: CreateAdminUser) {
    requireOnline();
    adminUserSchema.parse(input);
    return this.gateway.createUser(input);
  }

  updateUser(input: UpdateAdminUser) {
    requireOnline();
    adminUserSchema.parse(input);
    return this.gateway.updateUser(input);
  }

  setUserActive(userId: string, isActive: boolean) {
    requireOnline();
    return this.gateway.setUserActive(userId, isActive);
  }

  resetPassword(input: ResetAdminPassword) {
    requireOnline();
    adminPasswordResetSchema.parse(input);
    return this.gateway.resetPassword(input);
  }

  saveTeam(input: SaveAdminTeam) {
    requireOnline();
    adminTeamSchema.parse(input);
    return this.gateway.saveTeam(input);
  }

  saveSeason(input: SaveAdminSeason) {
    requireOnline();
    adminSeasonSchema.parse({
      ...input,
      startsOn: input.startsOn ?? '',
      endsOn: input.endsOn ?? '',
    });
    return this.gateway.saveSeason(input);
  }

  saveMember(input: SaveAdminMember) {
    requireOnline();
    adminMemberSchema.parse(input);
    return this.gateway.saveMember(input);
  }

  async uploadUserPhoto(userId: string, file: File) {
    requireOnline();
    validateAdminPhoto(file);
    const processed = await processAdminPhoto(file);
    validateAdminPhoto(processed);
    return this.gateway.uploadUserPhoto(userId, processed);
  }

  removeUserPhoto(userId: string) {
    requireOnline();
    return this.gateway.removeUserPhoto(userId);
  }
}
