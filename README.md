# BrightPath

BrightPath is a mobile-first learning app for grades 1–8. The repository contains a small Android Studio app and its shared interface, plus a PHP/MySQL API starter intended for a separate InfinityFree website.

## Android app

Open the [`android`](./android) folder in Android Studio, install the Android SDK if prompted, and wait for Gradle sync. Choose **Build → Build APK(s)** to make a debug APK. The project can also be built from PowerShell with Java 17, Android SDK platform 35/build-tools 35.0.0, and Gradle 8.9:

```powershell
.\android\gradlew.bat assembleDebug
```

The debug APK is written to `android/app/build/outputs/apk/debug/app-debug.apk`. It is for testing and sideloading, not a public release. The native app opens its bundled BrightPath interface, so it launches as an Android app and can display the interface offline; the school API requires an internet connection.

The Android wrapper includes:

- A launcher icon and native app window around locally bundled web assets.
- Android system camera capture for assignment photos and the system document picker for PDFs and images.
- An Android notification permission prompt and a local, testable reminder. Android may defer alarm delivery to save battery.
- HTTPS-only remote requests and a connection screen for the school API.

The app project is in [`android/app`](./android/app). Gradle copies the root interface into the app's assets when it builds. The project is source code only: no APK is checked into this repository.

After pushing to GitHub, the **Android app build** workflow checks the JavaScript/PHP syntax and builds a development APK. Download the `brightpath-android-debug` artifact from that workflow run under the repository's **Actions** tab, then install it on a test phone. This is a debug build for testing—not a signed public release.

To publish a signed APK from a webpage without Google Play, create a private Android release key and store it as repository Actions secrets: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, and `ANDROID_KEY_PASSWORD`. Never commit or share the key/password. Push a version tag such as `v1.0.0` to run the **Signed Android release** workflow; it attaches the signed APK to the repository's GitHub Release page for direct download. Keep a safe offline backup of the signing key—without that same key, Android cannot install updates over the existing release. Android asks users to approve installs from the download source.

On a computer with the JDK that comes with Android Studio, a key can be generated with `keytool -genkeypair -v -keystore brightpath-release.jks -alias brightpath -keyalg RSA -keysize 2048 -validity 10000`. Keep that file and its passwords private. In PowerShell, convert it for the `ANDROID_KEYSTORE_BASE64` secret with `[Convert]::ToBase64String([IO.File]::ReadAllBytes('brightpath-release.jks'))`; enter the other three values as repository **Settings → Secrets and variables → Actions** secrets. Do not paste the encoded key into source, chat, or a public issue.

## Web preview and GitHub Pages

Run the browser preview locally:

```powershell
python -m http.server 8000
```

Open `http://localhost:8000`. The static web preview remains useful for development, but the Android Studio project is the native Android install.

To publish the interface on GitHub Pages, push the repository to GitHub and select the default branch and repository root under **Settings → Pages**. On Android, the published page can also be added to the home screen as a PWA. GitHub Pages is static hosting; it cannot run PHP or host the MySQL database.

## InfinityFree app homepage and Android download

The BrightPath `index.html` can be the public InfinityFree homepage. Upload these root files into `public_html`: `index.html`, `app.js`, `styles.css`, `manifest.json`, `icon.svg`, `sw.js`, and `site-config.js`. Upload the contents of `backend/api` separately into `public_html/api`; do not upload Android build files or private server configuration.

Edit the public `site-config.js` on InfinityFree:

```js
window.BRIGHTPATH_CONFIG = Object.freeze({
  apiBase: window.location.origin,
  androidDownloadUrl: 'https://github.com/YOUR_ACCOUNT/YOUR_REPOSITORY/releases/latest/download/app-release.apk'
});
```

The homepage will show a **Download APK** link when `androidDownloadUrl` points to a published HTTPS GitHub Release asset. Until a signed release exists, keep the link blank or direct it to your actual release page; do not point students at a debug APK for public distribution. Android requires users to approve APK installation from their browser and to allow updates signed with the same private release key. The PWA install button is separate from the direct Android APK download.

