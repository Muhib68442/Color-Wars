# Android Build and Release Runbook

This is the practical, machine-specific runbook for building Color Wars as an
Android APK. The design contract, supported versions, and device matrix live in
[`ANDROID.md`](ANDROID.md); this file is the copy-paste checklist.

> **Status:** built. The Android project, icons, splash screens, versioning, and
> back-button adapter are in place. The debug APK for `1.0.1` was produced and
> verified (package `com.muhib.colorwars`, version code `10001`).
> Follow §4 for routine rebuilds and §6 for the next release.
>
> Built artifact: `android/app/build/outputs/apk/debug/app-debug.apk`

---

## 1. Fixed values

| Value | Current | Where it is controlled |
| --- | --- | --- |
| App name | `Color Wars` | `capacitor.config.ts` → `appName` |
| Package ID | `com.muhib.colorwars` | `capacitor.config.ts` → `appId` (permanent) |
| Version | `1.0.1` | `package.json` → `version` (single source of truth) |
| Version code | `10001` | Derived from the version: `major*10000 + minor*100 + patch` |
| Icon | Home-screen logo | `assets/logo.svg` and `assets/logo-dark.svg` |
| Web assets | `dist/` | Vite build, copied by `npx cap sync android` |
| Debug APK | `android/app/build/outputs/apk/debug/app-debug.apk` | `npm run android:debug` |
| Release APK | `android/app/build/outputs/apk/release/app-release.apk` | `gradlew.bat assembleRelease` |
| Release AAB | `android/app/build/outputs/bundle/release/app-release.aab` | `gradlew.bat bundleRelease` |

The About screen reads the same `package.json` version through Vite, so the web
and Android version strings can never disagree.

The package ID **must never change** after the first Play Store upload. Changing
it produces a different app with a different install base. The app name can
change; the package ID cannot.

---

## 2. One-time Windows toolchain setup

The installed Android Studio is 2022.3 with JDK 17 and has no SDK. Capacitor 8
needs JDK 21 and SDK 36, so install the portable toolchain on `F:` (C: is low on
space). These commands do not require an installer or administrator rights.

```powershell
$ErrorActionPreference = "Stop"
$root = "F:\Android"
New-Item -ItemType Directory -Force $root | Out-Null

# --- JDK 21 (portable) ---
$jdkZip = "$env:TEMP\jdk21.zip"
Invoke-WebRequest `
  "https://api.adoptium.net/v3/binary/latest/21/ga/windows/x64/jdk/hotspot/normal/eclipse" `
  -OutFile $jdkZip
Expand-Archive $jdkZip -DestinationPath $root -Force
$jdk = Get-ChildItem "$root\jdk-21*" -Directory | Select-Object -First 1
if ($null -eq $jdk) { throw "JDK 21 archive did not extract" }
if (-not (Test-Path "$root\jdk-21")) {
  Rename-Item $jdk.FullName "$root\jdk-21"
}

# --- Android command-line tools ---
$sdk = "$root\Sdk"
$cliZip = "$env:TEMP\android-cmdline-tools.zip"
Invoke-WebRequest `
  "https://dl.google.com/android/repository/commandlinetools-win-16111833_latest.zip" `
  -OutFile $cliZip
New-Item -ItemType Directory -Force "$sdk\cmdline-tools" | Out-Null
Expand-Archive $cliZip -DestinationPath "$sdk\cmdline-tools" -Force
if (Test-Path "$sdk\cmdline-tools\latest") {
  Remove-Item "$sdk\cmdline-tools\latest" -Recurse -Force
}
Rename-Item "$sdk\cmdline-tools\cmdline-tools" "$sdk\cmdline-tools\latest"

# --- Session environment ---
$env:JAVA_HOME = "$root\jdk-21"
$env:ANDROID_HOME = $sdk
$env:ANDROID_SDK_ROOT = $sdk
$env:GRADLE_USER_HOME = "F:\gradle-home"
$env:Path = "$env:JAVA_HOME\bin;$sdk\platform-tools;$sdk\cmdline-tools\latest\bin;$env:Path"

# --- SDK packages and licences ---
& "$sdk\cmdline-tools\latest\bin\sdkmanager.bat" --licenses
& "$sdk\cmdline-tools\latest\bin\sdkmanager.bat" `
  "platform-tools" "platforms;android-36" "build-tools;36.0.0"

