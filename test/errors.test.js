var assert = require('assert');
var typed = require('../typed-function');

describe('errors', function () {
  it('should give correct error in case of too few arguments', function() {
    var fn = typed('string, boolean', function () {});

    assert.throws(function () {fn()}, /TypeError: Too few arguments \(expected: string, index: 0\)/);
    assert.throws(function () {fn('foo')}, /TypeError: Too few arguments \(expected: boolean, index: 1\)/);
  });

  it('should give correct error in case of too few arguments (varArgs)', function() {
    var fn = typed('...string', function () {});

    assert.throws(function () {fn()}, /TypeError: Too few arguments \(expected: string, index: 0\)/);
  });

  it('should give correct error in case of too few arguments (varArgs) (2)', function() {
    var fn = typed('boolean, ...string', function () {});

    assert.throws(function () {fn()}, /TypeError: Too few arguments \(expected: boolean, index: 0\)/);
    assert.throws(function () {fn(true)}, /TypeError: Too few arguments \(expected: string, index: 1\)/);
  });

  it('should give correct error in case of too many arguments', function() {
    var fn = typed('string, boolean', function () {});

    assert.throws(function () {fn('foo', true, 2)}, /TypeError: Too many arguments \(expected: 2, actual: 3\)/);
    assert.throws(function () {fn('foo', true, 2, 1)}, /TypeError: Too many arguments \(expected: 2, actual: 4\)/);
  });

  it('should give correct error in case of wrong type of argument', function() {
    var fn = typed('boolean', function () {});

    assert.throws(function () {fn('foo')}, /TypeError: Unexpected type of argument \(expected: boolean, actual: string, index: 0\)/);
  });

  it('should give correct error in case of wrong type of argument (union args)', function() {
    var fn = typed('boolean | string | Date', function () {});

    assert.throws(function () {fn(2)}, /TypeError: Unexpected type of argument \(expected: boolean or string or Date, actual: number, index: 0\)/);
  });

  it('should give correct error in case of conflicting union arguments', function() {
    assert.throws(function () {
      var fn = typed({
        'string | number': function () {},
        'string': function () {}
      });
    }, /Error: Signature "string" defined multiple times/);
  });

  it('should give correct error in case of conflicting union arguments (2)', function() {
    assert.throws(function () {
      var fn = typed({
        '...string | number': function () {},
        '...string': function () {}
      });
    }, /Error: Signature "string" defined multiple times/);
  });

  it('should give correct error in case of wrong type of argument (varArgs)', function() {
    var fn = typed('...number', function () {});

    assert.throws(function () {fn(true)}, /TypeError: Unexpected type of argument \(expected: number, actual: boolean, index: 0\)/);
    assert.throws(function () {fn(2, true)}, /TypeError: Unexpected type of argument \(expected: number, actual: boolean, index: 1\)/);
    assert.throws(function () {fn(2, 3, true)}, /TypeError: Unexpected type of argument \(expected: number, actual: boolean, index: 2\)/);
  });

  it('should give correct error in case of wrong type of argument (nested varArgs)', function() {
    var fn = typed('string, ...number', function () {});

    assert.throws(function () {fn(true)}, /TypeError: Unexpected type of argument \(expected: string, actual: boolean, index: 0\)/);
    assert.throws(function () {fn('foo', true)}, /TypeError: Unexpected type of argument \(expected: number, actual: boolean, index: 1\)/);
    assert.throws(function () {fn('foo', 2, true)}, /TypeError: Unexpected type of argument \(expected: number, actual: boolean, index: 2\)/);
    assert.throws(function () {fn('foo', 2, 3, true)}, /TypeError: Unexpected type of argument \(expected: number, actual: boolean, index: 3\)/);
  });

  it('should give correct error in case of wrong type of argument (union and varArgs)', function() {
    var fn = typed('...number|boolean', function () {});

    assert.throws(function () {fn('foo')}, /TypeError: Unexpected type of argument \(expected: number or boolean, actual: string, index: 0\)/);
    assert.throws(function () {fn(2, 'foo')}, /TypeError: Unexpected type of argument \(expected: number or boolean, actual: string, index: 1\)/);
    assert.throws(function () {fn(2, true, 'foo')}, /TypeError: Unexpected type of argument \(expected: number or boolean, actual: string, index: 2\)/);
  });
});
