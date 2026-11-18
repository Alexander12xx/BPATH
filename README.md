# BrightPath

BrightPath is a learning app for grades 1 to 8. It ships as a **native Android app** with the interface bundled inside the APK, plus a PHP/MySQL API and install page hosted on InfinityFree.

The Android app is not a browser shortcut or a PWA wrapper around a remote site. It has its own launcher icon, a bundled offline app shell, Android Keystore biometric unlock, camera and microphone access for live classes, and local notifications.

> **Release status:** a signed APK is built and waiting at `htdocs1/downloads/brightpath.apk`. Upload the `htdocs1/` folder and the install page serves that file as soon as it is online. The same page checks the file first and falls back to the latest GitHub release, so it never points at a missing download. Publishing a GitHub release is optional.

## What is included

| Area | Details |
| --- | --- |
| Accounts | Student and parent self-registration, tutor registration with admin approval, guardian email and consent for students, optional school invite code, family-code parent linking, password recovery, forced password change |
| Learning | 8 starter lessons with reading content and 24 quiz questions, progress, points, streaks, badges |
| School work | Assignments with multiple choice, written answers, and file submissions; tutor review and feedback; protected PDF/DOC/DOCX resources |
| Live classes | Server-issued Jitsi rooms, video or audio-only, attendance, class chat, tutor end-class |
| Games | Number pop, memory match, word builder, focus drill, server-saved scores and leaderboard |
| Family and staff | Parent progress view and approvals, tutor student list, admin users, support inbox, audit log, sponsor cards, settings |
| Safety | Hashed passwords, hashed bearer tokens, prepared statements, CORS allowlist, security headers, login rate limits, validated uploads, storage outside web access, guardian consent, no secrets in the frontend |
| Android | Signed APK, biometric unlock, camera/mic permissions, notification prompt, local reminders, offline app shell |

## Repository layout

```
app.html, app.js, styles.css      Kid-friendly app shell and screens
index.html, download.*, site-config.js   Public Android install page
manifest.json, sw.js, icon.svg    Web shortcut metadata and offline cache
backend/api/index.php             Single-file production API (PHP 7.2+)
backend/api/schema.sql            Fresh-install database schema and starter content
backend/api/migrate.sql           One-time upgrade for the old InfinityFree database
backend/api/config.example.php    Server config template (no secrets)
backend/api/.htaccess             Blocks config and SQL files from the web
android/                          Native Android project (minSdk 26, targetSdk 34)
android/keys/                     Release keystore and passwords (gitignored, back up privately)
.github/workflows/                Debug build and signed release pipeline
htdocs1/                          Exact copy of what goes in the InfinityFree web root
htdocs1/downloads/brightpath.apk  Signed APK already available for students
github files/                     Mirror of the repository layout for GitHub upload
```

`htdocs1/`, `github files/`, and `android/app/src/main/assets/www/` are deployment copies. The root files are the source of truth.

## Deploy in five steps

Full details, verification commands, and troubleshooting are in [DEPLOYMENT.md](./DEPLOYMENT.md).

1. **Database.** Back up the database. On a fresh database import `schema.sql`. On the existing InfinityFree database run `migrate.sql` once, then `schema.sql`.
2. **Server config.** Copy `backend/api/config.example.php` to `config.php` on the server and fill in the database host, name, user, password, and allowed origins. Generate a one-time `bootstrap_key`. Never commit `config.php`.
3. **Upload the secure API.** Replace the old `api/index.php` with `backend/api/index.php`, upload the SQL and `.htaccess` files, and keep `storage/` protected. Verify `https://brightpath.gt.tc/api/index.php?r=health` reports `"api_version":"2.0.0"` and the new feature list.
4. **Create the first administrator.** Call `auth/bootstrap` once with the bootstrap key, then blank the key in `config.php`.
5. **Upload the APK.** Copy `htdocs1/` to the web root, including `downloads/brightpath.apk` and `downloads/.htaccess`. Open `https://brightpath.gt.tc/` and confirm the download button appears. A GitHub release is an optional second mirror.

## Database

The schema creates 30 tables:

`users`, `schools`, `tutors`, `api_tokens`, `login_attempts`, `password_resets`, `parent_child_links`, `tutor_students`, `lessons`, `lesson_questions`, `lesson_progress`, `learning_activity`, `badges`, `user_badges`, `assignments`, `submissions`, `assignment_answers`, `classes`, `class_attendance`, `class_messages`, `conversations`, `conversation_members`, `messages`, `notifications`, `sponsors`, `sponsor_events`, `game_scores`, `support_messages`, `audit_log`, and `app_settings`.

