package com.brightpath.learning;

import android.Manifest;
import android.app.Activity;
import android.app.AlarmManager;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.MediaStore;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;
import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewClientCompat;

import java.io.File;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.TimeUnit;

public final class MainActivity extends Activity {
    private static final int FILE_CHOOSER_REQUEST = 201;
    private static final int NOTIFICATION_PERMISSION_REQUEST = 202;
    private WebView webView;
    private ValueCallback<Uri[]> pendingFileCallback;
    private Uri pendingCameraUri;
    private String pendingReminderTitle;
    private String pendingReminderMessage;
    private int pendingReminderMinutes;
    private WebViewAssetLoader assetLoader;

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        webView = new WebView(this);
        webView.setBackgroundColor(0xFFF7F8FC);
        setContentView(webView);

        assetLoader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setSafeBrowsingEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(true);
        webView.addJavascriptInterface(new BrightPathBridge(), "BrightPathNative");
        webView.setWebViewClient(new WebViewClientCompat() {
            @Override
            public android.webkit.WebResourceResponse shouldInterceptRequest(
                    WebView view, WebResourceRequest request) {
                return assetLoader.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if ("appassets.androidplatform.net".equals(uri.getHost())
                        && "https".equals(uri.getScheme())) return false;
                if ("https".equals(uri.getScheme()) || "http".equals(uri.getScheme())) {
                    try {
                        startActivity(new Intent(Intent.ACTION_VIEW, uri));
                    } catch (ActivityNotFoundException exception) {
                        Toast.makeText(MainActivity.this, "No app can open this link.", Toast.LENGTH_SHORT).show();
                    }
                }
                return true;
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(
                    WebView view,
                    ValueCallback<Uri[]> callback,
                    FileChooserParams params) {
                if (pendingFileCallback != null) pendingFileCallback.onReceiveValue(null);
                pendingFileCallback = callback;
                if (params.isCaptureEnabled() && launchCamera()) return true;
                return launchFilePicker(params);
            }
        });
        webView.loadUrl("https://appassets.androidplatform.net/assets/www/app.html");
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    private boolean launchCamera() {
        Intent camera = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
        if (camera.resolveActivity(getPackageManager()) == null) return false;
        try {
            File captureDir = new File(getCacheDir(), "captures");
            if (!captureDir.exists() && !captureDir.mkdirs()) return false;
            File photo = File.createTempFile("brightpath_", ".jpg", captureDir);
            pendingCameraUri = FileProvider.getUriForFile(
                    this, getPackageName() + ".files", photo);
            camera.putExtra(MediaStore.EXTRA_OUTPUT, pendingCameraUri);
            camera.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
            startActivityForResult(camera, FILE_CHOOSER_REQUEST);
            return true;
        } catch (IOException | IllegalArgumentException exception) {
            pendingCameraUri = null;
            Toast.makeText(this, "Could not open the camera. Choose a saved photo instead.", Toast.LENGTH_SHORT).show();
            return false;
        }
    }

    private boolean launchFilePicker(WebChromeClient.FileChooserParams params) {
        try {
            Intent picker = new Intent(Intent.ACTION_OPEN_DOCUMENT);
            picker.addCategory(Intent.CATEGORY_OPENABLE);
            String[] acceptTypes = params.getAcceptTypes();
            List<String> mimeTypes = new ArrayList<>();
            for (String type : acceptTypes) {
                if (type != null && !type.trim().isEmpty()) mimeTypes.add(type.toLowerCase(Locale.ROOT));
            }
            if (mimeTypes.size() == 1) picker.setType(mimeTypes.get(0));
            else {
                picker.setType("*/*");
                if (!mimeTypes.isEmpty()) picker.putExtra(Intent.EXTRA_MIME_TYPES, mimeTypes.toArray(new String[0]));
            }
            if (params.getMode() == WebChromeClient.FileChooserParams.MODE_OPEN_MULTIPLE) {
                picker.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
            }
            startActivityForResult(picker, FILE_CHOOSER_REQUEST);
            return true;
        } catch (ActivityNotFoundException exception) {
            if (pendingFileCallback != null) pendingFileCallback.onReceiveValue(null);
            pendingFileCallback = null;
            Toast.makeText(this, "No file picker is available on this device.", Toast.LENGTH_LONG).show();
            return false;
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, @Nullable Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != FILE_CHOOSER_REQUEST || pendingFileCallback == null) return;
        Uri[] results = null;
        if (resultCode == Activity.RESULT_OK) {
            if (pendingCameraUri != null) {
                results = new Uri[]{pendingCameraUri};
            } else if (data != null) {
                if (data.getClipData() != null) {
                    int count = data.getClipData().getItemCount();
                    results = new Uri[count];
                    for (int i = 0; i < count; i++) results[i] = data.getClipData().getItemAt(i).getUri();
                } else if (data.getData() != null) results = new Uri[]{data.getData()};
            }
        }
        pendingFileCallback.onReceiveValue(results);
        pendingFileCallback = null;
        pendingCameraUri = null;
    }

    private void runInApp(String javascript) {
        runOnUiThread(() -> {
            if (webView != null) webView.evaluateJavascript(javascript, null);
        });
    }

    private void scheduleReminder(String title, String message, int minutes) {
        AlarmManager alarms = getSystemService(AlarmManager.class);
        if (alarms == null) {
            Toast.makeText(this, "Notifications are unavailable on this device.", Toast.LENGTH_LONG).show();
            return;
        }
        Intent intent = new Intent(this, ReminderReceiver.class);
        intent.putExtra("title", title);
        intent.putExtra("message", message);
        int id = (int) (System.currentTimeMillis() & 0x7FFFFFFF);
        intent.putExtra("notificationId", id);
        android.app.PendingIntent pending = android.app.PendingIntent.getBroadcast(
                this, id, intent,
                android.app.PendingIntent.FLAG_UPDATE_CURRENT | android.app.PendingIntent.FLAG_IMMUTABLE);
        long triggerAt = System.currentTimeMillis() + TimeUnit.MINUTES.toMillis(minutes);
        alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pending);
    }

