-- Creates the ClawOps engine database (connection.py defaults to DB_NAME=clawops_engine).
-- This runs only on FIRST container init (when the Postgres data dir is empty).
SELECT 'CREATE DATABASE clawops_engine'
WHERE NOT EXISTS (
  SELECT FROM pg_database WHERE datname = 'clawops_engine'
)\gexec