# --- Verify ---
java -version
adb version
```

`GRADLE_USER_HOME` is optional; it keeps the Gradle cache off the nearly-full C:
drive. If you open the project in Android Studio later, set
**Settings → Build, Execution, Deployment → Build Tools → Gradle → Gradle JDK**
to `F:\Android\jdk-21`.

Each new PowerShell window needs the environment block from `# --- Session
environment ---` again, or create a small `android-env.ps1` that sets it.

---

## 3. One-time project setup

Run from the repository root, in a PowerShell window where `java -version` shows
21 and `ANDROID_HOME` is set:

```powershell
npm install @capacitor/core@8.6.0 @capacitor/android@8.6.0 @capacitor/app@8.1.2
npm install -D @capacitor/cli@8.6.0 @capacitor/assets@4.0.0

npx cap add android
npm run android:assets
```

`npx cap add android` reads `capacitor.config.ts` and creates `android/` with the
package ID `com.muhib.colorwars`. Commit the generated `android/` directory, but
never commit `android/local.properties`, `android/keystore.properties`, or any
`*.keystore` file.

Create `android/local.properties` so Gradle finds the SDK:

```properties
sdk.dir=F:\\Android\\Sdk
```

`npm run android:assets` turns `assets/logo.svg` / `assets/logo-dark.svg` into
the adaptive launcher icons and splash screens. Replace those SVGs and rerun the
command whenever the logo changes.

### 3.1 Version code from `package.json` (already applied)

`android/app/build.gradle` reads the repository root `package.json` so the Gradle
version cannot drift from the web version. This is the applied configuration:

```groovy
def packageJson = new groovy.json.JsonSlurper().parseText(
    file("../../package.json").text
)
def appVersionName = packageJson.version.toString()
def (appMajor, appMinor, appPatch) = appVersionName.tokenize(".").collect { it as int }
```

Then replace the generated `versionCode` / `versionName` in `defaultConfig`:

```groovy
defaultConfig {
    applicationId "com.muhib.colorwars"
    versionCode appMajor * 10000 + appMinor * 100 + appPatch
    versionName appVersionName
    // keep the rest of the generated Capacitor values
}
```

`1.0.1` therefore becomes version code `10001`. Keep versions plain
`major.minor.patch`; do not add `-beta` suffixes because the Gradle parser
expects integers.

### 3.2 Android back button (already applied)

Keep the existing web platform adapters, but connect the hardware/gesture back
button to the app controller. `src/platform/backButton.ts` contains:

```ts
import { App as CapacitorApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";

/** Returns true when the back press was consumed by the app. */
export function installBackButton(handleBack: () => boolean): void {
  if (!Capacitor.isNativePlatform()) return;

  void CapacitorApp.addListener("backButton", () => {
    if (!handleBack()) void CapacitorApp.exitApp();
  });
}
```

Call it from `src/main.ts` after `createApp`:

```ts
import { installBackButton } from "./platform/backButton.js";

installBackButton(() => app.handleBack());
```

`app.handleBack()` already closes an open dialog, opens the pause menu from a
live match, returns from How to play / Settings / About, and returns `false` on
the home screen so Android can close the app.

---

## 4. Build

Always rebuild the web assets before syncing:

```powershell
npm test
npm run android:debug
```

Or step by step:

```powershell
npm run build
npx cap sync android
cd android
.\gradlew.bat assembleDebug
```

The debug APK is at:

```text
android\app\build\outputs\apk\debug\app-debug.apk
```

Install it on a USB-connected phone with debugging enabled:

```powershell
adb install -r android\app\build\outputs\apk\debug\app-debug.apk
adb logcat | findstr "Capacitor chromium"
```

No emulator or physical device is required to produce the APK.

---

## 5. Release signing (for Play Store or a shareable APK)

This step is **not** needed for the debug build. Do it once and keep the files
safe.

### 5.1 Create the keystore

```powershell
keytool -genkeypair -v `
  -keystore colorwars-release.keystore `
  -alias colorwars `
  -keyalg RSA -keysize 2048 -validity 10000
```

Use a strong password and store it in a password manager. The keystore is
gitignored by `*.keystore`. **Back it up offline.** If it is lost, you cannot
update an app that was not enrolled in Play App Signing.

### 5.2 Add the signing properties

Create `android/keystore.properties` (gitignored):

```properties
storeFile=../../colorwars-release.keystore
storePassword=YOUR_STORE_PASSWORD
keyAlias=colorwars
keyPassword=YOUR_KEY_PASSWORD
```

In `android/app/build.gradle`, load it before `android {`:

```groovy
def keystoreProperties = new Properties()
def keystorePropertiesFile = rootProject.file("keystore.properties")
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}
```

Add the signing config inside `android { ... }`:

```groovy
signingConfigs {
    release {
        if (keystorePropertiesFile.exists()) {
            storeFile file(keystoreProperties["storeFile"])
            storePassword keystoreProperties["storePassword"]
            keyAlias keystoreProperties["keyAlias"]
            keyPassword keystoreProperties["keyPassword"]
        }
    }
}
buildTypes {
    release {
        signingConfig signingConfigs.release
        minifyEnabled false
        shrinkResources false
    }
}
```

### 5.3 Build and verify

```powershell
cd android
.\gradlew.bat assembleRelease
.\gradlew.bat bundleRelease
```

Verify the artifact with the build-tools binaries:

```powershell
& "$env:ANDROID_HOME\build-tools\36.0.0\aapt.exe" dump badging `
  app\build\outputs\apk\release\app-release.apk |
  findstr "package: sdkVersion targetSdkVersion uses-permission"

& "$env:ANDROID_HOME\build-tools\36.0.0\apksigner.bat" verify --print-certs `
  app\build\outputs\apk\release\app-release.apk
```

Confirm the package ID, version name/code, SDK levels, permissions, and
signature before installing or uploading.

---

## 6. Future releases: what to change

Only these values normally change:

1. **Version** — edit `package.json` `version`.
   - `1.0.1` → version code `10001`
   - `1.0.2` → `10002`
   - `1.1.0` → `10100`
   - `2.0.0` → `20000`
   - The Android `versionName`/`versionCode` and the About screen follow
     automatically once §3.1 is applied.
2. **App name** — edit `capacitor.config.ts` `appName`, then `npx cap sync
   android`. Also update `android/app/src/main/res/values/strings.xml`
   (`app_name`) if Capacitor does not overwrite it.
3. **Icon / splash** — replace `assets/logo.svg` and
   `assets/logo-dark.svg`, then run `npm run android:assets`.
4. **Code / UI** — normal web development; always run `npm test` and `npm run
   android:debug` so the bundled assets are refreshed.

Never change:

- `appId` / `applicationId` (`com.muhib.colorwars`) after the first upload.
- The keystore or its alias/passwords. Losing them blocks updates.
- `versionCode` to a value lower than or equal to a version already uploaded.

Release checklist:

```text
[ ] package.json version bumped
[ ] npm test && npm run build pass
[ ] npx cap sync android
[ ] release APK + AAB built and signed
[ ] aapt / apksigner verification passed
[ ] release APK installed on a clean device
[ ] AAB uploaded to Play internal testing
[ ] git tag created for the release commit
[ ] keystore + mapping.txt + lockfile archived
```

---

## 7. Current machine notes

- Node 22.20, npm 10.9, Chrome, and network access are available.
- JDK 21 is at `F:\Software Program Data\JDK21`.
- Android SDK is at `F:\Software Program Data\Android SDK` with Platform 36,
  Build-Tools 35.0.0, and Platform-Tools; `adb` is on the SDK path.
- Gradle 8.14.3 and the build cache live in `F:\gradle-home`.
- Android Studio 2022.3 with JDK 17 is installed at
  `F:\Software Program Data\Android Studio`; it is **not** used by this runbook.
- The `android/` project exists and `npm run android:debug` produces the debug
  APK. The same environment variables as §2 are needed in each new shell:
  `JAVA_HOME`, `ANDROID_HOME`, `ANDROID_SDK_ROOT`, `GRADLE_USER_HOME`, `Path`.
