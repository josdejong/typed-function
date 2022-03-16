var assert = require('assert')
var typed = require('../typed-function')

describe('isTypedFunction', function () {

  function a () {}
  function b () {}

  var fn = typed('fn', {
    'number': a,
    'string': b
  });

  it('should distinguish typed functions from others', () => {
    assert(typed.isTypedFunction(fn))
    assert.strictEqual(typed.isTypedFunction(a), false)
    assert.strictEqual(typed.isTypedFunction(7), false)
  })

  it('should only recognize typed functions from the same typed universe', () => {
    const parallel = typed.create()
    const fn2 = parallel('fn', {
      'number': b,
      'string': a
    })

    assert.ok(parallel.isTypedFunction(fn2))
    assert.strictEqual(parallel.isTypedFunction(fn), false)
    assert.strictEqual(typed.isTypedFunction(fn2), false)
  })

})
