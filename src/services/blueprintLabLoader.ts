/// <reference types="vite/client" />
/**
 * blueprintLabLoader.ts
 * Supabase persistence layer for BlueprintLab.
 * Replaces window.storage.get / window.storage.set entirely.
 *
 * Schema routing:
 *   BP_PERSON_1.0   → person_blueprints
 *   BP_LOCATION_1.0 → location_blueprints
 *   BP_PRODUCT_1.0  → product_blueprints
 *   BP_COPY_1.0     → brand_copy_profiles
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const ANON_KEY     = import.meta.env.VITE_SUPABASE_ANON_KEY;

// ---------------------------------------------------------------------------
// TABLE ROUTING
// ---------------------------------------------------------------------------

const SCHEMA_TABLE: Record<string, string> = {
  'BP_PERSON_1.0':   'person_blueprints',
  'BP_LOCATION_1.0': 'location_blueprints',
  'BP_PRODUCT_1.0':  'product_blueprints',
  'BP_COPY_1.0':     'brand_copy_profiles',
};

export function getTableForSchema(schemaVersion: string): string | null {
  return SCHEMA_TABLE[schemaVersion] ?? null;
}

// ---------------------------------------------------------------------------
// RAW FETCH HELPERS
// ---------------------------------------------------------------------------

async function sbGet(table: string, params: string): Promise<any[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
  });
  if (!res.ok) throw new Error(`[BPLoader] GET ${table} failed: ${res.status}`);
  return res.json();
}

async function sbUpsertRaw(table: string, body: object): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`[BPLoader] UPSERT ${table} failed: ${res.status} — ${err}`);
  }
}

async function sbDelete(table: string, idField: string, id: string): Promise<void> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/${table}?${idField}=eq.${encodeURIComponent(id)}`,
    {
      method: 'DELETE',
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
    }
  );
  if (!res.ok) throw new Error(`[BPLoader] DELETE ${table} failed: ${res.status}`);
}

// ---------------------------------------------------------------------------
// NORMALIZERS — blueprint object → table row
// ---------------------------------------------------------------------------

function normalizePerson(bp: any): object {
  return {
    blueprint_id: bp.id,
    brand_id: bp.brandId,
    display_name: bp.displayName,
    role_default: bp.role_default ?? 'BOTH',
    status: bp.status ?? 'draft',
    imagelab_description: bp.imagelab?.description ?? null,
    imagelab_style: bp.imagelab?.style ?? null,
    imagelab_realism: bp.imagelab?.realism_level ?? null,
    imagelab_film_look: bp.imagelab?.film_look ?? null,
    imagelab_lens: bp.imagelab?.lens_preset ?? null,
    imagelab_dof: bp.imagelab?.depth_of_field ?? null,
    has_reference_photos: bp.imagelab?.has_reference_photos ?? false,
    speaking_style: bp.voicelab?.speaking_style ?? null,
    expertise: bp.expertise ?? null,
    compliance_notes: bp.compliance_notes ?? null,
    compatible_archetypes: bp.compatible_archetypes ?? [],
    raw_config: bp,
    active: bp.status === 'active',
  };
}

function normalizeLocation(bp: any): object {
  return {
    blueprint_id: bp.id,
    brand_id: bp.brandId,
    display_name: bp.displayName,
    location_type: bp.locationType ?? null,
    city: bp.city ?? null,
    country: bp.country ?? null,
    status: bp.status ?? 'draft',
    visual_description: bp.visual?.description ?? null,
    materials: bp.visual?.materials ?? null,
    color_palette: bp.visual?.color_palette ?? null,
    lighting: bp.visual?.lighting ?? null,
    time_of_day_best: bp.visual?.time_of_day_best ?? null,
    signature_elements: bp.visual?.signature_elements ?? null,
    imagelab_realism: bp.imagelab?.realism_level ?? null,
    imagelab_film_look: bp.imagelab?.film_look ?? null,
    imagelab_lens: bp.imagelab?.lens_preset ?? null,
    imagelab_dof: bp.imagelab?.depth_of_field ?? null,
    imagelab_framing: bp.imagelab?.framing ?? null,
    compatible_archetypes: bp.compatible_archetypes ?? [],
    recommended_angles: bp.recommended_angles ?? [],
    has_reference_photos: bp.has_reference_photos ?? false,
    raw_config: bp,
    active: bp.status === 'active',
  };
}

function normalizeProduct(bp: any): object {
  return {
    // product_blueprints uses uuid PK — we use sku field for the slug id
    brand_id: bp.brandId,
    sku: bp.id,
    name: bp.displayName,
    active: bp.status === 'active',
    imagelab_params: bp.defaultCompositeParams ?? null,
    raw_config: bp,
  };
}

function normalizeCopy(bp: any): object {
  return {
    id: bp.id,
    brand_id: bp.brandId,
    display_name: bp.displayName,
    status: bp.status ?? 'draft',
    inherits_from_person: bp.inherits_from_person ?? null,
    voice_tone_primary: bp.voice?.tone_primary ?? null,
    voice_tone_secondary: bp.voice?.tone_secondary ?? null,
    voice_writing_style: bp.voice?.writing_style ?? null,
    voice_pov: bp.voice?.pov ?? null,
    language_primary: bp.language?.primary ?? null,
    language_variants: bp.language?.variants ?? null,
    language_geo_default: bp.language?.geo_default ?? null,
    channels_primary: bp.channels?.primary ?? null,
    channels_secondary: bp.channels?.secondary ?? null,
    channels_excluded: bp.channels?.excluded ?? null,
    style_sentence_length: bp.style?.sentence_length ?? null,
    style_emoji_usage: bp.style?.emoji_usage ?? null,
    style_hashtag_style: bp.style?.hashtag_style ?? null,
    style_cta_style: bp.style?.cta_style ?? null,
    style_hooks: bp.style?.hooks ?? null,
    style_signature_phrases: bp.style?.signature_phrases ?? null,
    style_avoid_phrases: bp.style?.avoid_phrases ?? null,
    compliance_rules: bp.compliance?.rules ?? null,
    compliance_prohibited_words: bp.compliance?.prohibited_words ?? null,
    compliance_required_disclaimers: bp.compliance?.required_disclaimers ?? null,
    raw_config: bp,
    active: bp.status === 'active',
  };
}

function normalizeForTable(table: string, bp: any): object {
  switch (table) {
    case 'person_blueprints':   return normalizePerson(bp);
    case 'location_blueprints': return normalizeLocation(bp);
    case 'product_blueprints':  return normalizeProduct(bp);
    case 'brand_copy_profiles': return normalizeCopy(bp);
    default: throw new Error(`[BPLoader] Unknown table: ${table}`);
  }
}

// ---------------------------------------------------------------------------
// DENORMALIZERS — table row → blueprint object (for the UI)
// ---------------------------------------------------------------------------

function rowToBp(row: any, schemaVersion: string): any {
  // For all tables, raw_config is the canonical source
  const base = row.raw_config ?? {};
  // Ensure id field is populated
  const id = base.id || row.blueprint_id || row.sku || row.id;
  return { ...base, id, schema_version: schemaVersion };
}

// ---------------------------------------------------------------------------
// PUBLIC API
// ---------------------------------------------------------------------------

/**
 * Loads all blueprints from Supabase across 4 tables in parallel.
 * Returns a flat array in the same shape as INITIAL_BLUEPRINTS.
 */
