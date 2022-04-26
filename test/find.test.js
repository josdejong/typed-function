var assert = require('assert');
var typed = require('../typed-function');

describe('find', function () {

  function a () {}
  function b () {}
  function c () {}
  function d () {}
  function e () {}

  var fn = typed('fn', {
    'number': a,
    'string, ...number': b,
    'number, boolean': c,
    'any': d,
    '': e
  });


  it('should findSignature from an array with types', function() {
    assert.strictEqual(typed.findSignature(fn, ['number']).fn, a);
    assert.strictEqual(typed.findSignature(fn, ['number', 'boolean']).fn, c);
    assert.strictEqual(typed.findSignature(fn, ['any']).fn, d);
    assert.strictEqual(typed.findSignature(fn, []).fn, e);
  });

  it('should find a signature from an array with types', function() {
    assert.strictEqual(typed.find(fn, ['number']), a);
    assert.strictEqual(typed.find(fn, ['number', 'boolean']), c);
    assert.strictEqual(typed.find(fn, ['any']), d);
    assert.strictEqual(typed.find(fn, []), e);

  });

  it('should findSignature from a comma separated string with types', function() {
    assert.strictEqual(typed.findSignature(fn, 'number').fn, a);
    assert.strictEqual(typed.findSignature(fn, 'number,boolean').fn, c);
    assert.strictEqual(typed.findSignature(fn, ' number, boolean ').fn, c); // with spaces
    assert.strictEqual(typed.findSignature(fn, 'any').fn, d);
    assert.strictEqual(typed.findSignature(fn, '').fn, e);
  });

  it('should find a signature from a comma separated string with types', function() {
    assert.strictEqual(typed.find(fn, 'number'), a);
    assert.strictEqual(typed.find(fn, 'number,boolean'), c);
    assert.strictEqual(typed.find(fn, ' number, boolean '), c); // with spaces
    assert.strictEqual(typed.find(fn, 'any'), d);
    assert.strictEqual(typed.find(fn, ''), e);
  });

  it('should throw an error when not found', function() {
    assert.throws(function () {
      typed.find(fn, 'number, number');
    }, /TypeError: Signature not found \(signature: fn\(number, number\)\)/);
  });

  it('should handle non-exact matches as requested', function() {
    const t2 = typed.create();
    t2.addConversion({
      from: 'number',
      to: 'string',
      convert: n => '' + n + ' much'
    });
    const greeting = s => 'Hi ' + s;
    const greet = t2('greet', { string: greeting });
    const greetNumberSignature = t2.findSignature(greet, 'number');
    const greetNumber = t2.find(greet, 'number');
    assert.strictEqual(greetNumberSignature.fn, greeting);
    assert.strictEqual(greetNumber(42), 'Hi 42 much');
    assert.throws(
      () => t2.findSignature(greet, 'number', 'exact'),
      /Signature not found/);
    assert.throws(
      () => t2.find(greet, 'number', 'exact'),
      TypeError);
    assert.strictEqual(t2.find(greet, 'string'), greeting);
  });

});
