// Runs the Automatic Logging native (Kotlin) unit tests on the JVM: `npm run test:native`.
// Needs a JDK (17+) on JAVA_HOME. The first run downloads Gradle and Kotlin once.
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const dir = path.resolve(import.meta.dirname, '../modules/arthik-autolog/jvm-test');
const win = process.platform === 'win32';
const gradlew = path.join(dir, win ? 'gradlew.bat' : 'gradlew');
const r = spawnSync(win ? `"${gradlew}"` : gradlew, ['test', '--console=plain'], { cwd: dir, stdio: 'inherit', shell: win });
process.exit(r.status ?? 1);
