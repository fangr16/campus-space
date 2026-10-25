/**
 * Seed for the m3 schema. Repair ticketing holds business data only (created by users at runtime),
 * so there is nothing to seed yet. The script exists so `pnpm db:seed` stays uniform across
 * services and can grow reference data later without touching the pipeline.
 */
console.info("seed: m3 has no reference data to seed");
