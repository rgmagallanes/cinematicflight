-- Additive Phase 8 migration. Apply after the existing Prospecting migrations.
create table if not exists prospecting_qualification_provenance (
  id bigint unsigned not null auto_increment,
  public_id varchar(80) character set ascii collate ascii_bin not null,
  owner_id bigint unsigned not null,
  qualification_id bigint unsigned not null,
  prospect_id bigint unsigned not null,
  evidence_id bigint unsigned null,
  provenance_type varchar(40) not null,
  assessment_component varchar(40) null,
  manual_assessment_reason varchar(1000) null,
  created_at timestamp not null default current_timestamp,
  primary key (id),
  unique key prospecting_qualification_provenance_public_unique (public_id),
  key prospecting_qualification_provenance_qualification_index (owner_id, qualification_id, id),
  key prospecting_qualification_provenance_evidence_index (evidence_id),
  constraint prospecting_qualification_provenance_owner_fk foreign key (owner_id) references studio_users(id) on delete cascade,
  constraint prospecting_qualification_provenance_qualification_fk foreign key (qualification_id) references prospecting_qualifications(id) on delete cascade,
  constraint prospecting_qualification_provenance_prospect_fk foreign key (prospect_id) references prospecting_prospects(id) on delete cascade,
  constraint prospecting_qualification_provenance_evidence_fk foreign key (evidence_id) references prospecting_evidence(id) on delete restrict
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;