`schema.sql` also seeds starter lessons, quiz questions, badges, and settings. It uses `CREATE TABLE IF NOT EXISTS` and `INSERT IGNORE`, so it is safe to run after `migrate.sql`.

**Fresh database**

```text
phpMyAdmin â†’ select the database â†’ Import â†’ backend/api/schema.sql
```

**Existing BrightPath database (InfinityFree)**

```text
1. Export a backup.
2. Import backend/api/migrate.sql once.
3. Import backend/api/schema.sql once.
```

`migrate.sql` adds the new columns to the legacy `users`, `schools`, `assignments`, `submissions`, `assignment_answers`, and `tutors` tables. It does not delete data. Do not import `migration-v2.sql` from an older copy; it is superseded.

## Server configuration and keys

| Secret | Where it lives | How to create it |
| --- | --- | --- |
| MySQL host, database, user, password | `api/config.php` on the server only | InfinityFree control panel â†’ MySQL Databases |
| `bootstrap_key` | `api/config.php` until the first admin exists | `python -c "import secrets; print(secrets.token_urlsafe(32))"` |
| Android release keystore | `android/keys/brightpath-release.jks` (gitignored) plus an offline backup | Already generated; see `android/keys/STORE-PASSWORD.txt` |
| Keystore base64 for CI | GitHub secret `ANDROID_KEYSTORE_BASE64` | `android/keys/keystore.b64.txt` |
| Keystore/key passwords and alias | `android/keys/keystore.properties` and GitHub Actions secrets | Password is in `android/keys/STORE-PASSWORD.txt`; alias is `brightpath` |

The signed APK in this repository was built with that keystore:

| Property | Value |
| --- | --- |
| Package | `com.brightpath.learning` |
| Version | `1.0.0` (versionCode 1) |
| Minimum Android | 8.0 (API 26) |
| Size | 2,794,657 bytes |
| SHA-256 | `7435418FA9F9F4F50219E822ECAB86F84EFBA06B06369C043135FC2EA1DCACD0` |
| Signer SHA-256 | `4e5ce2061ac635f3c7cb8bb691add70357de77390c1b484ab7f70c11a2e04ab7` |

Back up `android/keys/` privately, never in GitHub. Android only installs an update over an existing app when both APKs use the same key, so losing the keystore means students must uninstall before installing a future version.

Rules:

- `config.php` is **never** committed, uploaded to GitHub Pages, or copied into the APK.
- `site-config.js` contains public URLs only: the API origin and the Android release links.
- BrightPath has no shared frontend API key. Each signed-in account gets a random bearer token; the server stores only its SHA-256 hash and an expiry.
- If an old example bootstrap key was ever public or reused, treat it as compromised and never use it again. The repository contains no active bootstrap key.

Optional mail: InfinityFree may block `mail()`. Leave `mail_enabled` false and use the administrator **Reset password** action, which creates a temporary password that must be changed at the next sign-in.

## API

Base URL: `https://brightpath.gt.tc/api/index.php?r=ROUTE`

- `GET` for reads, `POST` with JSON for changes.
- Authenticated requests use `Authorization: Bearer TOKEN` or `X-Auth-Token`.
- CORS accepts only the origins listed in `allowed_origins`; the list must include the site origin and `https://appassets.androidplatform.net`.
- `GET ?r=health` reports API version, database state, and the enabled feature list.

Main route groups: `auth/*`, `profile/update`, `dashboard`, `lessons*`, `progress`, `assignments*`, `submissions*`, `classes*`, `conversations`, `messages`, `notifications*`, `sponsors*`, `badges`, `games/*`, `contacts`, `parent/*`, `tutor/students*`, `schools*`, `admin/*`, and `support`.

All times are UTC. The frontend converts `datetime-local` values before sending them.

## Android app

Requirements: JDK 17, Android SDK platform 35, build-tools 35.0.0, Gradle 8.9.

Debug build for testing:

```powershell
.\android\gradlew.bat assembleDebug
```

The APK is written to `android/app/build/outputs/apk/debug/app-debug.apk`. Do not publish a debug APK to students.

Signed release APK (already built):

