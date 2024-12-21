/*
  Warnings:

  - Added the required column `Class` to the `Class` table without a default value. This is not possible if the table is not empty.
  - Added the required column `SubCode` to the `Class` table without a default value. This is not possible if the table is not empty.
  - Added the required column `Teacher` to the `Class` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Class" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "SubCode" TEXT NOT NULL,
    "Class" TEXT NOT NULL,
    "Day" TEXT NOT NULL,
    "StartTime" TEXT NOT NULL,
    "EndTime" TEXT NOT NULL,
    "Room" TEXT NOT NULL,
    "Teacher" TEXT NOT NULL
);
INSERT INTO "new_Class" ("Day", "EndTime", "Room", "StartTime", "id") SELECT "Day", "EndTime", "Room", "StartTime", "id" FROM "Class";
DROP TABLE "Class";
ALTER TABLE "new_Class" RENAME TO "Class";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
