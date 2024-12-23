/*
  Warnings:

  - You are about to drop the `Class` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "Class";

-- CreateTable
CREATE TABLE "classes" (
    "id" SERIAL NOT NULL,
    "SubCode" TEXT NOT NULL,
    "Class" TEXT NOT NULL,
    "Day" TEXT NOT NULL,
    "StartTime" TEXT NOT NULL,
    "EndTime" TEXT NOT NULL,
    "Room" TEXT NOT NULL,
    "Teacher" TEXT NOT NULL,

    CONSTRAINT "classes_pkey" PRIMARY KEY ("id")
);
