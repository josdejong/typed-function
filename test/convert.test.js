var assert = require('assert');
var typed = require('../typed-function');

describe('convert', function () {

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

  it('should convert a value', function() {
    assert.strictEqual(typed.convert(2, 'string'), '2');
    assert.strictEqual(typed.convert(true, 'string'), 'true');
    assert.strictEqual(typed.convert(true, 'number'), 1);
  });

  it('should return same value when conversion is not needed', function () {
    assert.strictEqual(typed.convert(2, 'number'), 2);
    assert.strictEqual(typed.convert(true, 'boolean'), true);
  });

  it('should throw an error when no conversion function is found', function() {
    assert.throws(function () {typed.convert(2, 'boolean')}, /Error: Cannot convert from number to boolean/);
  });

  it('should pick the right conversion function when a value matches multiple types', () => {
    // based on https://github.com/josdejong/typed-function/issues/128
    const typed2 = typed.create()

    typed2.types = [
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
      }
    ]

    typed2.addConversion({ from: 'string', to: 'number', convert: x => parseFloat(x) })

    const check = typed2('check', {
      identifier: i => 'found an identifier: ' + i,
      string: s => s + ' is just a string'
    })

    assert.strictEqual(check('xy33'), 'found an identifier: xy33')
    assert.strictEqual(check('Wow!'), 'Wow! is just a string')

    assert.strictEqual(typed2.convert('123.5', 'number'), 123.5)
    assert.strictEqual(typed2.convert('Infinity', 'number'), Infinity)
  })
});
