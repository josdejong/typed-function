var assert = require('assert');
var typed = require('../typed-function');

describe('any type', function () {

  it('should compose a function with one any type argument', function() {
    var fn = typed({
      'any': function (value) {
        return 'any:' + value;
      },
      'string': function (value) {
        return 'string:' + value;
      },
      'boolean': function (value) {
        return 'boolean:' + value;
      }
    });

    assert(fn.signatures instanceof Object);
    assert.strictEqual(Object.keys(fn.signatures).length, 3);
    assert.equal(fn(2), 'any:2');
    assert.equal(fn([1,2,3]), 'any:1,2,3');
    assert.equal(fn('foo'), 'string:foo');
    assert.equal(fn(false), 'boolean:false');
  });

  it('should compose a function with multiple any type arguments (1)', function() {
    var fn = typed({
      'any,boolean': function () {
        return 'any,boolean';
      },
      'any,string': function () {
        return 'any,string';
      }
    });

    assert(fn.signatures instanceof Object);
    assert.strictEqual(Object.keys(fn.signatures).length, 2);
    assert.equal(fn([],true), 'any,boolean');
    assert.equal(fn(2,'foo'), 'any,string');
    assert.throws(function () {fn([], new Date())}, /TypeError: Unexpected type of argument \(expected: string or boolean, actual: Date, index: 1\)/);
    assert.throws(function () {fn(2, 2)},           /TypeError: Unexpected type of argument \(expected: string or boolean, actual: number, index: 1\)/);
    assert.throws(function () {fn(2)},              /TypeError: Too few arguments \(expected: string or boolean, index: 1\)/);
  });

  it('should compose a function with multiple any type arguments (2)', function() {
    var fn = typed({
      'any,boolean': function () {
        return 'any,boolean';
      },
      'any,number': function () {
        return 'any,number';
      },
      'string,any': function () {
        return 'string,any';
      }
    });

    assert(fn.signatures instanceof Object);
    assert.strictEqual(Object.keys(fn.signatures).length, 3);
    assert.equal(fn([],true), 'any,boolean');
    assert.equal(fn([],2), 'any,number');
    assert.equal(fn('foo', 2), 'string,any');
    assert.throws(function () {fn([], new Date())}, /TypeError: Unexpected type of argument \(expected: number or boolean, actual: Date, index: 1\)/);
    assert.throws(function () {fn([], 'foo')},      /TypeError: Unexpected type of argument \(expected: number or boolean, actual: string, index: 1\)/)
  });

  it('should compose a function with multiple any type arguments (3)', function() {
    var fn = typed({
      'string,any': function () {
        return 'string,any';
      },
      'any': function () {
        return 'any';
      }
    });

    assert(fn.signatures instanceof Object);
    assert.strictEqual(Object.keys(fn.signatures).length, 2);
    assert.equal(fn('foo', 2), 'string,any');
    assert.equal(fn([]), 'any');
    assert.throws(function () {fn('foo')}, /TypeError: Too few arguments \(expected: any, index: 1\)/);
    assert.throws(function () {fn([], 'foo')}, /TypeError: Too many arguments \(expected: 1, actual: 2\)/);
  });

  it('var arg any type arguments should only handle unmatched types', function() {
    var fn = typed({
      'Array,string': function () {
        return 'Array,string';
      },
      '...': function () {
        return 'any';
      }
    });

    assert.equal(fn([], 'foo'), 'Array,string');
    assert.equal(fn('string'), 'any');
    assert.equal(fn(2), 'any');
    assert.throws(function () {fn([])}, /TypeError: Too few arguments \(expected: string, index: 1\)/);
  });

});
