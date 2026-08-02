import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const root = process.cwd();
const DEFAULT_TEAM_SLUG = "what-to-eat";
const DEFAULT_SOURCE_NAME = "seed-places.json";
const DEFAULT_LISTS = [
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
const IMPORTED_RATERS = [
  ["杨", "yang"],
  ["陈", "chen"],
];

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

function parseArgs(argv) {
  const options = {
    archiveMissing: false,
    confirm: false,
    dryRun: false,
    rollbackBatchId: null,
    sourceName: DEFAULT_SOURCE_NAME,
    teamSlug: DEFAULT_TEAM_SLUG,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--archive-missing") {
      options.archiveMissing = true;
    } else if (arg === "--confirm") {
      options.confirm = true;
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--rollback-batch") {
      options.rollbackBatchId = argv[index + 1];
      index += 1;
    } else if (arg === "--source-name") {
      options.sourceName = argv[index + 1];
      index += 1;
    } else if (arg === "--team-slug") {
      options.teamSlug = argv[index + 1];
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (options.rollbackBatchId && !options.dryRun && !options.confirm) {
    throw new Error("Rollback requires --confirm unless --dry-run is used.");
  }

  return options;
}

function getSupabaseClient() {
  return createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SECRET_KEY"), {
    auth: { persistSession: false },
  });
}

