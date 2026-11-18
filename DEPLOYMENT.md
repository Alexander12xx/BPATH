# BrightPath deployment guide

This guide deploys the **secure** BrightPath API, app, and signed Android APK to InfinityFree. GitHub is an optional second copy.

- Website and API: `https://brightpath.gt.tc/`
- Android download: `https://brightpath.gt.tc/downloads/brightpath.apk`
- GitHub repository: `https://github.com/Alexander12xx/BPATH`
- Optional GitHub APK mirror: `https://github.com/Alexander12xx/BPATH/releases/latest/download/brightpath.apk`

> Read the whole file once before uploading. The most important step is **replacing the old `api/index.php`**; uploading only the frontend leaves the vulnerable API in place.

---

## 0. Before you start

1. **Back up the database** in phpMyAdmin â†’ Export â†’ SQL.
2. **Back up the old `api/` folder** by downloading it to your computer.
3. **Rotate every key that has ever been public.** If an old example bootstrap key was shared or reused, treat it as compromised. Generate a new one in step 3 and never reuse the old value.
4. Use the HTTPS domain. Do not test with `http://`.
5. Do not put database passwords, the bootstrap key, or the Android signing key in GitHub, `site-config.js`, the APK, or chat.

---

## 1. Database

### Option A â€” existing BrightPath database on InfinityFree (most likely)

Run the files **in this order**:

```text
1. phpMyAdmin â†’ select if0_XXXXXXX_brightpath â†’ Import â†’ backend/api/migrate.sql
2. phpMyAdmin â†’ same database â†’ Import â†’ backend/api/schema.sql
```

Why both:

- `migrate.sql` adds the new columns to the legacy `users`, `schools`, `assignments`, `submissions`, `assignment_answers`, and `tutors` tables. It uses `ADD COLUMN IF NOT EXISTS`, so re-running is safe.
- `schema.sql` creates the 30 production tables with `IF NOT EXISTS`, then seeds badges, settings, 8 lessons, and 24 quiz questions with `INSERT IGNORE`. Existing tables are left alone.

Do **not** import the old `migration-v2.sql`; `migrate.sql` supersedes it.

### Option B â€” brand-new empty database

```text
phpMyAdmin â†’ select the empty database â†’ Import â†’ backend/api/schema.sql
```

### Command-line alternative

If your MySQL client is allowed to connect (InfinityFree usually requires phpMyAdmin), the equivalent commands are:

```powershell
mysql -h sqlXXX.infinityfree.com -u if0_XXXXXXX -p if0_XXXXXXX_brightpath < backend/api/schema.sql
```

For an existing database:

```powershell
mysql -h sqlXXX.infinityfree.com -u if0_XXXXXXX -p if0_XXXXXXX_brightpath < backend/api/migrate.sql
mysql -h sqlXXX.infinityfree.com -u if0_XXXXXXX -p if0_XXXXXXX_brightpath < backend/api/schema.sql
```

### Verify

In phpMyAdmin, confirm these tables exist:

```text
users, schools, tutors, api_tokens, login_attempts, password_resets,
parent_child_links, tutor_students, lessons, lesson_questions,
lesson_progress, learning_activity, badges, user_badges, assignments,
submissions, assignment_answers, classes, class_attendance, class_messages,
conversations, conversation_members, messages, notifications, sponsors,
sponsor_events, game_scores, support_messages, audit_log, app_settings
```

Also check:

```sql
SELECT COUNT(*) FROM lessons;          -- 8
SELECT COUNT(*) FROM lesson_questions; -- 24
SELECT COUNT(*) FROM badges;           -- seeded badges
SELECT COUNT(*) FROM app_settings;     -- seeded settings
```

---

## 2. Create the server-only `config.php`

Create the file **on the server**, in the same folder as `api/index.php`:

```text
htdocs/api/config.php
```

Start from `backend/api/config.example.php` and fill in every placeholder:

