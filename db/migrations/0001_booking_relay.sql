CREATE TABLE IF NOT EXISTS booking_requests (
  request_id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  status_code INTEGER,
  response_json TEXT,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_booking_requests_expires_at
  ON booking_requests(expires_at);

CREATE TABLE IF NOT EXISTS booking_rate_limits (
  fingerprint TEXT PRIMARY KEY,
  window_started INTEGER NOT NULL,
  request_count INTEGER NOT NULL
);
