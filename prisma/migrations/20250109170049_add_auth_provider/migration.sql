/*
  Warnings:

  - Added the required column `authProvider` to the `SignInLog` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('GOOGLE', 'GITHUB');

-- AlterTable
ALTER TABLE "SignInLog" ADD COLUMN     "authProvider" "AuthProvider" NOT NULL;