```php
<?php
declare(strict_types=1);

return [
    'db_host' => 'sqlXXX.infinityfree.com',
    'db_name' => 'if0_XXXXXXX_brightpath',
    'db_user' => 'if0_XXXXXXX',
    'db_password' => 'YOUR_REAL_DATABASE_PASSWORD',

    'allowed_origins' => [
        'https://brightpath.gt.tc',
        'https://alexander12xx.github.io',
        'https://appassets.androidplatform.net',
    ],

    'bootstrap_key' => 'GENERATE_A_NEW_ONE_TIME_KEY',

    'jitsi_domain' => 'meet.jit.si',
    'jitsi_script_url' => 'https://meet.jit.si/external_api.js',

    'upload_dir' => __DIR__ . '/storage',
    'max_upload_bytes' => 8 * 1024 * 1024,

    'token_lifetime_seconds' => 60 * 60 * 8,
    'staff_token_lifetime_seconds' => 60 * 60 * 12,
    'login_max_attempts_per_email' => 8,
    'login_max_attempts_per_ip' => 30,

    'mail_enabled' => false,
    'mail_from' => 'no-reply@brightpath.gt.tc',
    'support_email' => 'support@brightpath.gt.tc',
    'app_name' => 'BrightPath',
    'allow_debug_errors' => false,
];
```

### Generate the one-time bootstrap key

```powershell
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

Copy the output into `bootstrap_key`. After the first administrator is created (step 4), set it back to `''` and re-upload `config.php`.

### Rules

- Origins have **no trailing slash** and **no path**.
- Keep `https://appassets.androidplatform.net` in the list or the Android app cannot call the API.
- `config.php` must be named exactly that, not `config.php.txt`.
- `config.php` stays on the server. Do not upload it to GitHub, GitHub Pages, or the APK.
- File permissions: `644` for PHP files, `755` for folders, if InfinityFree asks. Do not make files world-writable.

---

## 3. Upload the secure site and API

### 3.1 Files for the web root (`htdocs`)

The simplest route is to upload the whole `htdocs1/` folder, which already matches the web root. It contains:

```text
index.html
app.html
app.js
styles.css
download.css
download.js
manifest.json
icon.svg
sw.js
site-config.js
downloads/brightpath.apk      â† signed Android app
downloads/.htaccess           â† APK MIME type, no folder listing
api/...                       â† see 3.2
```

`site-config.js` must contain only public values:

```js
window.BRIGHTPATH_CONFIG = Object.freeze({
  apiBase: 'https://brightpath.gt.tc',
  androidDownloadUrl: 'downloads/brightpath.apk',
  androidReleaseUrl: 'https://github.com/Alexander12xx/BPATH/releases/latest'
});
```

The download path is resolved against the page, so it becomes `https://brightpath.gt.tc/downloads/brightpath.apk`. An absolute HTTPS URL is accepted too.

### 3.2 Files for `htdocs/api`

**Delete or rename the old `api/index.php` first.** Then upload:

```text
backend/api/index.php
backend/api/.htaccess
backend/api/schema.sql
backend/api/migrate.sql
backend/api/config.php          â† created on the server in step 2
backend/api/storage/            â† folder with .htaccess and index.html
```

Optional, for reference only (blocked from the web by `.htaccess`):

```text
backend/api/config.example.php
```

Do **not** upload:

```text
backend/api/migration-v2.sql    â† obsolete
android/                        â† GitHub only
.github/                        â† GitHub only
config.php to GitHub
```

### 3.3 Confirm the secure API is the one running

This is the critical check. Open in a normal browser (not a command-line tool; InfinityFree may show a JavaScript challenge to scripts):

```text
https://brightpath.gt.tc/api/index.php?r=health
```

The response must include:

```json
{
  "ok": true,
  "app": "BrightPath",
  "api_version": "2.0.0",
  "database": "connected",
  "features": ["accounts", "lessons", "assignments", "live_classes", "messages", "notifications", "parents", "tutors", "rewards", "games", "sponsors", "support"]
}
```

If `api_version` is not `2.0.0`, or `live_classes` and `sponsors` are missing, the old API is still in place. Delete the old `index.php`, upload the new one, and hard-refresh.

Additional checks:

```text
https://brightpath.gt.tc/api/index.php?r=settings
```

