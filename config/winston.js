const env = require('./../.env');
const fs = require('fs');
const path = require('path');
const util = require('util');
const {exec} = require('child_process');
const logDir = './logs';
/**
 * @param {number} input
 */
const makeTwo = function(input) {
  const textInput = ''+input;
  return (textInput.length < 2 ? '0'+textInput : textInput);
};
/**
 * @param {number} input
 */
const makeThree = function(input) {
  let textInput = ''+input;
  while (textInput.length < 3) textInput = '0'+textInput;
  return textInput;
};
/**
 * @param {Date} date
 */
const dateFormat = function(date) {
  return ''+date.getFullYear()+'-'+makeTwo(date.getMonth()+1)+'-'+makeTwo(date.getDate())+'_'+
  makeTwo(date.getHours())+'-'+makeTwo(date.getMinutes())+'-'+makeTwo(date.getSeconds())+'-'+makeThree(date.getMilliseconds());
};

/** @type {Promise<void>[]} */
const promiseHandles = [];
/** @type {any[]} */
const appendQueue = [];

let logFile = path.resolve(__dirname, './../logs/app_'+dateFormat(new Date())+'.log');

const writeFile = util.promisify(fs.writeFile);

const readFile = util.promisify(fs.readFile);

const exists = util.promisify(fs.exists);

const newFile = async function() {
  contents = undefined;
  logFile = path.resolve(__dirname, './../logs/app_'+dateFormat(new Date())+'.log');
  if (!(await exists(logFile))) {
    await writeFile(logFile, '[]');
  }
};

const scheduleNewFile = async function() {
  const newLock = lock();
  promiseHandles.push(newLock.promise);
  if (promiseHandles.length>1) {
    await promiseHandles[promiseHandles.length - 2];
    promiseHandles.shift();
  }
  await newFile();
  try {
    await new Promise((resolve)=>{
      const date10 = new Date();
      date10.setDate(date10.getDate()-7);
      exec((process.platform === 'win32'?'del':'rm')+' '+path.join('logs', 'app_')+dateFormat(date10)+'*', function() {
        resolve(true);
      });
    });
  } catch (e) {
    //
  }
  newLock.resolve();
};

/** @type {any[] | undefined} */
let contents = undefined;

if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

if (!fs.existsSync(logFile)) {
  fs.writeFileSync(logFile, '[]');
}

setInterval(scheduleNewFile, 21600000); // 21600000 is 6 hrs

const lock = function() {
  const out = /** @type {{resolve: (data?: any) => void, reject: (reason?: any) => void, promise: Promise<void>}} */({
  });
  out.promise = new Promise(function(res, rej) {
    out.resolve = res;
    out.reject = rej;
  });
  return out;
};

/**
 * @param {any} json
 */
async function append(json) {
  appendQueue.push(json);
  const newLock = lock();
  promiseHandles.push(newLock.promise);
  if (promiseHandles.length>1) {
    await promiseHandles[promiseHandles.length - 2];
    promiseHandles.shift();
  }
  if (typeof contents === 'undefined') {
    const textContents = await readFile(logFile, {encoding: 'utf8'});
    try {
      contents = JSON.parse(textContents);
    } catch (e) {
      contents = [];
    }
  }
  try {
    if (typeof contents === 'string' || contents instanceof String) {
      contents = JSON.parse(contents+'');
    }
    if (contents) {
      contents.push(appendQueue.shift());
      await writeFile(logFile, JSON.stringify(contents, replaceErrors, 2));
      if (contents.length > 10000) {
        await newFile();
      }
    }
  } catch (e) {
    //
  }
  newLock.resolve();
}

/**
 * Flush the append queue to the log file
 */
function flush() {
  if (appendQueue.length > 0) {
    if (typeof contents === 'undefined') {
      const textContents = fs.readFileSync(logFile, {encoding: 'utf8'});
      try {
        contents = JSON.parse(textContents);
      } catch (e) {
        contents = [];
      }
    }
    if (typeof contents === 'string' || contents instanceof String) {
      contents = JSON.parse(contents+'');
    }
    if (contents) {
      while (appendQueue.length > 0) {
        contents.push(appendQueue.shift());
      }
      fs.writeFileSync(logFile, JSON.stringify(contents, replaceErrors, 2));
    }
  }
}

/**
 * @param {string} _key
 * @param {any} value
 */