export async function loadAllBlueprints(): Promise<any[]> {
  const [persons, locations, products, copies] = await Promise.all([
    sbGet('person_blueprints',   'select=raw_config,blueprint_id,status&active=eq.true'),
    sbGet('location_blueprints', 'select=raw_config,blueprint_id,status&active=eq.true'),
    sbGet('product_blueprints',  'select=raw_config,sku,active&active=eq.true'),
    sbGet('brand_copy_profiles', 'select=raw_config,id,status&active=eq.true'),
  ]);

  return [
    ...persons.map(r  => rowToBp(r, 'BP_PERSON_1.0')),
    ...locations.map(r => rowToBp(r, 'BP_LOCATION_1.0')),
    ...products.map(r  => rowToBp(r, 'BP_PRODUCT_1.0')),
    ...copies.map(r    => rowToBp(r, 'BP_COPY_1.0')),
  ].filter(bp => bp.id); // guard against nulls
}

/**
 * Upserts a single blueprint to its correct Supabase table.
 */
export async function upsertBlueprint(bp: any): Promise<void> {
  const table = getTableForSchema(bp.schema_version);
  if (!table) throw new Error(`[BPLoader] No table for schema: ${bp.schema_version}`);
  const row = normalizeForTable(table, bp);
  await sbUpsertRaw(table, row);
}

/**
 * Deletes a blueprint by ID from its correct table.
 */
export async function deleteBlueprint(bp: any): Promise<void> {
  const table = getTableForSchema(bp.schema_version);
  if (!table) throw new Error(`[BPLoader] No table for schema: ${bp.schema_version}`);

  // Each table has a different PK/unique field for the blueprint slug
  const idField: Record<string, string> = {
    person_blueprints:   'blueprint_id',
    location_blueprints: 'blueprint_id',
    product_blueprints:  'sku',
    brand_copy_profiles: 'id',
  };

  await sbDelete(table, idField[table], bp.id);
}
