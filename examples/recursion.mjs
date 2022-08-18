import typed from '../src/typed-function.mjs';

// create a typed function that invokes itself
var sqrt = typed({
  'number': function (value) {
    return Math.sqrt(value);
  },
  'string': typed.referToSelf(self => function (value) {
    return self(parseInt(value, 10));
  })
});

// use the typed function
console.log(sqrt("9"));         // output: 3
