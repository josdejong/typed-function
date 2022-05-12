var assert = require('assert');
var typed = require('../typed-function');

describe('convert', function () {

  before(function () {
    typed.addConversions([
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
    ]);
  });

  after(function () {
    // cleanup conversions
    typed.clearConversions();
  });

  it('should convert a value', function() {
    assert.strictEqual(typed.convert(2, 'string'), '2');
    assert.strictEqual(typed.convert(true, 'string'), 'true');
    assert.strictEqual(typed.convert(true, 'number'), 1);
  });

  it('should return same value when conversion is not needed', function () {
    assert.strictEqual(typed.convert(2, 'number'), 2);
    assert.strictEqual(typed.convert(true, 'boolean'), true);
  });

  it('should throw an error when an unknown type is requested', function () {
    assert.throws(function () { typed.convert(2, 'foo') }, /Unknown type.*foo/)
  });

  it('should throw an error when no conversion function is found', function() {
    assert.throws(
      function () {typed.convert(2, 'boolean')},
      /no conversions to boolean/);
    assert.throws(
      function () {typed.convert(null, 'string')},
      /Cannot convert null to string/);
  });

  it('should pick the right conversion function when a value matches multiple types', () => {
    // based on https://github.com/josdejong/typed-function/issues/128
    const typed2 = typed.create()

    typed2.clear()
    typed2.addTypes([
      {
        name: 'number',
        test: x => typeof x === 'number'
      },
      {
        name: 'identifier',
        test: x => (typeof x === 'string' &&
          /^\p{Alphabetic}[\d\p{Alphabetic}]*$/u.test(x))
      },
      {
        name: 'string',
        test: x => typeof x === 'string'
      },
      {
        name: 'boolean',
        test: x => typeof x === 'boolean'
      }
    ])

    typed2.addConversion({ from: 'string', to: 'number', convert: x => parseFloat(x) })

    const check = typed2('check', {
      identifier: i => 'found an identifier: ' + i,
      string: s => s + ' is just a string'
    })

    assert.strictEqual(check('xy33'), 'found an identifier: xy33')
    assert.strictEqual(check('Wow!'), 'Wow! is just a string')

    assert.strictEqual(typed2.convert('123.5', 'number'), 123.5)
    assert.strictEqual(typed2.convert('Infinity', 'number'), Infinity)

    const check2 = typed2({boolean: () => 'yes'})
    assert.throws(() => check2('x'), /TypeError:.*identifier.?|.?string/)
  });
});
