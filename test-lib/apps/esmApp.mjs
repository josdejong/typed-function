import typed from '../../lib/esm/typed-function.js'

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
