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

export class AdminService {
  constructor(private readonly gateway: AdminGateway) {}

  loadOverview() {
    return this.gateway.loadOverview();
  }

  createUser(input: CreateAdminUser) {
    adminUserSchema.parse(input);
    return this.gateway.createUser(input);
  }

  updateUser(input: UpdateAdminUser) {
    adminUserSchema.parse(input);
    return this.gateway.updateUser(input);
  }

  setUserActive(userId: string, isActive: boolean) {
    return this.gateway.setUserActive(userId, isActive);
  }

  resetPassword(input: ResetAdminPassword) {
    adminPasswordResetSchema.parse(input);
    return this.gateway.resetPassword(input);
  }

  saveTeam(input: SaveAdminTeam) {
    adminTeamSchema.parse(input);
    return this.gateway.saveTeam(input);
  }

  saveSeason(input: SaveAdminSeason) {
    adminSeasonSchema.parse({
      ...input,
      startsOn: input.startsOn ?? '',
      endsOn: input.endsOn ?? '',
    });
    return this.gateway.saveSeason(input);
  }

  saveMember(input: SaveAdminMember) {
    adminMemberSchema.parse(input);
    return this.gateway.saveMember(input);
  }

  async uploadUserPhoto(userId: string, file: File) {
    validateAdminPhoto(file);
    const processed = await processAdminPhoto(file);
    validateAdminPhoto(processed);
    return this.gateway.uploadUserPhoto(userId, processed);
  }

  removeUserPhoto(userId: string) {
    return this.gateway.removeUserPhoto(userId);
  }
}
