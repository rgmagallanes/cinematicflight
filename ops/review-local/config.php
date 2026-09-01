<?php
// Fixed fictional LOCAL test credentials only. Never deploy this directory.
if (getenv('CF_REVIEW_LOCAL') !== 'yes') throw new RuntimeException('Local review environment required.');
return [
    'db_host'=>'db', 'db_name'=>'review_local', 'db_user'=>'review_local',
    'db_password'=>'local-review-app-only', 'allowed_origin'=>'http://127.0.0.1:5182',
    'setup_token'=>'local-fixture-initialized-no-setup',
    'review_queue_enabled'=>true, 'review_test_sender'=>'sender@example.test',
    'review_attachments_enabled'=>true, 'review_attachment_storage'=>'/run/review-private/attachments',
];
