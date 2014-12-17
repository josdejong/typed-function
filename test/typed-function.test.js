// test parse
var assert = require('assert');
var typed = require('../typed-function');

describe('typed-function', function() {

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

    assert.throws(function () {fn(new Date())}, /TypeError: Unexpected type of argument. Expected: number, actual: Date, index: 0./);
  });

  it('should throw an error when providing a  Wrong function signature', function() {
    var fn = typed({
      'number': function (value) {
        return 'number:' + value;
      }
    });

    assert.throws(function () {fn(1, 2)}, /TypeError: Too many arguments. Expected: 1, actual: 2./);
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

  describe('configuration', function () {

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
      assert.throws(function () {fn('string')}, /TypeError: Unexpected type of argument. Expected: number or boolean, actual: string, index: 0./);
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
      assert.throws(function () {sum()},                /TypeError: Too few arguments. Expected: number, index: 0./);
      assert.throws(function () {sum(true)},            /TypeError: Unexpected type of argument. Expected: number, actual: boolean, index: 0./);
      assert.throws(function () {sum('string')},        /TypeError: Unexpected type of argument. Expected: number, actual: string, index: 0./);
      assert.throws(function () {sum(2, 'string')},     /TypeError: Unexpected type of argument. Expected: number, actual: string, index: 1./);
      assert.throws(function () {sum(2, 3, 'string')},  /TypeError: Unexpected type of argument. Expected: number, actual: string, index: 2./);
    });

    it('should create a typed function with variable arguments (2)', function() {
      var fn = typed('string, ...number', function (str, values) {
        assert.equal(typeof str, 'string');
        assert(Array.isArray(values));
        return str + ': ' + values.join(', ');
      });

      assert.equal(fn('foo', 2), 'foo: 2');
      assert.equal(fn('foo', 2, 4), 'foo: 2, 4');
      assert.throws(function () {fn(2, 4)}, /TypeError: Unexpected type of argument. Expected: string, actual: number, index: 0./);
      assert.throws(function () {fn('string')}, /TypeError: Too few arguments. Expected: number, index: 1./);
      assert.throws(function () {fn('string', 'string')}, /TypeError: Unexpected type of argument. Expected: number, actual: string, index: 1./);
    });

    it('should create a typed function with any type arguments (1)', function() {
      var fn = typed('string, ...any', function (str, values) {
        assert.equal(typeof str, 'string');
        assert(Array.isArray(values));
        return str + ': ' + values.join(', ');
      });

      assert.equal(fn('foo', 2), 'foo: 2');
      assert.equal(fn('foo', 2, true, 'bar'), 'foo: 2, true, bar');
      assert.equal(fn('foo', 'bar'), 'foo: bar');
      assert.throws(function () {fn(2, 4)}, /TypeError: Unexpected type of argument. Expected: string, actual: number, index: 0./);
      assert.throws(function () {fn('string')}, /TypeError: Too few arguments. Expected: any, index: 1./);
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
      assert.throws(function () {fn(2, 4)}, /TypeError: Unexpected type of argument. Expected: string, actual: number, index: 0./);
      assert.throws(function () {fn('string')}, /TypeError: Too few arguments. Expected: any, index: 1./);
    });

    it('should create a typed function with any type arguments (2)', function() {
      var fn = typed('any, ...number', function (any, values) {
        assert(Array.isArray(values));
        return any + ': ' + values.join(', ');
      });

      assert.equal(fn('foo', 2), 'foo: 2');
      assert.equal(fn(1, 2, 4), '1: 2, 4');
      assert.equal(fn(null, 2, 4), 'null: 2, 4');
      assert.throws(function () {fn('string')},           /TypeError: Too few arguments. Expected: number, index: 1./);
      assert.throws(function () {fn('string', 'string')}, /TypeError: Unexpected type of argument. Expected: number, actual: string, index: 1./);
    });

    it('should create a typed function with union type arguments', function() {
      var fn = typed('...number|string', function (values) {
        assert(Array.isArray(values));
        return values;
      });

      strictEqualArray(fn(2,3,4), [2,3,4]);
      strictEqualArray(fn('a','b','c'), ['a','b','c']);
      strictEqualArray(fn('a',2,'c',3), ['a',2,'c',3]);
      assert.throws(function () {fn()},               /TypeError: Too few arguments. Expected: number or string, index: 0./);
      assert.throws(function () {fn('string', true)}, /TypeError: Unexpected type of argument. Index: 1. Expected: string | number/);
      assert.throws(function () {fn(2, false)},       /TypeError: Unexpected type of argument. Index: 1. Expected: string | number/);
      assert.throws(function () {fn(2, 3, false)},    /TypeError: Unexpected type of argument. Index: 2. Expected: string | number/);
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
      // FIXME: error should be Expected: string or boolean
      assert.throws(function () {fn(2, 4)},           /TypeError: Unexpected type of argument. Expected: boolean, actual: number, index: 0./);
      assert.throws(function () {fn('string')},       /TypeError: Too few arguments. Expected: number, index: 1./);
      assert.throws(function () {fn('string', true)}, /TypeError: Unexpected type of argument. Expected: number, actual: boolean, index: 1./);
    });

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
      // FIXME: should return correct error message
      assert.throws(function () {fn()},           /TypeError: Too few arguments. Expected: string or number or boolean, index: 0./);
      assert.throws(function () {fn(1,2,3)},      /TypeError: Unexpected type of argument. Expected: boolean, actual: number, index: 1./);
      assert.throws(function () {fn('str', 2)},   /TypeError: Unexpected type of argument. Expected: boolean, actual: number, index: 1./);
      assert.throws(function () {fn(true, 'str')},/TypeError: Unexpected type of argument. Expected: boolean or number, actual: string, index: 1./);
      assert.throws(function () {fn(2, 3)},       /TypeError: Unexpected type of argument. Expected: boolean, actual: number, index: 1./);
      assert.throws(function () {fn(2, 'str')},   /TypeError: Unexpected type of argument. Expected: boolean, actual: string, index: 1./);
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
      assert.throws(function () {fn([], new Date())}, /TypeError: Unexpected type of argument. Expected: boolean or string, actual: Date, index: 1./);
      assert.throws(function () {fn(2, 2)},           /TypeError: Unexpected type of argument. Expected: boolean or string, actual: number, index: 1./);
      assert.throws(function () {fn(2)},              /TypeError: Too few arguments. Expected: boolean or string, index: 1./);
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
      assert.throws(function () {fn([], new Date())}, /TypeError: Unexpected type of argument. Expected: boolean or number, actual: Date, index: 1./);
      assert.throws(function () {fn([], 'foo')},      /TypeError: Unexpected type of argument. Expected: boolean or number, actual: string, index: 1./)
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
      assert.equal(fn('foo'), 'any');
      assert.equal(fn([]), 'any');
      assert.throws(function () {fn([], 'foo')}, /TypeError: Too many arguments. Expected: 1, actual: 2./)
    });

  });

  describe('conversions', function () {

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
      // note that a series of booleans can be converted to numbers, but a single
      // boolean should call the second signature `boolean`
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
      assert.equal(fn(2,true,4), 7);
      assert.equal(fn(1,2,false), 3);
      assert.equal(fn(1,2,true), 4);
      assert.equal(fn(true,1,2), 4);
      assert.equal(fn(true,false, true), 2);
      assert.equal(fn(2,3), 5);
      assert.equal(fn(false), 'boolean');
      assert.equal(fn(true), 'boolean');
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

      assert.throws(function () {fn(new Date(), '2')}, /TypeError: Unexpected type of argument. Expected: string or number, actual: Date, index: 0./)
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
  });

  describe('errors', function () {
    it('should give correct error in case of too few arguments', function() {
      var fn = typed('string, boolean', function () {});

      assert.throws(function () {fn()}, /TypeError: Too few arguments. Expected: string, index: 0./);
      assert.throws(function () {fn('foo')}, /TypeError: Too few arguments. Expected: boolean, index: 1./);
    });

    it('should give correct error in case of too few arguments (varArgs)', function() {
      var fn = typed('...string', function () {});

      assert.throws(function () {fn()}, /TypeError: Too few arguments. Expected: string, index: 0./);
    });

    it('should give correct error in case of too few arguments (varArgs) (2)', function() {
      var fn = typed('boolean, ...string', function () {});

      assert.throws(function () {fn()}, /TypeError: Too few arguments. Expected: boolean, index: 0./);
      assert.throws(function () {fn(true)}, /TypeError: Too few arguments. Expected: string, index: 1./);
    });

    it('should give correct error in case of too many arguments', function() {
      var fn = typed('string, boolean', function () {});

      assert.throws(function () {fn('foo', true, 2)}, /TypeError: Too many arguments. Expected: 2, actual: 3./);
      assert.throws(function () {fn('foo', true, 2, 1)}, /TypeError: Too many arguments. Expected: 2, actual: 4./);
    });

    it('should give correct error in case of wrong type of argument', function() {
      var fn = typed('boolean', function () {});

      assert.throws(function () {fn('foo')}, /TypeError: Unexpected type of argument. Expected: boolean, actual: string, index: 0./);
    });

    it('should give correct error in case of wrong type of argument (union args)', function() {
      var fn = typed('boolean | string | Date', function () {});

      assert.throws(function () {fn(2)}, /TypeError: Unexpected type of argument. Expected: boolean or string or Date, actual: number, index: 0./);
    });

    it('should give correct error in case of wrong type of argument (varArgs)', function() {
      var fn = typed('...number', function () {});

      assert.throws(function () {fn(true)}, /TypeError: Unexpected type of argument. Expected: number, actual: boolean, index: 0./);
      assert.throws(function () {fn(2, true)}, /TypeError: Unexpected type of argument. Expected: number, actual: boolean, index: 1./);
      assert.throws(function () {fn(2, 3, true)}, /TypeError: Unexpected type of argument. Expected: number, actual: boolean, index: 2./);
    });

    it('should give correct error in case of wrong type of argument (nested varArgs)', function() {
      var fn = typed('string, ...number', function () {});

      assert.throws(function () {fn(true)}, /TypeError: Unexpected type of argument. Expected: string, actual: boolean, index: 0./);
      assert.throws(function () {fn('foo', true)}, /TypeError: Unexpected type of argument. Expected: number, actual: boolean, index: 1./);
      assert.throws(function () {fn('foo', 2, true)}, /TypeError: Unexpected type of argument. Expected: number, actual: boolean, index: 2./);
      assert.throws(function () {fn('foo', 2, 3, true)}, /TypeError: Unexpected type of argument. Expected: number, actual: boolean, index: 3./);
    });

    it('should give correct error in case of wrong type of argument (union and varArgs)', function() {
      var fn = typed('...number|boolean', function () {});

      assert.throws(function () {fn('foo')}, /TypeError: Unexpected type of argument. Expected: number or boolean, actual: string, index: 0./);
      assert.throws(function () {fn(2, 'foo')}, /TypeError: Unexpected type of argument. Expected: number or boolean, actual: string, index: 1./);
      assert.throws(function () {fn(2, true, 'foo')}, /TypeError: Unexpected type of argument. Expected: number or boolean, actual: string, index: 2./);
    });
  });

  // TODO: test compose.tests
  // TODO: test the generated .signatures object on a typed function

});

function strictEqualArray(a, b) {
  assert.strictEqual(a.length, b.length);

  for (var i = 0; i < a.length; a++) {
    assert.strictEqual(a[i], b[i]);
  }
}
