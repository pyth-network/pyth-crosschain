-- PostgreSQL migration rollback - drops all tables and indexes created in the up migration

DROP TABLE IF EXISTS request;
