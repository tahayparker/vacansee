-- CreateTable
CREATE TABLE "Class" (
    "id" TEXT NOT NULL,
    "SubCode" TEXT NOT NULL,
    "Class" TEXT NOT NULL,
    "Day" TEXT NOT NULL,
    "StartTime" TEXT NOT NULL,
    "EndTime" TEXT NOT NULL,
    "Room" TEXT NOT NULL,
    "Teacher" TEXT NOT NULL,

    CONSTRAINT "Class_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_classes_endtime" ON "Class"("EndTime");

-- CreateIndex
CREATE INDEX "idx_classes_starttime" ON "Class"("StartTime");

-- CreateIndex
CREATE INDEX "idx_classes_day" ON "Class"("Day");
