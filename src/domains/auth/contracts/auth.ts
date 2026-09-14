export type MemberRole = 'captain' | 'treasurer';
export type MemberType = 'player' | 'staff';
export type SeasonStatus = 'draft' | 'active' | 'archived';

export type SeasonMembership = {
  id: string;
  seasonId: string;
  seasonName: string;
  seasonStatus: SeasonStatus;
  teamId: string;
  teamName: string;
  memberType: MemberType;
  roles: MemberRole[];
};

export type AuthenticatedUser = {
  id: string;
  username: string;
  displayName: string;
  avatarPath: string | null;
  mustChangePassword: boolean;
  isAppAdmin: boolean;
  memberships: SeasonMembership[];
};

export type AuthSession = {
  userId: string;
  expiresAt: number;
};

export type AuthSessionEvent =
  'initial' | 'signed-in' | 'signed-out' | 'token-refreshed' | 'user-updated';

export type PasswordChange = {
  currentPassword: string;
  newPassword: string;
};

export interface AuthGateway {
  signIn: (technicalEmail: string, password: string) => Promise<AuthSession>;
  getSession: () => Promise<AuthSession | null>;
  loadAuthorizationContext: (userId: string) => Promise<AuthenticatedUser>;
  updatePassword: (change: PasswordChange) => Promise<void>;
  signOut: () => Promise<void>;
  onSessionEvent: (listener: (event: AuthSessionEvent) => void) => () => void;
}

export type AuthCapability = 'member' | 'treasurer' | 'admin';
