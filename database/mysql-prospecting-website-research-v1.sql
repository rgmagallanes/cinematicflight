-- Additive Phase 6 migration. Apply after mysql-prospecting-v1.sql and
-- mysql-prospecting-execution-v1.sql. This migration does not run a crawler.

create table if not exists prospecting_website_research (
  id bigint unsigned not null auto_increment,
  public_id varchar(80) character set ascii collate ascii_bin not null,
  owner_id bigint unsigned not null,
  mission_id bigint unsigned not null,
  prospect_id bigint unsigned not null,
  agent_run_id bigint unsigned not null,
  status varchar(40) not null,
  requested_url varchar(2048) not null,
  canonical_host varchar(253) null,
  pages_attempted int unsigned not null default 0,
  pages_succeeded int unsigned not null default 0,
  stop_reason varchar(80) not null,
  idempotency_key varchar(190) character set ascii collate ascii_bin not null,
  request_hash char(64) character set ascii collate ascii_bin not null,
  started_at timestamp not null,
  completed_at timestamp not null,
  created_at timestamp not null default current_timestamp,
  updated_at timestamp not null default current_timestamp on update current_timestamp,
  primary key (id),
  unique key prospecting_website_research_public_unique (public_id),
  unique key prospecting_website_research_owner_idempotency_unique (owner_id, idempotency_key),
  key prospecting_website_research_owner_prospect_index (owner_id, prospect_id, id),
  key prospecting_website_research_run_index (agent_run_id),
  constraint prospecting_website_research_owner_fk foreign key (owner_id) references studio_users(id) on delete cascade,
  constraint prospecting_website_research_mission_fk foreign key (mission_id) references prospecting_missions(id) on delete restrict,
  constraint prospecting_website_research_prospect_fk foreign key (prospect_id) references prospecting_prospects(id) on delete restrict,
  constraint prospecting_website_research_run_fk foreign key (agent_run_id) references prospecting_agent_runs(id) on delete restrict
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

alter table prospecting_evidence
  add column if not exists website_research_id bigint unsigned null after agent_run_id,
  add key if not exists prospecting_evidence_website_research_index (website_research_id),
  add constraint prospecting_evidence_website_research_fk foreign key (website_research_id) references prospecting_website_research(id) on delete set null;
