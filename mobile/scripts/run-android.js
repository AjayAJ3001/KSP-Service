/**
 * Installs/launches the KSP Android app over USB.
 * Does not use Expo "development build" / Expo Go (those fail without expo-dev-client).
 */
const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PACKAGE = 'com.ksptransport.app';
const ACTIVITY = 'com.ksptransport.app.MainActivity';
const ROOT = path.resolve(__dirname, '..');
const ANDROID = path.join(ROOT, 'android');
const APK_DIR = path.join(ANDROID, 'app', 'build', 'outputs', 'apk', 'debug');

const args = new Set(process.argv.slice(2));
const forceRebuild = args.has('--rebuild');
const skipLaunch = args.has('--install-only');
const startMetro = args.has('--metro');

function run(cmd, opts = {}) {
  return execSync(cmd, {
    stdio: opts.silent ? 'pipe' : 'inherit',
    encoding: 'utf8',
    shell: true,
    cwd: opts.cwd,
    env: opts.env || process.env,
  });
}

function runOut(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', shell: true }).trim();
  } catch (err) {
    return String(err.stdout || err.stderr || '').trim();
  }
}

function requireDevice() {
  const out = runOut('adb devices');
  const devices = out
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.trim())
    .filter((line) => line.endsWith('\tdevice') || /\sdevice$/.test(line));
  if (!devices.length) {
    console.error('No Android phone/emulator found.');
    console.error('Connect USB, enable USB debugging, then run: adb devices');
    process.exit(1);
  }
  const serial = devices[0].split(/\s+/)[0];
  console.log('Device:', serial);
  return serial;
}

function findApk() {
  if (!fs.existsSync(APK_DIR)) return null;
  const files = fs
    .readdirSync(APK_DIR)
    .filter((name) => name.toLowerCase().endsWith('.apk'))
    .map((name) => {
      const full = path.join(APK_DIR, name);
      return { full, mtime: fs.statSync(full).mtimeMs };
    })
    .sort((a, b) => b.mtime - a.mtime);
  return files[0]?.full || null;
}

function isInstalled() {
  const out = runOut(`adb shell pm path ${PACKAGE}`);
  return /package:/.test(out);
}

function buildApk() {
  console.log('Building debug APK (this can take several minutes)...');
  const env = {
    ...process.env,
    GRADLE_USER_HOME: path.join(process.env.USERPROFILE || process.env.HOME || '', '.gradle'),
    NODE_ENV: 'development',
  };
  const gradlew = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';
  run(`${gradlew} assembleDebug`, { cwd: ANDROID, env });
}

function installApk(apkPath) {
  console.log('Installing', apkPath);
  const remote = '/data/local/tmp/ksp.apk';
  run(`adb push "${apkPath}" ${remote}`);
  const install = spawnSync('adb', ['shell', 'pm', 'install', '-r', '--user', '0', remote], {
    encoding: 'utf8',
  });
  const combined = `${install.stdout || ''}\n${install.stderr || ''}`;
  if (install.status !== 0 || /Failure|error/i.test(combined)) {
    console.log('pm install failed, trying adb install -r ...');
    run(`adb install -r "${apkPath}"`);
  } else {
    process.stdout.write(combined);
  }
}

function reversePorts() {
  for (const port of [8081, 5000]) {
    const result = spawnSync('adb', ['reverse', `tcp:${port}`, `tcp:${port}`], {
      encoding: 'utf8',
      timeout: 8000,
    });
    if (result.error && result.error.code === 'ETIMEDOUT') {
      console.warn(`adb reverse ${port} timed out (already forwarded?).`);
    } else if (result.status !== 0) {
      console.warn(`adb reverse ${port} skipped:`, (result.stderr || result.stdout || '').trim());
    }
  }
}

function launch() {
  console.log('Opening KSP Transport on the phone...');
  run(`adb shell am start -n ${PACKAGE}/${ACTIVITY}`);
}

function main() {
  requireDevice();
  reversePorts();

  let apk = findApk();
  const installed = isInstalled();

  if (forceRebuild || !apk) {
    buildApk();
    apk = findApk();
  }
  if (!apk) {
    console.error('No debug APK found after build.');
    process.exit(1);
  }
  if (forceRebuild || !installed) {
    installApk(apk);
  } else {
    console.log('KSP app already installed. Use npm run android -- --rebuild to reinstall.');
  }

  if (!skipLaunch) launch();

  console.log('Local backend: http://localhost:5000  (USB via adb reverse)');
  console.log('LAN backend:   http://192.168.1.11:5000');

  if (startMetro) {
    console.log('Starting Metro locally (not Expo Live / production). Keep this terminal open.');
    const expoBin = path.join(ROOT, 'node_modules', 'expo', 'bin', 'cli');
    const child = spawnSync(process.execPath, [expoBin, 'start'], {
      cwd: ROOT,
      stdio: 'inherit',
    });
    process.exit(child.status || 0);
  }
}

main();
