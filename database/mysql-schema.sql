create table if not exists studio_users (
  id bigint unsigned not null auto_increment,
  email varchar(190) not null,
  password_hash varchar(255) not null,
  display_name varchar(120) not null default 'Studio Owner',
  created_at timestamp not null default current_timestamp,
  updated_at timestamp not null default current_timestamp on update current_timestamp,
  primary key (id),
  unique key studio_users_email_unique (email)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table if not exists studio_inquiries (
  id bigint unsigned not null auto_increment,
  owner_id bigint unsigned not null,
  external_id varchar(80) not null,
  property_name varchar(190) not null,
  contact_name varchar(190) not null,
  contact_email varchar(190) not null,
  stage enum('New','Contacted','Replied','Qualified','Proposal','Won') not null default 'New',
  activity_label varchar(80) not null default '',
  next_action varchar(255) not null default 'Review new enquiry',
  action_status enum('Due today','Upcoming','Overdue','Completed') not null default 'Upcoming',
  due_label varchar(80) not null default 'Upcoming',
  detail text not null,
  working_note text not null,
  created_at timestamp not null default current_timestamp,
  updated_at timestamp not null default current_timestamp on update current_timestamp,
  primary key (id),
  unique key studio_inquiries_owner_external_unique (owner_id, external_id),
  key studio_inquiries_owner_stage_index (owner_id, stage),
  constraint studio_inquiries_owner_fk foreign key (owner_id) references studio_users(id) on delete cascade
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table if not exists studio_property_files (
  id bigint unsigned not null auto_increment,
  owner_id bigint unsigned not null,
  external_id varchar(80) not null,
  property_name varchar(190) not null,
  stage varchar(40) not null default 'New',
  enquiry_id varchar(80) not null default '',
  received_label varchar(120) not null default '',
  owner_name varchar(190) not null default '',
  next_action varchar(255) not null default '',
  source_count int unsigned not null default 0,
  documents longtext not null,
  created_at timestamp not null default current_timestamp,
  updated_at timestamp not null default current_timestamp on update current_timestamp,
  primary key (id),
  unique key studio_property_files_owner_external_unique (owner_id, external_id),
  key studio_property_files_owner_index (owner_id),
  constraint studio_property_files_owner_fk foreign key (owner_id) references studio_users(id) on delete cascade
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;
