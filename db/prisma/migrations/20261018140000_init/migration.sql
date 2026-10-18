-- The vector type must exist before Prisma's CREATE TABLE "chunk".
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "profile_kind" AS ENUM ('person', 'unit', 'project', 'infrastructure');

-- CreateEnum
CREATE TYPE "page_kind" AS ENUM ('person', 'unit', 'project', 'infrastructure', 'listing', 'other');

-- CreateEnum
CREATE TYPE "lang" AS ENUM ('de', 'en', 'fr', 'it', 'unknown');

-- CreateEnum
CREATE TYPE "claim_field" AS ENUM ('name', 'role', 'unit', 'expertise', 'projects', 'infrastructure', 'services');

-- CreateEnum
CREATE TYPE "claim_method" AS ENUM ('selector', 'model');

-- CreateEnum
CREATE TYPE "term_kind" AS ENUM ('synonym', 'lay', 'translation', 'acronym');

-- CreateEnum
CREATE TYPE "relation_kind" AS ENUM ('member_of', 'leads', 'part_of', 'works_on', 'operates');

-- CreateEnum
CREATE TYPE "place_kind" AS ENUM ('institute', 'platform', 'centre');

-- CreateEnum
CREATE TYPE "position_method" AS ENUM ('address', 'district');

-- CreateTable
CREATE TABLE "source" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site" (
    "host" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "unit" TEXT NOT NULL,

    CONSTRAINT "site_pkey" PRIMARY KEY ("host")
);

-- CreateTable
CREATE TABLE "page" (
    "url" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "fetched_at" TIMESTAMPTZ(3) NOT NULL,
    "sha256" CHAR(64) NOT NULL,
    "status" INTEGER NOT NULL,
    "lang" "lang",
    "kind" "page_kind",
    "title" TEXT,
    "text" TEXT NOT NULL,

    CONSTRAINT "page_pkey" PRIMARY KEY ("url")
);

