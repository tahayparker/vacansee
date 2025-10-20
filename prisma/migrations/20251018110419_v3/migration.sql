-- CreateTable
CREATE TABLE "Rooms" (
    "id" SERIAL NOT NULL,
    "Name" TEXT NOT NULL,
    "ShortCode" TEXT NOT NULL,
    "Capacity" INTEGER,

    CONSTRAINT "Rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Teacher" (
    "id" SERIAL NOT NULL,
    "Name" TEXT NOT NULL,
    "Email" TEXT NOT NULL,
    "Phone" TEXT NOT NULL,

    CONSTRAINT "Teacher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Timings" (
    "id" SERIAL NOT NULL,
    "SubCode" TEXT NOT NULL,
    "Class" TEXT NOT NULL,
    "Day" TEXT NOT NULL,
    "StartTime" TEXT NOT NULL,
    "EndTime" TEXT NOT NULL,
    "Room" TEXT NOT NULL,
    "Teacher" TEXT NOT NULL,

    CONSTRAINT "Timings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Rooms_ShortCode_idx" ON "Rooms"("ShortCode");

-- CreateIndex
CREATE INDEX "Rooms_Name_idx" ON "Rooms"("Name");

-- CreateIndex
CREATE INDEX "Timings_Day_StartTime_EndTime_idx" ON "Timings"("Day", "StartTime", "EndTime");

-- CreateIndex
CREATE INDEX "Timings_Room_idx" ON "Timings"("Room");

-- CreateIndex
CREATE INDEX "Timings_Day_idx" ON "Timings"("Day");
