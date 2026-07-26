-- AddValue: pending_purchase to GemTransactionType enum
-- PostgreSQL allows adding enum values without rebuilding the table
ALTER TYPE "GemTransactionType" ADD VALUE 'pending_purchase';
