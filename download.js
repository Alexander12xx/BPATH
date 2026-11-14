const downloadLink = document.querySelector('#android-download-link');
const releaseLink = document.querySelector('#android-release-link');
const downloadStatus = document.querySelector('#download-status');
const installButton = document.querySelector('#install-button');
const androidDownloadUrl = window.BRIGHTPATH_CONFIG?.androidDownloadUrl || '';

if (androidDownloadUrl) {
  try {
    const url = new URL(androidDownloadUrl);
    if (url.protocol !== 'https:' || url.username || url.password) {
      throw new Error('Android download URL must use HTTPS and cannot include credentials.');
    }
    downloadLink.href = url.href;
    downloadLink.hidden = false;
    releaseLink.hidden = true;
    downloadStatus.textContent = 'Download the signed APK. Android will ask you to approve installation from this source.';
  } catch (error) {
    downloadStatus.textContent = 'The Android download link is not configured correctly. Please contact the developer.';
    console.error('BrightPath download configuration error:', error);
  }
} else {
  downloadStatus.textContent = 'No signed Android APK is published yet. Check the release page for availability. “Install learning app” is a web app, not the Android app.';
}

let installPrompt;
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  installPrompt = event;
  installButton.hidden = false;
});

installButton.addEventListener('click', async () => {
  if (!installPrompt) return;
  installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt = null;
  installButton.hidden = true;
});

window.addEventListener('appinstalled', () => {
  downloadStatus.textContent = 'The BrightPath web app has been installed. To install the Android app, download its APK from the release page.';
});

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(error => {
    console.error('BrightPath offline install could not be registered:', error);
  }));
}
