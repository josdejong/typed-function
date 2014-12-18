# typed-function

Type checking for JavaScript functions.

In JavaScript, functions can be called with any number and any type of arguments.
When writing a function, the easiest way is to just assume that the function
will be called with the correct input. This leaves the function's behavior on
invalid input undefined. The function may throw some error, or worse,
it may silently fail or return wrong results. Typical errors are
*TypeError: undefined is not a function* or *TypeError: Cannot call method
'request' of undefined*. These error messages are not very helpful. It can be
hard to debug them, as they can be the result of a series of nested function
calls manipulating and propagating invalid or incomplete data.

Often, JavaScript developers add some basic type checking where it is important,
using checks like `typeof fn === 'function'`, `date instanceof Date`, and
`Array.isArray(arr)`. For functions supporting multiple signatures,
the type checking logic can grow quite a bit, and distract from the actual
logic of the function.

For functions dealing with a considerable amount of type checking logic,
or functions facing a public API, it can be very useful to use the
`typed-function` module to handle the type-checking logic. This way:

-   Users of the function get useful and consistent error messages when using
    the function wrongly.
-   The function cannot silently fail or silently give wrong results due to
    invalid input.
-   Correct type of input is assured inside the function. The function's code
    becomes easier to understand as it only contains the actual function logic.
    Lower level utility functions called by the type-checked function can
    possibly be kept simpler as they don't need to do additional type checking.

It's important however not to *overuse* type checking:

-   Locking down the type of input that a function accepts can unnecessary limit
    it's flexibility. Keep functions as flexible and forgiving as possible,
    follow the
    [robustness principle](http://en.wikipedia.org/wiki/Robustness_principle)
    here: "be liberal in what you accept and conservative in what you send"
    (Postel's law).
-   There is no need to apply type checking to *all* functions. It may be
    enough to apply type checking to one tier of public facing functions.
-   There is a performance penalty involved for all type checking, so applying
    it everywhere can unnecessarily worsen the performance.


## Features

typed-function has the following features:

- Type-checking of input arguments.
- Automatic type conversion of arguments.
- Compose typed functions with multiple signatures.
- Supports union types, any type, variable arguments.
- Detailed error messaging.

Supported environments: node.js, Chrome, Firefox, Safari, Opera, IE9+.


## Load

Install via npm:

    npm install typed-function


## Usage

Example usage:

```js
var typed = require('typed-function');

// create a typed function
var fn1 = typed('number, string', function (a, b) {
  return 'a is a number, b is a string';
});

// create a typed function with multiple types per argument (type union)
var fn2 = typed('string, number | boolean', function (a, b) {
  return 'a is a string, b is a number or a boolean';
});

// create a typed function with any type argument
var fn3 = typed('string, any', function (a, b) {
  return 'a is a string, b can be anything';
});

// create a typed function with multiple signatures
var fn4 = typed({
  'number': function (a) {
    return 'a is a number';
  },
  'number, boolean': function (a, b) {
    return 'a is a number, b is a boolean';
  },
  'number, number': function (a, b) {
    return 'a is a number, b is a number';
  }
});

// use the functions
console.log(fn1(2, 'foo'));      // outputs 'a is a number, b is a string'
console.log(fn4(2));             // outputs 'a is a number'

// calling the function with a non-supported type signature will throw an error
try {
  fn2('hello', 'world');
}
catch (err) {
  console.log(err.toString());
  // outputs:  TypeError: Unexpected type of argument.
  //           Expected: number or boolean, actual: string, index: 1.
}
```


## Types

typed-function has the following built-in types:

- `null`
- `boolean`
- `number`
- `string`
- `function`
- `Array`
- `Date`
- `RegExp`
- `Object`

The following type expressions are supported:

- Multiple arguments: `string, number, function`
- Union types: `number | string`
- Variable arguments: `...number`
- Any type: `any`


## API

### Construction

A typed function can be constructed as:

```
typed(signature: string, fn: function) : function
typed(name: string, signature: string, fn: function) : function

typed(signatures: Object.<string, function>) : function
typed(name: string, signatures: Object.<string, function>) : function
```

### Properties

-   `typed.types: Object`

    A map with the object types as key and a type checking test as value.
    Custom types can be added like:

    ```js
    function Person(...) {
      ...
    }

    typed.types['Person'] = function (x) {
      return x instanceof Person;
    };
  ```

-   `typed.conversions: Array`

    An Array with built-in conversions. Empty by default. Can be used for example
    to defined conversions from `boolean` to `number`. For example:

    ```js
    typed.conversions.push({
      from: 'boolean',
      to: 'number',
      convert: function (x) {
        return +x;
    });
    ```

-   `typed.config: Object`

    An object with configuration options for typed-function:

    -   `minify: boolean`

        If true (default), the functions are generated from minified code.
        If false the typed-functions have a nicely readable .toString() source.


### Output

The functions generated with `typed({...})` have:

- A function `toString`. When `typed.config.minify` is set to `true` (is `false`
  by default), the `toString` function will return well readable code which can
  be used to see what the function exactly does. For debugging purposes.
- A property `signatures`, which holds a map with the (normalized)
  signatures as key and the original sub-functions as value.


## Roadmap

### Version 1

- Extend function signatures:
  - Optional arguments like `'[number], array'` or like `number=, array`
  - Nullable arguments like `'?Object'`
- Be able to merge typed functions into a new typed function, like
  `fn1 = merged(fn2, fn3)`.
- Create a good benchmark, to get insight in the overhead.
- Allow conversions not to be able to convert any input (for example string to
  number is not always possible).

### Version 2

- Extend function signatures:
  - Constants like `'"linear" | "cubic"'`, `'0..10'`, etc.
  - Object definitions like `'{name: string, age: number}'`
  - Object definitions like `'Object.<string, Person>'`
  - Array definitions like `'Array.<Person>'`

## Test

To test the library, run:

    npm test


## Minify

To generate the minified version of the library, run:

    npm run minify
