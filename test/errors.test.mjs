import assert from 'assert'
import typed from '../src/typed-function.mjs'

describe('errors', function () {
  it('should give correct error in case of too few arguments (named function)', function () {
    const fn = typed('fn1', { 'string, boolean': function () {} })

    assert.throws(function () { fn() }, /TypeError: Too few arguments in function fn1 \(expected: string, index: 0\)/)
    assert.throws(function () { fn('foo') }, /TypeError: Too few arguments in function fn1 \(expected: boolean, index: 1\)/)
  })

  it('should give correct error in case of too few arguments (unnamed function)', function () {
    const fn = typed({ 'string, boolean': function () {} })

    assert.throws(function () { fn() }, /TypeError: Too few arguments in function unnamed \(expected: string, index: 0\)/)
    assert.throws(function () { fn('foo') }, /TypeError: Too few arguments in function unnamed \(expected: boolean, index: 1\)/)
  })

  it('should give correct error in case of too few arguments (rest params)', function () {
    const fn = typed({ '...string': function () {} })

    assert.throws(function () { fn() }, /TypeError: Too few arguments in function unnamed \(expected: string, index: 0\)/)
  })

  it('should give correct error in case of too few arguments (rest params) (2)', function () {
    const fn = typed({ 'boolean, ...string': function () {} })

    assert.throws(function () { fn() }, /TypeError: Too few arguments in function unnamed \(expected: boolean, index: 0\)/)
    assert.throws(function () { fn(true) }, /TypeError: Too few arguments in function unnamed \(expected: string, index: 1\)/)
  })

  it('should give correct error in case of too many arguments (unnamed function)', function () {
    const fn = typed({ 'string, boolean': function () {} })

    assert.throws(function () { fn('foo', true, 2) }, /TypeError: Too many arguments in function unnamed \(expected: 2, actual: 3\)/)
    assert.throws(function () { fn('foo', true, 2, 1) }, /TypeError: Too many arguments in function unnamed \(expected: 2, actual: 4\)/)
  })

  it('should give correct error in case of too many arguments (named function)', function () {
    const fn = typed('fn2', { 'string, boolean': function () {} })

    assert.throws(function () { fn('foo', true, 2) }, /TypeError: Too many arguments in function fn2 \(expected: 2, actual: 3\)/)
    assert.throws(function () { fn('foo', true, 2, 1) }, /TypeError: Too many arguments in function fn2 \(expected: 2, actual: 4\)/)
  })

  it('should give correct error in case of wrong type of argument (unnamed function)', function () {
    const fn = typed({ boolean: function () {} })

    assert.throws(function () { fn('foo') }, /TypeError: Unexpected type of argument in function unnamed \(expected: boolean, actual: string, index: 0\)/)
  })

  it('should give correct error in case of wrong type of argument (named function)', function () {
    const fn = typed('fn3', { boolean: function () {} })

    assert.throws(function () { fn('foo') }, /TypeError: Unexpected type of argument in function fn3 \(expected: boolean, actual: string, index: 0\)/)
  })

  it('should give correct error in case of wrong type of argument (union args)', function () {
    const fn = typed({ 'boolean | string | Date': function () {} })

    assert.throws(function () { fn(2) }, /TypeError: Unexpected type of argument in function unnamed \(expected: string or boolean or Date, actual: number, index: 0\)/)
  })

  it('should give correct error in case of conflicting union arguments', function () {
    assert.throws(function () {
      typed({
        'string | number': function () {},
        string: function () {}
      })
    }, /TypeError: Conflicting signatures "string\|number" and "string"/)
  })

  it('should give correct error in case of conflicting union arguments (2)', function () {
    assert.throws(function () {
      typed({
        '...string | number': function () {},
        '...string': function () {}
      })
    }, /TypeError: Conflicting signatures "...string\|number" and "...string"/)
  })

  it('should give correct error in case of conflicting rest params (1)', function () {
    assert.throws(function () {
      typed({
        '...string': function () {},
        string: function () {}
      })
    }, /TypeError: Conflicting signatures "...string" and "string"/)
  })

  it('should give correct error in case of conflicting rest params (2)', function () {
    // should not throw
    typed({
      '...string': function () {},
      'string, number': function () {}
    })

    assert.throws(function () {
      typed({
        '...string': function () {},
        'string, string': function () {}
      })
    }, /TypeError: Conflicting signatures "...string" and "string,string"/)
  })

  it('should give correct error in case of conflicting rest params (3)', function () {
    assert.throws(function () {
      typed({
        '...number|string': function () {},
        'number, string': function () {}
      })
    }, /TypeError: Conflicting signatures "...number\|string" and "number,string"/)
  })

  it('should give correct error in case of wrong type of argument (rest params)', function () {
    const fn = typed({ '...number': function () {} })

    assert.throws(function () { fn(true) }, /TypeError: Unexpected type of argument in function unnamed \(expected: number, actual: boolean, index: 0\)/)
    assert.throws(function () { fn(2, true) }, /TypeError: Unexpected type of argument in function unnamed \(expected: number, actual: boolean, index: 1\)/)
    assert.throws(function () { fn(2, 3, true) }, /TypeError: Unexpected type of argument in function unnamed \(expected: number, actual: boolean, index: 2\)/)
  })

  it('should give correct error in case of wrong type of argument (nested rest params)', function () {
    const fn = typed({ 'string, ...number': function () {} })

    assert.throws(function () { fn(true) }, /TypeError: Unexpected type of argument in function unnamed \(expected: string, actual: boolean, index: 0\)/)
    assert.throws(function () { fn('foo', true) }, /TypeError: Unexpected type of argument in function unnamed \(expected: number, actual: boolean, index: 1\)/)
    assert.throws(function () { fn('foo', 2, true) }, /TypeError: Unexpected type of argument in function unnamed \(expected: number, actual: boolean, index: 2\)/)
    assert.throws(function () { fn('foo', 2, 3, true) }, /TypeError: Unexpected type of argument in function unnamed \(expected: number, actual: boolean, index: 3\)/)
  })

  it('should give correct error in case of wrong type of argument (union and rest params)', function () {
    const fn = typed({ '...number|boolean': function () {} })

    assert.throws(function () { fn('foo') }, /TypeError: Unexpected type of argument in function unnamed \(expected: number or boolean, actual: string, index: 0\)/)
    assert.throws(function () { fn(2, 'foo') }, /TypeError: Unexpected type of argument in function unnamed \(expected: number or boolean, actual: string, index: 1\)/)
    assert.throws(function () { fn(2, true, 'foo') }, /TypeError: Unexpected type of argument in function unnamed \(expected: number or boolean, actual: string, index: 2\)/)
  })

  it('should only list matches of exact and convertable types', function () {
    const typed2 = typed.create()
    typed2.addConversion({
      from: 'number',
      to: 'string',
      convert: function (x) {
        return +x
      }
    })

    const fn1 = typed2({ string: function () {} })
    const fn2 = typed2({ '...string': function () {} })

    assert.throws(function () { fn1(true) }, /TypeError: Unexpected type of argument in function unnamed \(expected: string or number, actual: boolean, index: 0\)/)
    assert.throws(function () { fn2(true) }, /TypeError: Unexpected type of argument in function unnamed \(expected: string or number, actual: boolean, index: 0\)/)
    assert.throws(function () { fn2(2, true) }, /TypeError: Unexpected type of argument in function unnamed \(expected: string or number, actual: boolean, index: 1\)/)
  })
})
