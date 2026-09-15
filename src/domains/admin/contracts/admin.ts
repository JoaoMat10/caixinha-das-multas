export type AdminMemberRole = 'captain' | 'treasurer';
export type AdminMemberType = 'player' | 'staff';
export type AdminSeasonStatus = 'draft' | 'active' | 'archived';

export type AdminUser = {
  id: string;
  username: string;
  displayName: string;
  avatarPath: string | null;
  mustChangePassword: boolean;
  isActive: boolean;
  createdAt: string;
};

export type AdminTeam = {
  id: string;
  name: string;
  badgePath: string | null;
  isActive: boolean;
  createdAt: string;
};

export type AdminSeason = {
  id: string;
  teamId: string;
  name: string;
  startsOn: string | null;
  endsOn: string | null;
  status: AdminSeasonStatus;
  copiedFromSeasonId: string | null;
  createdAt: string;
};

export type AdminMember = {
  id: string;
  seasonId: string;
  userId: string;
  memberType: AdminMemberType;
  shirtNumber: number | null;
  staffFunction: string | null;
  status: 'active' | 'inactive';
  roles: AdminMemberRole[];
};

export type AdminAuditEvent = {
  id: string;
  actorUserId: string;
  actorDisplayName: string;
  action: string;
  entityType: string;
  entityId: string | null;
  teamId: string | null;
  seasonId: string | null;
  metadata: Record<string, unknown>;
  occurredAt: string;
};

export type AdminOverview = {
  users: AdminUser[];
  teams: AdminTeam[];
  seasons: AdminSeason[];
  members: AdminMember[];
  auditEvents: AdminAuditEvent[];
};

export type CreateAdminUser = {
  username: string;
  displayName: string;
  idempotencyKey: string;
};

export type UpdateAdminUser = Pick<
  AdminUser,
  'id' | 'username' | 'displayName'
>;

export type TemporaryPasswordResult = {
  temporaryPassword: string | null;
  replayed?: boolean;
};

export type SaveAdminTeam = {
  id?: string;
  name: string;
  isActive: boolean;
};

export type SaveAdminSeason = {
  id?: string;
  teamId: string;
  name: string;
  startsOn: string | null;
  endsOn: string | null;
  status: AdminSeasonStatus;
  copyFromSeasonId: string | null;
  idempotencyKey: string;
};

export type SaveAdminMember = {
  id?: string;
  seasonId: string;
  userId: string;
  memberType: AdminMemberType;
  shirtNumber: number | null;
  staffFunction: string | null;
  status: 'active' | 'inactive';
  roles: AdminMemberRole[];
};

export interface AdminGateway {
  loadOverview(): Promise<AdminOverview>;
  createUser(input: CreateAdminUser): Promise<TemporaryPasswordResult>;
  updateUser(input: UpdateAdminUser): Promise<void>;
  setUserActive(userId: string, isActive: boolean): Promise<void>;
  resetPassword(userId: string): Promise<TemporaryPasswordResult>;
  saveTeam(input: SaveAdminTeam): Promise<void>;
  saveSeason(input: SaveAdminSeason): Promise<void>;
  saveMember(input: SaveAdminMember): Promise<void>;
  uploadUserPhoto(userId: string, file: File): Promise<void>;
  removeUserPhoto(userId: string): Promise<void>;
}
