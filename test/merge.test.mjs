import assert from 'assert'
import typed from '../src/typed-function.mjs'

describe('merge', function () {
  it('should merge two typed-functions', function () {
    const typed1 = typed({ boolean: function (value) { return 'boolean:' + value } })
    const typed2 = typed({ number: function (value) { return 'number:' + value } })

    const typed3 = typed(typed1, typed2)

    assert.deepEqual(Object.keys(typed3.signatures).sort(), ['boolean', 'number'])

    assert.strictEqual(typed3(true), 'boolean:true')
    assert.strictEqual(typed3(2), 'number:2')
    assert.throws(function () { typed3('foo') }, /TypeError: Unexpected type of argument in function unnamed \(expected: number or boolean, actual: string, index: 0\)/)
  })

  it('should merge three typed-functions', function () {
    const typed1 = typed({ boolean: function (value) { return 'boolean:' + value } })
    const typed2 = typed({ number: function (value) { return 'number:' + value } })
    const typed3 = typed({ string: function (value) { return 'string:' + value } })

    const typed4 = typed(typed1, typed2, typed3)

    assert.deepEqual(Object.keys(typed4.signatures).sort(), ['boolean', 'number', 'string'])

    assert.strictEqual(typed4(true), 'boolean:true')
    assert.strictEqual(typed4(2), 'number:2')
    assert.strictEqual(typed4('foo'), 'string:foo')
    assert.throws(function () { typed4(new Date()) }, /TypeError: Unexpected type of argument in function unnamed \(expected: number or string or boolean, actual: Date, index: 0\)/)
  })

  it('should merge two typed-functions with a custom name', function () {
    const typed1 = typed('typed1', { boolean: function (value) { return 'boolean:' + value } })
    const typed2 = typed('typed2', { number: function (value) { return 'number:' + value } })

    const typed3 = typed('typed3', typed1, typed2)

    assert.equal(typed3.name, 'typed3')
  })

  it('should merge a typed function with an object of signatures', () => {
    const typed1 = typed({ boolean: b => !b, string: s => '!' + s })
    const typed2 = typed(typed1, { number: n => 1 - n })

    assert.equal(typed2(true), false)
    assert.equal(typed2('true'), '!true')
    assert.equal(typed2(1), 0)
  })

  it('should merge two objects of signatures', () => {
    const typed1 = typed(
      { boolean: b => !b, string: s => '!' + s },
      { number: n => 1 - n }
    )

    assert.equal(typed1(true), false)
    assert.equal(typed1('true'), '!true')
    assert.equal(typed1(1), 0)
  })

  it('should not copy conversions as exact signatures', function () {
    const typed2 = typed.create()
    typed2.addConversion(
      { from: 'string', to: 'number', convert: function (x) { return parseFloat(x) } }
    )

    const fn2 = typed2({ number: function (value) { return value } })

    assert.strictEqual(fn2(2), 2)
    assert.strictEqual(fn2('123'), 123)

    const fn1 = typed({ Date: function (value) { return value } })
    const fn3 = typed(fn1, fn2) // create via typed which has no conversions

    const date = new Date()
    assert.strictEqual(fn3(2), 2)
    assert.strictEqual(fn3(date), date)
    assert.throws(function () { fn3('123') }, /TypeError: Unexpected type of argument in function unnamed \(expected: number or Date, actual: string, index: 0\)/)
  })

  it('should allow merging duplicate signatures when pointing to the same function', function () {
    const typed1 = typed({ boolean: function (value) { return 'boolean:' + value } })

    const merged = typed(typed1, typed1)

    assert.deepEqual(Object.keys(merged.signatures).sort(), ['boolean'])
  })

  it('should throw an error in case of conflicting signatures when merging', function () {
    const typed1 = typed({ boolean: function (value) { return 'boolean:' + value } })
    const typed2 = typed({ boolean: function (value) { return 'boolean:' + value } })

    assert.throws(function () {
      typed(typed1, typed2)
    }, /Error: Signature "boolean" is defined twice/)
  })

  it('should throw an error in case of conflicting names when merging', function () {
    const typed1 = typed('fn1', { boolean: function () {} })
    const typed2 = typed('fn2', { string: function () {} })
    const typed3 = typed({ number: function () {} })

    assert.throws(function () {
      typed(typed1, typed2)
    }, /Error: Function names do not match \(expected: fn1, actual: fn2\)/)

    const typed4 = typed(typed2, typed3)
    assert.equal(typed4.name, 'fn2')
  })

  it('should be able to use referTo when merging signatures from multiple typed-functions', function () {
    function add1 (a, b) {
      return 'add1:' + (a + b)
    }

    function add2 (a, b) {
      return 'add2:' + (a + b)
    }

    const fn1 = typed({
      'number,number': add1,
      string: typed.referTo('number,number', (fnNumberNumber) => {
        return function (valuesString) {
          const values = valuesString.split(',').map(Number)
          return fnNumberNumber.apply(null, values)
        }
      })
    })

    const fn2 = typed({
      'number,number': add2
    })

    assert.equal(fn1('2,3'), 'add1:5')
    assert.equal(fn2(2, 3), 'add2:5')

    const fn3 = typed({
      ...fn1.signatures,
      ...fn2.signatures // <-- will override the 'number,number' signature of fn1 with the one of fn2
    })

    assert.equal(fn3('2,3'), 'add2:5')
  })

  it('should be able to use referToSelf across merged signatures', function () {
    const fn1 = typed({
      '...number': function (values) {
        let sum = 0
        for (let i = 0; i < values.length; i++) {
          sum += values[i]
        }
        return sum
      }
    })

    const fn2 = typed({
      '...string': typed.referToSelf((self) => {
        return function (values) {
          assert.strictEqual(self, fn3) // only holds after merging fn1 and fn2

          const newValues = []
          for (let i = 0; i < values.length; i++) {
            newValues[i] = parseInt(values[i], 10)
          }
          return self.apply(null, newValues)
        }
      })
    })

    const fn3 = typed(fn1, fn2)

    assert.equal(fn3('1', '2', '3'), '6')
    assert.equal(fn3(1, 2, 3), 6)
  })
})
