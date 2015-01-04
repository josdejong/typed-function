# History

## not yet released, version 0.5.0

- Implemented support for merging typed functions.
- Fixed a bug where a regular argument was not matched when there was a
  signature with variable arguments too.


## 2014-12-17, version 0.4.0

- Introduced new constructor options, create a typed function as
  `typed([name,] signature, fn)` or `typed([name,] signatures)`.
- Support for multiple types per parameter like `number | string, number'`.
- Support for variable parameters like `sting, ...number'`.
- Changed any type notation `'*'` to `'any'`.
- Implemented detailed error messages.
- Implemented option `typed.config.minify`.


## 2014-11-05, version 0.3.1

- Renamed module to `typed-function`.


## 2014-11-05, version 0.3.0

- Implemented support for any type arguments (denoted with `*`).


## 2014-10-23, version 0.2.0

- Implemented support for named functions.
- Implemented support for type conversions.
- Implemented support for custom types.
- Library packaged as UMD, usable with CommonJS (node.js), AMD, and browser globals.


## 2014-10-21, version 0.1.0

- Implemented support for functions with zero, one, or multiple arguments.


## 2014-10-19, version 0.0.1

- First release (no functionality yet)