function replaceErrors(_key, value) {
  if (value instanceof Error) {
    const error = {};

    Object.getOwnPropertyNames(value).forEach(function(transformKey) {
      const key = /** @type {keyof typeof error & keyof typeof value} */(transformKey);
      error[key] = value[key];
    });

    return error;
  }

  return value;
}

/**
 * Get stack trace and pop callsites until we get to the first call outside of winston.js and node_modules
 */
const getStackTrace = () => {
  const oldStackTrace = Error.prepareStackTrace;
  try {
    // eslint-disable-next-line handle-callback-err
    Error.prepareStackTrace = (err, structuredStackTrace) => structuredStackTrace;
    Error.captureStackTrace(this);
    const errorThis = /** @type {{stack: NodeJS.CallSite[]}} */(/** @type {unknown} */(this));
    const callSite = errorThis.stack.find((line) => {
      const fileName = line.getFileName();
      return fileName && fileName.indexOf('winston.js') < 0 &&
        fileName.indexOf('/node_modules/') < 0;
    });
    if (!callSite) {
      throw new Error('Failed to find call site');
    }
    const outputStack = errorThis.stack.slice(errorThis.stack.indexOf(callSite));
    // turn the stack trace into a string
    const stackTrace = outputStack.map((line) => {
      const fileName = line.getFileName();
      const lineNumber = line.getLineNumber();
      const columnNumber = line.getColumnNumber();
      const functionName = line.getFunctionName();
      return (functionName ? functionName+' ' : '')+'('+fileName+':'+lineNumber+':'+columnNumber+')';
    }).join('\n');
    return stackTrace;
  } finally {
    Error.prepareStackTrace = oldStackTrace;
  }
};

/**
 * Error formats can be of the following variations:
 * 1. Error
 * 3. {message: string, stack?: any, source?: string, instanceVariables?: {[key: string]: any}}
 * 10. string
 */

/**
 * @typedef {{
 * message: string,
 * stack?: any,
 * source?: string,
 * instanceVariables?: {[key: string]: any}
 * }} ManualErrorObject
 */

/**
 * @typedef {Error | ManualErrorObject | string} ErrorObject
 */

/**
 * @typedef {Map<string,
 * {
 *  unlockDate: Date,
 *  format: {
 *   message: any,
 *   instances: {
 *    timestamp: string,
 *    instanceVariables: {[key: string]: any} | undefined
 *   }[],
 *   level: 'error'
 *  }
 * }>} NotificationCache
 */

