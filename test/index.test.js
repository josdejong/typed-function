// test parse
var assert = require('assert');
var compose = require('../index');

describe('parse', function() {

  it('should compose a function with zero arguments', function() {
    var fns = {
      '': function () {
        return 'noargs';
      }
    };
    var fn = compose(fns);

    assert.equal(fn(), 'noargs');
    assert(fn.signatures instanceof Object);
    assert.strictEqual(Object.keys(fn.signatures).length, 1);
    assert.strictEqual(fn.signatures[''], fns['']);
  });

  it('should create a named function', function() {
    var fn = compose('myFunction',  {
      '': function () {
        return 'noargs';
      }
    });

    assert.equal(fn(), 'noargs');
    assert.equal(fn.name, 'myFunction');
  });

  it('should compose a function with one argument', function() {
    var fns = {
      'number': function (value) {
        return 'number:' + value;
      },
      'string': function (value) {
        return 'string:' + value;
      },
      'boolean': function (value) {
        return 'boolean:' + value;
      }
    };
    var fn = compose(fns);

    assert.equal(fn(2), 'number:2');
    assert.equal(fn('hi'), 'string:hi');
    assert.equal(fn(false), 'boolean:false');
    assert(fn.signatures instanceof Object);
    assert.strictEqual(Object.keys(fn.signatures).length, 3);
    assert.strictEqual(fn.signatures['number'], fns['number']);
    assert.strictEqual(fn.signatures['string'], fns['string']);
    assert.strictEqual(fn.signatures['boolean'], fns['boolean']);
  });

  it('should compose a function with multiple arguments', function() {
    var fns = {
      'number': function (value) {
        return 'number:' + value;
      },
      'string': function (value) {
        return 'string:' + value;
      },
      'number, boolean': function (a, b) { // mind space after the comma, should be normalized by composer
        return 'number,boolean:' + a + ',' + b;
      }
    };
    var fn = compose(fns);

    assert.equal(fn(2), 'number:2');
    assert.equal(fn('hi'), 'string:hi');
    assert.equal(fn(2, false), 'number,boolean:2,false');
    assert(fn.signatures instanceof Object);
    assert.strictEqual(Object.keys(fn.signatures).length, 3);
    assert.strictEqual(fn.signatures['number'], fns['number']);
    assert.strictEqual(fn.signatures['string'], fns['string']);
    assert.strictEqual(fn.signatures['number,boolean'], fns['number, boolean']);
  });

  it('should throw an error when providing an unsupported type of argument', function() {
    var fn = compose({
      'number': function (value) {
        return 'number:' + value;
      }
    });

    assert.throws(function () {fn(new Date())}, /TypeError: Wrong function signature/);
  });

  it('should throw an error when providing a wrong number of arguments', function() {
    var fn = compose({
      'number': function (value) {
        return 'number:' + value;
      }
    });

    assert.throws(function () {fn(1, 2)}, /TypeError: Wrong number of arguments/); // TODO: should be changed into an ArgumentsError?
  });


  // TODO: test compose.types
});
