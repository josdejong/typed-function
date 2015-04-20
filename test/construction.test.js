// test parse
var assert = require('assert');
var typed = require('../typed-function');

describe('construction', function() {

  it('should throw an error when not providing any signatures', function() {
    assert.throws(function () {
      typed({});
    }, /Error: No signatures provided/);
  });

  it('should create a named function', function() {
    var fn = typed('myFunction',  {
      'string': function (str) {
        return 'foo';
      }
    });

    assert.equal(fn('bar'), 'foo');
    assert.equal(fn.name, 'myFunction');
  });

  it('should create an unnamed function', function() {
    var fn = typed('string', function (str) {
      return 'foo';
    });

    assert.equal(fn('bar'), 'foo');
    assert.equal(fn.name, '');
  });

  it('should inherit the name of the function implementation', function() {
    var fn = typed('string', function fn1 (str) {
      return 'foo';
    });

    assert.equal(fn('bar'), 'foo');
    assert.equal(fn.name, 'fn1');
  });

  it('should compose a function with zero arguments', function() {
    var signatures = {
      '': function () {
        return 'noargs';
      }
    };
    var fn = typed(signatures);

    assert.equal(fn(), 'noargs');
    assert(fn.signatures instanceof Object);
    assert.strictEqual(Object.keys(fn.signatures).length, 1);
    assert.strictEqual(fn.signatures[''], signatures['']);
  });

  it('should create a typed function with one argument', function() {
    var fn = typed('string', function () {
      return 'string';
    });

    assert.equal(fn('hi'), 'string');
  });

  it('should create a typed function with two arguments', function() {
    var fn = typed('string, boolean', function () {
      return 'foo';
    });

    assert.equal(fn('hi', true), 'foo');
  });

  it('should create a named, typed function', function() {
    var fn = typed('myFunction', 'string, boolean', function () {
      return 'noargs';
    });

    assert.equal(fn('hi', true), 'noargs');
    assert.equal(fn.name, 'myFunction');
  });

  it('should correctly recognize Date from Object (both are an Object)', function() {
    var signatures = {
      'Object': function (value) {
        assert(value instanceof Object);
        return 'Object';
      },
      'Date': function (value) {
        assert(value instanceof Date);
        return 'Date';
      }
    };
    var fn = typed(signatures);

    assert.equal(fn({foo: 'bar'}), 'Object');
    assert.equal(fn(new Date()), 'Date');
  });

  it('should create a new, isolated instance of typed-function', function() {
    var typed2 = typed.create();
    function Person() {}

    typed.types['Person'] = function (x) {
      return x instanceof Person;
    };

    assert.strictEqual(typed.create, typed2.create);
    assert.notStrictEqual(typed.types, typed2.types);
    assert.notStrictEqual(typed.conversions, typed2.conversions);

    typed('Person', function (p) {return 'Person'});

    assert.throws(function () {
      typed2('Person', function (p) {return 'Person'});
    }, /Error: Unknown type "Person"/)
  });

  it('should throw an error when providing an unsupported type of argument', function() {
    var fn = typed({
      'number': function (value) {
        return 'number:' + value;
      }
    });

    assert.throws(function () {fn(new Date())}, /TypeError: Unexpected type of argument \(expected: number, actual: Date, index: 0\)/);
  });

  it('should throw an error when providing a wrong function signature', function() {
    var fn = typed({
      'number': function (value) {
        return 'number:' + value;
      }
    });

    assert.throws(function () {fn(1, 2)}, /TypeError: Too many arguments \(expected: 1, actual: 2\)/);
  });

  it('should throw an error when composing with an unknown type', function() {
    assert.throws(function () {
      var fn = typed({
        'foo': function (value) {
          return 'number:' + value;
        }
      });
    }, /Error: Unknown type "foo"/);
  });

  it('should give a hint when composing with a wrongly cased type', function() {
    assert.throws(function () {
      var fn = typed({
        'array': function (value) {
          return 'array:' + value;
        }
      });
    }, /Error: Unknown type "array". Did you mean "Array"?/);

    assert.throws(function () {
      var fn = typed({
        'Function': function (value) {
          return 'Function:' + value;
        }
      });
    }, /Error: Unknown type "Function". Did you mean "function"?/);
  });

});
