# History


## 2024-06-05, version 4.2.1

- Fix a bug in the new `override` option of method `addConversion`.


## 2024-06-05, version 4.2.0

- Extend methods `addConversion` and `addConversions` with a new option 
  `{ override: boolean }` to allow overriding an existing conversion.


## 2023-09-13, version 4.1.1

- Fix #168: add a `"license": "MIT"` field to the `package.json` file.


## 2022-08-23, version 4.1.0

- Publish an UMD version of the library, like in v3.0.0. It is still necessary.
  The UMD version can be used in CommonJS applications and in the browser.


## 2022-08-22, version 4.0.0

!!! BE CAREFUL: BREAKING CHANGES !!!

-   Breaking change: the code is converted into ES modules, and the library
    now outputs ES modules only instead of an UMD module. 
    -   If you're using `typed-function` inside and ES modules project, 
        all will just keep working like before:
        ```js
        import typed from 'typed-function'
        ```
    -   If you're using `typed-function` in a CommonJS project, you'll have to 
        import the library using a dynamic import:
        ```js
        const typed = (await import('typed-function')).default
        ```
    -   If you're importing `typed-function` straight into a browser page,
        you can load it as a module there:
        ```html
        <script type="module">
          import typed from 'typed-function/lib/esm/typed-function.mjs'
        </script>
        ```


## 2022-08-16, version 3.0.1

