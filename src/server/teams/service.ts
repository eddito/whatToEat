import "server-only";

import { getProfileByUsername } from "@/server/auth/repository";
import { isValidUsername, normalizeUsername } from "@/server/auth/username";
import {
  canManageTeamMembers,
  deleteTeamMember,
  getTeamBySlug,
  getTeamMembership,
  getTeamMembers,
  type TeamRole,
  upsertTeamMember,
} from "@/server/teams/repository";

export type UpsertAdminMemberInput = {
  actorUserId: string;
  username: string;
  role: TeamRole;
  teamSlug?: string;
};

export type RemoveAdminMemberInput = {
  actorUserId: string;
  username: string;
  teamSlug?: string;
};

export type AdminMemberResult = {
  username: string;
  userId: string;
  role: TeamRole | null;
  teamSlug: string;
};

export type AdminTeamMember = {
  username: string;
  userId: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: TeamRole;
  joinedAt: string;
};

export type GetAdminMembersInput = {
  actorUserId: string;
  teamSlug?: string;
};

export class MemberWriteError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "team_not_found"
      | "profile_not_found"
      | "not_allowed"
      | "invalid_username"
      | "self_remove_not_allowed"
      | "self_role_change_not_allowed",
  ) {
    super(message);
    this.name = "MemberWriteError";
  }
}

async function getWritableTeamForActor(actorUserId: string, teamSlug?: string) {
  const slug = teamSlug?.trim() || "what-to-eat";
  const team = await getTeamBySlug(slug);

  if (!team) {
    throw new MemberWriteError("Team not found.", "team_not_found");
  }

  const membership = await getTeamMembership(team.id, actorUserId);

  if (!canManageTeamMembers(membership?.role)) {
    throw new MemberWriteError("Current user cannot manage team members.", "not_allowed");
  }

  return team;
}

function toAdminTeamMember(member: Awaited<ReturnType<typeof getTeamMembers>>[number]): AdminTeamMember {
  return {
    username: member.profile.username,
    userId: member.profile.id,
    displayName: member.profile.display_name,
    avatarUrl: member.profile.avatar_url,
    role: member.role,
    joinedAt: member.created_at,
  };
}

async function getTargetProfile(username: string) {
  const normalizedUsername = normalizeUsername(username);

  if (!isValidUsername(normalizedUsername)) {
    throw new MemberWriteError("Username is invalid.", "invalid_username");
  }

  const profile = await getProfileByUsername(normalizedUsername);

  if (!profile) {
    throw new MemberWriteError("Profile not found.", "profile_not_found");
  }

  return profile;
}

export async function getAdminMembers(input: GetAdminMembersInput): Promise<AdminTeamMember[]> {
  const team = await getWritableTeamForActor(input.actorUserId, input.teamSlug);
  const members = await getTeamMembers(team.id);

  return members.map(toAdminTeamMember);
}

export async function upsertAdminMember(input: UpsertAdminMemberInput): Promise<AdminMemberResult> {
  const team = await getWritableTeamForActor(input.actorUserId, input.teamSlug);
  const profile = await getTargetProfile(input.username);

  if (profile.id === input.actorUserId && input.role !== "owner") {
    throw new MemberWriteError("Owners cannot change their own role away from owner.", "self_role_change_not_allowed");
  }

  const member = await upsertTeamMember({
    teamId: team.id,
    userId: profile.id,
    role: input.role,
  });

  return {
    username: profile.username,
    userId: profile.id,
    role: member.role,
    teamSlug: team.slug ?? "",
  };
}

export async function removeAdminMember(input: RemoveAdminMemberInput): Promise<AdminMemberResult> {
  const team = await getWritableTeamForActor(input.actorUserId, input.teamSlug);
  const profile = await getTargetProfile(input.username);

  if (profile.id === input.actorUserId) {
    throw new MemberWriteError("Owners cannot remove themselves from the team.", "self_remove_not_allowed");
  }

  await deleteTeamMember({
    teamId: team.id,
    userId: profile.id,
  });

  return {
    username: profile.username,
    userId: profile.id,
    role: null,
    teamSlug: team.slug ?? "",
  };
}