-- CreateTable
CREATE TABLE "profile" (
    "id" TEXT NOT NULL,
    "kind" "profile_kind" NOT NULL,
    "source_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "source_url" TEXT NOT NULL,

    CONSTRAINT "profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "claim" (
    "id" BIGSERIAL NOT NULL,
    "profile_id" TEXT NOT NULL,
    "field" "claim_field" NOT NULL,
    "position" INTEGER NOT NULL,
    "value" VARCHAR(200) NOT NULL,
    "method" "claim_method" NOT NULL,
    "page_url" TEXT NOT NULL,
    "page_sha256" CHAR(64) NOT NULL,
    "span" VARCHAR(300) NOT NULL,
    "start" INTEGER,

    CONSTRAINT "claim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entity_relation" (
    "id" BIGSERIAL NOT NULL,
    "from_profile_id" TEXT NOT NULL,
    "to_profile_id" TEXT NOT NULL,
    "kind" "relation_kind" NOT NULL,
    "method" "claim_method" NOT NULL,
    "page_url" TEXT NOT NULL,
    "page_sha256" CHAR(64) NOT NULL,
    "span" VARCHAR(300) NOT NULL,
    "start" INTEGER,

    CONSTRAINT "entity_relation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "place" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "kind" "place_kind" NOT NULL,
    "address" TEXT,
    "address_url" TEXT,
    "address_span" VARCHAR(300),
    "address_fetched_at" TIMESTAMPTZ(3),
    "address_page_sha256" CHAR(64),
    "x" DOUBLE PRECISION NOT NULL,
    "z" DOUBLE PRECISION NOT NULL,
    "position_method" "position_method" NOT NULL,

    CONSTRAINT "place_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "term" (
    "id" BIGSERIAL NOT NULL,
    "value" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "kind" "term_kind" NOT NULL,
    "lang" "lang",
    "model" TEXT NOT NULL,
    "prompt_version" TEXT NOT NULL,

    CONSTRAINT "term_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chunk" (
    "id" TEXT NOT NULL,
    "profile_id" TEXT,
    "page_url" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "embedding" vector(384),
    "tsv" tsvector,

    CONSTRAINT "chunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bundle_load" (
    "id" BIGSERIAL NOT NULL,
    "version" TEXT NOT NULL,
    "sha256" CHAR(64) NOT NULL,
    "loaded_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "counts" JSONB NOT NULL,

    CONSTRAINT "bundle_load_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "site_source_id_idx" ON "site"("source_id");

-- CreateIndex
CREATE INDEX "page_source_id_idx" ON "page"("source_id");

-- CreateIndex
CREATE UNIQUE INDEX "page_url_sha256_key" ON "page"("url", "sha256");

-- CreateIndex
CREATE INDEX "profile_source_id_idx" ON "profile"("source_id");

-- CreateIndex
CREATE INDEX "claim_page_url_page_sha256_idx" ON "claim"("page_url", "page_sha256");

-- CreateIndex
CREATE UNIQUE INDEX "claim_profile_id_field_position_key" ON "claim"("profile_id", "field", "position");

-- CreateIndex
CREATE INDEX "entity_relation_to_profile_id_idx" ON "entity_relation"("to_profile_id");

-- CreateIndex
CREATE INDEX "entity_relation_page_url_page_sha256_idx" ON "entity_relation"("page_url", "page_sha256");

-- CreateIndex
CREATE UNIQUE INDEX "entity_relation_from_profile_id_to_profile_id_kind_key" ON "entity_relation"("from_profile_id", "to_profile_id", "kind");

-- CreateIndex
CREATE INDEX "place_source_id_idx" ON "place"("source_id");

-- CreateIndex
CREATE INDEX "place_host_idx" ON "place"("host");

-- CreateIndex
CREATE UNIQUE INDEX "term_value_term_kind_key" ON "term"("value", "term", "kind");

-- CreateIndex
CREATE INDEX "chunk_profile_id_idx" ON "chunk"("profile_id");

-- CreateIndex
CREATE INDEX "chunk_page_url_idx" ON "chunk"("page_url");

-- CreateIndex
CREATE INDEX "chunk_tsv_gin_idx" ON "chunk" USING GIN ("tsv");

-- AddForeignKey
ALTER TABLE "site" ADD CONSTRAINT "site_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "source"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "page" ADD CONSTRAINT "page_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "source"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile" ADD CONSTRAINT "profile_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "source"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claim" ADD CONSTRAINT "claim_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claim" ADD CONSTRAINT "claim_page_url_page_sha256_fkey" FOREIGN KEY ("page_url", "page_sha256") REFERENCES "page"("url", "sha256") ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "entity_relation" ADD CONSTRAINT "entity_relation_from_profile_id_fkey" FOREIGN KEY ("from_profile_id") REFERENCES "profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_relation" ADD CONSTRAINT "entity_relation_to_profile_id_fkey" FOREIGN KEY ("to_profile_id") REFERENCES "profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_relation" ADD CONSTRAINT "entity_relation_page_url_page_sha256_fkey" FOREIGN KEY ("page_url", "page_sha256") REFERENCES "page"("url", "sha256") ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "place" ADD CONSTRAINT "place_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "source"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chunk" ADD CONSTRAINT "chunk_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chunk" ADD CONSTRAINT "chunk_page_url_fkey" FOREIGN KEY ("page_url") REFERENCES "page"("url") ON DELETE CASCADE ON UPDATE CASCADE;

-- Below: what Prisma cannot express in schema.prisma.

-- A page's sha256 is the hash of its stored text, so evidence pinned to (url, sha256) is pinned
-- to exactly the text it was checked against.
ALTER TABLE "page" ADD CONSTRAINT "page_sha256_matches_text"
    CHECK ("sha256" = encode(sha256(convert_to("text", 'UTF8')), 'hex'));

-- A place positioned by its address must carry the address evidence; one placed by district
-- need not.
ALTER TABLE "place" ADD CONSTRAINT "place_address_has_evidence"
    CHECK ("position_method" <> 'address' OR ("address" IS NOT NULL AND "address_url" IS NOT NULL
        AND "address_span" IS NOT NULL AND "address_page_sha256" IS NOT NULL));

-- Nearest neighbours by cosine distance for the vector half of hybrid search. Prisma has no HNSW
-- index type, so `prisma migrate diff` always proposes dropping this one; db/README.md explains.
CREATE INDEX "chunk_embedding_hnsw_idx" ON "chunk" USING hnsw ("embedding" vector_cosine_ops);

-- Second line of defence behind the engine's verifier: no claim or relation is stored unless its
-- span is verbatim in the page text it cites (at `start`, when given; offsets are characters).
-- The error names no page text, so nothing scraped leaks into logs.
CREATE FUNCTION "verify_evidence_span"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    page_text text;
BEGIN
    SELECT "text" INTO page_text FROM "page"
     WHERE "url" = NEW."page_url" AND "sha256" = NEW."page_sha256";
    IF page_text IS NULL
       OR (NEW."start" IS NULL AND strpos(page_text, NEW."span") = 0)
       OR (NEW."start" IS NOT NULL
           AND substr(page_text, NEW."start" + 1, char_length(NEW."span")) <> NEW."span") THEN
        RAISE EXCEPTION 'evidence span not found in page' USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "claim_verify_evidence_span"
    BEFORE INSERT OR UPDATE ON "claim"
    FOR EACH ROW EXECUTE FUNCTION "verify_evidence_span"();

CREATE TRIGGER "entity_relation_verify_evidence_span"
    BEFORE INSERT OR UPDATE ON "entity_relation"
    FOR EACH ROW EXECUTE FUNCTION "verify_evidence_span"();
