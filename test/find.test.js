var assert = require('assert');
var typed = require('../typed-function');

describe('find', function () {

  var a =  function a () {};
  var b =  function b () {};
  var c =  function c () {};
  var d =  function d () {};

  var fn = typed({
    'number': a,
    'string, ...number': b,
    'number, boolean': c,
    'any': d
  });


  it('should find a signature from an array with types', function() {
    assert.strictEqual(typed.find(fn, ['number']), a);
    assert.strictEqual(typed.find(fn, ['number', 'boolean']), c);
    assert.strictEqual(typed.find(fn, ['any']), d);

  });

  it('should find a signature from a comma separated string with types', function() {
    assert.strictEqual(typed.find(fn, 'number'), a);
    assert.strictEqual(typed.find(fn, 'number,boolean'), c);
    assert.strictEqual(typed.find(fn, ' number, boolean '), c); // with spaces
    assert.strictEqual(typed.find(fn, 'any'), d);
  });


  // TODO: implement support for matching non-exact signatures
  //assert.strictEqual(typed.find(fn, ['Array']), d);


});
