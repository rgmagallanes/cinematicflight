<?php

// On Hostinger, save the completed file as:
// cinematic-flight-private/config.php (beside public_html, not inside it).
return [
    'db_host' => 'localhost',
    'db_port' => 3306,
    'db_name' => 'u123456789_cinematic_studio',
    'db_user' => 'u123456789_studio_user',
    'db_password' => 'replace-with-database-password',
    'allowed_origin' => 'https://studio.cinematicflight.com',
    'setup_token' => 'replace-with-a-long-random-setup-token',
    // Optional. Defaults to a private folder beside public_html.
    // 'image_storage_path' => '/home/u123456789/cinematic-flight-storage/client-images',
    'image_upload_max_bytes' => 8388608,
];
