/**
 * Module dependencies.
 */
var passport = require('passport-strategy')
  , totp = require('speakeasy').totp
  , util = require('util');


/**
 * `Strategy` constructor.
 *
 * The TOTP authentication strategy authenticates requests based on the
 * TOTP value submitted through an HTML-based form.
 *
 * Applications must supply a `setup` callback which accepts `user`, and then
 * calls the `done` callback supplying a `key` and `period` used to verify the
 * TOTP value.
 *
 * Optionally, `options` can be used to change the fields in which the
 * credentials are found.
 *
 * Options:
 *   - `codeField`  field name where the HOTP value is found, defaults to _code_
 *   - `window`     size of time step delay window, defaults to 6
 *
 * Examples:
 *
 *     passport.use(new TotpStrategy(
 *       function(user, done) {
 *         TotpKey.findOne({ userId: user.id }, function (err, key) {
 *           if (err) { return done(err); }
 *           return done(null, key.key, key.period);
 *         });
 *       }
 *     ));
 *
 * References:
 *  - [TOTP: Time-Based One-Time Password Algorithm](http://tools.ietf.org/html/rfc6238)
 *  - [KeyUriFormat](https://code.google.com/p/google-authenticator/wiki/KeyUriFormat)
 *
 * @param {Object} options
 * @param {Function} setup
 * @api public
 */
function Strategy(options, setup) {
  if (typeof options == 'function') {
    setup = options;
    options = {};
  }

  this._encoding = options.encoding || 'base32';
  this._codeField = options.codeField || 'code';
  this._window = options.window !== undefined ? options.window : 6;
  this._passReqToCallback = options.passReqToCallback || false;

  passport.Strategy.call(this);
  this._setup = setup;
  this.name = 'totp';
}

/**
 * Inherit from `passport.Strategy`.
 */
util.inherits(Strategy, passport.Strategy);

/**
 * Authenticate request based on TOTP values.
 *
 * @param {Object} req
 * @api protected
 */
Strategy.prototype.authenticate = function(req, options) {
  var value = lookup(req.body, this._codeField) || lookup(req.query, this._codeField);

  var self = this;

  function verified(err, key, period) {
    if (err) { return self.error(err); }

    var rv = totp.verify({
      secret: key,
      token: value,
      window: self._window,
      time: period,
      encoding: self._encoding,
    });

    if (!rv) { return self.fail(); }
    return self.success(req.user);
  }


  try {
    if (self._passReqToCallback) {
      this._setup(req, req.user, verified);
    } else {
      this._setup(req.user, verified);
    }
  } catch (ex) {
    return self.error(ex);
  }

  function lookup(obj, field) {
    if (!obj) { return null; }
    var chain = field.split(']').join('').split('[');
    for (var i = 0, len = chain.length; i < len; i++) {
      var prop = obj[chain[i]];
      if (typeof(prop) === 'undefined') { return null; }
      if (typeof(prop) !== 'object') { return prop; }
      obj = prop;
    }
    return null;
  }
}


/**
 * Expose `Strategy`.
 */
module.exports = Strategy;
