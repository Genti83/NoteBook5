import fs from 'fs';
import path from 'path';

const root = process.cwd();
const androidDir = path.join(root, 'android');
const appDir = path.join(androidDir, 'app');
const manifestPath = path.join(appDir, 'src', 'main', 'AndroidManifest.xml');
const stringsPath = path.join(appDir, 'src', 'main', 'res', 'values', 'strings.xml');
const gradlePath = path.join(appDir, 'build.gradle');
const variablesGradlePath = path.join(androidDir, 'variables.gradle');

const runNumber = Number(process.env.GITHUB_RUN_NUMBER || '1') || 1;
const explicitVersionCode = process.env.ANDROID_VERSION_CODE ? Number(process.env.ANDROID_VERSION_CODE) : null;
const versionCode = explicitVersionCode && explicitVersionCode > 0 ? explicitVersionCode : 320 + runNumber;
const pkgVersion = (() => {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    return pkg.version || '1.5.2';
  } catch {
    return '1.5.2';
  }
})();
const versionName = (process.env.ANDROID_VERSION_NAME || '').trim() || `${pkgVersion}.${runNumber}`;

console.log(`[configure-android] Configuring NoteBook3 Android build v${versionName} (versionCode=${versionCode})...`);

// 1. Ensure strings.xml has NoteBook3
if (fs.existsSync(stringsPath)) {
  let stringsXml = fs.readFileSync(stringsPath, 'utf8');
  stringsXml = stringsXml
    .replace(/<string name="app_name">[^<]*<\/string>/g, '<string name="app_name">NoteBook3</string>')
    .replace(/<string name="title_activity_main">[^<]*<\/string>/g, '<string name="title_activity_main">NoteBook3</string>')
    .replace(/<string name="package_name">[^<]*<\/string>/g, '<string name="package_name">com.notebook3.app</string>')
    .replace(/<string name="custom_url_scheme">[^<]*<\/string>/g, '<string name="custom_url_scheme">com.notebook3.app</string>');
  fs.writeFileSync(stringsPath, stringsXml, 'utf8');
  console.log('[configure-android] Updated strings.xml');
}

// 2. Inject Play-Store-compliant permissions and flags in AndroidManifest.xml
if (fs.existsSync(manifestPath)) {
  let manifest = fs.readFileSync(manifestPath, 'utf8');

  // Remove any legacy broad storage permissions if generated
  manifest = manifest.replace(/<uses-permission[^>]*MANAGE_EXTERNAL_STORAGE[^>]*\/>\s*/g, '');

  const requiredPermissions = [
    'android.permission.INTERNET',
    'android.permission.ACCESS_NETWORK_STATE',
    'android.permission.RECORD_AUDIO',
    'android.permission.VIBRATE',
    'android.permission.POST_NOTIFICATIONS',
    'android.permission.USE_BIOMETRIC',
    'android.permission.USE_FINGERPRINT',
  ];

  const permissionLinesToAdd = [];
  for (const perm of requiredPermissions) {
    if (!manifest.includes(`"${perm}"`)) {
      permissionLinesToAdd.push(`    <uses-permission android:name="${perm}" />`);
    }
  }

  const optionalFeatures = [
    'android.hardware.microphone',
    'android.hardware.fingerprint',
  ];
  for (const feat of optionalFeatures) {
    if (!manifest.includes(`"${feat}"`)) {
      permissionLinesToAdd.push(`    <uses-feature android:name="${feat}" android:required="false" />`);
    }
  }

  if (permissionLinesToAdd.length > 0) {
    manifest = manifest.replace(
      /(<manifest\b[^>]*>)/,
      `$1\n${permissionLinesToAdd.join('\n')}`
    );
  }

  // Ensure android:allowBackup="false" for privacy & Play Store security review
  if (manifest.includes('android:allowBackup="true"')) {
    manifest = manifest.replace(/android:allowBackup="true"/g, 'android:allowBackup="false"');
  } else if (!manifest.includes('android:allowBackup=')) {
    manifest = manifest.replace(/<application\b/, '<application android:allowBackup="false"');
  }

  // Android 11+ (API 30+) package visibility queries so local OEM calendar apps can be resolved without broad QUERY_ALL_PACKAGES
  if (!manifest.includes('android.intent.category.APP_CALENDAR')) {
    const queriesBlock = `    <queries>
        <intent>
            <action android:name="android.intent.action.MAIN" />
            <category android:name="android.intent.category.APP_CALENDAR" />
        </intent>
        <intent>
            <action android:name="android.intent.action.VIEW" />
            <data android:scheme="content" android:host="com.android.calendar" />
        </intent>
        <intent>
            <action android:name="android.intent.action.VIEW" />
            <data android:mimeType="text/calendar" />
        </intent>
    </queries>`;
    manifest = manifest.replace(/<\/manifest>/, `${queriesBlock}\n</manifest>`);
  }

  fs.writeFileSync(manifestPath, manifest, 'utf8');
  console.log('[configure-android] Updated AndroidManifest.xml with Play Store compliant permissions & calendar queries');
}

