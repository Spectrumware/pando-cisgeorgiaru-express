/* jshint -W079 */
/* jshint -W124 */
const express = require('express');
const path = require('path');
const fs = require('fs');
const favicon = require('serve-favicon');
// const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const cookieSession = require('cookie-session');
const methodOverride = require('method-override');
const parser = require('express-busboy');
const csrf = require('csurf');
const aleet = require('aleet');

// Load environment configuration with fallback
let env;
try {
  env = require('./.env');
  console.log('App: Loaded configuration from .env.js');
} catch (error) {
  console.log('App: .env.js not found, using default configuration');
  env = {
    NODE_ENV: process.env.NODE_ENV || 'production',
    app: {
      title: process.env.APP_TITLE || 'Reality U CIS Georgia',
      domain: process.env.APP_DOMAIN || '',
      topDomain: process.env.APP_TOP_DOMAIN || 'cisgeorgiaru.org',
      workerID: parseInt(process.env.APP_WORKER_ID || '1', 10)
    }
  };
}

const publicPaths = require('./routes/public');

process.on('uncaughtException', function(err) {
  console.error('Uncaught Exception:', (err && err.stack) ? err.stack: err);
  throw err;
});

const app = express();

// @ts-ignore (we are adding a new property to the app object)
app.locals.title = env.app.title;

aleet.config({
  debug: env.NODE_ENV === 'development',
  viewPath: path.join(__dirname, 'views'),
  /**
   * @param {string} input
   * @returns {Promise<string>}
   */
  cssProcessor: async function(input) {
    return input;
  },
  /**
   * @param {Error | string} err
   */
  log: function(err) {
    if (err instanceof Error) {
      console.error('Aleet Error:', err);
    } else if (typeof err === 'string') {
      console.error('Aleet Parse Error:', err);
    }
  }
});

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.engine('html', (filepath, options, callback) => {
  aleet(filepath, options, (/** @type {any} */ err, /** @type {string} */ html) => {
    if (err) {
      callback(err, html);
      return;
    }
    callback(null, html);
  });
});

if (env.NODE_ENV === 'development') {
  app.disable('view cache');
}
app.locals.basedir = path.join(__dirname, 'views');

// uncomment after placing your favicon in /public
// @ts-ignore (the typings for favicon are wrong)
app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
if (env.NODE_ENV === 'production') {
  // app.use(bugsnag.requestHandler);
}
if (env.NODE_ENV === 'development') {
  // app.use(morgan('combined', {
  //   stream: winston.stream
  // }));
}
parser.extend(app, {
  upload: true,
  path: './uploads/',
  /**
   * @param {string} url
   * @returns {boolean}
   */
  allowedPath: function(url) {
    return url == '/user/upload' || url == '/admin/templateImages';
  },
  mimeTypeLimit: [
    'image/jpeg',
    'image/png',
    'application/pdf'
  ]
});

// @ts-ignore (the typings for app.use are wrong)
app.use(cookieParser());

// @ts-ignore (the typings for app.use are wrong)
app.use(methodOverride(function(req) {
  if (typeof req.body._method !== 'undefined') {
    if (req.body._method.toUpperCase() === 'DELETE') {
      return 'delete';
    } else if (req.body._method.toUpperCase() === 'PUT') {
      return 'put';
    }
  }
  return 'post';
}));

app.use(express.static(path.join(__dirname, 'public')));

// @ts-ignore (the typings for app.use are wrong)
app.use(csrf({
  cookie: true
}));

// @ts-ignore (the typings for app.use are wrong)
app.use(cookieSession({
  name: 'session',
  secret: 'my-secret',
  overwrite: true,
  // @ts-ignore (cookieSession typings are wrong)
  secure: (env.NODE_ENV === 'development' ? false : true)
}));

app.use('/', publicPaths);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  // console.log(req.originalUrl);
  const err = new Error('Not Found');
  // @ts-ignore (Adding a new property to the error object)
  err.status = 404;
  next(err);
});

if (env.NODE_ENV === 'production') {
  // app.use(bugsnag.errorHandler);
}

// error handler
app.use(
  /**
  * @param {any} err
  * @param {express.Request} rawReq
  * @param {express.Response} res
  * @param {Function} next
  */
  function(err, rawReq, res, next) {
    const req = /** @type {MyRequest<typeof rawReq>} */(rawReq);
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};

    console.error('Request Error:', {
      message: err.message,
      status: err.status || 500,
      url: req.originalUrl,
      method: req.method,
      ip: req.ip,
      stack: req.app.get('env') === 'development' ? err.stack : undefined
    });

    // render the error page
    res.status(err.status || 500);
    if (err.status === 404) {
      res.render('public/404.html');
    } else {
      res.render('public/error.html');
    }
    return;
  }
);

module.exports = app;
