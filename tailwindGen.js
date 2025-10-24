// @ts-check
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const childProcess = require('child_process');

const fileArgs = process.argv.slice(2);

/**
 * @template T
 * @param {T} value
 * @returns {NonNullable<T>}
 */
function assert(value) {
  if (typeof value === 'undefined' || value === null) {
    throw new Error('Value is undefined or null');
  }
  return value;
}

const TailwindBuildManager = {
  lock: false,
  callAfterLock: false,
  debounceTime: 0
};

/**
 */
function updateTailwindBuild() {
  if (TailwindBuildManager.lock) {
    if (new Date().getTime() - TailwindBuildManager.debounceTime > 200) {
      TailwindBuildManager.callAfterLock = true;
    }
    return;
  }
  TailwindBuildManager.lock = true;
  TailwindBuildManager.callAfterLock = false;
  TailwindBuildManager.debounceTime = new Date().getTime();
  // get start time
  const startTime = new Date().getTime();
  console.log('Rebuilding Tailwind CSS...');

  try {
    // call tailwindcss cli to build the css
    const result = childProcess
      .spawnSync('node', ['node_modules/tailwindcss/lib/cli.js', 'build', '-i', 'public/css/source.css', '-o', 'public/css/main.css']);
    if (result.error) {
      throw result.error;
    } else if (result.stdout.length > 0) {
      console.log(result.stdout.toString());
    } else if (result.stderr.length > 0) {
      throw new Error(result.stderr.toString());
    }
  } catch (e) {
    console.error(e);
  }

  console.log('Updated Tailwind CSS build: ' + (new Date().getTime() - startTime) + 'ms');
  TailwindBuildManager.lock = false;
  if (TailwindBuildManager.callAfterLock) {
    setImmediate(updateTailwindBuild);
  }
}

/**
 * @param {Map<string, {time: number, hash: string}>} debounceMap
 * @param {string} filename
 */
function proceedIfFiveSecondsHAveEllapsed(debounceMap, filename) {
  if (!debounceMap.has(filename)) {
    const hasher = crypto.createHash('sha256');
    hasher.update(fs.readFileSync(filename));
    const hash = hasher.digest('base64');
    debounceMap.set(filename, {time: (new Date()).getTime(), hash: hash});
    return true;
  } else {
    const debounce = assert(debounceMap.get(filename));
    if (new Date().getTime() - debounce.time > 5000) {
      const hasher = crypto.createHash('sha256');
      hasher.update(fs.readFileSync(filename));
      const hash = hasher.digest('base64');
      if (hash !== debounce.hash) {
        debounceMap.set(filename, {time: (new Date()).getTime(), hash: hash});
        return true;
      } else {
        return false;
      }
    } else {
      return false;
    }
  }
}

if (fileArgs.includes('--watch')) {
  const watchDebounce = new Map();
  fs.watch('views', {recursive: true}, async (eventType, filename) => {
    if (eventType !== 'change') {
      return;
    }
    if (filename) {
      const fullPath = path.join(__dirname, 'views', filename);
      if (filename.endsWith('.html') || filename.endsWith('.css') || filename.endsWith('.js')) {
        if (proceedIfFiveSecondsHAveEllapsed(watchDebounce, fullPath)) {
          try {
            updateTailwindBuild();
          } catch (e) {
            console.error(e);
          }
        }
      }
    }
  });
  setInterval(() => {
    watchDebounce.forEach((value, key) => {
      if (new Date().getTime() - value > 5000) {
        watchDebounce.delete(key);
      }
    });
  }, 30);
} else {
  updateTailwindBuild();
}
