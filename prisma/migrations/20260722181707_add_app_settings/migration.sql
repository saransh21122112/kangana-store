-- CreateTable
CREATE TABLE "AppSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "storeName" TEXT NOT NULL DEFAULT 'Kangna Beauty & Jewellery',
    "logoUrl" TEXT,
    "accentColor" TEXT NOT NULL DEFAULT '#0A84FF',
    "categories" TEXT[] DEFAULT ARRAY['Jewellery - Gold', 'Jewellery - Diamond', 'Jewellery - Silver', 'Beauty Services', 'Skincare', 'Makeup', 'Other']::TEXT[],
    "inactiveThreshold30" INTEGER NOT NULL DEFAULT 30,
    "inactiveThreshold60" INTEGER NOT NULL DEFAULT 60,
    "inactiveThreshold90" INTEGER NOT NULL DEFAULT 90,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSettings_pkey" PRIMARY KEY ("id")
);
