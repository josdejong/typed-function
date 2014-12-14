# typed-function

Type checking for JavaScript functions.

Features:

- Type-checking of input arguments.
- Automatic type conversion of arguments.
- Compose typed functions with multiple signatures.
- Supports union types, any type, variable arguments.

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
  fn4('hello world');
}
catch (err) {
  console.log(err.toString());   // outputs: 'TypeError: Wrong function signature'
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

- Multiple parameters: `string, number, function`
- Union types: `number | string`
- Variable parameters: `...number`
- Any type: `any`


## API

### Construction

A typed function can be constructed as:

```js
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


## Performance

Type checking input arguments adds some overhead to a function. For very small
functions this overhead can be larger than the function execution itself is,
but for any non-trivial function the overhead is typically small to neglectable.
You need to keep in mind though that you probably would have to do the type
checking done by `typed-function` anyway.


## Roadmap

### Version 1

- Extend function signatures:
  - Optional arguments like `'[number], array'` or like `number=, array`
  - Nullable arguments like `'?Object'`
- Detailed error messages.
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
