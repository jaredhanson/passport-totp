var express = require('express')
  , flash = require('connect-flash')
  , loggedin = require('connect-ensure-login')
  , base32 = require('thirty-two')
  , utils = require('./utils')
  , passport = require('passport')
  , LocalStrategy = require('passport-local').Strategy
  , TotpStrategy = require('../..').Strategy
  

var users = [
    { id: 1, username: 'bob', password: 'secret', email: 'bob@example.com' }
  , { id: 2, username: 'joe', password: 'birthday', email: 'joe@example.com' }
];

var keys = {}

function findById(id, fn) {
  var idx = id - 1;
  if (users[idx]) {
    fn(null, users[idx]);
  } else {
    fn(new Error('User ' + id + ' does not exist'));
  }
}

function findByUsername(username, fn) {
  for (var i = 0, len = users.length; i < len; i++) {
    var user = users[i];
    if (user.username === username) {
      return fn(null, user);
    }
  }
  return fn(null, null);
}

function findKeyForUserId(id, fn) {
  return fn(null, keys[id]);
}

function saveKeyForUserId(id, key, fn) {
  keys[id] = key;
  return fn(null);
}


// Passport session setup.
//   To support persistent login sessions, Passport needs to be able to
//   serialize users into and deserialize users out of the session.  Typically,
//   this will be as simple as storing the user ID when serializing, and finding
//   the user by ID when deserializing.
passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  findById(id, function (err, user) {
    done(err, user);
  });
});


// Use the LocalStrategy within Passport.
//   Strategies in passport require a `verify` function, which accept
//   credentials (in this case, a username and password), and invoke a callback
//   with a user object.  In the real world, this would query a database;
//   however, in this example we are using a baked-in set of users.
passport.use(new LocalStrategy(function(username, password, done) {
    process.nextTick(function () {
      // Find the user by username.  If there is no user with the given
      // username, or the password is not correct, set the user to `false` to
      // indicate failure and set a flash message.  Otherwise, return the
      // authenticated `user`.
      findByUsername(username, function(err, user) {
        if (err) { return done(err); }
        if (!user) { return done(null, false, { message: 'Invalid username or password' }); }
        if (user.password != password) { return done(null, false, { message: 'Invalid username or password' }); }
        return done(null, user);
      })
    });
  }));

passport.use(new TotpStrategy(
  function(user, done) {
    // setup function, supply key and period to done callback
    findKeyForUserId(user.id, function(err, obj) {
      if (err) { return done(err); }
      return done(null, obj.key, obj.period);
    });
  }
));



var app = express();

// configure Express
app.configure(function() {
  app.set('views', __dirname + '/views');
  app.set('view engine', 'ejs');
  app.engine('ejs', require('ejs-locals'));
  app.use(express.static(__dirname + '/../../public'));
  app.use(express.logger());
  app.use(express.cookieParser());
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.session({ secret: 'keyboard cat' }));
  app.use(flash());
  // Initialize Passport!  Also use passport.session() middleware, to support
  // persistent login sessions (recommended).
  app.use(passport.initialize());
  app.use(passport.session());
  app.use(app.router);
});


app.get('/', function(req, res){
  res.render('index', { user: req.user });
});

// To view account details, user must be authenticated using two factors
app.get('/account', loggedin.ensureLoggedIn(), ensureSecondFactor, function(req, res){
  res.render('account', { user: req.user });
});

app.get('/setup', loggedin.ensureLoggedIn(), function(req, res, next){
  findKeyForUserId(req.user.id, function(err, obj) {
    if (err) { return next(err); }
    if (obj) {
      // two-factor auth has already been setup
      var encodedKey = base32.encode(obj.key);
      
      // generate QR code for scanning into Google Authenticator
      // reference: https://code.google.com/p/google-authenticator/wiki/KeyUriFormat
      var otpUrl = 'otpauth://totp/' + req.user.email
                 + '?secret=' + encodedKey + '&period=' + (obj.period || 30);
      var qrImage = 'https://chart.googleapis.com/chart?chs=166x166&chld=L|0&cht=qr&chl=' + encodeURIComponent(otpUrl);
      
      res.render('setup', { user: req.user, key: encodedKey, qrImage: qrImage });
    } else {
      // new two-factor setup.  generate and save a secret key
      var key = utils.randomKey(10);
      var encodedKey = base32.encode(key);
      
      // generate QR code for scanning into Google Authenticator
      // reference: https://code.google.com/p/google-authenticator/wiki/KeyUriFormat
      var otpUrl = 'otpauth://totp/' + req.user.email
                 + '?secret=' + encodedKey + '&period=30';
      var qrImage = 'https://chart.googleapis.com/chart?chs=166x166&chld=L|0&cht=qr&chl=' + encodeURIComponent(otpUrl);
  
      saveKeyForUserId(req.user.id, { key: key, period: 30 }, function(err) {
        if (err) { return next(err); }
        res.render('setup', { user: req.user, key: encodedKey, qrImage: qrImage });
      });
    }
  });
});

app.get('/login', function(req, res){
  res.render('login', { user: req.user, message: req.flash('error') });
});

// POST /login
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  If authentication fails, the user will be redirected back to the
//   login page.  Otherwise, the primary route function function will be called,
//   which, in this example, will redirect the user to the home page.
//
//   curl -v -d "username=bob&password=secret" http://127.0.0.1:3000/login
app.post('/login', 
  passport.authenticate('local', { failureRedirect: '/login', failureFlash: true }),
  function(req, res) {
    res.redirect('/');
  });

app.get('/login-otp', loggedin.ensureLoggedIn(),
  function(req, res, next) {
    // If user hasn't set up two-factor auth, redirect
    findKeyForUserId(req.user.id, function(err, obj) {
      if (err) { return next(err); }
      if (!obj) { return res.redirect('/setup'); }
      return next();
    });
  },
  function(req, res) {
    res.render('login-otp', { user: req.user, message: req.flash('error') });
  });

app.post('/login-otp', 
  passport.authenticate('totp', { failureRedirect: '/login-otp', failureFlash: true }),
  function(req, res) {
    req.session.secondFactor = 'totp';
    res.redirect('/');
  });

app.get('/logout', function(req, res){
  req.logout();
  res.redirect('/');
});

app.listen(3000, function() {
  console.log('Express server listening on port 3000');
});


function ensureSecondFactor(req, res, next) {
  if (req.session.secondFactor == 'totp') { return next(); }
  res.redirect('/login-otp')
}
