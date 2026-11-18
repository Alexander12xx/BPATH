<?php
declare(strict_types=1);

/*
 * Copy this file to config.php, fill in the InfinityFree MySQL details,
 * and change every placeholder. config.php must never be committed to GitHub
 * or copied into the Android app.
 */
return [
    // InfinityFree control panel > MySQL Databases
    'db_host' => 'sqlXXX.infinityfree.com',
    'db_name' => 'if0_XXXXXXX_brightpath',
    'db_user' => 'if0_XXXXXXX',
    'db_password' => 'REPLACE_WITH_DATABASE_PASSWORD',

    // Exact browser/app origins, without a trailing slash and without a path.
    'allowed_origins' => [
        'https://brightpath.gt.tc',
        'https://alexander12xx.github.io',
        'https://appassets.androidplatform.net',
    ],

    // One-time administrator setup. Generate with:
    //   python -c "import secrets; print(secrets.token_urlsafe(32))"
    // Remove it (set to '') immediately after creating the first administrator.
    'bootstrap_key' => '',

    // Free open-source video classrooms (Jitsi Meet).
    // meet.jit.si needs no account or API key. You may point this at your own
    // self-hosted Jitsi domain later, e.g. 'meet.your-school.org'.
    'jitsi_domain' => 'meet.jit.si',
    'jitsi_script_url' => 'https://meet.jit.si/external_api.js',

    // File uploads. The storage folder must stay outside public web access.
    'upload_dir' => __DIR__ . '/storage',
    'max_upload_bytes' => 8 * 1024 * 1024,

    // Sessions. Students get a shorter session than staff.
    'token_lifetime_seconds' => 60 * 60 * 8,
    'staff_token_lifetime_seconds' => 60 * 60 * 12,

    // Login protection (per 15 minutes).
    'login_max_attempts_per_email' => 8,
    'login_max_attempts_per_ip' => 30,

    // Optional password-reset email. InfinityFree may block mail(); leave this
    // false and use the administrator "reset password" button in the app.
    'mail_enabled' => false,
    'mail_from' => 'no-reply@brightpath.gt.tc',

    // Shown in the app and on the support page.
    'support_email' => 'support@brightpath.gt.tc',
    'app_name' => 'BrightPath',

    // Set this to false after Android release testing.
    'allow_debug_errors' => false,
];
