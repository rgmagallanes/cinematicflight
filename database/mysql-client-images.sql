create table if not exists studio_inquiry_images (
  id bigint unsigned not null auto_increment,
  owner_id bigint unsigned not null,
  inquiry_external_id varchar(80) not null,
  original_name varchar(255) not null,
  storage_name varchar(96) not null,
  mime_type enum('image/jpeg','image/png','image/webp','image/gif') not null,
  byte_size int unsigned not null,
  created_at timestamp not null default current_timestamp,
  primary key (id),
  unique key studio_inquiry_images_storage_unique (storage_name),
  key studio_inquiry_images_owner_inquiry_index (owner_id, inquiry_external_id),
  constraint studio_inquiry_images_owner_fk foreign key (owner_id) references studio_users(id) on delete cascade
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;
