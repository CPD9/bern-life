-- Reading a slice of a compressed long page can cut a UTF-8 character in half, so substr() on it
-- fails with an encoding error. `|| ''` makes Postgres decompress the whole text first; the check
-- itself is unchanged.
CREATE OR REPLACE FUNCTION "verify_evidence_span"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    page_text text;
BEGIN
    SELECT "text" || '' INTO page_text FROM "page"
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