async function getOrCreateTeam(supabase, slug, dryRun) {
  const existing = await supabase.from("teams").select("id, slug").eq("slug", slug).maybeSingle();

  if (existing.error) {
    throw existing.error;
  }

  if (existing.data) {
    return { id: existing.data.id, action: "existing" };
  }

  if (dryRun) {
    return { id: "dry-run-team-id", action: "create" };
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

  return { id: inserted.data.id, action: "create" };
}

async function getOrUpsertList(supabase, teamId, list, dryRun) {
  const existing = await supabase
    .from("lists")
    .select("id")
    .eq("team_id", teamId)
    .eq("slug", list.slug)
    .maybeSingle();

  if (existing.error) {
    throw existing.error;
  }

  if (dryRun) {
    return {
      id: existing.data?.id ?? `dry-run-list-${list.slug}`,
      action: existing.data ? "update" : "create",
    };
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

    return { id: existing.data.id, action: "update" };
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

  return { id: inserted.data.id, action: "create" };
}

async function getExistingPlaces(supabase, teamId) {
  const { data, error } = await supabase
    .from("places")
    .select("id, import_key, archived_at")
    .eq("team_id", teamId)
    .not("import_key", "is", null);

  if (error) {
    throw error;
  }

  return new Map((data ?? []).map((place) => [place.import_key, place]));
}

function toPlacePayload(teamId, place, importBatchId) {
  return {
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
    archived_at: null,
    import_batch_id: importBatchId,
    updated_at: new Date().toISOString(),
  };
}

async function upsertPlace(supabase, teamId, place, existingPlace, importBatchId, dryRun) {
  if (dryRun) {
    return {
      id: existingPlace?.id ?? `dry-run-place-${place.id}`,
      action: existingPlace ? "update" : "create",
    };
  }

  const payload = toPlacePayload(teamId, place, importBatchId);

  if (existingPlace) {
    const updated = await supabase.from("places").update(payload).eq("id", existingPlace.id);

    if (updated.error) {
      throw updated.error;
    }

    return { id: existingPlace.id, action: "update" };
  }

  const inserted = await supabase.from("places").insert(payload).select("id").single();

  if (inserted.error) {
    throw inserted.error;
  }

  return { id: inserted.data.id, action: "create" };
}

async function linkPlaceToList(supabase, listId, placeId, sortOrder, importBatchId, dryRun) {
  if (dryRun && placeId.startsWith("dry-run-")) {
    return "create";
  }

  const existing = await supabase
    .from("list_places")
    .select("list_id")
    .eq("list_id", listId)
    .eq("place_id", placeId)
    .maybeSingle();

  if (existing.error) {
    throw existing.error;
  }

  if (dryRun) {
    return existing.data ? "update" : "create";
  }

  if (existing.data) {
    const updated = await supabase
      .from("list_places")
      .update({ sort_order: sortOrder, import_batch_id: importBatchId })
      .eq("list_id", listId)
      .eq("place_id", placeId);

    if (updated.error) {
      throw updated.error;
    }

    return "update";
  }

  const inserted = await supabase.from("list_places").insert({
    list_id: listId,
    place_id: placeId,
    sort_order: sortOrder,
    import_batch_id: importBatchId,
  });

  if (inserted.error) {
    throw inserted.error;
  }

  return "create";
}

async function upsertImportedRating(supabase, teamId, placeId, raterLabel, score, importBatchId, dryRun) {
  if (!score || score <= 0) {
    return "skip";
  }

  if (dryRun && placeId.startsWith("dry-run-")) {
    return "create";
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

  if (dryRun) {
    return existing.data ? "update" : "create";
  }

  const payload = {
    team_id: teamId,
    place_id: placeId,
    source: "team_member",
    rater_label: raterLabel,
    score,
    import_batch_id: importBatchId,
    updated_at: new Date().toISOString(),
  };

  if (existing.data) {
    const updated = await supabase.from("ratings").update(payload).eq("id", existing.data.id);

    if (updated.error) {
      throw updated.error;
    }

    return "update";
  }

  const inserted = await supabase.from("ratings").insert(payload);

  if (inserted.error) {
    throw inserted.error;
  }

  return "create";
}

async function createImportBatch(supabase, options, summary, dryRun) {
  if (dryRun) {
    return "dry-run-batch-id";
  }

  const inserted = await supabase
    .from("import_batches")
    .insert({
      source_name: options.sourceName,
      operation: options.archiveMissing ? "seed_with_archive_missing" : "seed",
      status: "running",
      summary,
    })
    .select("id")
    .single();

  if (inserted.error) {
    throw inserted.error;
  }

  return inserted.data.id;
}

async function finishImportBatch(supabase, batchId, status, summary, dryRun) {
  if (dryRun) {
    return;
  }

  const updated = await supabase
    .from("import_batches")
    .update({
      status,
      summary,
      finished_at: new Date().toISOString(),
    })
    .eq("id", batchId);

  if (updated.error) {
    throw updated.error;
  }
}

async function archiveMissingPlaces(supabase, teamId, importedKeys, importBatchId, dryRun) {
  const existingPlaces = await getExistingPlaces(supabase, teamId);
  const missing = Array.from(existingPlaces.values()).filter(
    (place) => !importedKeys.has(place.import_key) && !place.archived_at,
  );

  if (!dryRun && missing.length > 0) {
    const updated = await supabase
      .from("places")
      .update({
        archived_at: new Date().toISOString(),
        import_batch_id: importBatchId,
        updated_at: new Date().toISOString(),
      })
      .in(
        "id",
        missing.map((place) => place.id),
      );

    if (updated.error) {
      throw updated.error;
    }
  }

  return missing.length;
}

async function runSeedImport(supabase, options) {
  const seedPlaces = JSON.parse(readFileSync(resolve(root, "src/data/seed-places.json"), "utf8"));
  const dryRun = options.dryRun;
  const summary = {
    archiveMissing: options.archiveMissing,
    listsCreated: 0,
    listsUpdated: 0,
    placesCreated: 0,
    placesUpdated: 0,
    listLinksCreated: 0,
    listLinksUpdated: 0,
    ratingsCreated: 0,
    ratingsUpdated: 0,
    ratingsSkipped: 0,
    placesArchivedMissing: 0,
  };

  const team = await getOrCreateTeam(supabase, options.teamSlug, dryRun);
  const teamId = team.id;
  const existingPlaces = dryRun && team.action === "create" ? new Map() : await getExistingPlaces(supabase, teamId);
  const batchId = await createImportBatch(supabase, options, summary, dryRun);
  const listIds = new Map();
  const importedKeys = new Set();

  try {
    for (const list of DEFAULT_LISTS) {
      const result = await getOrUpsertList(supabase, teamId, list, dryRun);
      listIds.set(list.slug, result.id);
      summary[result.action === "create" ? "listsCreated" : "listsUpdated"] += 1;
    }

    for (const [index, place] of seedPlaces.entries()) {
      const listId = listIds.get(place.listSlug);

      if (!listId) {
        throw new Error(`Unknown list slug for place ${place.id}: ${place.listSlug}`);
      }

      importedKeys.add(place.id);

      const placeResult = await upsertPlace(supabase, teamId, place, existingPlaces.get(place.id), batchId, dryRun);
      summary[placeResult.action === "create" ? "placesCreated" : "placesUpdated"] += 1;

      const linkAction = await linkPlaceToList(supabase, listId, placeResult.id, index, batchId, dryRun);
      summary[linkAction === "create" ? "listLinksCreated" : "listLinksUpdated"] += 1;

      for (const [raterLabel, scoreKey] of IMPORTED_RATERS) {
        const ratingAction = await upsertImportedRating(
          supabase,
          teamId,
          placeResult.id,
          raterLabel,
          place.memberScores?.[scoreKey],
          batchId,
          dryRun,
        );

        if (ratingAction === "skip") {
          summary.ratingsSkipped += 1;
        } else {
          summary[ratingAction === "create" ? "ratingsCreated" : "ratingsUpdated"] += 1;
        }
      }
    }

    if (options.archiveMissing) {
      summary.placesArchivedMissing = await archiveMissingPlaces(supabase, teamId, importedKeys, batchId, dryRun);
    }

    await finishImportBatch(supabase, batchId, "completed", summary, dryRun);

    return {
      ok: true,
      dryRun,
      teamId,
      importBatchId: batchId,
      sourceName: options.sourceName,
      summary,
    };
  } catch (error) {
    await finishImportBatch(supabase, batchId, "failed", { ...summary, error: error.message }, dryRun);
    throw error;
  }
}

async function rollbackBatch(supabase, options) {
  const batchId = options.rollbackBatchId;
  const batchResult = await supabase
    .from("import_batches")
    .select("id, source_name, operation, status, summary, rolled_back_at")
    .eq("id", batchId)
    .maybeSingle();

  if (batchResult.error) {
    throw batchResult.error;
  }

  if (!batchResult.data) {
    throw new Error(`Import batch not found: ${batchId}`);
  }

  const [{ count: ratingsCount, error: ratingsCountError }, { count: linksCount, error: linksCountError }, { count: placesCount, error: placesCountError }] =
    await Promise.all([
      supabase.from("ratings").select("id", { count: "exact", head: true }).eq("import_batch_id", batchId),
      supabase.from("list_places").select("place_id", { count: "exact", head: true }).eq("import_batch_id", batchId),
      supabase.from("places").select("id", { count: "exact", head: true }).eq("import_batch_id", batchId).is("archived_at", null),
    ]);

  if (ratingsCountError) throw ratingsCountError;
  if (linksCountError) throw linksCountError;
  if (placesCountError) throw placesCountError;

  const summary = {
    ratingsDeleted: ratingsCount ?? 0,
    listLinksDeleted: linksCount ?? 0,
    placesArchived: placesCount ?? 0,
  };

  if (options.dryRun) {
    return {
      ok: true,
      dryRun: true,
      rollbackBatchId: batchId,
      batch: batchResult.data,
      summary,
    };
  }

  const ratingsDelete = await supabase.from("ratings").delete().eq("import_batch_id", batchId);
  if (ratingsDelete.error) throw ratingsDelete.error;

  const linksDelete = await supabase.from("list_places").delete().eq("import_batch_id", batchId);
  if (linksDelete.error) throw linksDelete.error;

  const placesArchive = await supabase
    .from("places")
    .update({
      archived_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("import_batch_id", batchId)
    .is("archived_at", null);
  if (placesArchive.error) throw placesArchive.error;

  const batchUpdate = await supabase
    .from("import_batches")
    .update({
      status: "rolled_back",
      rolled_back_at: new Date().toISOString(),
      summary: {
        ...batchResult.data.summary,
        rollback: summary,
      },
    })
    .eq("id", batchId);
  if (batchUpdate.error) throw batchUpdate.error;

  return {
    ok: true,
    dryRun: false,
    rollbackBatchId: batchId,
    summary,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  loadEnv();

  const supabase = getSupabaseClient();
  const result = options.rollbackBatchId
    ? await rollbackBatch(supabase, options)
    : await runSeedImport(supabase, options);

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
