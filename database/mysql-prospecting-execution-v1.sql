-- Additive Phase 3.5 migration. Apply after mysql-prospecting-v1.sql.
-- Durable reservation accounting and internal-ingest replay protection only.

create table if not exists prospecting_budget_reservations (
  id bigint unsigned not null auto_increment,
  public_id varchar(80) character set ascii collate ascii_bin not null,
  owner_id bigint unsigned not null,
  mission_id bigint unsigned not null,
  prospect_id bigint unsigned null,
  agent_run_id bigint unsigned null,
  provider varchar(120) not null,
  operation varchar(120) not null,
  estimated_cost_centavos bigint unsigned not null,
  reserved_cost_centavos bigint unsigned not null,
  actual_cost_centavos bigint unsigned null,
  status varchar(40) not null,
  idempotency_key varchar(190) character set ascii collate ascii_bin not null,
  request_hash char(64) character set ascii collate ascii_bin not null,
  expires_at timestamp not null,
  created_at timestamp not null default current_timestamp,
  updated_at timestamp not null default current_timestamp on update current_timestamp,
  committed_at timestamp null,
  released_at timestamp null,
  primary key (id),
  unique key prospecting_reservations_public_unique (public_id),
  unique key prospecting_reservations_owner_idempotency_unique (owner_id, idempotency_key),
  key prospecting_reservations_owner_mission_status (owner_id, mission_id, status, expires_at),
  key prospecting_reservations_owner_status_expiry (owner_id, status, expires_at),
  key prospecting_reservations_prospect_index (prospect_id),
  key prospecting_reservations_run_index (agent_run_id),
  constraint prospecting_reservations_owner_fk foreign key (owner_id) references studio_users(id) on delete cascade,
  constraint prospecting_reservations_mission_fk foreign key (mission_id) references prospecting_missions(id) on delete restrict,
  constraint prospecting_reservations_prospect_fk foreign key (prospect_id) references prospecting_prospects(id) on delete restrict,
  constraint prospecting_reservations_run_fk foreign key (agent_run_id) references prospecting_agent_runs(id) on delete restrict
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table if not exists prospecting_agent_ingest_requests (
  id bigint unsigned not null auto_increment,
  owner_id bigint unsigned not null,
  request_id varchar(190) character set ascii collate ascii_bin not null,
  operation varchar(80) not null,
  payload_hash char(64) character set ascii collate ascii_bin not null,
  response_status smallint unsigned not null,
  response_json longtext not null,
  created_at timestamp not null default current_timestamp,
  completed_at timestamp not null default current_timestamp,
  primary key (id),
  unique key prospecting_ingest_owner_request_unique (owner_id, request_id),
  key prospecting_ingest_owner_created_index (owner_id, created_at),
  constraint prospecting_ingest_owner_fk foreign key (owner_id) references studio_users(id) on delete cascade
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;
