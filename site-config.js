/* Public browser settings only. Never place database or signing secrets here.
   androidDownloadUrl is relative to the site root, so it resolves to
   https://brightpath.gt.tc/downloads/brightpath.apk on InfinityFree. */
window.BRIGHTPATH_CONFIG = Object.freeze({
  apiBase: 'https://brightpath.gt.tc',
  androidDownloadUrl: 'downloads/brightpath.apk',
  androidReleaseUrl: 'https://github.com/Alexander12xx/BPATH/releases/latest'
});
