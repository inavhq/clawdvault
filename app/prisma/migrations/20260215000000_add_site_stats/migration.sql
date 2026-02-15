-- CreateTable
CREATE TABLE "site_stats" (
    "key" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "site_stats_pkey" PRIMARY KEY ("key")
);

-- Seed the page_views counter
INSERT INTO "site_stats" ("key", "value") VALUES ('page_views', 0);
