import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const root = process.cwd();

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

async function getOrCreateTeam(supabase) {
  const slug = "what-to-eat";
  const existing = await supabase.from("teams").select("id").eq("slug", slug).maybeSingle();

  if (existing.error) {
    throw existing.error;
  }

  if (existing.data) {
    return existing.data.id;
  }

  const inserted = await supabase
    .from("teams")
    .insert({
      slug,
      name: "今天吃什么",
      description: "重庆探店小队",
    })
    .select("id")
    .single();

  if (inserted.error) {
    throw inserted.error;
  }

  return inserted.data.id;
}

async function getOrCreateList(supabase, teamId, list) {
  const existing = await supabase
    .from("lists")
    .select("id")
    .eq("team_id", teamId)
    .eq("slug", list.slug)
    .maybeSingle();

  if (existing.error) {
    throw existing.error;
  }

  if (existing.data) {
    const updated = await supabase
      .from("lists")
      .update({
        name: list.name,
        description: list.description,
        visibility: list.visibility,
      })
      .eq("id", existing.data.id);

    if (updated.error) {
      throw updated.error;
    }

    return existing.data.id;
  }

  const inserted = await supabase
    .from("lists")
    .insert({
      team_id: teamId,
      slug: list.slug,
      name: list.name,
      description: list.description,
      visibility: list.visibility,
    })
    .select("id")
    .single();

  if (inserted.error) {
    throw inserted.error;
  }

  return inserted.data.id;
}

async function getOrUpsertPlace(supabase, teamId, place) {
  const existing = await supabase
    .from("places")
    .select("id")
    .eq("team_id", teamId)
    .eq("import_key", place.id)
    .maybeSingle();

  if (existing.error) {
    throw existing.error;
  }

  const payload = {
    team_id: teamId,
    import_key: place.id,
    name: place.name,
    category: place.category || null,
    taste_tags: place.tasteTags || [],
    signature_dishes: place.signatureDishes || null,
    review_summary: place.review || null,
    region: place.region || null,
    location_label: place.locationLabel || null,
    parking_note: place.parkingNote || null,
    source_label: place.sourceLabel || null,
    visited: Boolean(place.visited),
    longitude: place.longitude ?? null,
    latitude: place.latitude ?? null,
    geocode_status: place.longitude && place.latitude ? "resolved" : "pending",
    updated_at: new Date().toISOString(),
  };

  if (existing.data) {
    const updated = await supabase.from("places").update(payload).eq("id", existing.data.id);

    if (updated.error) {
      throw updated.error;
    }

    return existing.data.id;
  }

  const inserted = await supabase.from("places").insert(payload).select("id").single();

  if (inserted.error) {
    throw inserted.error;
  }

  return inserted.data.id;
}

async function linkPlaceToList(supabase, listId, placeId, sortOrder) {
  const existing = await supabase
    .from("list_places")
    .select("list_id")
    .eq("list_id", listId)
    .eq("place_id", placeId)
    .maybeSingle();

  if (existing.error) {
    throw existing.error;
  }

  if (existing.data) {
    const updated = await supabase
      .from("list_places")
      .update({ sort_order: sortOrder })
      .eq("list_id", listId)
      .eq("place_id", placeId);

    if (updated.error) {
      throw updated.error;
    }

    return;
  }

  const inserted = await supabase.from("list_places").insert({
    list_id: listId,
    place_id: placeId,
    sort_order: sortOrder,
  });

  if (inserted.error) {
    throw inserted.error;
  }
}

async function upsertImportedRating(supabase, teamId, placeId, raterLabel, score) {
  if (!score || score <= 0) {
    return false;
  }

  const existing = await supabase
    .from("ratings")
    .select("id")
    .eq("place_id", placeId)
    .eq("source", "team_member")
    .eq("rater_label", raterLabel)
    .maybeSingle();

  if (existing.error) {
    throw existing.error;
  }

  const payload = {
    team_id: teamId,
    place_id: placeId,
    source: "team_member",
    rater_label: raterLabel,
    score,
    updated_at: new Date().toISOString(),
  };

  if (existing.data) {
    const updated = await supabase.from("ratings").update(payload).eq("id", existing.data.id);

    if (updated.error) {
      throw updated.error;
    }

    return true;
  }

  const inserted = await supabase.from("ratings").insert(payload);

  if (inserted.error) {
    throw inserted.error;
  }

  return true;
}

async function main() {
  loadEnv();

  const supabase = createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SECRET_KEY"), {
    auth: { persistSession: false },
  });

  const seedPlaces = JSON.parse(readFileSync(resolve(root, "src/data/seed-places.json"), "utf8"));
  const lists = [
    {
      slug: "red-list",
      name: "红榜",
      description: "已经探过、值得优先推荐的店。",
      visibility: "public_rate",
    },
    {
      slug: "retry-list",
      name: "再练练",
      description: "体验还有争议，适合二刷确认的候选。",
      visibility: "public_view",
    },
  ];

  const teamId = await getOrCreateTeam(supabase);
  const listIds = new Map();

  for (const list of lists) {
    listIds.set(list.slug, await getOrCreateList(supabase, teamId, list));
  }

  const importBatch = await supabase
    .from("import_batches")
    .insert({ source_name: "seed-places.json" })
    .select("id")
    .single();

  if (importBatch.error) {
    throw importBatch.error;
  }

  let placeCount = 0;
  let ratingCount = 0;

  for (const [index, place] of seedPlaces.entries()) {
    const listId = listIds.get(place.listSlug);

    if (!listId) {
      throw new Error(`Unknown list slug for place ${place.id}: ${place.listSlug}`);
    }

    const placeId = await getOrUpsertPlace(supabase, teamId, place);
    await linkPlaceToList(supabase, listId, placeId, index);
    placeCount += 1;

    if (await upsertImportedRating(supabase, teamId, placeId, "杨", place.memberScores?.yang)) {
      ratingCount += 1;
    }

    if (await upsertImportedRating(supabase, teamId, placeId, "陈", place.memberScores?.chen)) {
      ratingCount += 1;
    }
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        teamId,
        importBatchId: importBatch.data.id,
        lists: lists.length,
        places: placeCount,
        ratingsWithScores: ratingCount,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
