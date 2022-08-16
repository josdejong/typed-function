// test parse
var assert = require('assert');
var typed = require('../typed-function');

describe('construction', function() {

  it('should throw an error when not providing any arguments', function() {
    assert.throws(function () {
      typed();
    }, /Error: No signatures provided/);
  });

  it('should throw an error when not providing any signatures', function() {
    assert.throws(function () {
      typed({});
    }, /Error: Argument .*typed.* 0 .* not/);
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

  it('should create a typed function from a regular function with a signature', function() {
    function myFunction(str) {
      return 'foo';
    }
    myFunction.signature = 'string'

    var fn = typed(myFunction);

    assert.equal(fn('bar'), 'foo');
    assert.equal(fn.name, 'myFunction');
    assert.deepEqual(Object.keys(fn.signatures), ['string']);
  });

  it('should create an unnamed function', function() {
    var fn = typed({
      'string': function (str) {
        return 'foo';
      }
    });

    assert.equal(fn('bar'), 'foo');
    assert.equal(fn.name, '');
  });

  it('should inherit the name of typed functions', function() {
    var fn = typed({
      'string': typed('fn1', {
        'string': function (str) {
          return 'foo';
        }
      })
    });

    assert.equal(fn('bar'), 'foo');
    assert.equal(fn.name, 'fn1');
  });

  it('should not inherit the name of the JavaScript functions (only from typed functions)', function() {
    var fn = typed({
      'string': function fn1 (str) {
        return 'foo';
      }
    });

    assert.equal(fn('bar'), 'foo');
    assert.equal(fn.name, '');
  });

  it('should throw if attempting to construct from other types', () => {
    assert.throws(() => typed(1), TypeError)
    assert.throws(() => typed('myfunc', 'implementation'), TypeError)
  })

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
    var fn = typed({
      'string': function () {
        return 'string';
      }
    });

    assert.equal(fn('hi'), 'string');
  });

  it('should ignore whitespace when creating a typed function with one argument', function() {
    var fn = typed({' ... string ': A => 'string'});
    assert.equal(fn('hi'), 'string');
  });

  it('should create a typed function with two arguments', function() {
    var fn = typed({
      'string, boolean': function () {
        return 'foo';
      }
    });

    assert.equal(fn('hi', true), 'foo');
  });

  it('should create a named, typed function', function() {
    var fn = typed('myFunction', {
      'string, boolean': function () {
        return 'noargs';
      }
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

  it('should correctly handle null', function () {
    var fn = typed({
      'Object': function (a) {
        return 'Object';
      },
      'null': function (a) {
        return 'null';
      },
      'undefined': function (a) {
        return 'undefined';
      }
    });

    assert.equal(fn(new Object(null)), 'Object');
    assert.equal(fn(null), 'null');
    assert.equal(fn(undefined), 'undefined');
  });

  it('should throw correct error message when passing null from an Object', function() {
    var signatures = {
      'Object': function (value) {
        assert(value instanceof Object);
        return 'Object';
      }
    };
    var fn = typed(signatures);

    assert.equal(fn({}), 'Object');
    assert.throws(function () { fn(null) },
        /TypeError: Unexpected type of argument in function unnamed \(expected: Object, actual: null, index: 0\)/);
  });

  it('should create a new, isolated instance of typed-function', function() {
    var typed1 = typed.create();
    var typed2 = typed.create();
    function Person() {}

    typed1.addType({
      name: 'Person',
      test: function (x) {
        return x instanceof Person;
      }
    });

    assert.strictEqual(typed.create, typed1.create);
    assert.notStrictEqual(typed.addTypes, typed1.addTypes);
    assert.notStrictEqual(typed.addConversion, typed1.addConversion);

    assert.strictEqual(typed.create, typed2.create);
    assert.notStrictEqual(typed.addTypes, typed2.addTypes);
    assert.notStrictEqual(typed.addConversion, typed2.addConversion);

    assert.strictEqual(typed1.create, typed2.create);
    assert.notStrictEqual(typed1.addTypes, typed2.addTypes);
    assert.notStrictEqual(typed1.addConversion, typed2.addConversion);

    typed1({
      'Person': function (p) {return 'Person'}
    });

    assert.throws(function () {
      typed2({
        'Person': function (p) {return 'Person'}
      });
    }, /Error: Unknown type "Person"/)
  });

  it('should add a type using addType (before object)', function() {
    var typed2 = typed.create();
    function Person() {}

    var newType = {
      name: 'Person',
      test: function (x) {
        return x instanceof Person;
      }
    };

    var objectIndex = typed2._findType('Object').index;
    typed2.addType(newType);
    assert.strictEqual(typed2._findType('Person').index, objectIndex);
  });

  it('should add a type using addType at the end (after Object)', function() {
    var typed2 = typed.create();
    function Person() {}

    var newType = {
      name: 'Person',
      test: function (x) {
        return x instanceof Person;
      }
    };

    typed2.addType(newType, false);

    assert.strictEqual(
      typed2._findType('Person').index,
      typed2._findType('any').index - 1);
  });

  it('should add a type using addType (no object)', function() {
    const typed3 = typed.create();
    typed3.clear();
    typed3.addType({name: 'number', test: n => typeof n === 'number'});
    assert.strictEqual(typed3._findType('number').index, 0)
  });

  it('should throw an error when passing an invalid type to addType', function() {
    var typed2 = typed.create();
    var errMsg = /TypeError: Object with properties {name: string, test: function} expected/;

    assert.throws(function () {typed2.addType({})}, errMsg);
    assert.throws(function () {typed2.addType({name: 2, test: function () {}})}, errMsg);
    assert.throws(function () {typed2.addType({name: 'foo', test: 'bar'})}, errMsg);
  });

  it('should throw an error when providing an unsupported type of argument', function() {
    var fn = typed('fn1', {
      'number': function (value) {
        return 'number:' + value;
      }
    });

    assert.throws(function () {fn(new Date())}, /TypeError: Unexpected type of argument in function fn1 \(expected: number, actual: Date, index: 0\)/);
  });

  it('should throw an error when providing a wrong function signature', function() {
    var fn = typed('fn1', {
      'number': function (value) {
        return 'number:' + value;
      }
    });

    assert.throws(function () {fn(1, 2)}, /TypeError: Too many arguments in function fn1 \(expected: 1, actual: 2\)/);
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
        'function': function (value) {
          return 'Function:' + value;
        }
      });
    }, /Error: Unknown type "function". Did you mean "Function"?/);
  });

  it('should attach signatures to the created typed-function', function() {
    var fn1 = function () {}
    var fn2 = function () {}
    var fn3 = function () {}
    var fn4 = function () {}

    var fn = typed({
      'string': fn1,
      'string, boolean': fn2,
      'number | Date, boolean': fn3,
      'Array | Object, string | RegExp': fn3,
      'number, ...string | number': fn4
    });

    assert.deepStrictEqual(fn.signatures, {
      'string': fn1,
      'string,boolean': fn2,
      'number,boolean': fn3,
      'Date,boolean': fn3,
      'Array,string': fn3,
      'Array,RegExp': fn3,
      'Object,string': fn3,
      'Object,RegExp': fn3,
      'number,...string|number': fn4
    });
  });

  it('should correctly order signatures', function () {
    const t2 = typed.create()
    t2.clear()
    t2.addTypes([
      {name: 'foo', test: x => x[0] === 1},
      {name: 'bar', test: x => x[1] === 1},
      {name: 'baz', test: x => x[2] === 1}
    ])
    var fn = t2({
      baz: a => 'isbaz',
      bar: a => 'isbar',
      foo: a => 'isfoo'
    })

    assert.strictEqual(fn([1,1,1]), 'isfoo')
    assert.strictEqual(fn([0,1,1]), 'isbar')
    assert.strictEqual(fn([0,0,1]), 'isbaz')
  });

  it('should increment the count of typed functions', function () {
    const saveCount = typed.createCount;
    const fn = typed({number: () => true});
    assert.strictEqual(typed.createCount - saveCount, 1);
  });

  it('should allow a function refer to itself', function () {
    var fn = typed({
      'number': function (value) {
        return 'number:' + value;
      },
      'string': typed.referToSelf((self) => {
        return function (value) {
          assert.strictEqual(self, fn)

          return self(parseInt(value, 10));
        }
      })
    });

    assert.equal(fn('2'), 'number:2');
  });

  it('should allow to resolve multiple function signatures with referTo', function () {
    var fnNumber = function (value) {
      return 'number:' + value;
    }

    var fnBoolean = function (value) {
      return 'boolean:' + value;
    }

    var fn = typed({
      'number': fnNumber,
      'boolean': fnBoolean,
      'string': typed.referTo('number', 'boolean', (fnNumberResolved, fnBooleanResolved) => {
        assert.strictEqual(fnNumberResolved, fnNumber)
        assert.strictEqual(fnBooleanResolved, fnBoolean)

        return function fnString(value) {
          return fnNumberResolved(parseInt(value, 10));
        }
      })
    });

    assert.equal(fn('2'), 'number:2');
  });

  it('should resolve referTo signatures on the resolved signatures, not exact matches', function () {
    var fnNumberOrBoolean = function (value) {
      return 'number or boolean:' + value;
    }

    var fn = typed({
      'number|boolean': fnNumberOrBoolean,
      'string': typed.referTo('number', (fnNumberResolved) => {
        assert.strictEqual(fnNumberResolved, fnNumberOrBoolean)

        return function fnString(value) {
          return fnNumberResolved(parseInt(value, 10));
        }
      })
    });

    assert.equal(fn('2'), 'number or boolean:2');
  });

  it('should throw an exception when a signature is not found with referTo', function () {
    assert.throws(() => {
      typed({
        'string': typed.referTo('number', (fnNumberResolved) => {
          return function fnString(value) {
            return fnNumberResolved(parseInt(value, 10));
          }
        })
      });
    }, /Error:.*reference.*signature "number"/)
  });

  it('should allow forward references with referTo', function () {
    const forward = typed({
      'string': typed.referTo('number', (fnNumberResolved) => {
        return function fnString(value) {
          return fnNumberResolved(parseInt(value, 10));
        }
      }),
      // Forward reference: we define `number` after we use it in `string`
      'number': typed.referTo(() => {
        return value => 'number:' + value;
      })
    })
    assert.strictEqual(forward('10'), 'number:10')
  });

  it('should throw an exception in case of circular referTo', function () {
    assert.throws(
      () => { typed({
        string: typed.referTo('number', fN => s => fN(s.length)),
        number: typed.referTo('string', fS => n => fS(n.toString()))
      })},
      SyntaxError)
  });

  it('should throw with circular referTo and direct referToSelf', function () {
    assert.throws(
      () => { typed({
        boolean: typed.referToSelf(self => b => b ? self(1) : self('false')),
        string: typed.referTo('number', fN => s => fN(s.length)),
        number: typed.referTo('string', fS => n => fS(n.toString()))
      })},
      SyntaxError)
  });

  it('should throw an exception when a signature in referTo is not a string', function () {
    assert.throws(() => {
      typed.referTo(123, () => {});
    }, /TypeError: Signatures must be strings/);

    assert.throws(() => {
      typed.referTo('number', 123, () => {});
    }, /TypeError: Signatures must be strings/);
  });

  it('should throw an exception when the last argument of referTo is not a callback function', function () {
    assert.throws(() => {
      typed.referTo('number');
    }, /TypeError: Callback function expected as last argument/);
  });

  it('should throw an exception when the first argument of referToSelf is not a callback function', function () {
    assert.throws(() => {
      typed.referToSelf(123);
    }, /TypeError: Callback function expected as first argument/);
  });

  it('should have correct context `this` when resolving reference function signatures', function () {
    // to make this work, in all functions we must use regular functions and no arrow functions,
    // and we need to use .call or .apply, passing the `this` context along
    var fnNumber = function (value) {
      return 'number:' + value + ', this.value:' + this.value;
    }

    var fn = typed({
      'number': typed.referTo(function () {
        // created as a "reference" function just for the unit test...
        return fnNumber
      }),
      'string': typed.referTo('number', function (fnNumberResolved) {
        assert.strictEqual(fnNumberResolved, fnNumber)

        return function fnString(value) {
          return fnNumberResolved.call(this, parseInt(value, 10));
        }
      })
    });

    assert.equal(fn('2'), 'number:2, this.value:undefined');

    // verify the reference function has the right context
    var obj = {
      value: 42,
      fn
    }
    assert.equal(obj.fn('2'), 'number:2, this.value:42');
  });

  it('should pass this function context', () => {
    var getProperty = typed({
      'string': function (key) {
        return this[key];
      }
    });

    assert.equal(getProperty('value'), undefined)

    var obj = {
      value: 42,
      getProperty
    };

    assert.equal(obj.getProperty('value'), 42);

    var boundGetProperty = getProperty.bind({ otherValue: 123 });
    assert.equal(boundGetProperty('otherValue'), 123);
  });

  it('should throw a deprecation warning when self reference via `this(...)` is used', () => {
    assert.throws(() => {
      typed({
        'number': function (value) {
          return value * value;
        },
        'string': function (value) {
          return this(parseFloat(value));
        }
      });
    }, /SyntaxError: Using `this` to self-reference a function is deprecated since typed-function@3\. Use typed\.referTo and typed\.referToSelf instead\./);
  });

  it('should not throw a deprecation warning on `this(...)` when the warning is turned off', () => {
    var typed2 = typed.create();
    typed2.warnAgainstDeprecatedThis = false;

    var deprecatedSquare = typed2({
      'number': function (value) {
        return value * value;
      },
      'string': function (value) {
        return this(parseFloat(value));
      }
    });

    assert.equal(deprecatedSquare(3), 9);

    assert.throws(() => {
      deprecatedSquare('3');
    }, /TypeError: this is not a function/);
  });

  it('should throw a deprecation warning when self reference via `this.signatures` is used', () => {
    assert.throws(() => {
      var square = typed({
        'number': function (value) {
          return value * value;
        },
        'string': function (value) {
          return this.signatures['number'](parseFloat(value));
        }
      });
    }, /SyntaxError: Using `this` to self-reference a function is deprecated since typed-function@3\. Use typed\.referTo and typed\.referToSelf instead\./);
  });

});