```text
htdocs1/downloads/brightpath.apk
```

Rebuild it after changing the web app. The Gradle build copies the root web files into `android/app/src/main/assets/www` first, then signs with the local keystore:

```powershell
$keyDir = 'C:\Users\alemb\OneDrive\Desktop\APP\android\keys'
$env:ANDROID_KEYSTORE_PATH = Join-Path $keyDir 'brightpath-release.jks'
$env:ANDROID_KEYSTORE_PASSWORD = (Get-Content (Join-Path $keyDir 'STORE-PASSWORD.txt') -Raw).Trim()
$env:ANDROID_KEY_ALIAS = 'brightpath'
$env:ANDROID_KEY_PASSWORD = $env:ANDROID_KEYSTORE_PASSWORD
$env:GRADLE_USER_HOME = 'C:\Users\alemb\AppData\Local\BrightPathAndroid\gradle-home'
& 'C:\Users\alemb\AppData\Local\BrightPathAndroid\gradle-8.9\bin\gradle.bat' -p android assembleRelease --no-daemon --console=plain
```

The output is `android/app/build/outputs/apk/release/app-release.apk`. Copy it over `htdocs1/downloads/brightpath.apk` and upload the folder again. Raise `versionCode` and `versionName` in `android/app/build.gradle.kts` for each public update.

Verify the signature before uploading:

```powershell
& "$env:ANDROID_HOME\build-tools\35.0.0\apksigner.bat" verify --print-certs htdocs1\downloads\brightpath.apk
```

Optional GitHub release: add the four signing secrets to the repository, push a `v*` tag, and the **Signed Android release** workflow builds, verifies, renames the asset to `brightpath.apk`, and publishes it. The stable GitHub link is:

```text
https://github.com/Alexander12xx/BPATH/releases/latest/download/brightpath.apk
```

Keep the keystore and passwords safe. Android will only install an update over an existing app when both APKs are signed with the same key.

The APK uses:

- `INTERNET`, `CAMERA`, `RECORD_AUDIO`, `MODIFY_AUDIO_SETTINGS`, and `POST_NOTIFICATIONS`.
- HTTPS-only traffic and a network security config.
- A `WebChromeClient` permission bridge so Jitsi can use the camera and microphone after Android grants them.
- Android Keystore + BiometricPrompt; the password itself is never stored for fingerprint sign-in.

The app loads its bundled interface from `appassets.androidplatform.net` and calls the API over HTTPS. The root web files are copied into the APK by a Gradle `Sync` task at build time.

## Public install page

`index.html` is Android-first:

- It sends a `HEAD` request to the APK on this site. If `downloads/brightpath.apk` exists, **Download the Android app** points straight at it.
- If the site copy is missing, it asks the GitHub API for the latest release and uses an `.apk` asset when one exists.
- If neither exists, it shows the release page and says so instead of linking a missing file.
- The browser app and the optional web shortcut are offered separately and are not described as the Android app.

Set public links in `site-config.js`:

```js
window.BRIGHTPATH_CONFIG = Object.freeze({
  apiBase: 'https://brightpath.gt.tc',
  androidDownloadUrl: 'downloads/brightpath.apk',
  androidReleaseUrl: 'https://github.com/Alexander12xx/BPATH/releases/latest'
});
```

`androidDownloadUrl` is relative to the site root and resolves to `https://brightpath.gt.tc/downloads/brightpath.apk`. An absolute HTTPS URL also works. Only HTTPS is accepted, except a same-origin HTTP URL used for local testing.

## Verification

PHP was reviewed for PHP 7.2 compatibility and JavaScript was runtime-tested in a browser with a mock API. The release APK was built and its signature verified with `apksigner`. Before inviting students:

- Confirm the live health endpoint shows API version `2.0.0`.
- Confirm `https://brightpath.gt.tc/` shows **Download the Android app** and the file downloads as `brightpath.apk`.
- Sign in, register a student with guardian consent, and link a parent.
- Create a lesson attempt, submit an assignment, and review it as a tutor.
- Join a Jitsi class on two devices, once with video and once audio-only.
- Install the signed APK on a real Android phone and test fingerprint unlock, camera, microphone, and notifications.
- Confirm `config.php`, `schema.sql`, `migrate.sql`, and `storage/` return 403 over HTTP.
- Review your local safeguarding and privacy requirements before collecting real children's data.
