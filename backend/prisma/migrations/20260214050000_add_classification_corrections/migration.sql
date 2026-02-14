-- Classification corrections for feedback loop (gh-73)
CREATE TABLE "public"."classification_corrections" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "request_id" UUID NOT NULL,
    "message_text" TEXT NOT NULL,
    "original_class" "public"."MessageClassification" NOT NULL,
    "corrected_class" "public"."MessageClassification" NOT NULL,
    "corrected_by" UUID NOT NULL,
    "corrected_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "classification_corrections_pkey" PRIMARY KEY ("id")
);

-- Foreign keys
ALTER TABLE "public"."classification_corrections"
  ADD CONSTRAINT "classification_corrections_request_id_fkey"
  FOREIGN KEY ("request_id") REFERENCES "public"."client_requests"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."classification_corrections"
  ADD CONSTRAINT "classification_corrections_corrected_by_fkey"
  FOREIGN KEY ("corrected_by") REFERENCES "public"."users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Indexes
CREATE INDEX "classification_corrections_original_corrected_idx"
  ON "public"."classification_corrections"("original_class", "corrected_class");
CREATE INDEX "classification_corrections_corrected_at_idx"
  ON "public"."classification_corrections"("corrected_at");
