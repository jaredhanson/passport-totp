/* global describe, it, expect, before */
/* jshint expr: true */

var chai = require('chai')
  , speakeasy = require('speakeasy')
  , Strategy = require('../lib/strategy');


describe('Strategy', function() {

  let userTest = {};

  before(function (done) {
    userTest.username = 'johndoe';
    userTest.secret = speakeasy.generateSecret().base32;

    done();
  });

  describe('passing request to verify callback', function() {
    var strategy = new Strategy({passReqToCallback: true}, function(req, user, done) {
      if (user.secret === userTest.secret) {
        return done(null, user.secret);
      }
      return done(null, false);
    });

    var user
      , info;

    before(function(done) {
      chai.passport.use(strategy)
        .success(function(u, i) {
          user = u;
          info = i;
          done();
        })
        .req(function(req) {
          req.user = userTest;

          req.body = {};
          req.body.code = speakeasy.totp({ secret: req.user.secret, encoding: 'base32' });
        })
        .authenticate();
    });

    it('should supply user', function() {
      expect(user.username).to.be.a.string;
      expect(user.secret).to.equal(userTest.secret);

    });
  });

  describe('passing window option', function() {
    const window = 60;
    var strategy = new Strategy({ window }, function(user, done) {
      if (user.secret) {
        return done(null, user.secret);
      }
      return done(null, false);
    });

    it('should window option', function() {
      const strategyTest = chai.passport.use(strategy);

      expect(strategyTest._strategy._window).to.equal(window);
    });
  });

  describe('passing encoding option', function() {
    const encoding = 'sha512';
    var strategy = new Strategy({ encoding }, function(user, done) {
      if (user.secret) {
        return done(null, user.secret);
      }
      return done(null, false);
    });

    it('should encoding option', function() {
      const strategyTest = chai.passport.use(strategy);

      expect(strategyTest._strategy._encoding).to.equal(encoding);
    });
  });

});
