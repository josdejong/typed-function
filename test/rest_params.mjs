import assert from 'assert'
import typed from '../src/typed-function.mjs'
import { strictEqualArray } from './strictEqualArray.mjs'

describe('rest parameters', function () {
  it('should create a typed function with rest parameters', function () {
    const sum = typed({
      '...number': function (values) {
        assert(Array.isArray(values))
        let sum = 0
        for (let i = 0; i < values.length; i++) {
          sum += values[i]
        }
        return sum
      }
    })

    assert.equal(sum(2), 2)
    assert.equal(sum(2, 3, 4), 9)
    assert.throws(function () { sum() }, /TypeError: Too few arguments in function unnamed \(expected: number, index: 0\)/)
    assert.throws(function () { sum(true) }, /TypeError: Unexpected type of argument in function unnamed \(expected: number, actual: boolean, index: 0\)/)
    assert.throws(function () { sum('string') }, /TypeError: Unexpected type of argument in function unnamed \(expected: number, actual: string, index: 0\)/)
    assert.throws(function () { sum(2, 'string') }, /TypeError: Unexpected type of argument in function unnamed \(expected: number, actual: string, index: 1\)/)
    assert.throws(function () { sum(2, 3, 'string') }, /TypeError: Unexpected type of argument in function unnamed \(expected: number, actual: string, index: 2\)/)
  })

  it('should create a typed function with rest parameters (2)', function () {
    const fn = typed({
      'string, ...number': function (str, values) {
        assert.equal(typeof str, 'string')
        assert(Array.isArray(values))
        return str + ': ' + values.join(', ')
      }
    })

    assert.equal(fn('foo', 2), 'foo: 2')
    assert.equal(fn('foo', 2, 4), 'foo: 2, 4')
    assert.throws(function () { fn(2, 4) }, /TypeError: Unexpected type of argument in function unnamed \(expected: string, actual: number, index: 0\)/)
    assert.throws(function () { fn('string') }, /TypeError: Too few arguments in function unnamed \(expected: number, index: 1\)/)
    assert.throws(function () { fn('string', 'string') }, /TypeError: Unexpected type of argument in function unnamed \(expected: number, actual: string, index: 1\)/)
  })

  it('should create a typed function with any type arguments (1)', function () {
    const fn = typed({
      'string, ...any': function (str, values) {
        assert.equal(typeof str, 'string')
        assert(Array.isArray(values))
        return str + ': ' + values.join(', ')
      }
    })

    assert.equal(fn('foo', 2), 'foo: 2')
    assert.equal(fn('foo', 2, true, 'bar'), 'foo: 2, true, bar')
    assert.equal(fn('foo', 'bar'), 'foo: bar')
    assert.throws(function () { fn(2, 4) }, /TypeError: Unexpected type of argument in function unnamed \(expected: string, actual: number, index: 0\)/)
    assert.throws(function () { fn('string') }, /TypeError: Too few arguments in function unnamed \(expected: any, index: 1\)/)
  })

  it('should create a typed function with implicit any type arguments', function () {
    const fn = typed({
      'string, ...': function (str, values) {
        assert.equal(typeof str, 'string')
        assert(Array.isArray(values))
        return str + ': ' + values.join(', ')
      }
    })

    assert.equal(fn('foo', 2), 'foo: 2')
    assert.equal(fn('foo', 2, true, 'bar'), 'foo: 2, true, bar')
    assert.equal(fn('foo', 'bar'), 'foo: bar')
    assert.throws(function () { fn(2, 4) }, /TypeError: Unexpected type of argument in function unnamed \(expected: string, actual: number, index: 0\)/)
    assert.throws(function () { fn('string') }, /TypeError: Too few arguments in function unnamed \(expected: any, index: 1\)/)
  })

  it('should create a typed function with any type arguments (2)', function () {
    const fn = typed({
      'any, ...number': function (any, values) {
        assert(Array.isArray(values))
        return any + ': ' + values.join(', ')
      }
    })

    assert.equal(fn('foo', 2), 'foo: 2')
    assert.equal(fn(1, 2, 4), '1: 2, 4')
    assert.equal(fn(null, 2, 4), 'null: 2, 4')
    assert.throws(function () { fn('string') }, /TypeError: Too few arguments in function unnamed \(expected: number, index: 1\)/)
    assert.throws(function () { fn('string', 'string') }, /TypeError: Unexpected type of argument in function unnamed \(expected: number, actual: string, index: 1\)/)
  })

  it('should create a typed function with union type arguments', function () {
    const fn = typed({
      '...number|string': function (values) {
        assert(Array.isArray(values))
        return values
      }
    })

    strictEqualArray(fn(2, 3, 4), [2, 3, 4])
    strictEqualArray(fn('a', 'b', 'c'), ['a', 'b', 'c'])
    strictEqualArray(fn('a', 2, 'c', 3), ['a', 2, 'c', 3])
    assert.throws(function () { fn() }, /TypeError: Too few arguments in function unnamed \(expected: number or string, index: 0\)/)
    assert.throws(function () { fn('string', true) }, /TypeError: Unexpected type of argument. Index: 1 in function unnamed \(expected: string | number/)
    assert.throws(function () { fn(2, false) }, /TypeError: Unexpected type of argument. Index: 1 in function unnamed \(expected: string | number/)
    assert.throws(function () { fn(2, 3, false) }, /TypeError: Unexpected type of argument. Index: 2 in function unnamed \(expected: string | number/)
  })

  it('should create a composed function with rest parameters', function () {
    const fn = typed({
      'string, ...number': function (str, values) {
        assert.equal(typeof str, 'string')
        assert(Array.isArray(values))
        return str + ': ' + values.join(', ')
      },

      '...boolean': function (values) {
        assert(Array.isArray(values))
        return 'booleans'
      }
    })

    assert.equal(fn('foo', 2), 'foo: 2')
    assert.equal(fn('foo', 2, 4), 'foo: 2, 4')
    assert.equal(fn(true, false, false), 'booleans')
    assert.throws(function () { fn(2, 4) }, /TypeError: Unexpected type of argument in function unnamed \(expected: string or boolean, actual: number, index: 0\)/)
    assert.throws(function () { fn('string') }, /TypeError: Too few arguments in function unnamed \(expected: number, index: 1\)/)
    assert.throws(function () { fn('string', true) }, /TypeError: Unexpected type of argument in function unnamed \(expected: number, actual: boolean, index: 1\)/)
  })

  it('should continue with other options if rest params do not match', function () {
    const fn = typed({
      '...number': function (values) {
        return '...number'
      },

      Object: function (value) {
        return 'Object'
      }
    })

    assert.equal(fn(2, 3), '...number')
    assert.equal(fn(2), '...number')
    assert.equal(fn({}), 'Object')

    assert.equal(Object.keys(fn.signatures).length, 2)
    assert.ok('Object' in fn.signatures)
    assert.ok('...number' in fn.signatures)
  })

  it('should split rest params with conversions in two and order them correctly', function () {
    const typed2 = typed.create()
    typed2.addConversion(
      { from: 'string', to: 'number', convert: function (x) { return parseFloat(x) } }
    )

    const fn = typed2({
      '...number': function (values) {
        return values
      },

      '...string': function (value) {
        return value
      }
    })

    assert.deepEqual(fn(2, 3), [2, 3])
    assert.deepEqual(fn(2), [2])
    assert.deepEqual(fn(2, '4'), [2, 4])
    assert.deepEqual(fn('2', 4), [2, 4])
    assert.deepEqual(fn('foo'), ['foo'])
    assert.deepEqual(Object.keys(fn.signatures), [
      '...number',
      '...string'
    ])
  })

  it('should throw an error in case of unexpected rest parameters', function () {
    assert.throws(function () {
      typed({ '...number, string': function () {} })
    }, /SyntaxError: Unexpected rest parameter "...number": only allowed for the last parameter/)
  })

  it('should correctly interact with any', function () {
    const fn = typed({
      string: function () {
        return 'one'
      },
      '...any': function () {
        return 'two'
      }
    })

    assert.equal(fn('a'), 'one')
    assert.equal(fn([]), 'two')
    assert.equal(fn('a', 'a'), 'two')
    assert.equal(fn('a', []), 'two')
    assert.equal(fn([], []), 'two')
  })
})
