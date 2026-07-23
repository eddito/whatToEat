import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const root = process.cwd();
const USERNAME_PATTERN = /^[a-z][a-z0-9_]{2,31}$/;
const DEFAULT_TEAM_SLUG = "what-to-eat";

function loadEnv() {
  const envPath = resolve(root, ".env.local");
  const envText = readFileSync(envPath, "utf8");

  for (const line of envText.split(/\r?\n/)) {
    const match = line.match(/^\s*([^#=\s]+)\s*=(.*)$/);
    if (match) {
      process.env[match[1]] = match[2].trim();
    }
  }
}

function requireEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function parseArgs() {
  const args = new Map();
  const entries = process.argv.slice(2);

  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];

    if (!entry.startsWith("--")) {
      continue;
    }

    const [rawKey, inlineValue] = entry.slice(2).split("=", 2);
    const value = inlineValue ?? entries[index + 1];
    args.set(rawKey, value);

    if (inlineValue === undefined) {
      index += 1;
    }
  }

  return {
    username: String(args.get("username") ?? process.env.AUTH_USERNAME ?? "").trim().toLowerCase(),
    password: String(args.get("password") ?? process.env.AUTH_PASSWORD ?? ""),
    displayName: String(args.get("display-name") ?? process.env.AUTH_DISPLAY_NAME ?? "").trim(),
    role: String(args.get("role") ?? process.env.AUTH_ROLE ?? "member").trim(),
    teamSlug: String(args.get("team-slug") ?? process.env.AUTH_TEAM_SLUG ?? DEFAULT_TEAM_SLUG).trim(),
    noTeam: args.has("no-team") || process.env.AUTH_NO_TEAM === "1",
  };
}

function getInternalEmail(username) {
  return `${username}@users.what-to-eat-today.invalid`;
}

async function getTeamId(supabase, slug) {
  const { data, error } = await supabase.from("teams").select("id").eq("slug", slug).maybeSingle();

  if (error) {
    throw error;
  }

  return data?.id ?? null;
}

async function upsertProfile(supabase, userId, username, displayName) {
  const { error } = await supabase.from("profiles").upsert(
    {
      id: userId,
      username,
      display_name: displayName || username,
    },
    {
      onConflict: "id",
    },
  );

  if (error) {
    throw error;
  }
}

async function upsertTeamMember(supabase, teamId, userId, role) {
  const { error } = await supabase.from("team_members").upsert(
    {
      team_id: teamId,
      user_id: userId,
      role,
    },
    {
      onConflict: "team_id,user_id",
    },
  );

  if (error) {
    throw error;
  }
}

async function main() {
  loadEnv();

  const { username, password, displayName, role, teamSlug, noTeam } = parseArgs();

  if (!USERNAME_PATTERN.test(username)) {
    throw new Error("Invalid username. Use 3-32 chars: lowercase letter first, then lowercase letters, numbers, or underscore.");
  }

  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }

  if (!["owner", "member", "viewer"].includes(role)) {
    throw new Error("Invalid role. Use owner, member, or viewer.");
  }

  const supabase = createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SECRET_KEY"), {
    auth: {
      persistSession: false,
    },
  });
  const internalEmail = getInternalEmail(username);
  const existingProfile = await supabase.from("profiles").select("id").eq("username", username).maybeSingle();

  if (existingProfile.error) {
    throw existingProfile.error;
  }

  let userId = existingProfile.data?.id;
  let createdAuthUser = false;

  if (userId) {
    const { error } = await supabase.auth.admin.updateUserById(userId, {
      password,
      user_metadata: {
        username,
        display_name: displayName || username,
      },
    });

    if (error) {
      throw error;
    }
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email: internalEmail,
      password,
      email_confirm: true,
      user_metadata: {
        username,
        display_name: displayName || username,
      },
    });

    if (error) {
      throw error;
    }

    userId = data.user.id;
    createdAuthUser = true;
  }

  await upsertProfile(supabase, userId, username, displayName);

  const teamId = noTeam ? null : await getTeamId(supabase, teamSlug);

  if (teamId) {
    await upsertTeamMember(supabase, teamId, userId, role);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        username,
        userId,
        role: teamId ? role : null,
        teamSlug: teamId ? teamSlug : null,
        noTeam,
        createdAuthUser,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
