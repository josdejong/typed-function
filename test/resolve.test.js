var assert = require('assert')
var typed = require('../typed-function')

describe('resolve', function () {

  before(() => typed.addConversion({
    from: 'boolean', to: 'string', convert: x => '' + x
  }))

  after(() => { typed.clearConversions() })

  it('should choose the signature that direct execution would', () => {
    const fn = typed({
      'number': n => 'b ' + n,
      'boolean': b => b ? 'c' : 'd',
      'number, string': (n, s) => 'e ' + n + ' ' + s,
      '...string': a => 'f ' + a.length,
      '...': a => 'g ' + a.length
    })
    const examples = [
      [3],
      ['hello'],
      [false],
      [3, 'me'],
      [0, true],
      ['x', 'y', 'z'],
      [false, 'y', false],
      [[1]],
      ['x', [1], 'z', 'w']
    ]
    for (example of examples) {
      assert.strictEqual(
        typed.resolve(fn, example).implementation.apply(null, example),
        fn.apply(fn, example)
      )
    }
  })
})
