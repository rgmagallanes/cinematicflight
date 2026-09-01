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
    // Controlled fictional-email test only. Leave disabled until the additive
    // review migration and authenticated API tests pass on the target server.
    'review_queue_enabled' => false,
    'review_test_sender' => '', // Your own test sender address, never a customer.
    // Separate, optional attachment preview support. Keep disabled until the
    // additive attachment migration is installed and this private folder exists.
    // The folder must be outside public_html and writable only by the PHP app.
    'review_attachments_enabled' => false,
    // 'review_attachment_storage' => '/home/u123456789/cinematic-flight-storage/review-attachments',
];
