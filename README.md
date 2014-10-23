function-composer
=================

Compose functions with multiple type signatures.

Supported environments: node.js, Chrome, Firefox, Safari, Opera, IE9+.

# Load

Install via npm:

    npm install function-composer


# Usage

Example usage:

```js
var compose = require('function-composer');

// compose a new function
var fn = compose({
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


# Performance

Type checking input arguments adds some overhead to a function. For very small
functions this overhead can be larger than the function execution itself is, 
but for any non-trivial function the overhead is typically neglectable.
You need to keep in mind though that you probably would have to do the type
checking done by `function-composer` anyway.


# API

## Construction

```js
compose(signatures: Object.<string, function>) : function
compose(name: string, signatures: Object.<string, function>) : function
```

## Properties

- `compose.tests: Object`  
  A map with built-in type checking expressions.
- `compose.conversions: Array`  
  An Array with built-in conversions. Empty by default. Can be used for example 
  to defined conversions from `boolean` to `number`.


# Roadmap

- Add new types (already possible but not yet documented)
- Extend function signatures:
  - Any type arguments like `'*, boolean'`.
  - Ellipsis like `'string, ...'`.
  - Optional arguments like `'number?, array'`.
  - Multiple types per argument like `number | string, number'`.
- Create a good benchmark, to get insight in the overhead.
- Add a bundle for use in the browser.
