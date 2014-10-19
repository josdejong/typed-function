// test parse
var assert = require('assert');
var compose = require('../index');

describe('parse', function() {

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
    assert.strictEqual(fn.signatures['number'], fns['number']);
    assert.strictEqual(fn.signatures['string'], fns['string']);
    assert.strictEqual(fn.signatures['boolean'], fns['boolean']);
    assert.strictEqual(Object.keys(fn.signatures).length, 3);
  });

  it('should throw an error when providing an unsupported type of argument', function() {
    var fn = compose({
      'number': function (value) {
        return 'number:' + value;
      }
    });

    assert.throws(function () {fn(new Date())}, /TypeError: date not supported/);
  });

  it.skip('should throw an error when providing a wrong number of arguments', function() {
    var fn = compose({
      'number': function (value) {
        return 'number:' + value;
      }
    });

    assert.throws(function () {fn(1, 2)}, /ArgumentError: wrong number of arguments/);
  });

});
