/* BrightPath public install page.
   The signed APK uploaded to this site is checked first, then the latest GitHub
   release. If neither has a real APK, the page links the release page instead of
   claiming a file that is not published. */
(function () {
  'use strict';

  var CONFIG = window.BRIGHTPATH_CONFIG || {};
  var DEFAULT_RELEASE = 'https://github.com/Alexander12xx/BPATH/releases/latest';

  var downloadLink = document.querySelector('#android-download-link');
  var releaseLink = document.querySelector('#android-release-link');
  var footerRelease = document.querySelector('#release-link');
  var downloadStatus = document.querySelector('#download-status');
  var installButton = document.querySelector('#install-button');

  function safeHttps(value) {
    if (!value) return '';
    try {
      var url = new URL(String(value));
      if (url.protocol !== 'https:' || url.username || url.password) return '';
      return url.href;
    } catch (error) {
      return '';
    }
  }

  /* The APK may be a relative path on this site or an absolute HTTPS URL. */
  function resolveDownloadUrl(value) {
    if (!value) return '';
    try {
      var url = new URL(String(value), window.location.href);
      if (url.username || url.password) return '';
      var sameOrigin = url.origin === window.location.origin;
      if (url.protocol !== 'https:' && !(sameOrigin && url.protocol === 'http:')) return '';
      return url.href;
    } catch (error) {
      return '';
    }
  }

  function setStatus(message) {
    if (downloadStatus) downloadStatus.textContent = message;
  }

  function setReleasePage(url) {
    if (releaseLink) releaseLink.href = url;
    if (footerRelease) footerRelease.href = url;
  }

  function formatSize(bytes) {
    var size = Number(bytes) || 0;
    if (size <= 0) return '';
    if (size < 1024 * 1024) return Math.round(size / 1024) + ' KB';
    return (size / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function showDownload(assetUrl, release) {
    if (downloadLink) {
      downloadLink.href = assetUrl;
      downloadLink.hidden = false;
    }
    if (releaseLink) releaseLink.hidden = true;
    var details = [];
    if (release && release.tag_name) details.push('Version ' + String(release.tag_name).replace(/^v/i, ''));
    var size = formatSize(release && release.assetSize);
    if (size) details.push(size);
    setStatus((details.length ? details.join(' · ') + ' · ' : '') +
      'Signed APK. Android will ask you to allow installs from this browser, then install and open the app.');
  }

  function showReleaseOnly(message, url) {
    if (downloadLink) downloadLink.hidden = true;
    if (releaseLink) releaseLink.hidden = false;
    if (url) setReleasePage(url);
    setStatus(message);
  }

  var releaseUrl = safeHttps(CONFIG.androidReleaseUrl) || DEFAULT_RELEASE;
  var downloadUrl = resolveDownloadUrl(CONFIG.androidDownloadUrl);
  setReleasePage(releaseUrl);

  var repoMatch = releaseUrl.match(/^https:\/\/github\.com\/([^/]+)\/([^/?#]+)/i);
  var apiUrl = repoMatch
    ? 'https://api.github.com/repos/' + repoMatch[1] + '/' + repoMatch[2] + '/releases?per_page=1'
    : '';

  /* Confirms the APK really exists before offering it as a download. */
  function headApk(url, timeoutMs) {
    return new Promise(function (resolve) {
      if (!url || typeof window.fetch !== 'function') { resolve(null); return; }
      var controller = typeof window.AbortController === 'function' ? new AbortController() : null;
      var timer = null;
      if (controller) {
        timer = window.setTimeout(function () { controller.abort(); }, timeoutMs || 6000);
      }
      window.fetch(url, {
        method: 'HEAD',
        cache: 'no-store',
        signal: controller ? controller.signal : undefined
      }).then(function (response) {
        if (timer) window.clearTimeout(timer);
        if (!response || !response.ok) { resolve(null); return; }
        var size = Number(response.headers && response.headers.get('content-length')) || 0;
        resolve({ size: size });
      }).catch(function () {
        if (timer) window.clearTimeout(timer);
        resolve(null);
      });
    });
  }

  function offerLocalApk() {
    if (!downloadUrl) return Promise.resolve(false);
    return headApk(downloadUrl, 6000).then(function (info) {
      if (!info) return false;
      showDownload(downloadUrl, info.size ? { assetSize: info.size } : null);
      return true;
    });
  }

  function checkRelease() {
    offerLocalApk().then(function (localReady) {
      if (localReady) return;
      if (!apiUrl || typeof window.fetch !== 'function') {
        showReleaseOnly('Open the release page to download the Android app. The browser version below works right away.');
        return;
      }

      var controller = typeof window.AbortController === 'function' ? new AbortController() : null;
      var timer = controller ? window.setTimeout(function () { controller.abort(); }, 8000) : null;

      window.fetch(apiUrl, {
        headers: { Accept: 'application/vnd.github+json' },
        signal: controller ? controller.signal : undefined
      }).then(function (response) {
        if (!response.ok) throw new Error('GitHub release check returned ' + response.status);
        return response.json();
      }).then(function (releases) {
        var release = Array.isArray(releases) ? releases[0] : null;
        if (!release) {
          showReleaseOnly('No signed Android APK is published yet. Open the release page to check again; the browser version works right away.');
          return;
        }
        var assets = release && Array.isArray(release.assets) ? release.assets : [];
        var apk = null;
        for (var i = 0; i < assets.length; i += 1) {
          if (/\.apk$/i.test(String(assets[i].name || ''))) { apk = assets[i]; break; }
        }
        if (!apk) {
          showReleaseOnly('No Android APK is attached to the latest release yet. Use the release page to check again; the browser version works right away.',
            safeHttps(release && release.html_url));
          return;
        }
        var assetUrl = safeHttps(apk.browser_download_url);
        if (!assetUrl) {
          showReleaseOnly('The latest release has an APK, but its download link could not be verified. Open the release page instead.',
            safeHttps(release && release.html_url));
          return;
        }
        release.assetSize = apk.size;
        showDownload(assetUrl, release);
      }).catch(function (error) {
        showReleaseOnly('Could not check for a release right now. Open the release page to download the Android app; the browser version works right away.');
        console.warn('BrightPath release check:', error.message || error);
      }).then(function () {
        if (timer) window.clearTimeout(timer);
      });
    });
  }

  checkRelease();

  /* The web shortcut is optional and clearly separate from the Android app. */
  var installPrompt = null;
  window.addEventListener('beforeinstallprompt', function (event) {
    event.preventDefault();
    installPrompt = event;
    if (installButton) installButton.hidden = false;
  });

  if (installButton) {
    installButton.addEventListener('click', function () {
      if (!installPrompt) return;
      installPrompt.prompt();
      installPrompt.userChoice.then(function () {
        installPrompt = null;
        installButton.hidden = true;
      });
    });
  }

  window.addEventListener('appinstalled', function () {
    setStatus('The BrightPath web shortcut was added. For lessons and live classes on a phone, install the Android app.');
    if (installButton) installButton.hidden = true;
  });

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('./sw.js').catch(function (error) {
        console.warn('BrightPath offline cache was not registered:', error);
      });
    });
  }
})();
