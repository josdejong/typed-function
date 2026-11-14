import assert from 'assert'
import typed from '../src/typed-function.mjs'

describe('registration introspection', function () {
  let instance

  beforeEach(function () {
    instance = typed.create()
  })

  it('lists the default types in type-checking order, including any', function () {
    const types = instance.getTypes()
    assert.deepStrictEqual(types.map(type => type.name), [
      'number', 'string', 'boolean', 'Function', 'Array', 'Date',
      'RegExp', 'Object', 'null', 'undefined', 'any'
    ])
    assert.strictEqual(types[0].test(2), true)
    assert.strictEqual(types[0].test('2'), false)
    assert.strictEqual(types[types.length - 1].isAny, true)
    assert.strictEqual(types[types.length - 1].test(Symbol('value')), true)
  })

  it('returns type definitions that cannot change registered type tests', function () {
    const test = value => value === 'custom'
    instance.addTypes([{ name: 'custom', test }], 'string')
    const types = instance.getTypes()
    assert.strictEqual(types[1].name, 'custom')
    assert.strictEqual(types[1].test, test)
    assert.deepStrictEqual(Object.keys(types[1]).sort(), ['isAny', 'name', 'test'])
    types[1].name = 'changed'
    types[1].test = () => false
    types[1].isAny = true
    types.length = 0

    const fn = instance({ custom: () => 'custom', string: () => 'string' })
    assert.strictEqual(fn('custom'), 'custom')
    assert.strictEqual(fn('other'), 'string')
    assert.strictEqual(instance.getTypes()[1].name, 'custom')
  })

  it('returns type snapshots independent of clear and other instances', function () {
    const types = instance.getTypes()
    instance.clear()
    assert.strictEqual(types.length, 11)
    assert.deepStrictEqual(instance.getTypes().map(type => type.name), ['any'])
    assert.strictEqual(typed.create().getTypes().length, 11)
  })

  it('lists conversions in registration order without internal metadata', function () {
    const conversions = [
      { from: 'number', to: 'string', convert: String },
      { from: 'boolean', to: 'number', convert: Number },
      { from: 'boolean', to: 'string', convert: String }
    ]
    assert.deepStrictEqual(instance.getConversions(), [])
    instance.addConversions(conversions)
    assert.deepStrictEqual(instance.getConversions(), conversions)
  })

  it('returns conversion definitions that cannot change registered conversions', function () {
    const conversion = { from: 'boolean', to: 'number', convert: Number }
    instance.addConversion(conversion)
    const conversions = instance.getConversions()
    conversions[0].from = 'string'
    conversions[0].to = 'string'
    conversions[0].convert = () => -1
    conversions.push({ from: 'string', to: 'number', convert: Number })

    assert.strictEqual(instance.convert(true, 'number'), 1)
    assert.throws(() => instance.convert('2', 'number'), /Cannot convert 2 to number/)
    assert.deepStrictEqual(instance.getConversions(), [conversion])
  })

  it('reflects overrides and removals without changing earlier snapshots', function () {
    const original = { from: 'boolean', to: 'number', convert: Number }
    const replacement = { from: 'boolean', to: 'number', convert: () => 2 }
    instance.addConversion(original)
    const conversions = instance.getConversions()
    instance.addConversion(replacement, { override: true })
    assert.deepStrictEqual(instance.getConversions(), [replacement])
    assert.deepStrictEqual(conversions, [original])
    instance.removeConversion(replacement)
    assert.deepStrictEqual(instance.getConversions(), [])
    instance.addConversion(original)
    instance.clearConversions()
    assert.deepStrictEqual(instance.getConversions(), [])
    assert.deepStrictEqual(conversions, [original])
  })
})
