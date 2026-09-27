-- Evolve RawTimings to match the actual portal data structure.
-- The previous schema speculated GroupTag/AndOrText; the real portal
-- payload exposes `subject_selection_option` (OR/AND/blank) which is
-- the authoritative structural field, plus `type` and `type_full` that
-- give the section number explicitly.

-- DropColumn
ALTER TABLE "RawTimings" DROP COLUMN IF EXISTS "GroupTag";
ALTER TABLE "RawTimings" DROP COLUMN IF EXISTS "AndOrText";

-- AddColumn
ALTER TABLE "RawTimings" ADD COLUMN "Type" TEXT NOT NULL DEFAULT '';
ALTER TABLE "RawTimings" ADD COLUMN "TypeFull" TEXT NOT NULL DEFAULT '';
ALTER TABLE "RawTimings" ADD COLUMN "SelectionOption" TEXT NOT NULL DEFAULT '';
ALTER TABLE "RawTimings" ADD COLUMN "SemesterId" TEXT NOT NULL DEFAULT '';

-- Drop the defaults so future rows must populate explicitly (matching
-- the Prisma model). The DEFAULT '' was only needed for the ALTER itself.
ALTER TABLE "RawTimings" ALTER COLUMN "Type" DROP DEFAULT;
ALTER TABLE "RawTimings" ALTER COLUMN "TypeFull" DROP DEFAULT;
ALTER TABLE "RawTimings" ALTER COLUMN "SelectionOption" DROP DEFAULT;
ALTER TABLE "RawTimings" ALTER COLUMN "SemesterId" DROP DEFAULT;
