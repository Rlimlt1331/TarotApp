-- Add pendingPayment flag to submissions so a reading can be queued before gems are credited
ALTER TABLE "submissions" ADD COLUMN "pendingPayment" BOOLEAN NOT NULL DEFAULT false;
