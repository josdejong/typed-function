var assert = require('assert');
var typed = require('../typed-function');
var strictEqualArray = require('./strictEqualArray');

describe('conversion', function () {

  before(function () {
    typed.conversions = [
      {from: 'boolean', to: 'number', convert: function (x) {return +x;}},
      {from: 'boolean', to: 'string', convert: function (x) {return x + '';}},
      {from: 'number',  to: 'string', convert: function (x) {return x + '';}},
      {
        from: 'string',
        to: 'Date',
        convert: function (x) {
          var d = new Date(x);
          return isNaN(d.valueOf()) ? undefined : d;
        },
        fallible: true // TODO: not yet supported
      }
    ];
  });

  after(function () {
    // cleanup conversions
    typed.conversions = [];
  });

  it('should add conversions to a function with one argument', function() {
    var fn = typed({
      'string': function (a) {
        return a;
      }
    });

    assert.equal(fn(2), '2');
    assert.equal(fn(false), 'false');
    assert.equal(fn('foo'), 'foo');
  });

  it('should add conversions to a function with multiple arguments', function() {
    // note: we add 'string, string' first, and `string, number` afterwards,
    //       to test whether the conversions are correctly ordered.
    var fn = typed({
      'string, string': function (a, b) {
        assert.equal(typeof a, 'string');
        assert.equal(typeof b, 'string');
        return 'string, string';
      },
      'string, number': function (a, b) {
        assert.equal(typeof a, 'string');
        assert.equal(typeof b, 'number');
        return 'string, number';
      }
    });

    assert.equal(fn(true, false), 'string, number');
    assert.equal(fn(true, 2), 'string, number');
    assert.equal(fn(true, 'foo'), 'string, string');
    assert.equal(fn(2, false), 'string, number');
    assert.equal(fn(2, 3), 'string, number');
    assert.equal(fn(2, 'foo'), 'string, string');
    assert.equal(fn('foo', true), 'string, number');
    assert.equal(fn('foo', 2), 'string, number');
    assert.equal(fn('foo', 'foo'), 'string, string');
  });

  it('should add conversions to a function with variable arguments (1)', function() {
    var sum = typed('...number', function (values) {
      assert(Array.isArray(values));
      var sum = 0;
      for (var i = 0; i < values.length; i++) {
        sum += values[i];
      }
      return sum;
    });

    assert.equal(sum(2,3,4), 9);
    // TODO
    //assert.equal(sum(2,true,4), 7);
    //assert.equal(sum(1,2,false), 3);
    //assert.equal(sum(1,2,true), 4);
    //assert.equal(sum(true,1,2), 4);
    assert.equal(sum(true,false, true), 2);
  });

  it('should add conversions to a function with variable arguments (2)', function() {
    var sum = typed('string, ...number', function (name, values) {
      assert.equal(typeof name, 'string');
      assert(Array.isArray(values));
      var sum = 0;
      for (var i = 0; i < values.length; i++) {
        sum += values[i];
      }
      return sum;
    });

    assert.equal(sum('foo', 2,3,4), 9);
    assert.equal(sum('foo', 2,true,4), 7);
    assert.equal(sum('foo', 1,2,false), 3);
    assert.equal(sum('foo', 1,2,true), 4);
    assert.equal(sum('foo', true,1,2), 4);
    assert.equal(sum('foo', true,false, true), 2);
    assert.equal(sum(123, 2,3), 5);
    assert.equal(sum(false, 2,3), 5);
  });

  it('should add conversions to a function with variable arguments in a non-conflicting way', function() {
    var fn = typed({
      '...number': function (values) {
        assert(Array.isArray(values));
        var sum = 0;
        for (var i = 0; i < values.length; i++) {
          sum += values[i];
        }
        return sum;
      },
      'boolean': function (value) {
        assert.equal(typeof value, 'boolean');
        return 'boolean';
      }
    });

    assert.equal(fn(2,3,4), 9);
    assert.equal(fn(false), 'boolean');
    assert.equal(fn(true), 'boolean');
    assert.throws(function () {fn(2,true,4)}, /TypeError: Unexpected type of argument \(expected: number, actual: boolean, index: 1\)/);
    assert.throws(function () {fn(true,2,4)}, /TypeError: Too many arguments \(expected: 1, actual: 3\)/);
  });

  it('should add conversions to a function with variable and union arguments', function() {
    var fn = typed({
      '...string | number': function (values) {
        assert(Array.isArray(values));
        return values;
      }
    });

    strictEqualArray(fn(2,3,4), [2,3,4]);
    strictEqualArray(fn(2,true,4), [2,1,4]);
    strictEqualArray(fn(2,'str'), [2,'str']);
    strictEqualArray(fn('str', true, false), ['str', 1, 0]);
    strictEqualArray(fn('str', 2, false), ['str', 2, 0]);

    assert.throws(function () {fn(new Date(), '2')}, /TypeError: Unexpected type of argument \(expected: string or number, actual: Date, index: 0\)/)
  });

  it('should add non-conflicting conversions to a function with one argument', function() {
    var fn = typed({
      'number': function (a) {
        return a;
      },
      'string': function (a) {
        return a;
      }
    });

    // booleans should be converted to number
    assert.equal(fn(false), 0);
    assert.equal(fn(true), 1);

    // numbers and strings should be left as is
    assert.equal(fn(2), 2);
    assert.equal(fn('foo'), 'foo');
  });

  it('should add non-conflicting conversions to a function with one argument', function() {
    var fn = typed({
      'boolean': function (a) {
        return a;
      }
    });

    // booleans should be converted to number
    assert.equal(fn(false), 0);
    assert.equal(fn(true), 1);
  });

  it('should add non-conflicting conversions to a function with two arguments', function() {
    var fn = typed({
      'boolean, boolean': function (a, b) {
        return 'boolean, boolean';
      },
      'number, number': function (a, b) {
        return 'number, number';
      }
    });

    //console.log('FN', fn.toString());

    // booleans should be converted to number
    assert.equal(fn(false, true), 'boolean, boolean');
    assert.equal(fn(2, 4), 'number, number');
    assert.equal(fn(false, 4), 'number, number');
    assert.equal(fn(2, true), 'number, number');
  });

  it('should add non-conflicting conversions to a function with three arguments', function() {
    var fn = typed({
      'boolean, boolean, boolean': function (a, b, c) {
        return 'booleans';
      },
      'number, number, number': function (a, b, c) {
        return 'numbers';
      }
    });

    //console.log('FN', fn.toString());

    // booleans should be converted to number
    assert.equal(fn(false, true, true), 'booleans');
    assert.equal(fn(false, false, 5), 'numbers'); // FIXME
    assert.equal(fn(false, 4, false), 'numbers');
    assert.equal(fn(2, false, false), 'numbers');
    assert.equal(fn(false, 4, 5), 'numbers');
    assert.equal(fn(2, false, 5), 'numbers');
    assert.equal(fn(2, 4, false), 'numbers');
    assert.equal(fn(2, 4, 5), 'numbers');
  });

});
