-- Opportunities as sources (contract #104): calls, services and spaces become profile and page
-- kinds, with their own claim fields. Every value is still a verbatim span, checked by the same
-- trigger. Adding enum values only; Postgres 17 allows several in one migration.

ALTER TYPE "claim_field" ADD VALUE 'funder';
ALTER TYPE "claim_field" ADD VALUE 'deadline';
ALTER TYPE "claim_field" ADD VALUE 'amount';
ALTER TYPE "claim_field" ADD VALUE 'eligibility';
ALTER TYPE "claim_field" ADD VALUE 'location';
ALTER TYPE "claim_field" ADD VALUE 'size';

ALTER TYPE "page_kind" ADD VALUE 'call';
ALTER TYPE "page_kind" ADD VALUE 'service';
ALTER TYPE "page_kind" ADD VALUE 'space';

ALTER TYPE "profile_kind" ADD VALUE 'call';
ALTER TYPE "profile_kind" ADD VALUE 'service';
ALTER TYPE "profile_kind" ADD VALUE 'space';
