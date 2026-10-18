"""Integration tests reach Postgres through here, so a missing database is one clear skip.

CI always sets DATABASE_URL, so there a broken database fails the run instead of skipping.
"""

import os
import unittest

import psycopg


def database_url() -> str:
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise unittest.SkipTest(
            "DATABASE_URL is not set; run make db-up db-migrate and export DATABASE_URL"
        )
    return url


def connect() -> psycopg.Connection:
    return psycopg.connect(database_url())