// 3. Ensure variables.gradle aligns minSdkVersion >= 24 and targetSdkVersion = 36
if (fs.existsSync(variablesGradlePath)) {
  let vars = fs.readFileSync(variablesGradlePath, 'utf8');
  vars = vars
    .replace(/minSdkVersion\s*=\s*\d+/g, 'minSdkVersion = 24')
    .replace(/compileSdkVersion\s*=\s*\d+/g, 'compileSdkVersion = 36')
    .replace(/targetSdkVersion\s*=\s*\d+/g, 'targetSdkVersion = 36');
  fs.writeFileSync(variablesGradlePath, vars, 'utf8');
  console.log('[configure-android] Updated variables.gradle (minSdk 24, compileSdk/targetSdk 36)');
}

// 4. Patch android/app/build.gradle for dynamic versionCode/versionName and optional release keystore
if (fs.existsSync(gradlePath)) {
  let gradle = fs.readFileSync(gradlePath, 'utf8');
  gradle = gradle
    .replace(/versionCode\s+\d+/g, `versionCode ${versionCode}`)
    .replace(/versionName\s+"[^"]*"/g, `versionName "${versionName}"`)
    .replace(/applicationId\s+"[^"]*"/g, 'applicationId "com.notebook3.app"');

  const hasReleaseSigningSecrets =
    fs.existsSync(path.join(appDir, 'release-keystore.jks')) &&
    Boolean(process.env.ANDROID_KEYSTORE_PASS) &&
    Boolean(process.env.ANDROID_KEY_ALIAS);

  if (hasReleaseSigningSecrets && !gradle.includes('signingConfigs')) {
    const signingBlock = `    signingConfigs {
        release {
            storeFile file("release-keystore.jks")
            storePassword System.getenv("ANDROID_KEYSTORE_PASS")
            keyAlias System.getenv("ANDROID_KEY_ALIAS")
            keyPassword System.getenv("ANDROID_KEY_PASS") ?: System.getenv("ANDROID_KEYSTORE_PASS")
        }
    }
    buildTypes {`;
    gradle = gradle.replace(/^\s*buildTypes\s*\{/m, signingBlock);
    gradle = gradle.replace(
      /(buildTypes\s*\{[\s\S]*?release\s*\{)/,
      `$1\n            signingConfig signingConfigs.release`
    );
    console.log('[configure-android] Configured Play Store release keystore signing');
  }

  fs.writeFileSync(gradlePath, gradle, 'utf8');
  console.log('[configure-android] Updated android/app/build.gradle');
}

// 5. Enhance MainActivity.java with NB3Device JavascriptInterface (OEM local non-Google calendar launch, Android 13+ notifications, native OS lock verification, WindowInsets & WebSettings)
const javaRoot = path.join(appDir, 'src', 'main', 'java', 'com', 'notebook3', 'app');
if (fs.existsSync(javaRoot)) {
  const mainActivityPath = path.join(javaRoot, 'MainActivity.java');
  const mainActivityJava = `package com.notebook3.app;

import android.app.Activity;
import android.app.KeyguardManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.hardware.biometrics.BiometricManager;
import android.hardware.biometrics.BiometricPrompt;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;
import java.util.List;

public class MainActivity extends BridgeActivity {
    private static final int NB3_NOTIF_PERMISSION_REQ = 3031;
    private static final int NB3_DEVICE_LOCK_REQ = 3032;
    private static final int NB3_AUDIO_PERMISSION_REQ = 3033;
    private static final String NB3_ALARM_CHANNEL_ID = "nb3_calendar_alarms";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        ensureNotificationChannel();

        View rootView = findViewById(android.R.id.content);
        if (rootView != null) {
            ViewCompat.setOnApplyWindowInsetsListener(rootView, (v, windowInsets) -> {
                Insets bars = windowInsets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.ime());
                v.setPadding(bars.left, bars.top, bars.right, bars.bottom);
                return WindowInsetsCompat.CONSUMED;
            });
        }

        if (this.getBridge() != null && this.getBridge().getWebView() != null) {
            WebView webView = this.getBridge().getWebView();
            WebSettings settings = webView.getSettings();
            settings.setDomStorageEnabled(true);
            settings.setDatabaseEnabled(true);
            settings.setMediaPlaybackRequiresUserGesture(false);
            webView.addJavascriptInterface(new NB3DeviceBridge(this, webView), "NB3Device");
        }
    }

    @Override
    @SuppressWarnings("deprecation")
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == NB3_DEVICE_LOCK_REQ) {
            boolean verified = resultCode == Activity.RESULT_OK;
            dispatchDeviceSecurityEvent(verified, !verified, false, "Android Device Lock (PIN / Pattern / Password)");
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == NB3_NOTIF_PERMISSION_REQ) {
            boolean granted = grantResults != null && grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;
            dispatchNotifPermissionEvent(granted);
        } else if (requestCode == NB3_AUDIO_PERMISSION_REQ) {
            boolean granted = grantResults != null && grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;
            dispatchAudioPermissionEvent(granted);
        }
    }

    private void dispatchNotifPermissionEvent(final boolean granted) {
        if (this.getBridge() == null || this.getBridge().getWebView() == null) return;
        final WebView webView = this.getBridge().getWebView();
        webView.post(() -> webView.evaluateJavascript(
            "window.dispatchEvent(new CustomEvent('nb3-notif-permission', { detail: { granted: " + (granted ? "true" : "false") + " } }));",
            null
        ));
    }

    private void dispatchAudioPermissionEvent(final boolean granted) {
        if (this.getBridge() == null || this.getBridge().getWebView() == null) return;
        final WebView webView = this.getBridge().getWebView();
        webView.post(() -> webView.evaluateJavascript(
            "window.dispatchEvent(new CustomEvent('nb3-audio-permission', { detail: { granted: " + (granted ? "true" : "false") + " } }));",
            null
        ));
    }

    private void dispatchDeviceSecurityEvent(final boolean verified, final boolean cancelled, final boolean noLock, final String method) {
        if (this.getBridge() == null || this.getBridge().getWebView() == null) return;
        final WebView webView = this.getBridge().getWebView();
        final String safeMethod = (method != null ? method : "Android Device Lock").replace("'", "\\'");
        webView.post(() -> webView.evaluateJavascript(
            "window.dispatchEvent(new CustomEvent('nb3-device-security', { detail: { verified: "
                + (verified ? "true" : "false")
                + ", cancelled: " + (cancelled ? "true" : "false")
                + ", noLock: " + (noLock ? "true" : "false")
                + ", method: '" + safeMethod + "' } }));",
            null
        ));
    }

    private void ensureNotificationChannel() {
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) {
                NotificationChannel channel = new NotificationChannel(
                    NB3_ALARM_CHANNEL_ID,
                    "NoteBook3 Calendar Alarms",
                    NotificationManager.IMPORTANCE_HIGH
                );
                channel.setDescription("Personal calendar reminders and appointment alarms");
                channel.enableVibration(true);
                nm.createNotificationChannel(channel);
            }
        }
    }

    public static class NB3DeviceBridge {
        private final MainActivity activity;
        private final WebView webView;

        public NB3DeviceBridge(MainActivity activity, WebView webView) {
            this.activity = activity;
            this.webView = webView;
        }

        private boolean isGoogleCalendarPkg(String pkg) {
            return pkg != null && (pkg.equals("com.google.android.calendar") || pkg.startsWith("com.google.android.calendar."));
        }

        @JavascriptInterface
        public boolean hasDeviceSecurityLock() {
            try {
                KeyguardManager km = (KeyguardManager) activity.getSystemService(Context.KEYGUARD_SERVICE);
                if (km == null) return false;
                if (Build.VERSION.SDK_INT >= 23) {
                    return km.isDeviceSecure();
                }
                return km.isKeyguardSecure();
            } catch (Exception ignored) {
                return false;
            }
        }

        @SuppressWarnings("deprecation")
        private void launchKeyguardCredential(KeyguardManager km, String title, String subtitle) {
            try {
                Intent intent = km.createConfirmDeviceCredentialIntent(title, subtitle);
                if (intent != null) {
                    activity.startActivityForResult(intent, NB3_DEVICE_LOCK_REQ);
                } else {
                    activity.dispatchDeviceSecurityEvent(false, false, true, "No Android Device Lock");
                }
            } catch (Exception ignored) {
                activity.dispatchDeviceSecurityEvent(false, false, true, "Device Lock Error");
            }
        }

        @JavascriptInterface
        public boolean verifyDeviceSecurity(final String title, final String subtitle) {
            final String safeTitle = (title != null && !title.trim().isEmpty()) ? title : "NoteBook3 Security";
            final String safeSubtitle = (subtitle != null && !subtitle.trim().isEmpty()) ? subtitle : "Verify phone PIN, Password, Pattern, or Biometrics";
            try {
                final KeyguardManager km = (KeyguardManager) activity.getSystemService(Context.KEYGUARD_SERVICE);
                if (km == null || !hasDeviceSecurityLock()) {
                    activity.dispatchDeviceSecurityEvent(false, false, true, "No Device Lock");
                    return false;
                }

                activity.runOnUiThread(() -> {
                    if (Build.VERSION.SDK_INT >= 30) {
                        try {
                            BiometricPrompt prompt = new BiometricPrompt.Builder(activity)
                                .setTitle(safeTitle)
                                .setSubtitle(safeSubtitle)
                                .setAllowedAuthenticators(
                                    BiometricManager.Authenticators.BIOMETRIC_STRONG
                                        | BiometricManager.Authenticators.BIOMETRIC_WEAK
                                        | BiometricManager.Authenticators.DEVICE_CREDENTIAL
                                )
                                .build();

                            prompt.authenticate(
                                new CancellationSignal(),
                                ContextCompat.getMainExecutor(activity),
                                new BiometricPrompt.AuthenticationCallback() {
                                    @Override
                                    public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) {
                                        activity.dispatchDeviceSecurityEvent(true, false, false, "Android Biometric / Device Lock");
                                    }

                                    @Override
                                    public void onAuthenticationError(int errorCode, CharSequence errString) {
                                        if (errorCode == BiometricPrompt.BIOMETRIC_ERROR_NO_BIOMETRICS
                                            || errorCode == BiometricPrompt.BIOMETRIC_ERROR_HW_NOT_PRESENT
                                            || errorCode == BiometricPrompt.BIOMETRIC_ERROR_HW_UNAVAILABLE
                                            || errorCode == BiometricPrompt.BIOMETRIC_ERROR_NO_DEVICE_CREDENTIAL) {
                                            launchKeyguardCredential(km, safeTitle, safeSubtitle);
                                        } else {
                                            activity.dispatchDeviceSecurityEvent(false, true, false, "Android Device Lock");
                                        }
                                    }

                                    @Override
                                    public void onAuthenticationFailed() {
                                        // User can retry inside the OS dialog
                                    }
                                }
                            );
                            return;
                        } catch (Exception ignored) {
                            // Fall back to KeyguardManager credential prompt below
                        }
                    }
                    launchKeyguardCredential(km, safeTitle, safeSubtitle);
                });
                return true;
            } catch (Exception ignored) {
                activity.dispatchDeviceSecurityEvent(false, false, false, "Unavailable");
                return false;
            }
        }

        @JavascriptInterface
        public boolean hasAudioPermission() {
            return ContextCompat.checkSelfPermission(activity, "android.permission.RECORD_AUDIO") == PackageManager.PERMISSION_GRANTED;
        }

        @JavascriptInterface
        public boolean requestAudioPermission() {
            if (hasAudioPermission()) {
                activity.dispatchAudioPermissionEvent(true);
                return true;
            }
            ActivityCompat.requestPermissions(
                activity,
                new String[] { "android.permission.RECORD_AUDIO" },
                NB3_AUDIO_PERMISSION_REQ
            );
            return false;
        }

        @JavascriptInterface
        public boolean openLocalCalendar(long epochMs) {
            try {
                PackageManager pm = activity.getPackageManager();
                String selfPkg = activity.getPackageName();

                // 1. Resolve via standard CATEGORY_APP_CALENDAR preferring local non-Google OEM calendar apps
                Intent catIntent = new Intent(Intent.ACTION_MAIN);
                catIntent.addCategory(Intent.CATEGORY_APP_CALENDAR);
                List<ResolveInfo> catMatches = pm.queryIntentActivities(catIntent, 0);
                if (catMatches != null) {
                    for (ResolveInfo ri : catMatches) {
                        if (ri.activityInfo == null) continue;
                        String pkg = ri.activityInfo.packageName;
                        if (pkg != null && !pkg.equals(selfPkg) && !isGoogleCalendarPkg(pkg)) {
                            Intent launch = new Intent(Intent.ACTION_MAIN);
                            launch.addCategory(Intent.CATEGORY_APP_CALENDAR);
                            launch.setClassName(pkg, ri.activityInfo.name);
                            launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                            try {
                                activity.startActivity(launch);
                                return true;
                            } catch (Exception ignored) {
                                Intent fallbackPkg = pm.getLaunchIntentForPackage(pkg);
                                if (fallbackPkg != null) {
                                    fallbackPkg.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                                    activity.startActivity(fallbackPkg);
                                    return true;
                                }
                            }
                        }
                    }
                }

                // 2. Resolve content://com.android.calendar/time/<epochMs> preferring non-Google handlers
                Intent timeIntent = new Intent(Intent.ACTION_VIEW, Uri.parse("content://com.android.calendar/time/" + epochMs));
                List<ResolveInfo> timeMatches = pm.queryIntentActivities(timeIntent, 0);
                if (timeMatches != null) {
                    for (ResolveInfo ri : timeMatches) {
                        if (ri.activityInfo == null) continue;
                        String pkg = ri.activityInfo.packageName;
                        if (pkg != null && !pkg.equals(selfPkg) && !isGoogleCalendarPkg(pkg)) {
                            Intent directTime = new Intent(Intent.ACTION_VIEW, Uri.parse("content://com.android.calendar/time/" + epochMs));
                            directTime.setClassName(pkg, ri.activityInfo.name);
                            directTime.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                            activity.startActivity(directTime);
                            return true;
                        }
                    }
                }

                // 3. Direct probe of widely installed non-Google local OEM / open-source Calendar packages
                String[] knownLocalCalendars = new String[] {
                    "com.samsung.android.calendar",
                    "com.sec.android.app.calendar",
                    "com.xiaomi.calendar",
                    "com.miui.calendar",
                    "com.huawei.calendar",
                    "com.hihonor.calendar",
                    "com.coloros.calendar",
                    "com.oppo.calendar",
                    "com.oneplus.calendar",
                    "com.vivo.calendar",
                    "com.bbk.calendar",
                    "com.android.calendar",
                    "com.htc.calendar",
                    "com.lge.calendar",
                    "com.asus.calendar",
                    "com.sonymobile.calendar",
                    "com.sonyericsson.calendar",
                    "com.lenovo.calendar",
                    "com.motorola.calendar",
                    "org.fossify.calendar",
                    "com.simplemobiletools.calendar.pro",
                    "com.simplemobiletools.calendar",
                    "ws.xsoh.etar"
                };
                for (String pkg : knownLocalCalendars) {
                    Intent oemLaunch = pm.getLaunchIntentForPackage(pkg);
                    if (oemLaunch != null) {
                        oemLaunch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        activity.startActivity(oemLaunch);
                        return true;
                    }
                }
            } catch (Exception ignored) {
            }
            return false;
        }

        @JavascriptInterface
        public boolean hasNotificationPermission() {
            if (Build.VERSION.SDK_INT < 33) {
                return true;
            }
            return ContextCompat.checkSelfPermission(activity, "android.permission.POST_NOTIFICATIONS") == PackageManager.PERMISSION_GRANTED;
        }

        @JavascriptInterface
        public boolean requestNotificationPermission() {
            if (Build.VERSION.SDK_INT < 33) {
                activity.dispatchNotifPermissionEvent(true);
                return true;
            }
            if (hasNotificationPermission()) {
                activity.dispatchNotifPermissionEvent(true);
                return true;
            }
            ActivityCompat.requestPermissions(
                activity,
                new String[] { "android.permission.POST_NOTIFICATIONS" },
                NB3_NOTIF_PERMISSION_REQ
            );
            return false;
        }

        @JavascriptInterface
        public boolean showLocalNotification(String title, String body) {
            try {
                if (Build.VERSION.SDK_INT >= 33 && !hasNotificationPermission()) {
                    return false;
                }
                NotificationManager nm = (NotificationManager) activity.getSystemService(Context.NOTIFICATION_SERVICE);
                if (nm == null) return false;
                int iconRes = activity.getApplicationInfo().icon;
                if (iconRes == 0) {
                    iconRes = android.R.drawable.ic_popup_reminder;
                }
                NotificationCompat.Builder builder = new NotificationCompat.Builder(activity, NB3_ALARM_CHANNEL_ID)
                    .setSmallIcon(iconRes)
                    .setContentTitle(title != null ? title : "NoteBook3")
                    .setContentText(body != null ? body : "")
                    .setPriority(NotificationCompat.PRIORITY_HIGH)
                    .setAutoCancel(true);
                int notifId = (int) (System.currentTimeMillis() & 0x7fffffff);
                nm.notify(notifId, builder.build());
                return true;
            } catch (Exception ignored) {
                return false;
            }
        }
    }
}
`;
  fs.writeFileSync(mainActivityPath, mainActivityJava, 'utf8');
  console.log('[configure-android] Updated MainActivity.java with local Calendar, Device Lock, Insets, & Notification bridge');
}

// 6. Install NoteBook3 v1.5.1 Play Store & Adaptive Launcher Icons into Android res/mipmap-*
const iconsSrcDir = path.join(root, '.github', 'android-icons');
const resDir = path.join(appDir, 'src', 'main', 'res');
if (fs.existsSync(iconsSrcDir) && fs.existsSync(resDir)) {
  const densities = ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi'];
  let copiedCount = 0;
  for (const density of densities) {
    const mipmapDir = path.join(resDir, `mipmap-${density}`);
    fs.mkdirSync(mipmapDir, { recursive: true });
    const launcherSrc = path.join(iconsSrcDir, `ic_launcher_${density}.png`);
    const fgSrc = path.join(iconsSrcDir, `ic_launcher_fg_${density}.png`);
    if (fs.existsSync(launcherSrc)) {
      fs.copyFileSync(launcherSrc, path.join(mipmapDir, 'ic_launcher.png'));
      fs.copyFileSync(launcherSrc, path.join(mipmapDir, 'ic_launcher_round.png'));
      copiedCount++;
    }
    if (fs.existsSync(fgSrc)) {
      fs.copyFileSync(fgSrc, path.join(mipmapDir, 'ic_launcher_foreground.png'));
      copiedCount++;
    }
  }
  const valuesDir = path.join(resDir, 'values');
  fs.mkdirSync(valuesDir, { recursive: true });
  const bgXmlPath = path.join(valuesDir, 'ic_launcher_background.xml');
  fs.writeFileSync(
    bgXmlPath,
    `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#123C9D</color>\n</resources>\n`,
    'utf8'
  );
  const colorsXmlPath = path.join(valuesDir, 'colors.xml');
  if (fs.existsSync(colorsXmlPath)) {
    let colorsXml = fs.readFileSync(colorsXmlPath, 'utf8');
    if (colorsXml.includes('name="ic_launcher_background"')) {
      colorsXml = colorsXml.replace(
        /<color name="ic_launcher_background">[^<]*<\/color>/g,
        '<color name="ic_launcher_background">#123C9D</color>'
      );
    } else {
      colorsXml = colorsXml.replace(
        '</resources>',
        '    <color name="ic_launcher_background">#123C9D</color>\n</resources>'
      );
    }
    fs.writeFileSync(colorsXmlPath, colorsXml, 'utf8');
  }
  console.log(`[configure-android] Installed NoteBook3 custom Play Store icons (${copiedCount} density assets + #123C9D background)`);
}