Should return `app_name`, `welcome_message`, `jitsi_domain`, and `support_email` â€” not a database error.

```text
https://brightpath.gt.tc/api/config.php
https://brightpath.gt.tc/api/schema.sql
https://brightpath.gt.tc/api/migrate.sql
https://brightpath.gt.tc/api/storage/
```

All four must return **403 Forbidden** (or 404). If any returns file contents, stop and fix `.htaccess` before continuing.

To compare the uploaded file with your local copy over FTP:

```powershell
Get-FileHash .\backend\api\index.php -Algorithm SHA256
```

Download `api/index.php` from the server over FTP and run the same command on the downloaded file. The hashes must match.

---

## 4. Create the first administrator

The app has no default account and no shared password. Create the first administrator once with the bootstrap key.

### Browser console method (recommended on InfinityFree)

1. Open `https://brightpath.gt.tc/app.html` in a browser.
2. Open Developer Tools â†’ Console.
3. Run this, replacing the four values:

```js
fetch('/api/index.php?r=auth/bootstrap', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    bootstrap_key: 'YOUR_ONE_TIME_KEY',
    name: 'School Administrator',
    email: 'admin@example.com',
    password: 'A-strong-password-of-at-least-8-characters'
  })
}).then(r => r.json()).then(console.log);
```

Expected result:

```json
{ "ok": true, "message": "Administrator created. Remove bootstrap_key from config.php now.", "user_id": 1 }
```

### PowerShell method

```powershell
$body = @{
  bootstrap_key = 'YOUR_ONE_TIME_KEY'
  name          = 'School Administrator'
  email         = 'admin@example.com'
  password      = 'A-strong-password-of-at-least-8-characters'
} | ConvertTo-Json

Invoke-RestMethod -Method Post `
  -Uri 'https://brightpath.gt.tc/api/index.php?r=auth/bootstrap' `
  -ContentType 'application/json' `
  -Body $body
```

If InfinityFree blocks the request with a challenge page, use the browser console method.

### Close setup

1. Edit `api/config.php` on the server.
2. Set `'bootstrap_key' => ''`.
3. Save and re-upload.
4. Sign in at `https://brightpath.gt.tc/app.html` with the administrator account.
5. Change the temporary password if you shared it with anyone.

The API refuses `auth/bootstrap` after an administrator exists, and refuses it when the key is blank.

---

## 5. Publish the signed Android APK

A signed release APK is already built and waiting in the upload folder:

```text
htdocs1/downloads/brightpath.apk
htdocs1/downloads/.htaccess
```

Uploading `htdocs1/` in step 3 publishes it. A GitHub release is optional and only acts as a second mirror.

### 5.1 Verify the APK before uploading

```powershell
$apk = '.\htdocs1\downloads\brightpath.apk'
Get-Item $apk | Select-Object Length
Get-FileHash $apk -Algorithm SHA256
& "$env:ANDROID_HOME\build-tools\35.0.0\apksigner.bat" verify --print-certs $apk
& "$env:ANDROID_HOME\build-tools\35.0.0\aapt.exe" dump badging $apk | Select-String 'package:|sdkVersion|targetSdkVersion'
```

Expected values:

| Property | Value |
| --- | --- |
| Package | `com.brightpath.learning` |
| Version | `1.0.0` (versionCode 1) |
| Minimum / target Android | API 26 / API 34 |
| Size | 2,794,657 bytes |
| SHA-256 | `7435418FA9F9F4F50219E822ECAB86F84EFBA06B06369C043135FC2EA1DCACD0` |
| Signer SHA-256 | `4e5ce2061ac635f3c7cb8bb691add70357de77390c1b484ab7f70c11a2e04ab7` |

If `apksigner` says the APK is unsigned, stop and rebuild it before uploading.

### 5.2 Upload the APK with the site

1. In FTP, create `htdocs/downloads/`.
2. Upload `htdocs1/downloads/brightpath.apk` and `htdocs1/downloads/.htaccess`.
3. Open `https://brightpath.gt.tc/downloads/brightpath.apk` on a phone. It must start downloading, not show a 404.
4. Open `https://brightpath.gt.tc/`. The primary button must read **Download the Android app** and download `brightpath.apk`.

