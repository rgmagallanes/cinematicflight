-- Additive migration. Run only after backup and explicit deployment approval.
-- Existing Studio users and enquiries must already exist.
create table if not exists studio_review_drafts (
  id bigint unsigned not null auto_increment,
  owner_id bigint unsigned not null,
  inquiry_id bigint unsigned not null,
  source_key char(64) character set ascii collate ascii_bin not null,
  message_key char(64) character set ascii collate ascii_bin not null,
  source_json text not null,
  original_text text not null,
  reply_text text not null,
  model varchar(150) not null,
  status enum('pending','approved','rejected') not null default 'pending',
  version int unsigned not null default 1,
  revision int unsigned not null default 1,
  approval_json text null,
  history_json longtext not null,
  created_at timestamp not null default current_timestamp,
  updated_at timestamp not null default current_timestamp on update current_timestamp,
  primary key (id),
  unique key studio_review_source_unique (owner_id, source_key),
  unique key studio_review_message_unique (owner_id, message_key),
  key studio_review_owner_queue (owner_id, id),
  constraint studio_review_owner_fk foreign key (owner_id) references studio_users(id) on delete cascade,
  constraint studio_review_inquiry_fk foreign key (inquiry_id) references studio_inquiries(id) on delete restrict
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;
