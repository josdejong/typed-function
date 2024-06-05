import assert from 'assert'
import typed from '../src/typed-function.mjs'

function convertBool(b) {
  return +b
}

describe('conversion', function () {
  before(function () {
    typed.addConversions([
      { from: 'boolean', to: 'number', convert: convertBool },
      { from: 'boolean', to: 'string', convert: function (x) { return x + '' } },
      { from: 'number', to: 'string', convert: function (x) { return x + '' } },
      {
        from: 'string',
        to: 'Date',
        convert: function (x) {
          const d = new Date(x)
          return isNaN(d.valueOf()) ? undefined : d
        },
        fallible: true // TODO: not yet supported
      }
    ])
  })

  after(function () {
    // cleanup conversions
    typed.clearConversions()
  })

  it('should add conversions to a function with one argument', function () {
    const fn = typed({
      string: function (a) {
        return a
      }
    })

    assert.equal(fn(2), '2')
    assert.equal(fn(false), 'false')
    assert.equal(fn('foo'), 'foo')
  })

  it('should add a conversion using addConversion', function () {
    const typed2 = typed.create()

    const conversion = {
      from: 'number',
      to: 'string',
      convert: function (x) {
        return x + ''
      }
    }

    assert.strictEqual(typed2._findType('string').conversionsTo.length, 0)

    typed2.addConversion(conversion)

    assert.strictEqual(typed2._findType('string').conversionsTo.length, 1)
    assert.strictEqual(
      typed2._findType('string').conversionsTo[0].convert,
      conversion.convert)
  })

  it('should throw an error when a conversion already existing when using addConversion', function () {
    const typed2 = typed.create()

    const conversionA = { from: 'number', to: 'string', convert: () => 'a' }
    const conversionB = { from: 'number', to: 'string', convert: () => 'b' }


    typed2.addConversion(conversionA)

    assert.throws(() => {
      typed2.addConversion(conversionB)
    }, /There is already a conversion/)

    assert.throws(() => {
      typed2.addConversion(conversionB, { override: false })
    }, /There is already a conversion/)
  })

  it('should override a conversion using addConversion', function () {
    const typed2 = typed.create()

    const conversionA = { from: 'number', to: 'string', convert: () => 'a' }
    const conversionB = { from: 'number', to: 'string', convert: () => 'b' }

    typed2.addConversion(conversionA)
    assert.strictEqual(typed2._findType('string').conversionsTo.length, 1)
    assert.strictEqual(
      typed2._findType('string').conversionsTo[0].convert,
      conversionA.convert)

    typed2.addConversion(conversionB, { override: true })
    assert.strictEqual(typed2._findType('string').conversionsTo.length, 1)
    assert.strictEqual(
      typed2._findType('string').conversionsTo[0].convert,
      conversionB.convert)
  })

  it('should override a conversion using addConversions', function () {
    const typed2 = typed.create()

    // we add an unrelated conversion to ensure we cannot misuse the internal .index 
    // (which is more like an auto incrementing id)
    const conversionUnrelated = { from: 'string', to: 'boolean', convert: () => 'c' }
    typed2.addConversion(conversionUnrelated)

    const conversionA = { from: 'number', to: 'string', convert: () => 'a' }
    const conversionB = { from: 'number', to: 'string', convert: () => 'b' }

    typed2.addConversion(conversionA)
    assert.strictEqual(typed2._findType('string').conversionsTo.length, 1)
    assert.strictEqual(
      typed2._findType('string').conversionsTo[0].convert,
      conversionA.convert)

    typed2.addConversions([conversionB], { override: true })
    assert.strictEqual(typed2._findType('string').conversionsTo.length, 1)
    assert.strictEqual(
      typed2._findType('string').conversionsTo[0].convert,
      conversionB.convert)
  })

  it('should throw an error when passing an invalid conversion object to addConversion', function () {
    const typed2 = typed.create()
    const errMsg = /TypeError: Object with properties \{from: string, to: string, convert: function} expected/

    assert.throws(function () { typed2.addConversion({}) }, errMsg)
    assert.throws(function () { typed2.addConversion({ from: 'number', to: 'string' }) }, errMsg)
    assert.throws(function () { typed2.addConversion({ from: 'number', convert: function () { } }) }, errMsg)
    assert.throws(function () { typed2.addConversion({ to: 'string', convert: function () { } }) }, errMsg)
    assert.throws(function () { typed2.addConversion({ from: 2, to: 'string', convert: function () { } }) }, errMsg)
    assert.throws(function () { typed2.addConversion({ from: 'number', to: 2, convert: function () { } }) }, errMsg)
    assert.throws(function () { typed2.addConversion({ from: 'number', to: 'string', convert: 'foo' }) }, errMsg)
  })

  it('should throw an error when attempting to add a conversion to unknown type', function () {
    assert.throws(() => typed.addConversion({
      from: 'number',
      to: 'garbage',
      convert: () => null
    }), /Unknown type/)
  })

  it('should add conversions to a function with multiple arguments', function () {
    // note: we add 'string, string' first, and `string, number` afterwards,
    //       to test whether the conversions are correctly ordered.
    const fn = typed({
      'string, string': function (a, b) {
        assert.equal(typeof a, 'string')
        assert.equal(typeof b, 'string')
        return 'string, string'
      },
      'string, number': function (a, b) {
        assert.equal(typeof a, 'string')
        assert.equal(typeof b, 'number')
        return 'string, number'
      }
    })

    assert.equal(fn(true, false), 'string, number')
    assert.equal(fn(true, 2), 'string, number')
    assert.equal(fn(true, 'foo'), 'string, string')
    assert.equal(fn(2, false), 'string, number')
    assert.equal(fn(2, 3), 'string, number')
    assert.equal(fn(2, 'foo'), 'string, string')
    assert.equal(fn('foo', true), 'string, number')
    assert.equal(fn('foo', 2), 'string, number')
    assert.equal(fn('foo', 'foo'), 'string, string')
    assert.equal(Object.keys(fn.signatures).length, 2)
    assert.ok('string,number' in fn.signatures)
    assert.ok('string,string' in fn.signatures)
  })

  it('should add conversions to a function with rest parameters (1)', function () {
    const toNumber = typed({
      '...number': function (values) {
        assert(Array.isArray(values))
        return values
      }
    })

    assert.deepStrictEqual(toNumber(2, 3, 4), [2, 3, 4])
    assert.deepStrictEqual(toNumber(2, true, 4), [2, 1, 4])
    assert.deepStrictEqual(toNumber(1, 2, false), [1, 2, 0])
    assert.deepStrictEqual(toNumber(1, 2, true), [1, 2, 1])
    assert.deepStrictEqual(toNumber(true, 1, 2), [1, 1, 2])
    assert.deepStrictEqual(toNumber(true, false, true), [1, 0, 1])
  })

  it('should add conversions to a function with rest parameters (2)', function () {
    const sum = typed({
      'string, ...number': function (name, values) {
        assert.equal(typeof name, 'string')
        assert(Array.isArray(values))
        let sum = 0
        for (let i = 0; i < values.length; i++) {
          sum += values[i]
        }
        return sum
      }
    })

    assert.equal(sum('foo', 2, 3, 4), 9)
    assert.equal(sum('foo', 2, true, 4), 7)
    assert.equal(sum('foo', 1, 2, false), 3)
    assert.equal(sum('foo', 1, 2, true), 4)
    assert.equal(sum('foo', true, 1, 2), 4)
    assert.equal(sum('foo', true, false, true), 2)
    assert.equal(sum(123, 2, 3), 5)
    assert.equal(sum(false, 2, 3), 5)
  })

  it('should add conversions to a function with rest parameters in a non-conflicting way', function () {
    const fn = typed({
      '...number': function (values) {
        return values
      },
      boolean: function (value) {
        assert.equal(typeof value, 'boolean')
        return 'boolean'
      }
    })

    assert.deepStrictEqual(fn(2, 3, 4), [2, 3, 4])
    assert.deepStrictEqual(fn(2, true, 4), [2, 1, 4])
    assert.deepStrictEqual(fn(true, 3, 4), [1, 3, 4])
    assert.equal(fn(false), 'boolean')
    assert.equal(fn(true), 'boolean')
  })

  it('should add conversions to a function with rest parameters in a non-conflicting way', function () {
    const typed2 = typed.create()
    typed2.addConversions([
      { from: 'boolean', to: 'number', convert: function (x) { return +x } },
      { from: 'string', to: 'number', convert: function (x) { return parseFloat(x) } },
      { from: 'string', to: 'boolean', convert: function (x) { return !!x } }
    ])

    // booleans can be converted to numbers, so the `...number` signature
    // will match. But the `...boolean` signature is a better (exact) match so that
    // should be picked
    const fn = typed2({
      '...number': function (values) {
        return values
      },
      '...boolean': function (values) {
        return values
      }
    })

    assert.deepStrictEqual(fn(2, 3, 4), [2, 3, 4])
    assert.deepStrictEqual(fn(2, true, 4), [2, 1, 4])
    assert.deepStrictEqual(fn(true, true, true), [true, true, true])
  })

  it('should add conversions to a function with variable and union arguments', function () {
    const fn = typed({
      '...string | number': function (values) {
        assert(Array.isArray(values))
        return values
      }
    })

    assert.deepStrictEqual(fn(2, 3, 4), [2, 3, 4])
    assert.deepStrictEqual(fn(2, true, 4), [2, 1, 4])
    assert.deepStrictEqual(fn(2, 'str'), [2, 'str'])
    assert.deepStrictEqual(fn('str', true, false), ['str', 1, 0])
    assert.deepStrictEqual(fn('str', 2, false), ['str', 2, 0])

    assert.throws(function () { fn(new Date(), '2') }, /TypeError: Unexpected type of argument in function unnamed \(expected: string or number or boolean, actual: Date, index: 0\)/)
  })

  it('should order conversions and type Object correctly ', function () {
    const typed2 = typed.create()
    typed2.addConversion(
      { from: 'Date', to: 'string', convert: function (x) { return x.toISOString() } }
    )

    const fn = typed2({
      string: function () {
        return 'string'
      },
      Object: function () {
        return 'object'
      }
    })

    assert.equal(fn('foo'), 'string')
    assert.equal(fn(new Date(2018, 1, 20)), 'string')
    assert.equal(fn({ a: 2 }), 'object')
  })

  it('should add non-conflicting conversions to a function with one argument', function () {
    const fn = typed({
      number: function (a) {
        return a
      },
      string: function (a) {
        return a
      }
    })

    // booleans should be converted to number
    assert.strictEqual(fn(false), 0)
    assert.strictEqual(fn(true), 1)

    // numbers and strings should be left as is
    assert.strictEqual(fn(2), 2)
    assert.strictEqual(fn('foo'), 'foo')
  })

  it('should add non-conflicting conversions to a function with one argument', function () {
    const fn = typed({
      boolean: function (a) {
        return a
      }
    })

    // booleans should be converted to number
    assert.equal(fn(false), 0)
    assert.equal(fn(true), 1)
  })

  it('should add non-conflicting conversions to a function with two arguments', function () {
    const fn = typed({
      'boolean, boolean': function (a, b) {
        return 'boolean, boolean'
      },
      'number, number': function (a, b) {
        return 'number, number'
      }
    })

    // console.log('FN', fn.toString());

    // booleans should be converted to number
    assert.equal(fn(false, true), 'boolean, boolean')
    assert.equal(fn(2, 4), 'number, number')
    assert.equal(fn(false, 4), 'number, number')
    assert.equal(fn(2, true), 'number, number')
  })

  it('should add non-conflicting conversions to a function with three arguments', function () {
    const fn = typed({
      'boolean, boolean, boolean': function (a, b, c) {
        return 'booleans'
      },
      'number, number, number': function (a, b, c) {
        return 'numbers'
      }
    })

    // console.log('FN', fn.toString());

    // booleans should be converted to number
    assert.equal(fn(false, true, true), 'booleans')
    assert.equal(fn(false, false, 5), 'numbers')
    assert.equal(fn(false, 4, false), 'numbers')
    assert.equal(fn(2, false, false), 'numbers')
    assert.equal(fn(false, 4, 5), 'numbers')
    assert.equal(fn(2, false, 5), 'numbers')
    assert.equal(fn(2, 4, false), 'numbers')
    assert.equal(fn(2, 4, 5), 'numbers')
  })

  it('should only end up with one way to convert a signature', function () {
    const t2 = typed.create()
    t2.addConversions([
      { from: 'number', to: 'string', convert: n => 'N' + n },
      { from: 'Array', to: 'boolean', convert: A => A.length > 0 }
    ])
    const ambiguous = t2({
      'string, Array': (s, A) => 'one ' + s,
      'number, boolean': (n, b) => 'two' + n
    }) // Could be two ways to apply to 'number, Array'; want only one
    assert.strictEqual(ambiguous._typedFunctionData.signatures.length, 3)
    assert.strictEqual(
      t2.find(ambiguous, 'number, Array')(0, [0]),
      'two0')
  })

  it('should prefer conversions to any type argument', function () {
    const fn = typed({
      number: function (a) {
        return 'number'
      },
      any: function (a) {
        return 'any'
      }
    })

    assert.equal(fn(2), 'number')
    assert.equal(fn(true), 'number')
    assert.equal(fn('foo'), 'any')
    assert.equal(fn('{}'), 'any')
  })

  it('should allow removal of conversions', function () {
    const inc = typed({ number: n => n + 1 })
    assert.strictEqual(inc(true), 2)
    typed.removeConversion({
      from: 'boolean',
      to: 'number',
      convert: convertBool
    })
    assert.throws(() => typed.convert(false, 'number'), /no conversions/)
    const dec = typed({ number: n => n - 1 })
    assert.throws(() => dec(true), /TypeError: Unexpected type/)
    // But pre-existing functions remain OK:
    assert.strictEqual(inc(true), 2)
  })

  describe('ordering', function () {
    it('should correctly select the signatures with the least amount of conversions', function () {
      typed.clearConversions()
      typed.addConversions([
        { from: 'boolean', to: 'number', convert: function (x) { return +x } },
        { from: 'number', to: 'string', convert: function (x) { return x + '' } },
        { from: 'boolean', to: 'string', convert: function (x) { return x + '' } }
      ])

      const fn = typed({
        'boolean, boolean': function (a, b) {
          assert.equal(typeof a, 'boolean')
          assert.equal(typeof b, 'boolean')
          return 'booleans'
        },
        'number, number': function (a, b) {
          assert.equal(typeof a, 'number')
          assert.equal(typeof b, 'number')
          return 'numbers'
        },
        'string, string': function (a, b) {
          assert.equal(typeof a, 'string')
          assert.equal(typeof b, 'string')
          return 'strings'
        }
      })

      assert.equal(fn(true, true), 'booleans')
      assert.equal(fn(2, true), 'numbers')
      assert.equal(fn(true, 2), 'numbers')
      assert.equal(fn(2, 2), 'numbers')
      assert.equal(fn('foo', 'bar'), 'strings')
      assert.equal(fn('foo', 2), 'strings')
      assert.equal(fn(2, 'foo'), 'strings')
      assert.equal(fn(true, 'foo'), 'strings')
      assert.equal(fn('foo', true), 'strings')

      assert.equal(Object.keys(fn.signatures).length, 3)
      assert.ok('number,number' in fn.signatures)
      assert.ok('string,string' in fn.signatures)
      assert.ok('boolean,boolean' in fn.signatures)
    })

    it('should select the signatures with the conversion with the lowest index (1)', function () {
      typed.clearConversions()
      typed.addConversions([
        { from: 'boolean', to: 'string', convert: function (x) { return x + '' } },
        { from: 'boolean', to: 'number', convert: function (x) { return x + 0 } }
      ])

      // in the following typed function, a boolean input can be converted to
      // both a string or a number, which is both ok. In that case,
      // the conversion with the lowest index should be picked: boolean -> string
      const fn = typed({
        'string | number': function (a) {
          return a
        }
      })

      assert.strictEqual(fn(true), 'true')

      assert.equal(Object.keys(fn.signatures).length, 2)
      assert.ok('number' in fn.signatures)
      assert.ok('string' in fn.signatures)
    })

    it('should select the signatures with the conversion with the lowest index (2)', function () {
      typed.clearConversions()
      typed.addConversions([
        { from: 'boolean', to: 'number', convert: function (x) { return x + 0 } },
        { from: 'boolean', to: 'string', convert: function (x) { return x + '' } }
      ])

      // in the following typed function, a boolean input can be converted to
      // both a string or a number, which is both ok. In that case,
      // the conversion with the lowest index should be picked: boolean -> number
      const fn = typed({
        'string | number': function (a) {
          return a
        }
      })

      assert.strictEqual(fn(true), 1)
    })

    it('should select the signatures with least needed conversions (1)', function () {
      typed.clearConversions()
      typed.addConversions([
        { from: 'number', to: 'boolean', convert: function (x) { return !!x } },
        { from: 'number', to: 'string', convert: function (x) { return x + '' } },
        { from: 'boolean', to: 'string', convert: function (x) { return x + '' } }
      ])

      // in the following typed function, the number input can be converted to
      // both a string or a boolean, which is both ok. It should pick the
      // conversion to boolean because that is defined first
      const fn = typed({
        string: function (a) { return a },
        boolean: function (a) { return a }
      })

      assert.strictEqual(fn(1), true)
    })

    it('should select the signatures with least needed conversions (2)', function () {
      typed.clearConversions()
      typed.addConversions([
        { from: 'number', to: 'boolean', convert: function (x) { return !!x } },
        { from: 'number', to: 'string', convert: function (x) { return x + '' } },
        { from: 'boolean', to: 'string', convert: function (x) { return x + '' } }
      ])

      // in the following typed function, the number input can be converted to
      // both a string or a boolean, which is both ok. It should pick the
      // conversion to boolean because that conversion is defined first
      const fn = typed({
        'number, number': function (a, b) { return [a, b] },
        'string, string': function (a, b) { return [a, b] },
        'boolean, boolean': function (a, b) { return [a, b] }
      })

      assert.deepStrictEqual(fn('foo', 2), ['foo', '2'])
      assert.deepStrictEqual(fn(1, true), [true, true])
    })
  })
})