The install page sends a `HEAD` request to that file first, so it only labels it as a download when the file really exists. If the site copy is missing it checks the GitHub release instead, and if neither exists it links the release page rather than showing a dead download.

### 5.3 Rebuild after changing the app

The Gradle build copies the root web files into `android/app/src/main/assets/www` first, then signs with the local keystore:

```powershell
$keyDir = 'C:\Users\alemb\OneDrive\Desktop\APP\android\keys'
$env:ANDROID_KEYSTORE_PATH = Join-Path $keyDir 'brightpath-release.jks'
$env:ANDROID_KEYSTORE_PASSWORD = (Get-Content (Join-Path $keyDir 'STORE-PASSWORD.txt') -Raw).Trim()
$env:ANDROID_KEY_ALIAS = 'brightpath'
$env:ANDROID_KEY_PASSWORD = $env:ANDROID_KEYSTORE_PASSWORD
$env:GRADLE_USER_HOME = 'C:\Users\alemb\AppData\Local\BrightPathAndroid\gradle-home'
& 'C:\Users\alemb\AppData\Local\BrightPathAndroid\gradle-8.9\bin\gradle.bat' -p android assembleRelease --no-daemon --console=plain
Copy-Item -Force '.\android\app\build\outputs\apk\release\app-release.apk' '.\htdocs1\downloads\brightpath.apk'
```

Raise `versionCode` and `versionName` in `android/app/build.gradle.kts` before a public update, or Android will refuse to install it over the older app. Then re-upload `htdocs1/downloads/`.

If Gradle reports `Address already in use: bind`, delete `$env:GRADLE_USER_HOME\daemon` and run the build again.

### 5.4 Keep the signing key safe

| File | Purpose |
| --- | --- |
| `android/keys/brightpath-release.jks` | Release keystore |
| `android/keys/STORE-PASSWORD.txt` | Keystore and key password |
| `android/keys/keystore.properties` | Local Gradle signing values |
| `android/keys/keystore.b64.txt` | Base64 copy for the GitHub secret |

Back these up offline, never commit them, and never paste them into chat or an issue. Android only installs an update over an existing app when both APKs use the same key. If the key is lost, students must uninstall the old app before installing a new one.

### 5.5 Optional GitHub release

GitHub is not required for the site download. To add it as a mirror:

1. Repository â†’ **Settings â†’ Secrets and variables â†’ Actions â†’ New repository secret**:

   | Secret | Value |
   | --- | --- |
   | `ANDROID_KEYSTORE_BASE64` | Contents of `android/keys/keystore.b64.txt` |
   | `ANDROID_KEYSTORE_PASSWORD` | Keystore password |
   | `ANDROID_KEY_ALIAS` | `brightpath` |
   | `ANDROID_KEY_PASSWORD` | Key password |

2. Push the repository, then tag a release:

   ```powershell
   git add .
   git commit -m "Secure BrightPath release"
   git push origin main
   git tag v1.0.0
   git push origin v1.0.0
   ```

3. The **Signed Android release** workflow builds `assembleRelease`, verifies the signature with `apksigner`, renames the asset to `brightpath.apk`, and publishes it as the latest release.

4. Verify:

   ```text
   https://github.com/Alexander12xx/BPATH/releases/latest/download/brightpath.apk
   ```

   It must download an `.apk`, not a 404 page.

The APK itself is gitignored: the site copy lives in `htdocs1/downloads/`, and the workflow builds its own signed copy for GitHub.

---

## 6. Install and test on a real phone

1. Open `https://brightpath.gt.tc/` on the phone.
2. Tap **Download the Android app**.
3. Android asks to allow installs from the browser. Allow it, go back, and tap the downloaded file.
4. Install and open **BrightPath** from the home screen.
5. Sign in. Open **Profile** and turn on **Fingerprint sign-in**.
6. Lock and reopen the app; use the fingerprint and confirm it unlocks.
7. Join a live class:
   - Allow camera and microphone when Android asks.
   - Test video once.
   - Test **audio-only** once.
