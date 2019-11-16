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

  describe('handling a request with valid token field in body', function() {
    var strategy = new Strategy({ codeField: 'token' }, function(user, done) {
      if (user.secret) {
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
          req.body.token = speakeasy.totp({ secret: req.user.secret, encoding: 'base32' });
        })
        .authenticate();
    });

    it('should supply user', function() {
      expect(user.username).to.be.a.string;
      expect(user.secret).to.equal(userTest.secret);

    });
  });
});
