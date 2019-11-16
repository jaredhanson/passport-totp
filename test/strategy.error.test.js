/* global describe, it, expect, before */

var chai = require('chai')
  , speakeasy = require('speakeasy')
  , Strategy = require('../lib/strategy');


describe('Strategy', function() {
  let user = {};

  before(function (done) {
    user.username = 'johndoe';
    user.secret = speakeasy.generateSecret().base32;

    done();
  });


  describe('encountering an error during verification', function() {
    var strategy = new Strategy(function(user, done) {
      done(new Error('something went wrong'));
    });

    var err;

    before(function(done) {
      chai.passport.use(strategy)
        .error(function(e) {
          err = e;
          done();
        })
        .req(function(req) {
          req.user = user;
          req.body = {};
          req.body.code = '123456';
        })
        .authenticate();
    });

    it('should error', function() {
      expect(err).to.be.an.instanceof(Error);
      expect(err.message).to.equal('something went wrong');
    });
  });

  describe('encountering an exception during verification', function() {
    var strategy = new Strategy(function(user, done) {
      throw new Error('something went horribly wrong');
    });

    var err;

    before(function(done) {
      chai.passport.use(strategy)
        .error(function(e) {
          err = e;
          done();
        })
        .req(function(req) {
          req.user = user;
          req.body = {};
          req.body.code = '123456';
        })
        .authenticate();
    });

    it('should error', function() {
      expect(err).to.be.an.instanceof(Error);
      expect(err.message).to.equal('something went horribly wrong');
    });
  });

});