- Fix #157: `typed()` can enter infinite loop when there is both `referToSelf`  
  and `referTo` functions involved (#158). Thanks @gwhitney.
- Fix #155: `typed.addType()` fails if there is no `Object` type (#159).
  Thanks @gwhitney.


## 2022-05-12, version 3.0.0

!!! BE CAREFUL: BREAKING CHANGES !!!

Breaking changes:

- Fix #14: conversions now have preference over `any`. Thanks @gwhitney.

- The properties `typed.types` and `typed.conversions` have been removed.
    Instead of adding and removing types and conversions with those
    arrays, use the methods `addType`, `addTypes`, `addConversion`, 
    `addConversions`, `removeConversion`, `clear`, `clearConversions`.

- The `this` variable is no longer bound to the typed function itself but is 
    unbound. Instead, use `typed.referTo(...)` and `typed.referToSelf(...)`.

    By default, all function bodies will be scanned against the deprecated 
    usage pattern of `this`, and an error will be thrown when encountered. To 
    disable this validation step, set `typed.warnAgainstDeprecatedThis = false`.

    Example:
 
    ```js
    // old:
    const square = typed({
      'number': x => x * x,
      'string': x => this(parseFloat(x))
    })
  
    // new:
    const square = typed({
      'number': x => x * x,
      'string': typed.referToSelf(function (self) {
        // using self is not optimal, if possible,  
        // refer to a specific signature instead, 
        // see next example
        return x => self(parseFloat(x))
      })
    })

    // optimized new:
    const square = typed({
      'number': x => x * x,
      'string': typed.referTo('number', function (squareNumber) {
        return x => sqrtNumber(parseFloat(x))
      })
    })
    ```
  
- The property `typed.ignore` is removed. If you need it, see if you can
    create a new `typed` instance without the types that you want to ignore, or
    filter the signatures passed to `typed()` by hand.
- Drop official support for Nodejs 12. 

Non-breaking changes:

-   Implemented new static functions, Thanks @gwhitney:
    - `typed.referTo(...string, callback: (resolvedFunctions: ...function) => function)`
    - `typed.referToSelf(callback: (self) => function)`
    - `typed.isTypedFunction(entity: any): boolean`
    - `typed.resolve(fn: typed-function, argList: Array<any>): signature-object`
    - `typed.findSignature(fn: typed-function, signature: string | Array, options: object) : signature-object`
    - `typed.addType(type: {name: string, test: function, ignored?: boolean} [, beforeObjectTest=true]): void`
    - `typed.addTypes(types: TypeDef[] [, before = 'any']): void`
    - `typed.clear(): void`
    - `typed.addConversions(conversions: ConversionDef[]): void`
    - `typed.removeConversion(conversion: ConversionDef): void`
    - `typed.clearConversions(): void`
-   Refactored the `typed` constructor to be more flexible, accepting a
    combination of multiple typed functions or objects. And internally refactored
    the constructor to not use typed-function itself (#142). Thanks @gwhitney.
-   Extended the benchmark script and added counting of creation of typed
    functions (#146).
-   Fixes and extensions to `typed.find()` now correctly handling cases with
    rest or `any` parameters and matches requiring conversions; adds an
    `options` argument to control whether matches with conversions are allowed.
    Thanks @gwhitney.
-   Fix to `typed.convert()`: Will now find a conversion even in presence of
    overlapping types.
-   Reports all matching types in runtime errors, not just the first one.
-   Improved documentation. Thanks @gwhitney. 


## 2022-03-11, version 2.1.0

- Implemented configurable callbacks `typed.createError` and `typed.onMismatch`. 
  Thanks @gwhitney.


## 2020-07-03, version 2.0.0

- Drop official support for node.js 6 and 8, though no breaking changes 
  at this point.
- Implemented support for recursion using the `this` keyword. Thanks @nickewing. 


## 2019-08-22, version 1.1.1

- Fix #15: passing `null` to an `Object` parameter throws wrong error.


## 2018-07-28, version 1.1.0

- Implemented support for creating typed functions from a plain function
  having a property `signature`.
- Implemented providing a name when merging multiple typed functions.


## 2018-07-04, version 1.0.4

- By default, `addType` will insert new types before the `Object` test
  since the `Object` test also matches arrays and classes.
- Upgraded `devDependencies`.


## 2018-03-17, version 1.0.3

- Dropped usage of ES6 feature `Array.find`, so typed-function is
  directly usable on any ES5 compatible JavaScript engine (like IE11).


## 2018-03-17, version 1.0.2

- Fixed typed-function not working on browsers that don't allow
  setting the `name` property of a function.


## 2018-02-21, version 1.0.1

- Upgraded dev dependencies.


## 2018-02-20, version 1.0.0

Version 1.0.0 is rewritten from scratch. The API is the same,
though generated error messages may differ slightly.

Version 1.0.0 no longer uses `eval` under the hood to achieve good
performance. This reduces security risks and makes typed-functions
easier to debug.

Type `Object` is no longer treated specially from other types. This
means that the test for `Object` must not give false positives for
types like `Array`, `Date`, or class instances.

In version 1.0.0, support for browsers like IE9, IE10 is dropped,
though typed-function can still work when using es5 and es6 polyfills.


## 2018-01-24, version 0.10.7

- Fixed the field `data.actual` in a `TypeError` message containing
  the type index instead of the actual type of the argument.


## 2017-11-18, version 0.10.6

- Fixed a security issue allowing to execute arbitrary JavaScript
  code via a specially prepared function name of a typed function.
  Thanks Masato Kinugawa.


## 2016-11-18, version 0.10.5

- Fixed the use of multi-layered use of `any` type. See #8.


## 2016-04-09, version 0.10.4

- Typed functions can only inherit names from other typed functions and no
  longer from regular JavaScript functions since these names are unreliable:
  they can be manipulated by minifiers and browsers.


## 2015-10-07, version 0.10.3

- Reverted the fix of v0.10.2 until the introduced issue with variable
  arguments is fixed too. Added unit test for the latter case.


## 2015-10-04, version 0.10.2

- Fixed support for using `any` multiple times in a single signture.
  Thanks @luke-gumbley.


## 2015-07-27, version 0.10.1

- Fixed functions `addType` and `addConversion` not being robust against
  replaced arrays `typed.types` and `typed.conversions`.


## 2015-07-26, version 0.10.0

- Dropped support for the following construction signatures in order to simplify
  the API:
  - `typed(signature: string, fn: function)`
  - `typed(name: string, signature: string, fn: function)`
- Implemented convenience methods `typed.addType` and `typed.addConversion`.
- Changed the casing of the type `'function'` to `'Function'`. Breaking change.
- `typed.types` is now an ordered Array containing objects 
  `{name: string, test: function}`. Breaking change.
- List with expected types in error messages no longer includes converted types.


## 2015-05-17, version 0.9.0

- `typed.types` is now an ordered Array containing objects 
  `{type: string, test: function}` instead of an object. Breaking change.
- `typed-function` now allows merging typed functions with duplicate signatures
  when they point to the same function.


## 2015-05-16, version 0.8.3

- Function `typed.find` now throws an error instead of returning `null` when a 
  signature is not found.
- Fixed: the attached signatures no longer contains signatures with conversions.


## 2015-05-09, version 0.8.2

- Fixed function `typed.convert` not handling the case where the value already
  has the requested type. Thanks @rjbaucells.


## 2015-05-09, version 0.8.1

- Implemented option `typed.ignore` to ignore/filter signatures of a typed
  function.


## 2015-05-09, version 0.8.0

- Implemented function `create` to create a new instance of typed-function.
- Implemented a utility function `convert(value, type)` (#1).
- Implemented a simple `typed.find` function to find the implementation of a
  specific function signature.
- Extended the error messages to denote the function name, like `"Too many 
  arguments in function foo (...)"`.


## 2015-04-17, version 0.7.0

- Performance improvements.


## 2015-03-08, version 0.6.3

- Fixed generated internal Signature and Param objects not being cleaned up
  after the typed function has been generated.


## 2015-02-26, version 0.6.2

- Fixed a bug sometimes not ordering the handling of any type arguments last.
- Fixed a bug sometimes not choosing the signature with the lowest number of
  conversions.


## 2015-02-07, version 0.6.1

- Large code refactoring.
- Fixed bugs related to any type parameters.


## 2015-01-16, version 0.6.0

- Removed the configuration option `minify`
  (it's not clear yet whether minifying really improves the performance).
- Internal code simplifications.
- Bug fixes.


## 2015-01-07, version 0.5.0

- Implemented support for merging typed functions.
- Typed functions inherit the name of the function in case of one signature.
- Fixed a bug where a regular argument was not matched when there was a
  signature with variable arguments too.
- Slightly changed the error messages.


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
