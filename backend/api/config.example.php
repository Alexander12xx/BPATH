<?php
declare(strict_types=1);

return [
    'db_host' => 'REPLACE_WITH_INFINITYFREE_MYSQL_HOST',
    'db_name' => 'REPLACE_WITH_INFINITYFREE_DATABASE_NAME',
    'db_user' => 'REPLACE_WITH_INFINITYFREE_DATABASE_USERNAME',
    'db_password' => 'REPLACE_WITH_DATABASE_PASSWORD',
    'allowed_origins' => [
        'https://brightpath.gt.tc',
        'https://alexander12xx.github.io',
        'https://appassets.androidplatform.net',
    ],
    'bootstrap_key' => 'REPLACE_WITH_A_RANDOM_ONE_TIME_SECRET',
    'upload_dir' => __DIR__ . '/storage',
    'max_upload_bytes' => 8 * 1024 * 1024,
    'token_lifetime_seconds' => 60 * 60 * 8,
];
