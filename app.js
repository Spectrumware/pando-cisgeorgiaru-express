/* jshint -W079 */
/* jshint -W124 */
const express = require('express');
const winston = require('./config/winston');
const path = require('path');
const fs = require('fs');
const favicon = require('serve-favicon');
// const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const cookieSession = require('cookie-session');
const methodOverride = require('method-override');
const parser = require('express-busboy');
const csrf = require('csurf');
const env = require('./.env');
const aleet = require('aleet');

const publicPaths = require('./routes/public');

process.stdout.write = /** @type {(text: string) => true} */(function(text) {
  winston.info(text);
  return true;
});

process.stderr.write = /** @type {(text: string) => true} */(function(text) {
  winston.unknownError(text);
  return true;
});

process.on('uncaughtException', function(err) {
  // console.error((err && err.stack) ? err.stack: err);
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
      winston.unknownError(err);
    } else if (typeof err === 'string') {
      // this is a function string that failed to parse, log an error and then write the function string to a file
      const fileName = 'view-error-'+Date.now()+'.js';
      winston.unknownError(new Error('Failed to parse function string, writing to file: '+fileName));
      try {
        fs.writeFileSync(path.resolve(__dirname, 'logs', fileName), err, 'utf8');
      } catch (e) {
        // ignore
      }
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

    winston.error({
      message: 'Request Error: '+err.message,
      instanceVariables: {
        status: err.status || 500,
        url: req.originalUrl,
        method: req.method,
        ip: req.ip
      }
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
