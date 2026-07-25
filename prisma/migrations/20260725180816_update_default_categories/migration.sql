-- AlterTable
ALTER TABLE "AppSettings" ALTER COLUMN "categories" SET DEFAULT ARRAY['Jewellery - Gold', 'Jewellery - Diamond', 'Jewellery - Silver', 'Imitation Jewellery', 'Lingerie', 'Hair & Beauty Accessories', 'Beauty Services', 'Skincare', 'Makeup', 'Other']::TEXT[];
