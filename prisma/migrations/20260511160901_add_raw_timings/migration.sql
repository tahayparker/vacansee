-- CreateTable
CREATE TABLE "RawTimings" (
    "id" SERIAL NOT NULL,
    "SubCode" TEXT NOT NULL,
    "SubName" TEXT NOT NULL,
    "TypeWithSection" TEXT NOT NULL,
    "Day" TEXT NOT NULL,
    "StartTime" TEXT NOT NULL,
    "EndTime" TEXT NOT NULL,
    "Location" TEXT NOT NULL,
    "Lecturer" TEXT NOT NULL,
    "GroupTag" TEXT NOT NULL,
    "AndOrText" TEXT NOT NULL,

    CONSTRAINT "RawTimings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RawTimings_SubCode_idx" ON "RawTimings"("SubCode");

-- CreateIndex
CREATE INDEX "RawTimings_Day_idx" ON "RawTimings"("Day");
