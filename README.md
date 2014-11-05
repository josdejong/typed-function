typed-function
=================

Type checking for JavaScript functions.

Features:

- Type-checking of input arguments.
- Automatic type conversion of arguments.
- Compose multiple functions with different signatures into one.

Supported environments: node.js, Chrome, Firefox, Safari, Opera, IE9+.

## Load

Install via npm:

    npm install typed-function


## Usage

Example usage:

```js
var typed = require('typed-function');

// compose a new function
var fn = typed({
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

// use the function
console.log(fn(2, true));      // outputs 'a is a number, b is a boolean'
console.log(fn(2));            // outputs 'a is a number'

// calling the function with a non-supported type signature will throw an error
try {
  fn('hello world');
}
catch (err) {
  console.log(err.toString()); // outputs: 'TypeError: Wrong function signature'
}
```


## Performance

Type checking input arguments adds some overhead to a function. For very small
functions this overhead can be larger than the function execution itself is, 
but for any non-trivial function the overhead is typically small to neglectable.
You need to keep in mind though that you probably would have to do the type
checking done by `typed-function` anyway.


## API

### Construction

A function is constructed as:

```js
typed(signatures: Object.<string, function>) : function
typed(name: string, signatures: Object.<string, function>) : function
```

### Properties

- `typed.types: Object`
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

- `typed.conversions: Array`
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

### Types

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
- `*` (anytype)


### Output

The functions generated with `typed({...})` have:

- A `toString()` function which returns well readable code, giving insight in
  what the function exactly does.
- A property `signatures`, which holds a map with the (normalized)
  signatures as key and the original sub-functions as value.


## Roadmap

### Version 1

- Extend function signatures:
  - Any type arguments like `'*, boolean'`
  - Ellipsis like `'string, ...'`
  - Optional arguments like `'number?, array'`
  - Multiple types per argument like `number | string, number'`
- Detailed error messages.
- Create a good benchmark, to get insight in the overhead.
- Allow conversions not to be able to convert any input (for example string to
  number is not always possible).

### Version 2

- Extend function signatures:
  - Constants like `'"linear" | "cubic"'`.
  - Object definitions like `'{name: string, age: number}'`
  - Object definitions like `'Object.<string, Person>'`
  - Array definitions like `'Array.<Person>'`

## Test

To test the library, run:

    npm test


## Minify

To generate the minified version of the library, run:

    npm run minify
