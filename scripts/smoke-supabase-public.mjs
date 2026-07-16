import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const root = process.cwd();

function loadEnvFile() {
  const envPath = resolve(root, ".env.local");

  if (!existsSync(envPath)) {
    return false;
  }

  const envText = readFileSync(envPath, "utf8");

  for (const line of envText.split(/\r?\n/)) {
    const match = line.match(/^\s*([^#=\s]+)\s*=(.*)$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].trim();
    }
  }

  return true;
}

function requireEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

async function countQuery(label, query) {
  const { count, error } = await query;

  if (error) {
    throw new Error(`${label}: ${error.message}`);
  }

  return count ?? 0;
}

loadEnvFile();

const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
const publishableKey = requireEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
const supabase = createClient(supabaseUrl, publishableKey, {
  auth: {
    persistSession: false,
  },
});

const publicLists = await countQuery(
  "public lists",
  supabase
    .from("lists")
    .select("id", { count: "exact", head: true })
    .in("visibility", ["public_view", "public_rate"]),
);

const publicListPlaces = await countQuery(
  "public list_places",
  supabase.from("list_places").select("list_id", { count: "exact", head: true }),
);

const publicPlaces = await countQuery(
  "public places",
  supabase.from("places").select("id", { count: "exact", head: true }),
);

const publicRatings = await countQuery(
  "public ratings",
  supabase.from("ratings").select("id", { count: "exact", head: true }),
);

const samplePlace = await supabase
  .from("list_places")
  .select(
    `
    lists (slug, name, visibility),
    places (import_key, name, category, region)
  `,
  )
  .limit(1)
  .maybeSingle();

if (samplePlace.error) {
  throw new Error(`sample public place: ${samplePlace.error.message}`);
}

const checks = [
  ["public lists", publicLists >= 2],
  ["public list_places", publicListPlaces >= 1],
  ["public places", publicPlaces >= 1],
  ["public ratings", publicRatings >= 1],
  ["sample public place", Boolean(samplePlace.data)],
];

for (const [label, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
}

console.log(
  JSON.stringify(
    {
      publicLists,
      publicListPlaces,
      publicPlaces,
      publicRatings,
      hasSamplePlace: Boolean(samplePlace.data),
    },
    null,
    2,
  ),
);

if (checks.some(([, ok]) => !ok)) {
  process.exit(1);
}
