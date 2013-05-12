var totp = require('index');


describe('passport-totp', function() {
    
  it('should export version', function() {
    expect(totp.version).to.be.a('string');
  });
    
  it('should export Strategy', function() {
    expect(totp.Strategy).to.be.a('function');
  });
  
});
