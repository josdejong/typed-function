async function run () {
  const typed = (await import('../../lib/esm/typed-function.js')).default

  // create a typed function
  const fn1 = typed({
    'number, string': function (a, b) {
      return 'a is a number, b is a string'
    }
  })

  // use the function
  // outputs 'a is a number, b is a string'
  const result = fn1(2, 'foo')
  console.log(result)
}

run().catch(console.error)
