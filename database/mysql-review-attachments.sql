-- Additive, local-test attachment storage. Production rollout requires approval.
create table if not exists studio_review_attachment_sets (
  draft_id bigint unsigned not null primary key,
  owner_id bigint unsigned not null,
  manifest_hash char(64) character set ascii collate ascii_bin not null,
  checked_at timestamp not null default current_timestamp,
  foreign key (draft_id) references studio_review_drafts(id) on delete cascade
) engine=InnoDB default charset=utf8mb4;
create table if not exists studio_review_attachments (
  id bigint unsigned not null auto_increment primary key,
  owner_id bigint unsigned not null,
  draft_id bigint unsigned not null,
  provider_key char(64) character set ascii collate ascii_bin not null,
  provider_id text not null,
  filename varchar(255) not null,
  content_type varchar(100) not null,
  byte_size int unsigned not null,
  content_byte_size int unsigned null,
  inline_image boolean not null default false,
  status enum('metadata_only','ready','unsupported') not null,
  content_hash char(64) character set ascii collate ascii_bin null,
  unique key review_attachment_identity (draft_id, provider_key),
  foreign key (draft_id) references studio_review_drafts(id) on delete cascade
) engine=InnoDB default charset=utf8mb4;
alter table studio_review_attachments add column if not exists content_byte_size int unsigned null after byte_size;