This public file contains only public URLs. **Do not put a MySQL password, API key, bootstrap key, or Android signing secret in `site-config.js`, `app.js`, GitHub Pages, or the APK.** BrightPath does not use a shared frontend API key: the PHP server keeps the MySQL credentials in `backend/api/config.php`, and signed-in accounts receive short-lived bearer tokens.

## Connect an InfinityFree PHP/MySQL API

Keep the API on the PHP host, not in GitHub Pages or the Android source. The browser/app calls the PHP API over HTTPS; PHP connects to MySQL. The MySQL hostname, username, password, and database name are **server-only secrets**.

1. In InfinityFree, create a MySQL database and user in the hosting control panel. Note the database hostname, name, and username shown there; the database hostname is not necessarily `localhost`.
2. In phpMyAdmin, select that database and import [`backend/api/schema.sql`](./backend/api/schema.sql).
3. Copy the contents of `backend/api` to `public_html/api` on the PHP host. Do not copy any student data into GitHub.
4. On the PHP host, copy `config.example.php` to `config.php`, fill in the InfinityFree database details, and set `allowed_origins` to the exact InfinityFree origin, any GitHub Pages origin you actually use, and `https://appassets.androidplatform.net` for the Android app. Do not add trailing slashes. Generate a one-time bootstrap key on your computer, for example with `python -c "import secrets; print(secrets.token_urlsafe(32))"`, and set it as `bootstrap_key` in the server-only config. Type that key only into the one-time setup form.
5. In the public InfinityFree `site-config.js`, set `apiBase` to `window.location.origin`. In the Android app, connect using the same HTTPS InfinityFree website origin. Select **Test connection**; a successful response confirms both the PHP API and its MySQL connection.
6. Use **One-time school administrator setup** once to create the first administrator. Sign in, create school accounts, and share student credentials privately with their parent/guardian. Immediately clear `bootstrap_key` in the server config after setup.
7. An administrator can create student, parent, and tutor accounts. Tutors can publish assignments for grades 1–8 and review/download work submitted to their own assignments. Student accounts can see published assignments for their grade and submit a JPG, PNG, WebP, or PDF (maximum 8 MB) from the assignment page.

The SQL in [`backend/api/schema.sql`](./backend/api/schema.sql) creates only the tables currently used by the implemented API: accounts, assignments, sessions/tokens, and student submissions. Import it in phpMyAdmin; it is not a schema for every future LMS feature. The PHP API code is in [`backend/api/index.php`](./backend/api/index.php). Its health endpoint checks the database, sign-in issues short-lived revocable bearer tokens, API account creation is administrator-only, tutor assignment/review access is scoped to the tutor's own assignments, and student submission uploads are stored under a directory that denies direct web access. The API validates the file's actual MIME type, checks student role/grade and the 8 MB limit, hashes passwords, and uses prepared SQL statements.

The PHP host must allow HTTPS requests from the exact published GitHub origin and the Android asset origin. If the connection test fails in a browser, check the website address, the PHP-host TLS certificate, the `allowed_origins` list, and the server's PHP/MySQL settings. Never put MySQL credentials or an administrator password in a frontend setting.

## Current scope and safety

The demo dashboards still show sample progress. Parent-child account linking, parent access to private student records, tutor attendance/grading, real video calls, moderated messaging, scheduled server push, and a production signed release process are not implemented. The debug APK has been built, but this workspace has no connected Android device and the PHP/MySQL API has not been tested against an InfinityFree account. Camera capture, file picking, local reminders, API health checking, sign-in, and protected student uploads still need on-device and hosted-server testing.

This is a starter integration, not a production-ready service for children. Before inviting real students, add verified guardian consent and family linking, server-side role checks for every record, account recovery and login rate limits, secure tutor/class workflows, upload scanning and retention rules, backups, audit/incident procedures, and privacy/safeguarding review for your region. Keep third-party recommendations clearly labeled, age-appropriate, and free from behavioral targeting.
