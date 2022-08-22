import assert from 'assert'
import typed from '../src/typed-function.mjs'

describe('isTypedFunction', function () {
  function a () {}
  function b () {}

  const fn = typed('fn', {
    number: a,
    string: b
  })

  it('should distinguish typed functions from others', () => {
    assert.ok(typed.isTypedFunction(fn))
    assert.strictEqual(typed.isTypedFunction(a), false)
    assert.strictEqual(typed.isTypedFunction(7), false)
  })

  it('recognize typed functions from any typed instance', () => {
    const parallel = typed.create()
    const fn2 = parallel('fn', {
      number: b,
      string: a
    })

    assert.ok(parallel.isTypedFunction(fn2))
    assert.ok(parallel.isTypedFunction(fn))
    assert.ok(typed.isTypedFunction(fn2))
  })
})
