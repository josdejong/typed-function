// test parse
var assert = require('assert');
var typed = require('../typed-function');

describe('parse', function() {

  it('should compose an empty function', function() {
    var fn = typed({});
    assert.throws(function () {
      fn();
    }, /TypeError: Wrong function signature/);
    assert(fn.signatures instanceof Object);
    assert.deepEqual(fn.signatures, []);
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

  it('should throw an error when providing an unsupported type of argument', function() {
    var fn = typed({
      'number': function (value) {
        return 'number:' + value;
      }
    });

    assert.throws(function () {fn(new Date())}, /TypeError: Wrong function signature/);
  });

  it('should throw an error when providing a  Wrong function signature', function() {
    var fn = typed({
      'number': function (value) {
        return 'number:' + value;
      }
    });

    assert.throws(function () {fn(1, 2)}, /TypeError: Wrong function signature/);
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

  describe.skip('configuration', function () {

    it('option minify should be true by default', function () {
      assert.equal(typed.config.minify, true)
    });

    it('should configure option minify', function () {
      var orig = typed.config.minify;

      typed.config.minify = true;

      var fn1 = typed('string', function (str) {
        return 'string';
      });
      var len1 = fn1.toString().length;

      typed.config.minify = false;

      var fn2 = typed('string', function (str) {
        return 'string';
      });
      var len2 = fn2.toString().length;

      assert.equal(fn1('foo'), 'string');
      assert.equal(fn2('foo'), 'string');
      assert(len2 > len1);

      // restore original configuration
      typed.config.minify = orig;
    });

  });

  describe('multiple types', function () {

    it('should create a typed function with multiple types per argument', function() {
      var fn = typed('number | boolean', function (arg) {
        return typeof arg;
      });

      assert.equal(fn(true), 'boolean');
      assert.equal(fn(2), 'number');
      assert.throws(function () {fn('string')}, /Wrong function signature/);
    });

  });

  describe('variable arguments', function () {

    it('should create a typed function with variable arguments', function() {
      var sum = typed('...number', function (values) {
        assert(Array.isArray(values));
        var sum = 0;
        for (var i = 0; i < values.length; i++) {
          sum += values[i];
        }
        return sum;
      });

      assert.equal(sum(2), 2);
      assert.equal(sum(2,3,4), 9);
      assert.throws(function () {sum()}, /Wrong function signature/);
      assert.throws(function () {sum(true)}, /Wrong function signature/);
      assert.throws(function () {sum('string')}, /Wrong function signature/);
    });

    it('should create a typed function with variable arguments (2)', function() {
      var fn = typed('string, ...number', function (str, values) {
        assert.equal(typeof str, 'string');
        assert(Array.isArray(values));
        return str + ': ' + values.join(', ');
      });

      assert.equal(fn('foo', 2), 'foo: 2');
      assert.equal(fn('foo', 2, 4), 'foo: 2, 4');
      assert.throws(function () {fn(2, 4)}, /Wrong function signature/);
      assert.throws(function () {fn('string')}, /Wrong function signature/);
      assert.throws(function () {fn('string', 'string')}, /Wrong function signature/);
    });

    it('should create a typed function with any type arguments (1)', function() {
      var fn = typed('string, ...*', function (str, values) {
        assert.equal(typeof str, 'string');
        assert(Array.isArray(values));
        return str + ': ' + values.join(', ');
      });

      assert.equal(fn('foo', 2), 'foo: 2');
      assert.equal(fn('foo', 2, true, 'bar'), 'foo: 2, true, bar');
      assert.equal(fn('foo', 'bar'), 'foo: bar');
      assert.throws(function () {fn(2, 4)}, /Wrong function signature/);
      assert.throws(function () {fn('string')}, /Wrong function signature/);
    });

    it('should create a typed function with implicit any type arguments', function() {
      var fn = typed('string, ...', function (str, values) {
        assert.equal(typeof str, 'string');
        assert(Array.isArray(values));
        return str + ': ' + values.join(', ');
      });

      assert.equal(fn('foo', 2), 'foo: 2');
      assert.equal(fn('foo', 2, true, 'bar'), 'foo: 2, true, bar');
      assert.equal(fn('foo', 'bar'), 'foo: bar');
      assert.throws(function () {fn(2, 4)}, /Wrong function signature/);
      assert.throws(function () {fn('string')}, /Wrong function signature/);
    });

    it('should create a typed function with any type arguments (2)', function() {
      var fn = typed('*, ...number', function (any, values) {
        assert(Array.isArray(values));
        return any + ': ' + values.join(', ');
      });

      assert.equal(fn('foo', 2), 'foo: 2');
      assert.equal(fn(1, 2, 4), '1: 2, 4');
      assert.equal(fn(null, 2, 4), 'null: 2, 4');
      assert.throws(function () {fn('string')}, /Wrong function signature/);
      assert.throws(function () {fn('string', 'string')}, /Wrong function signature/);
    });

    it('should create a composed function with variable arguments', function() {
      var fn = typed({
        'string, ...number': function (str, values) {
          assert.equal(typeof str, 'string');
          assert(Array.isArray(values));
          return str + ': ' + values.join(', ');
        },

        '...boolean': function (values) {
          assert(Array.isArray(values));
          return 'booleans';
        }
      });

      assert.equal(fn('foo', 2), 'foo: 2');
      assert.equal(fn('foo', 2, 4), 'foo: 2, 4');
      assert.equal(fn(true, false, false), 'booleans');
      assert.throws(function () {fn(2, 4)}, /Wrong function signature/);
      assert.throws(function () {fn('string')}, /Wrong function signature/);
      assert.throws(function () {fn('string', true)}, /Wrong function signature/);
    });

    // TODO: test combination of varArgs and conversion

    it('should throw an error in case of unexpected variable arguments', function() {
      assert.throws(function () {
        typed('...number, string', function () {});
      }, /SyntaxError: Unexpected variable arguments operator "..."/);
    });

  });

  describe('compose', function () {

    it('should create a composed function with multiple types per argument', function() {
      var fn = typed({
        'string | number, boolean':  function () {return 'A';},
        'boolean, boolean | number': function () {return 'B';},
        'string':                    function () {return 'C';}
      });

      assert.equal(fn('str', false), 'A');
      assert.equal(fn(2, true), 'A');
      assert.equal(fn(false, true), 'B');
      assert.equal(fn(false, 2), 'B');
      assert.equal(fn('str'), 'C');
      assert.throws(function () {fn()}, / Wrong function signature/);
      assert.throws(function () {fn(1,2,3)}, / Wrong function signature/);
      assert.throws(function () {fn('str', 2)}, /Wrong function signature/);
      assert.throws(function () {fn(true, 'str')}, /Wrong function signature/);
      assert.throws(function () {fn(2, 3)}, /Wrong function signature/);
      assert.throws(function () {fn(2, 'str')}, /Wrong function signature/);
    });

    // TODO: test whether the constructor throws errors when providing wrong arguments to typed(...)

    it('should compose a function with one argument', function() {
      var signatures = {
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
      var fn = typed(signatures);

      assert.equal(fn(2), 'number:2');
      assert.equal(fn('foo'), 'string:foo');
      assert.equal(fn(false), 'boolean:false');
      assert(fn.signatures instanceof Object);
      assert.strictEqual(Object.keys(fn.signatures).length, 3);
      assert.strictEqual(fn.signatures['number'], signatures['number']);
      assert.strictEqual(fn.signatures['string'], signatures['string']);
      assert.strictEqual(fn.signatures['boolean'], signatures['boolean']);
    });

    it('should compose a function with multiple arguments', function() {
      var signatures = {
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
      var fn = typed(signatures);

      assert.equal(fn(2), 'number:2');
      assert.equal(fn('foo'), 'string:foo');
      assert.equal(fn(2, false), 'number,boolean:2,false');
      assert(fn.signatures instanceof Object);
      assert.strictEqual(Object.keys(fn.signatures).length, 3);
      assert.strictEqual(fn.signatures['number'], signatures['number']);
      assert.strictEqual(fn.signatures['string'], signatures['string']);
      assert.strictEqual(fn.signatures['number,boolean'], signatures['number, boolean']);
    });

  });

  describe('any type', function () {

    it('should compose a function with one any type argument', function() {
      var fn = typed({
        '*': function (value) {
          return 'any type:' + value;
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
      assert.equal(fn(2), 'any type:2');
      assert.equal(fn([1,2,3]), 'any type:1,2,3');
      assert.equal(fn('foo'), 'string:foo');
      assert.equal(fn(false), 'boolean:false');
    });

    it('should compose a function with multiple any type arguments (1)', function() {
      var fn = typed({
        '*,boolean': function () {
          return 'any type,boolean';
        },
        '*,string': function () {
          return 'any type,string';
        }
      });

      assert(fn.signatures instanceof Object);
      assert.strictEqual(Object.keys(fn.signatures).length, 2);
      assert.equal(fn([],true), 'any type,boolean');
      assert.equal(fn(2,'foo'), 'any type,string');
      assert.throws(function () {fn([], new Date())}, /Wrong function signature/)
      assert.throws(function () {fn(2, 2)}, /Wrong function signature/)
    });

    it('should compose a function with multiple any type arguments (2)', function() {
      var fn = typed({
        '*,boolean': function () {
          return 'any type,boolean';
        },
        '*,number': function () {
          return 'any type,number';
        },
        'string,*': function () {
          return 'string,any type';
        }
      });

      assert(fn.signatures instanceof Object);
      assert.strictEqual(Object.keys(fn.signatures).length, 3);
      assert.equal(fn([],true), 'any type,boolean');
      assert.equal(fn([],2), 'any type,number');
      assert.equal(fn('foo', 2), 'string,any type');
      assert.throws(function () {fn([], new Date())}, /Wrong function signature/)
      assert.throws(function () {fn([], 'foo')}, /Wrong function signature/)
    });

    it('should compose a function with multiple any type arguments (3)', function() {
      var fn = typed({
        'string,*': function () {
          return 'string,any type';
        },
        '*': function () {
          return 'any type';
        }
      });

      assert(fn.signatures instanceof Object);
      assert.strictEqual(Object.keys(fn.signatures).length, 2);
      assert.equal(fn('foo', 2), 'string,any type');
      assert.equal(fn('foo'), 'any type');
      assert.equal(fn([]), 'any type');
      assert.throws(function () {fn([], 'foo')}, /Wrong function signature/)
    });

  });

  describe.skip('conversions' , function () {

    before(function () {
      typed.conversions = [
        {from: 'boolean', to: 'number', convert: function (x) {return +x;}},
        {from: 'boolean', to: 'string', convert: function (x) {return x + '';}},
        {from: 'number',  to: 'string', convert: function (x) {return x + '';}}
      ];
    });

    after(function () {
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
  });

  // TODO: test compose.tests
});
