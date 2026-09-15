import type {
  AdminGateway,
  CreateAdminUser,
  SaveAdminMember,
  SaveAdminSeason,
  SaveAdminTeam,
  UpdateAdminUser,
} from '@/domains/admin/contracts/admin';
import {
  adminMemberSchema,
  adminSeasonSchema,
  adminTeamSchema,
  adminUserSchema,
  validateAdminPhoto,
} from '@/domains/admin/rules/adminValidation';

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

  resetPassword(userId: string) {
    return this.gateway.resetPassword(userId);
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

  uploadUserPhoto(userId: string, file: File) {
    validateAdminPhoto(file);
    return this.gateway.uploadUserPhoto(userId, file);
  }

  removeUserPhoto(userId: string) {
    return this.gateway.removeUserPhoto(userId);
  }
}
