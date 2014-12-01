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

  it('should create a named function', function() {
    var fn = typed('myFunction',  {
      '': function () {
        return 'noargs';
      }
    });

    assert.equal(fn(), 'noargs');
    assert.equal(fn.name, 'myFunction');
  });

  it('should create a typed function', function() {
    var fn = typed('string, boolean', function () {
        return 'noargs';
    });

    assert.equal(fn('hi', true), 'noargs');
  });

  it('should create a named, typed function', function() {
    var fn = typed('myFunction', 'string, boolean', function () {
        return 'noargs';
    });

    assert.equal(fn('hi', true), 'noargs');
    assert.equal(fn.name, 'myFunction');
  });

  it('should create a typed function with multiple types per argument', function() {
    var fn = typed('number | boolean', function (arg) {
      return typeof arg;
    });

    assert.equal(fn(true), 'boolean');
    assert.equal(fn(2), 'number');
    assert.throws(function () {fn('string')}, /Wrong function signature/);
  });

  it.skip('should create a typed function with varArgs', function() {
    var fn = typed('number...', function (arg) {
      return typeof arg;
    });

    assert.equal(fn(2), 'number');
    assert.throws(function () {fn(true)}, /Wrong function signature/);
    assert.throws(function () {fn('string')}, /Wrong function signature/);
  });

  it('should throw an error in case of unexpected varArgs', function() {
    assert.throws(function () {
      typed('number... | string', function () {});
    }, /SyntaxError: Unexpected varArgs/);
    
    assert.throws(function () {
      typed('number..., string', function () {});
    }, /SyntaxError: Unexpected varArgs/);
  });

  // TODO: test a function with only two arguments (not one)

  // TODO: test config.minify

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
    assert.throws(function () {fn()}, /Wrong number of arguments/);
    assert.throws(function () {fn(1,2,3)}, /Wrong number of arguments/);
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

  describe('anytype', function () {

    it('should compose a function with one anytype argument', function() {
      var fn = typed({
        '*': function (value) {
          return 'anytype:' + value;
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
      assert.equal(fn(2), 'anytype:2');
      assert.equal(fn([1,2,3]), 'anytype:1,2,3');
      assert.equal(fn('foo'), 'string:foo');
      assert.equal(fn(false), 'boolean:false');
    });

    it('should compose a function with multiple anytype arguments (1)', function() {
      var fn = typed({
        '*,boolean': function () {
          return 'anytype,boolean';
        },
        '*,string': function () {
          return 'anytype,string';
        }
      });

      assert(fn.signatures instanceof Object);
      assert.strictEqual(Object.keys(fn.signatures).length, 2);
      assert.equal(fn([],true), 'anytype,boolean');
      assert.equal(fn(2,'foo'), 'anytype,string');
      assert.throws(function () {fn([], new Date())}, /Wrong function signature/)
      assert.throws(function () {fn(2, 2)}, /Wrong function signature/)
    });

    it('should compose a function with multiple anytype arguments (2)', function() {
      var fn = typed({
        '*,boolean': function () {
          return 'anytype,boolean';
        },
        '*,number': function () {
          return 'anytype,number';
        },
        'string,*': function () {
          return 'string,anytype';
        }
      });

      assert(fn.signatures instanceof Object);
      assert.strictEqual(Object.keys(fn.signatures).length, 3);
      assert.equal(fn([],true), 'anytype,boolean');
      assert.equal(fn([],2), 'anytype,number');
      assert.equal(fn('foo', 2), 'string,anytype');
      assert.throws(function () {fn([], new Date())}, /Wrong function signature/)
      assert.throws(function () {fn([], 'foo')}, /Wrong function signature/)
    });

    it('should compose a function with multiple anytype arguments (3)', function() {
      var fn = typed({
        'string,*': function () {
          return 'string,anytype';
        },
        '*': function () {
          return 'anytype';
        }
      });

      assert(fn.signatures instanceof Object);
      assert.strictEqual(Object.keys(fn.signatures).length, 2);
      assert.equal(fn('foo', 2), 'string,anytype');
      assert.equal(fn('foo'), 'anytype');
      assert.equal(fn([]), 'anytype');
      assert.throws(function () {fn([], 'foo')}, /Wrong function signature/)
    });

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

  it('should throw an error when providing a wrong number of arguments', function() {
    var fn = typed({
      'number': function (value) {
        return 'number:' + value;
      }
    });

    assert.throws(function () {fn(1, 2)}, /TypeError: Wrong number of arguments/);
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

  describe('conversions' , function () {

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