8. Enable notifications, then check the notification drawer.
9. Turn on airplane mode and reopen the app; the bundled shell should still appear.

If install fails, uninstall an older debug build first and confirm every release uses the same signing key.

---

## 7. Post-deploy smoke test

Run these in order on the live site:

- [ ] Health endpoint shows `api_version: 2.0.0` and `database: connected`.
- [ ] `https://brightpath.gt.tc/downloads/brightpath.apk` downloads the signed APK.
- [ ] Homepage shows **Download the Android app** and it points at that file.
- [ ] Student registration works and requires guardian email + consent.
- [ ] Tutor registration creates a pending account; admin can approve it.
- [ ] Student signs in; dashboard, lessons, assignments, classes, games, rewards, progress, messages, family, help, and profile open without console errors.
- [ ] A lesson quiz saves a score and awards points.
- [ ] An assignment with a multiple-choice question is marked on the server, not the browser.
- [ ] A photo or PDF upload succeeds; direct access to `api/storage/` returns 403.
- [ ] Parent links with a family code and sees the child's progress.
- [ ] Tutor creates a class; two devices join the Jitsi room; audio-only works.
- [ ] Class chat messages persist after reload.
- [ ] Notifications appear in the server inbox and the notification drawer.
- [ ] Admin can reset a password, close a support message, and edit settings.
- [ ] Eight wrong passwords trigger the login limit.
- [ ] `config.php`, `schema.sql`, `migrate.sql`, and `storage/` return 403.
- [ ] A non-allowed origin receives 403 from the API.
- [ ] APK installs, fingerprint unlock works, and camera/mic prompts appear.

---

## 8. Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| `BrightPath server setup is incomplete` | `api/config.php` is missing, misnamed (`config.php.txt`), or not beside `index.php`. |
| `database: unavailable` | Wrong `db_host`, `db_name`, `db_user`, or password in `config.php`; create/repair the database user in InfinityFree. |
| `This website origin is not allowed` | Add the exact origin (no trailing slash, no path) to `allowed_origins`; keep `https://appassets.androidplatform.net`. |
| Old features still missing | The old `api/index.php` is still running. Delete it, upload the new one, verify `api_version: 2.0.0`. |
| Login always fails | Confirm the account exists, the password is at least 8 characters, and the login limit has expired (15 minutes). Admins can reset it. |
| Upload fails | Check `storage/` exists and is writable, the file is JPG/PNG/WebP/PDF under 8 MB, and the folder is not directly web-accessible. |
| Jitsi loads but there is no camera | Android Settings â†’ Apps â†’ BrightPath â†’ Permissions â†’ Camera and Microphone. Reopen the class. |
| Jitsi joins but audio is silent | Leave the class, check media volume and the microphone permission, then rejoin. Use audio-only if the connection is weak. |
| APK link returns 404 | `downloads/brightpath.apk` was not uploaded, is in the wrong folder, or the case of the file name differs. Upload `htdocs1/downloads/` with its `.htaccess`. A GitHub release is only the fallback. |
| Homepage shows the release page instead of a download | The site `HEAD` check did not find `downloads/brightpath.apk`, and no GitHub release has an APK asset. Upload the APK or publish a release. |
| `app not installed` | An older APK with a different signing key is installed. Uninstall it, then install the new signed APK. |
| Website shows an old version | The service worker served a cached copy. Hard-refresh once; the cache version is `brightpath-v13`. |
| Android cannot reach the API | `site-config.js` `apiBase` is wrong, the site is not HTTPS, or `appassets.androidplatform.net` is missing from CORS. |
| Mail recovery does not send | InfinityFree blocks `mail()`. Keep `mail_enabled` false and use admin password reset. |

---

## 9. Rollback

1. Restore the old `api/` folder from the backup downloaded in step 0.
2. Restore the database from the phpMyAdmin export.
3. Restore the previous root web files.
4. If a bad APK was published, replace `htdocs/downloads/brightpath.apk` with a good build. If a GitHub release is bad, delete it or upload a new APK signed with the same key and a higher `versionCode`.

Never restore a version that used a shared or public bootstrap key.