    private final class BrightPathBridge {
        @JavascriptInterface
        public boolean isNativeApp() {
            return true;
        }

        @JavascriptInterface
        public void requestNotificationPermission() {
            runOnUiThread(() -> {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                        && ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.POST_NOTIFICATIONS)
                        != PackageManager.PERMISSION_GRANTED) {
                    requestPermissions(
                            new String[]{Manifest.permission.POST_NOTIFICATIONS},
                            NOTIFICATION_PERMISSION_REQUEST);
                } else {
                    Toast.makeText(MainActivity.this, "Notifications are ready on this device.", Toast.LENGTH_SHORT).show();
                }
            });
        }

        @JavascriptInterface
        public void scheduleNotification(String title, String message, int delayMinutes) {
            int safeDelay = Math.max(1, Math.min(delayMinutes, 30 * 24 * 60));
            String safeTitle = title == null ? "BrightPath reminder" : title.substring(0, Math.min(80, title.length()));
            String safeMessage = message == null ? "" : message.substring(0, Math.min(180, message.length()));
            runOnUiThread(() -> {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                        && ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.POST_NOTIFICATIONS)
                        != PackageManager.PERMISSION_GRANTED) {
                    pendingReminderTitle = safeTitle;
                    pendingReminderMessage = safeMessage;
                    pendingReminderMinutes = safeDelay;
                    requestPermissions(
                            new String[]{Manifest.permission.POST_NOTIFICATIONS},
                            NOTIFICATION_PERMISSION_REQUEST);
                } else {
                    scheduleReminder(safeTitle, safeMessage, safeDelay);
                    Toast.makeText(MainActivity.this, "Learning reminder scheduled.", Toast.LENGTH_SHORT).show();
                }
            });
        }
    }

    @Override
    public void onRequestPermissionsResult(
            int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode != NOTIFICATION_PERMISSION_REQUEST) return;
        if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
            if (pendingReminderTitle != null) {
                scheduleReminder(pendingReminderTitle, pendingReminderMessage, pendingReminderMinutes);
                pendingReminderTitle = null;
                pendingReminderMessage = null;
                Toast.makeText(this, "Learning reminder scheduled.", Toast.LENGTH_SHORT).show();
            } else {
                Toast.makeText(this, "BrightPath notifications are enabled.", Toast.LENGTH_SHORT).show();
            }
        } else {
            pendingReminderTitle = null;
            pendingReminderMessage = null;
            Toast.makeText(this, "Notifications are off. You can enable them in Android settings.", Toast.LENGTH_LONG).show();
        }
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.removeJavascriptInterface("BrightPathNative");
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