// We Yeet notifications to the developer when an error occurs. Yeet because we don't care what happens to them
const yeetNotification = (function() {
  const notificationChannel = env.NODE_ENV === 'development' ? 'local' : 'wide';
  const maxNotificationsPerHour = notificationChannel === 'local' ? 100 : 5;
  const newQueueEjectDate = function() {
    return new Date(new Date().getTime()+3600000);
  };
  // when in local mode, we want to send notifications immediately, but when in production,
  //   we want to send duplicate notifications once an hour at most
  const notificationCacheTimeout = notificationChannel === 'local' ? 1000 : 3600000;
  const newCacheUnlockDate = function() {
    return new Date(new Date().getTime()+notificationCacheTimeout);
  };
  /** @type {{expireAt: Date}[]} */
  const notificationQueue = [];
  /** @type {NotificationCache} */
  const notificationCache = new Map();

  const sendNotification = notificationChannel === 'local' ? (function() {
    /**
     * @param {object} notification
     */
    return async function(notification) {
    };
  })() : (function() {
    /**
     * @param {object} notification
     */
    return async function(notification) {
    };
  })();

  /**
   * @param {{message: any, timestamp: string, level: 'error', stack?: any}} notification
   */
  return async function(notification) {
    const output = notification;
    // we need to serialize the error object to see if we've already sent an notification about it in the last hour
    try {
      const serialized = typeof output.message === 'string' ? output.message :
        ('instanceVariables' in output.message) ? JSON.stringify(Object.omit(output.message, 'instanceVariables'), replaceErrors) :
          JSON.stringify(output.message, replaceErrors);
      const cached = notificationCache.get(serialized);
      if (cached && cached.unlockDate > new Date()) {
        // we've already sent an notification about this error in the last hour
        cached.format.instances.push({
          timestamp: output.timestamp,
          instanceVariables: ('instanceVariables' in Object(output.message)) ? Object(output.message).instanceVariables : undefined
        });
        return;
      } else if (cached) {
        // we've already sent an notification about this error, but it was longer than our timeout ago so we can send it now
        cached.unlockDate = newCacheUnlockDate();
        cached.format.instances.push({
          timestamp: output.timestamp,
          instanceVariables: ('instanceVariables' in Object(output.message)) ? Object(output.message).instanceVariables : undefined
        });
        const notificationViewOption = cached.format;
        if (notificationQueue.length >= maxNotificationsPerHour && notificationQueue[0].expireAt > new Date()) {
          return;
        } else if (notificationQueue.length >= maxNotificationsPerHour) {
          while (notificationQueue.length > 0 && notificationQueue[0].expireAt < new Date()) {
            notificationQueue.shift();
          }
        }
        notificationQueue.push({
          expireAt: newQueueEjectDate()
        });
        await sendNotification(notificationViewOption);
        cached.format.instances = [];
        return;
      } else {
        const unlockDate = newCacheUnlockDate();
        notificationCache.set(serialized, {
          unlockDate,
          format: {
            // we make a copy of the message so the original can be garbage collected
            message: JSON.parse(JSON.stringify(output.message, replaceErrors)),
            instances: [],
            level: 'error'
          }
        });
      }
      if (notificationQueue.length >= maxNotificationsPerHour && notificationQueue[0].expireAt > new Date()) {
        // we've already sent too many notifications in the last hour, so we shouldn't send another one
        const cache = notificationCache.get(serialized);
        if (!cache) {
          return;
        }
        cache.format.instances.push({
          timestamp: output.timestamp,
          instanceVariables: ('instanceVariables' in Object(output.message)) ? Object(output.message).instanceVariables : undefined
        });
        return;
      } else if (notificationQueue.length >= maxNotificationsPerHour) {
        while (notificationQueue.length > 0 && notificationQueue[0].expireAt < new Date()) {
          notificationQueue.shift();
        }
      }
      notificationQueue.push({
        expireAt: newQueueEjectDate()
      });
      await sendNotification(output);
    } catch (e) {
      // eslint-disable-next-line no-unused-vars
      const _caughtError = e;
      // we don't want to get stuck in a loop, so we catch errors here
    }
  };
})();

process.on('exit', function() {
  if (contents) {
    flush();
  }
});

process.on('uncaughtException', function(/** @type {unknown} */ err) {
  module.exports.unknownError(err);
  flush();
  process.exit(1);
});

module.exports = {
  /**
   * @param {any} input
   */
  info: async function(input) {
    const json = {
      level: 'info',
      timestamp: (new Date()).toString(),
      message: input
    };
    if (typeof input.stack !== 'undefined') {
      append(Object.assign({}, json, {stack: input.stack}));
      return;
    }
    append(json);
  },
  /**
   * @param {ErrorObject} input
   */
  error: async function(input) {
    const json = {
      /** @type {'error'} */
      level: 'error',
      timestamp: (new Date()).toString(),
      message: input
    };
    // @ts-ignore
    const middleOutput = /** @type {typeof json & {stack?: any}} */(/** @type {unknown} */((typeof input.stack !== 'undefined') ?
      // @ts-ignore
      Object.assign(json, {stack: input.stack}) : json));
    // @ts-ignore
    if (!middleOutput.stack && !middleOutput.message?.source) {
      // we don't have a stack trace, so we need to get one
      const stackTrace = getStackTrace();
      middleOutput.stack = stackTrace;
    }
    const output = /** @type {typeof middleOutput & {stack: any}} */(middleOutput);
    append(output);
    setImmediate(function() {
      if (output.message !== 'Request Error: invalid csrf token') {
        yeetNotification(output);
      }
    });
  },
  /**
   * @param {unknown} input
   */
  unknownError: async function(input) {
    if (input instanceof Error) {
      return await this.error(input);
    } else {
      return await this.error({
        message: 'Error of nondeterminant type',
        instanceVariables: {
          source: input
        }
      });
    }
  },
  /**
   * @param {any} input
   */
  debug: async function(input) {
    const json = {
      level: 'debug',
      timestamp: (new Date()).toString(),
      message: input
    };
    if (typeof input.stack !== 'undefined') {
      append(Object.assign({}, json, {stack: input.stack}));
      return;
    }
    append(json);
  }
};
