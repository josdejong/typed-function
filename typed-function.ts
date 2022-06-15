/**
 * typed-function
 *
 * Type checking for JavaScript functions
 *
 * https://github.com/josdejong/typed-function
 */

function ok() {
  return true
}

function notOk() {
  return false
}

function undef() {
  return undefined
}

const NOT_TYPED_FUNCTION = "Argument is not a typed-function."

export type Signature = {
  params: Param[]
  fn: () => void // TODO fix
  test: (x: any) => boolean
  implementation: () => void // TODO fix
}

export type Param = {
  types: Type[]
  hasAny: boolean
  hasConversion: boolean
  restParam: boolean
  name: string
  typeSet: Set<string>
}

export type Type = {
  name: string
  typeIndex: number
  test: TestFunction
  isAny: boolean
  conversion?: ConversionDef
  conversionIndex: number
}

export type ConversionDef = {
  from: string
  to: string
  convert: ConversionDefConvertFunction
  index: number
}

export type ConversionDefConvertFunction = (x: any) => void

export type TypeDef = {
  name: string
  test: TestFunction
  isAny?: boolean
  index?: number // TODO check if should be non null?
  conversionsTo: any[] // TODO
}

export interface TypedFunction {
  (...args: any[]): any // TODO fix
  _typedFunctionData: any
  signatures: Signature[]
}

export interface TypedReference {
  referToSelf: {
    callback: (self: Function) => Function // TODO figure out
  }
  referTo: {
    callback: (self: Function) => Function // TODO figure out
    references: any[] // TODO figure out
  }
}

export type TestFunction = (x: any) => boolean

class TypedFunctionTypeError extends TypeError {
  data: {
    category: "wrongType" | 'tooFewArgs' | 'tooManyArgs' | 'mismatch'
    fn?: string
    index?: number
    actual?: string[]
    expected?: string[]
    expectedLength?: number
  } | null = null
}

class TypedFunctionError extends Error {
  data: {
    signature?: string
    actual?: string
    expected?: string
  } | null = {}
}

// create a new instance of typed-function
function create() {
  // data type tests

  /**
   * Returns true if the argument is a non-null "plain" object
   */
  function isPlainObject(x: any): x is object {
    return typeof x === "object" && x !== null && x.constructor === Object
  }

  const _types: TypeDef[] = [
    {
      name: "number",
      test: function (x: any): x is number {
        return typeof x === "number"
      },
      conversionsTo: [],
    },
    {
      name: "string",
      test: function (x: any): x is string {
        return typeof x === "string"
      },
      conversionsTo: [],
    },
    {
      name: "boolean",
      test: function (x: any): x is boolean {
        return typeof x === "boolean"
      },
      conversionsTo: [],
    },
    {
      name: "Function",
      test: function (x: any): x is Function {
        return typeof x === "function"
      },
      conversionsTo: [],
    },
    { name: "Array", test: Array.isArray, conversionsTo: [] },
    {
      name: "Date",
      test: function (x: any): x is Date {
        return x instanceof Date
      },
      conversionsTo: [],
    },
    {
      name: "RegExp",
      test: function (x: any): x is RegExp {
        return x instanceof RegExp
      },
      conversionsTo: [],
    },
    { name: "Object", test: isPlainObject, conversionsTo: [] },
    {
      name: "null",
      test: function (x: any): x is null {
        return x === null
      },
      conversionsTo: [],
    },
    {
      name: "undefined",
      test: function (x: any): x is undefined {
        return x === undefined
      },
      conversionsTo: [],
    },
  ]

  const anyType: TypeDef = {
    name: "any",
    test: ok,
    isAny: true,
    conversionsTo: [], // TODO check if this is right!!!
  }

  // Data structures to track the types. As these are local variables in
  // create(), each typed universe will get its own copy, but the variables
  // will only be accessible through the (closures of the) functions supplied
  // as properties of the typed object, not directly.
  // These will be initialized in clear() below
  let typeMap: Record<any, any> // primary store of all types
  let typeList: any[] // Array of just type names, for the sake of ordering

  // And similar data structures for the type conversions:
  let nConversions = 0
  // the actual conversions are stored on a property of the destination types

  // This is a temporary object, will be replaced with a function at the end
  let typed = { createCount: 0 }

  /**
   * Takes a type name and returns the corresponding official type object
   * for that type.
   */
  function findType(typeName: string): TypeDef {
    const type = typeMap.get(typeName)
    if (type) {
      return type
    }
    // Remainder is error handling
    let message = 'Unknown type "' + typeName + '"'
    const name = typeName.toLowerCase()
    let otherName
    for (otherName of typeList) {
      if (otherName.toLowerCase() === name) {
        message += '. Did you mean "' + otherName + '" ?'
        break
      }
    }
    throw new TypeError(message)
  }

  /**
   * Adds an array `types` of type definitions to this typed instance.
   * Each type definition should be an object with properties:
   * 'name' - a string giving the name of the type; 'test' - function
   * returning a boolean that tests membership in the type; and optionally
   * 'isAny' - true only for the 'any' type.
   *
   * The second optional argument, `before`, gives the name of a type that
   * these types should be added before. The new types are added in the
   * order specified.
   */
  function addTypes(types: TypeDef[], beforeSpec: "any" | false = "any") {
    const beforeIndex =
      (beforeSpec ? findType(beforeSpec).index : typeList.length) || 0 // TODO check if right!!!!!!!!

    const newTypes = []

    for (var i = 0; i < types.length; ++i) {
      if (
        !types[i] ||
        typeof types[i].name !== "string" ||
        typeof types[i].test !== "function"
      ) {
        throw new TypeError(
          "Object with properties {name: string, test: function} expected"
        )
      }
      const typeName = types[i].name
      if (typeMap.has(typeName)) {
        throw new TypeError('Duplicate type name "' + typeName + '"')
      }
      newTypes.push(typeName)
      typeMap.set(typeName, {
        name: typeName,
        test: types[i].test,
        isAny: types[i].isAny,
        index: beforeIndex + i, // TODO check if this is right!!!
        conversionsTo: [], // Newly added type can't have any conversions to it
      })
    }
    // update the typeList
    const affectedTypes = typeList.slice(beforeIndex)
    typeList = typeList
      .slice(0, beforeIndex)
      .concat(newTypes)
      .concat(affectedTypes)
    // Fix the indices
    for (let i = beforeIndex + newTypes.length; i < typeList.length; ++i) {
      typeMap.get(typeList[i]).index = i
    }
  }

  /**
   * Removes all types and conversions from this typed instance.
   * May cause previously constructed typed-functions to throw
   * strange errors when they are called with types that do not
   * match any of their signatures.
   */
  function clear() {
    typeMap = new Map()
    typeList = []
    nConversions = 0
    addTypes([anyType], false)
  }

  // initialize the types to the default list
  clear()
  addTypes(_types)

  /**
   * Removes all conversions, leaving the types alone.
   */
  function clearConversions() {
    let typeName
    for (typeName of typeList) {
      typeMap.get(typeName).conversionsTo = []
    }
    nConversions = 0
  }

  /**
   * Find the type names that match a value.
   * @return Array of names of types for which
   *                  the type test matches the value.
   */
  function findTypeNames(value: any): string[] {
    const matches = typeList.filter((name) => {
      const type = typeMap.get(name)
      return !type.isAny && type.test(value)
    })
    if (matches.length) {
      return matches
    }
    return ["any"]
  }

  /**
   * Check if an entity is a typed function created by any instance
   */
  function isTypedFunction(entity: any): entity is TypedFunction {
    return (
      entity && typeof entity === "function" && "_typedFunctionData" in entity
    )
  }

  /**
   * Find a specific signature from a (composed) typed function, for example:
   *
   *   typed.findSignature(fn, ['number', 'string'])
   *   typed.findSignature(fn, 'number, string')
   *   typed.findSignature(fn, 'number,string', {exact: true})
   *
   * This function findSignature will by default return the best match to
   * the given signature, possibly employing type conversions.
   *
   * The (optional) third argument is a plain object giving options
   * controlling the signature search. Currently the only implemented
   * option is `exact`: if specified as true (default is false), only
   * exact matches will be returned (i.e. signatures for which `fn` was
   * directly defined). Note that a (possibly different) type matching
   * `any`, or one or more instances of TYPE matching `...TYPE` are
   * considered exact matches in this regard, as no conversions are used.
   *
   * This function returns a "signature" object, as does `typed.resolve()`,
   * which is a plain object with four keys: `params` (the array of parameters
   * for this signature), `fn` (the originally supplied function for this
   * signature), `test` (a generated function that determines if an argument
   * list matches this signature, and `implementation` (the function to call
   * on a matching argument list, that performs conversions if necessary and
   * then calls the originally supplied function).
   *
   * @param fn A typed-function
   *     Signature to be found, can be an array or a comma separated string.
   * @paramControls the signature search as documented
   * @return Returns the matching signature, or throws an error when no signature
   *     is found.
   */

  type FindSignatureOptions = { exact: boolean }

  function findSignature(
    fn: TypedFunction,
    signature: string | string[],
    options?: FindSignatureOptions
  ): Signature {
    if (!isTypedFunction(fn)) {
      throw new TypeError(NOT_TYPED_FUNCTION)
    }

    // Canonicalize input
    const exact = options && options.exact
    const stringSignature = Array.isArray(signature)
      ? signature.join(",")
      : signature
    const params = parseSignature(stringSignature) || []
    const canonicalSignature = stringifyParams(params)

    // First hope we get lucky and exactly match a signature
    if (!exact || canonicalSignature in fn.signatures) {
      // OK, we can check the internal signatures
      const match = fn._typedFunctionData.signatureMap.get(canonicalSignature)
      if (match) {
        return match
      }
    }

    // Oh well, we did not; so we have to go back and check the parameters
    // one by one, in order to catch things like `any` and rest params.
    // Note here we can assume there is at least one parameter, because
    // the empty signature would have matched successfully above.
    const nParams = params.length
    let remainingSignatures
    if (exact) {
      remainingSignatures = []
      let name
      for (name in fn.signatures) {
        remainingSignatures.push(fn._typedFunctionData.signatureMap.get(name))
      }
    } else {
      remainingSignatures = fn._typedFunctionData.signatures
    }
    for (var i = 0; i < nParams; ++i) {
      const want = params[i]
      const filteredSignatures = []
      let possibility
      for (possibility of remainingSignatures) {
        const have = getParamAtIndex(possibility.params, i)
        if (!have || (want.restParam && !have.restParam)) {
          continue
        }
        if (!have.hasAny) {
          // have to check all of the wanted types are available
          const haveTypes = paramTypeSet(have)
          if (want.types.some((wtype) => !haveTypes.has(wtype.name))) {
            continue
          }
        }
        // OK, this looks good
        filteredSignatures.push(possibility)
      }
      remainingSignatures = filteredSignatures
      if (remainingSignatures.length === 0) break
    }
    // Return the first remaining signature that was totally matched:
    let candidate
    for (candidate of remainingSignatures) {
      if (candidate.params.length <= nParams) {
        return candidate
      }
    }

    throw new TypeError(
      "Signature not found (signature: " +
        (fn.name || "unnamed") +
        "(" +
        stringifyParams(params, ", ") +
        "))"
    )
  }

  /**
   * Find the proper function to call for a specific signature from
   * a (composed) typed function, for example:
   *
   *   typed.find(fn, ['number', 'string'])
   *   typed.find(fn, 'number, string')
   *   typed.find(fn, 'number,string', {exact: true})
   *
   * This function find will by default return the best match to
   * the given signature, possibly employing type conversions (and returning
   * a function that will perform those conversions as needed). The
   * (optional) third argument is a plain object giving options contolling
   * the signature search. Currently only the option `exact` is implemented,
   * which defaults to "false". If `exact` is specified as true, then only
   * exact matches will be returned (i.e. signatures for which `fn` was
   * directly defined). Uses of `any` and `...TYPE` are considered exact if
   * no conversions are necessary to apply the corresponding function.
   *
   * @param signature Signature to be found, can be an array or a comma separated string.
   * @param Controls the signature match as documented
   * @return  Returns the function to call for the given signature, or throws an error if no match is found.
   */
  function find(
    fn: TypedFunction,
    signature: string | string[],
    options: FindSignatureOptions
  ) {
    return findSignature(fn, signature, options).implementation
  }

  /**
   * Convert a given value to another data type, specified by type name.
   */
  function convert(value: any, typeName: string) {
    // check conversion is needed
    const type = findType(typeName)
    if (type.test(value)) {
      return value
    }
    const conversions = type.conversionsTo
    if (conversions.length === 0) {
      throw new Error("There are no conversions to " + typeName + " defined.")
    }
    for (var i = 0; i < conversions.length; i++) {
      const fromType = findType(conversions[i].from)
      if (fromType.test(value)) {
        return conversions[i].convert(value)
      }
    }

    throw new Error("Cannot convert " + value + " to " + typeName)
  }

  /**
   * Stringify parameters in a normalized way
   */
  function stringifyParams(params: Param[], separator: string = ",") {
    return params.map((p) => p.name).join(separator)
  }

  /**
   * Parse a parameter, like "...number | boolean"
   */
  function parseParam(param: string): Param {
    const restParam = param.indexOf("...") === 0
    const types = !restParam ? param : param.length > 3 ? param.slice(3) : "any"

    const typeDefs = types.split("|").map((s) => findType(s.trim()))

    let hasAny = false
    let paramName = restParam ? "..." : ""

    const exactTypes = typeDefs.map(function (type) {
      hasAny = type.isAny || hasAny
      paramName += type.name + "|"

      return {
        name: type.name,
        typeIndex: type.index,
        test: type.test,
        isAny: type.isAny,
        conversion: null,
        conversionIndex: -1,
        typeSet: new Set(),
      }
    })

    return {
      types: exactTypes,
      name: paramName.slice(0, -1), // remove trailing '|' from above
      hasAny: hasAny,
      hasConversion: false,
      restParam: restParam,
    }
  }

  /**
   * Expands a parsed parameter with the types available from currently
   * defined conversions.
   */
  function expandParam(param: Param) {
    const typeNames = param.types.map((t) => t.name)
    const matchingConversions = availableConversions(typeNames)
    let hasAny = param.hasAny
    let newName = param.name

    const convertibleTypes = matchingConversions.map(function (conversion) {
      const type = findType(conversion.from)
      hasAny = type.isAny || hasAny
      newName += "|" + conversion.from

      return {
        name: conversion.from,
        typeIndex: type.index || 0, // TODO check what to do here!!!
        test: type.test,
        isAny: type.isAny || false, // TODO check what to do here!!!
        conversion: conversion,
        conversionIndex: conversion.index,
      }
    })

    return {
      types: param.types.concat(convertibleTypes),
      name: newName,
      hasAny: hasAny,
      hasConversion: convertibleTypes.length > 0,
      restParam: param.restParam,
    }
  }

  /**
   * Return the set of type names in a parameter.
   * Caches the result for efficiency
   */
  function paramTypeSet(param: Param): Set<string> {
    if (!param.typeSet) {
      param.typeSet = new Set()
      param.types.forEach((type) => param.typeSet.add(type.name))
    }
    return param.typeSet
  }

  /**
   * Parse a signature with comma separated parameters,
   * like "number | boolean, ...string"
   */
  function parseSignature(rawSignature: string): Param[] | null {
    const params: Param[] = []

    if (typeof rawSignature !== "string") {
      throw new TypeError("Signatures must be strings")
    }
    const signature = rawSignature.trim()
    if (signature === "") {
      return params
    }

    const rawParams = signature.split(",")
    for (var i = 0; i < rawParams.length; ++i) {
      const parsedParam = parseParam(rawParams[i].trim())
      if (parsedParam.restParam && i !== rawParams.length - 1) {
        throw new SyntaxError(
          'Unexpected rest parameter "' +
            rawParams[i] +
            '": ' +
            "only allowed for the last parameter"
        )
      }
      // if invalid, short-circuit (all of the types may have been filtered)
      if (parsedParam.types.length == 0) {
        return null
      }
      params.push(parsedParam)
    }

    return params
  }

  /**
   * Test whether a set of params contains a restParam
   * @return Returns true when the last parameter is a restParam
   */
  function hasRestParam(params: Param[]) {
    const param = last(params)
    return param ? param.restParam : false
  }

  /**
   * Create a type test for a single parameter, which can have one or multiple
   * types.
   * @param {Param} param
   * @return {function(x: *) : boolean} Returns a test function
   */
  function compileTest(param: Param): TestFunction {
    if (!param || param.types.length === 0) {
      // nothing to do
      return ok
    } else if (param.types.length === 1) {
      return findType(param.types[0].name).test
    } else if (param.types.length === 2) {
      const test0 = findType(param.types[0].name).test
      const test1 = findType(param.types[1].name).test
      return function or(x) {
        return test0(x) || test1(x)
      }
    } else {
      // param.types.length > 2
      const tests = param.types.map(function (type) {
        return findType(type.name).test
      })
      return function or(x) {
        for (var i = 0; i < tests.length; i++) {
          if (tests[i](x)) {
            return true
          }
        }
        return false
      }
    }
  }

  /**
   * Create a test for all parameters of a signature
   */
  function compileTests(params: Param[]): TestFunction {
    let tests: TestFunction[]
    let test0: TestFunction
    let test1: TestFunction

    if (hasRestParam(params)) {
      // variable arguments like '...number'
      tests = initial(params).map(compileTest)
      const varIndex = tests.length
      const lastTest = compileTest(last(params))
      const testRestParam = function (args) {
        for (var i = varIndex; i < args.length; i++) {
          if (!lastTest(args[i])) {
            return false
          }
        }
        return true
      }

      return function testArgs(args) {
        for (var i = 0; i < tests.length; i++) {
          if (!tests[i](args[i])) {
            return false
          }
        }
        return testRestParam(args) && args.length >= varIndex + 1
      }
    } else {
      // no variable arguments
      if (params.length === 0) {
        return function testArgs(args) {
          return args.length === 0
        }
      } else if (params.length === 1) {
        test0 = compileTest(params[0])
        return function testArgs(args) {
          return test0(args[0]) && args.length === 1
        }
      } else if (params.length === 2) {
        test0 = compileTest(params[0])
        test1 = compileTest(params[1])
        return function testArgs(args) {
          return test0(args[0]) && test1(args[1]) && args.length === 2
        }
      } else {
        // arguments.length > 2
        tests = params.map(compileTest)
        return function testArgs(args) {
          for (var i = 0; i < tests.length; i++) {
            if (!tests[i](args[i])) {
              return false
            }
          }
          return args.length === tests.length
        }
      }
    }
  }

  /**
   * Find the parameter at a specific index of a Params list.
   * Handles rest parameters.
   * @return Returns the matching parameter when found,
   *                        null otherwise.
   */
  function getParamAtIndex(params: Param[], index: number) {
    return index < params.length
      ? params[index]
      : hasRestParam(params)
      ? last(params)
      : null
  }

  /**
   * Get all type names of a parameter
   * @return Returns an array with type names
   */
  function getTypeSetAtIndex(params: Param[], index: number) {
    const param = getParamAtIndex(params, index)
    if (!param) {
      return new Set<string>()
    }
    return paramTypeSet(param)
  }

  /**
   * Test whether a type is an exact type or conversion
   */
  function isExactType(type: Type) {
    return type.conversion === null || type.conversion === undefined
  }

  /**
   * Helper function for creating error messages: create an array with
   * all available types on a specific argument index.
   * @return Returns an array with available types
   */
  function mergeExpectedParams(signatures: Signature[], index: number): string[] {
    const typeSet = new Set<string>()
    signatures.forEach((signature) => {
      const paramSet = getTypeSetAtIndex(signature.params, index)
      let name
      for (name of paramSet) {
        typeSet.add(name)
      }
    })

    return typeSet.has("any") ? ["any"] : Array.from(typeSet)
  }

  /**
   * Create
   * @param name        The name of the function
   * @param args        The actual arguments passed to the function
   * @param signatures  A list with available signatures
   * @return Returns a type error with additional data
   *                     attached to it in the property `data`
   */
  function createError(
    name: string,
    args: any[],
    signatures: Signature[]
  ): TypedFunctionTypeError {
    let err, expected
    const _name = name || "unnamed"

    // test for wrong type at some index
    let matchingSignatures = signatures
    for (var index = 0; index < args.length; index++) {
      const nextMatchingDefs: Signature[] = []
      matchingSignatures.forEach((signature) => {
        const param = getParamAtIndex(signature.params, index)
        const test = compileTest(param)
        if (
          (index < signature.params.length || hasRestParam(signature.params)) &&
          test(args[index])
        ) {
          nextMatchingDefs.push(signature)
        }
      })

      if (nextMatchingDefs.length === 0) {
        // no matching signatures anymore, throw error "wrong type"
        expected = mergeExpectedParams(matchingSignatures, index)
        if (expected.length > 0) {
          const actualTypes = findTypeNames(args[index])

          err = new TypedFunctionTypeError(
            "Unexpected type of argument in function " +
              _name +
              " (expected: " +
              expected.join(" or ") +
              ", actual: " +
              actualTypes.join(" | ") +
              ", index: " +
              index +
              ")"
          )
          err.data = {
            category: "wrongType",
            fn: _name,
            index: index,
            actual: actualTypes,
            expected: expected,
          }
          return err
        }
      } else {
        matchingSignatures = nextMatchingDefs
      }
    }

    // test for too few arguments
    const lengths = matchingSignatures.map(function (signature) {
      return hasRestParam(signature.params) ? Infinity : signature.params.length
    })
    if (args.length < Math.min.apply(null, lengths)) {
      expected = mergeExpectedParams(matchingSignatures, index)
      err = new TypedFunctionTypeError(
        "Too few arguments in function " +
          _name +
          " (expected: " +
          expected.join(" or ") +
          ", index: " +
          args.length +
          ")"
      )
      err.data = {
        category: "tooFewArgs",
        fn: _name,
        index: args.length,
        expected: expected,
      }
      return err
    }

    // test for too many arguments
    const maxLength = Math.max.apply(null, lengths)
    if (args.length > maxLength) {
      err = new TypedFunctionTypeError(
        "Too many arguments in function " +
          _name +
          " (expected: " +
          maxLength +
          ", actual: " +
          args.length +
          ")"
      )
      err.data = {
        category: "tooManyArgs",
        fn: _name,
        index: args.length,
        expectedLength: maxLength,
      }
      return err
    }

    // Generic error
    const argTypes = []
    for (var i = 0; i < args.length; ++i) {
      argTypes.push(findTypeNames(args[i]).join("|"))
    }
    err = new TypedFunctionTypeError(
      'Arguments of type "' +
        argTypes.join(", ") +
        '" do not match any of the defined signatures of function ' +
        _name +
        "."
    )
    err.data = {
      category: "mismatch",
      actual: argTypes,
    }
    return err
  }

  /**
   * Find the lowest index of all exact types of a parameter (no conversions)
   * @return Returns the index of the lowest type in typed.types
   */
  function getLowestTypeIndex(param: Param) {
    let min = typeList.length + 1

    for (var i = 0; i < param.types.length; i++) {
      if (isExactType(param.types[i])) {
        min = Math.min(min, param.types[i].typeIndex)
      }
    }

    return min
  }

  /**
   * Find the lowest index of the conversion of all types of the parameter
   * having a conversion
   * @return {number} Returns the lowest index of the conversions of this type
   */
  function getLowestConversionIndex(param: Param) {
    let min = nConversions + 1

    for (var i = 0; i < param.types.length; i++) {
      if (!isExactType(param.types[i])) {
        min = Math.min(min, param.types[i].conversionIndex)
      }
    }

    return min
  }

  /**
   * Compare two params
   * @return returns -1 when param1 must get a lower index than param2, 1 when the opposite, or zero when both are equal
   */
  function compareParams(param1: Param, param2: Param) {
    // We compare a number of metrics on a param in turn:
    // 1) 'any' parameters are the least preferred
    if (param1.hasAny) {
      if (!param2.hasAny) {
        return 1
      }
    } else if (param2.hasAny) {
      return -1
    }

    // 2) Prefer non-rest to rest parameters
    if (param1.restParam) {
      if (!param2.restParam) {
        return 1
      }
    } else if (param2.restParam) {
      return -1
    }

    // 3) Prefer exact type match to conversions
    if (param1.hasConversion) {
      if (!param2.hasConversion) {
        return 1
      }
    } else if (param2.hasConversion) {
      return -1
    }

    // 4) Prefer lower type index:
    const typeDiff = getLowestTypeIndex(param1) - getLowestTypeIndex(param2)
    if (typeDiff < 0) {
      return -1
    }
    if (typeDiff > 0) {
      return 1
    }

    // 5) Prefer lower conversion index
    const convDiff =
      getLowestConversionIndex(param1) - getLowestConversionIndex(param2)
    if (convDiff < 0) {
      return -1
    }
    if (convDiff > 0) {
      return 1
    }

    // Don't have a basis for preference
    return 0
  }

  /**
   * Compare two signatures
   * @return returns a negative number when param1 must get a lower index than param2, a positive number when the opposite, or zero when both are equal
   */
  function compareSignatures(signature1: Signature, signature2: Signature) {
    const pars1 = signature1.params
    const pars2 = signature2.params
    const last1 = last(pars1)
    const last2 = last(pars2)
    const hasRest1 = hasRestParam(pars1)
    const hasRest2 = hasRestParam(pars2)
    // We compare a number of metrics on signatures in turn:
    // 1) An "any rest param" is least preferred
    if (hasRest1 && last1.hasAny) {
      if (!hasRest2 || !last2.hasAny) {
        return 1
      }
    } else if (hasRest2 && last2.hasAny) {
      return -1
    }

    // 2) Minimize the number of 'any' parameters
    let any1 = 0
    let conv1 = 0
    let par
    for (par of pars1) {
      if (par.hasAny) ++any1
      if (par.hasConversion) ++conv1
    }
    let any2 = 0
    let conv2 = 0
    for (par of pars2) {
      if (par.hasAny) ++any2
      if (par.hasConversion) ++conv2
    }
    if (any1 !== any2) {
      return any1 - any2
    }

    // 3) A conversion rest param is less preferred
    if (hasRest1 && last1.hasConversion) {
      if (!hasRest2 || !last2.hasConversion) {
        return 1
      }
    } else if (hasRest2 && last2.hasConversion) {
      return -1
    }

    // 4) Minimize the number of conversions
    if (conv1 !== conv2) {
      return conv1 - conv2
    }

    // 5) Prefer no rest param
    if (hasRest1) {
      if (!hasRest2) {
        return 1
      }
    } else if (hasRest2) {
      return -1
    }

    // 6) Prefer shorter with rest param, longer without
    const lengthCriterion = (pars1.length - pars2.length) * (hasRest1 ? -1 : 1)
    if (lengthCriterion !== 0) {
      return lengthCriterion
    }

    // Signatures are identical in each of the above metrics.
    // In particular, they are the same length.
    // We can therefore compare the parameters one by one.
    // First we count which signature has more preferred parameters.
    const comparisons = []
    let tc = 0
    for (let i = 0; i < pars1.length; ++i) {
      const thisComparison = compareParams(pars1[i], pars2[i])
      comparisons.push(thisComparison)
      tc += thisComparison
    }
    if (tc !== 0) {
      return tc
    }

    // They have the same number of preferred parameters, so go by the
    // earliest parameter in which we have a preference.
    // In other words, dispatch is driven somewhat more by earlier
    // parameters than later ones.
    let c
    for (c of comparisons) {
      if (c !== 0) {
        return c
      }
    }

    // It's a tossup:
    return 0
  }

  /**
   * Produce a list of all conversions from distinct types to one of
   * the given types.
   * @return Returns the conversions that are available
   *                        resulting in any given type (if any)
   */
  function availableConversions(typeNames: string[]): ConversionDef[] {
    if (typeNames.length === 0) {
      return []
    }
    const types = typeNames.map(findType)
    if (typeNames.length > 1) {
      types.sort((t1, t2) => t1.index - t2.index)
    }
    let matches = types[0].conversionsTo
    if (typeNames.length === 1) {
      return matches
    }

    matches = matches.concat([]) // shallow copy the matches
    // Since the types are now in index order, we just want the first
    // occurrence of any from type:
    const knownTypes = new Set(typeNames)
    for (var i = 1; i < types.length; ++i) {
      let newMatch
      for (newMatch of types[i].conversionsTo) {
        if (!knownTypes.has(newMatch.from)) {
          matches.push(newMatch)
          knownTypes.add(newMatch.from)
        }
      }
    }

    return matches
  }

  /**
   * Preprocess arguments before calling the original function:
   * - if needed convert the parameters
   * - in case of rest parameters, move the rest parameters into an Array
   * @return Returns a wrapped function
   */
  function compileArgsPreprocessing(params: Param[], fn: () => any) {
    let fnConvert = fn

    // TODO: can we make this wrapper function smarter/simpler?

    if (params.some((p) => p.hasConversion)) {
      const restParam = hasRestParam(params)
      const compiledConversions = params.map(compileArgConversion)

      fnConvert = function convertArgs() {
        const args = []
        const last = restParam ? arguments.length - 1 : arguments.length
        for (var i = 0; i < last; i++) {
          args[i] = compiledConversions[i](arguments[i])
        }
        if (restParam) {
          args[last] = arguments[last].map(compiledConversions[last])
        }

        return fn.apply(this, args)
      }
    }

    let fnPreprocess = fnConvert
    if (hasRestParam(params)) {
      const offset = params.length - 1

      fnPreprocess = function preprocessRestParams() {
        return fnConvert.apply(
          this,
          slice(arguments, 0, offset).concat([slice(arguments, offset)])
        )
      }
    }

    return fnPreprocess
  }

  /**
   * Compile conversion for a parameter to the right type
   * @param {Param} param
   * @return {function} Returns the wrapped function that will convert arguments
   *
   */
  function compileArgConversion(param: Param) {
    let test0: TestFunction
    let test1: TestFunction
    let conversion0: ConversionDefConvertFunction
    let conversion1: ConversionDefConvertFunction

    const tests: TestFunction[] = []
    const conversions: ConversionDefConvertFunction[] = []

    param.types.forEach(function (type) {
      if (type.conversion) {
        tests.push(findType(type.conversion.from).test)
        conversions.push(type.conversion.convert)
      }
    })

    // create optimized conversion functions depending on the number of conversions
    switch (conversions.length) {
      case 0:
        return function convertArg(arg: any) {
          return arg
        }

      case 1:
        test0 = tests[0]
        conversion0 = conversions[0]
        return function convertArg(arg: any) {
          if (test0(arg)) {
            return conversion0(arg)
          }
          return arg
        }

      case 2:
        test0 = tests[0]
        test1 = tests[1]
        conversion0 = conversions[0]
        conversion1 = conversions[1]
        return function convertArg(arg: any) {
          if (test0(arg)) {
            return conversion0(arg)
          }
          if (test1(arg)) {
            return conversion1(arg)
          }
          return arg
        }

      default:
        return function convertArg(arg: any) {
          for (var i = 0; i < conversions.length; i++) {
            if (tests[i](arg)) {
              return conversions[i](arg)
            }
          }
          return arg
        }
    }
  }

  /**
   * Split params with union types in to separate params.
   *
   * For example:
   *
   *     splitParams([['Array', 'Object'], ['string', 'RegExp'])
   *     // returns:
   *     // [
   *     //   ['Array', 'string'],
   *     //   ['Array', 'RegExp'],
   *     //   ['Object', 'string'],
   *     //   ['Object', 'RegExp']
   *     // ]
   */
  function splitParams(params: Param[]) {
    function _splitParams(params: Param[], index: number, paramsSoFar: Param[]) {
      if (index < params.length) {
        const param = params[index]
        let resultingParams = []

        if (param.restParam) {
          // split the types of a rest parameter in two:
          // one with only exact types, and one with exact types and conversions
          const exactTypes = param.types.filter(isExactType)
          if (exactTypes.length < param.types.length) {
            resultingParams.push({
              types: exactTypes,
              name: "..." + exactTypes.map((t) => t.name).join("|"),
              hasAny: exactTypes.some((t) => t.isAny),
              hasConversion: false,
              restParam: true,
            })
          }
          resultingParams.push(param)
        } else {
          // split all the types of a regular parameter into one type per param
          resultingParams = param.types.map(function (type) {
            return {
              types: [type],
              name: type.name,
              hasAny: type.isAny,
              hasConversion: type.conversion,
              restParam: false,
            }
          })
        }

        // recurse over the groups with types
        return flatMap(resultingParams, function (nextParam: Param) {
          return _splitParams(
            params,
            index + 1,
            paramsSoFar.concat([nextParam])
          )
        })
      } else {
        // we've reached the end of the parameters.
        return [paramsSoFar]
      }
    }

    return _splitParams(params, 0, [])
  }

  /**
   * Test whether two param lists represent conflicting signatures
   * @return Returns true when the signatures conflict, false otherwise.
   */
  function conflicting(params1: Param[], params2: Param[]) {
    const ii = Math.max(params1.length, params2.length)

    for (var i = 0; i < ii; i++) {
      const typeSet1 = getTypeSetAtIndex(params1, i)
      const typeSet2 = getTypeSetAtIndex(params2, i)
      let overlap = false
      let name
      for (name of typeSet2) {
        if (typeSet1.has(name)) {
          overlap = true
          break
        }
      }
      if (!overlap) {
        return false
      }
    }

    const len1 = params1.length
    const len2 = params2.length
    const restParam1 = hasRestParam(params1)
    const restParam2 = hasRestParam(params2)

    return restParam1
      ? restParam2
        ? len1 === len2
        : len2 >= len1
      : restParam2
      ? len1 >= len2
      : len1 === len2
  }

  /**
   * Helper function for `resolveReferences` that returns a copy of
   * functionList wihe any prior resolutions cleared out, in case we are
   * recycling signatures from a prior typed function construction.
   *
   * @param {Array.<function|typed-reference>} functionList
   * @return {Array.<function|typed-reference>}
   */
  function clearResolutions(functionList: TypedReference[]) {
    return functionList.map((fn) => {
      if (isReferToSelf(fn)) {
        return referToSelf(fn.referToSelf.callback)
      }
      if (isReferTo(fn)) {
        return makeReferTo(fn.referTo.references, fn.referTo.callback)
      }
      return fn
    })
  }

  /**
   * Take a list of references, a list of functions functionList, and a
   * signatureMap indexing signatures into functionList, and return
   * the list of resolutions, or a false-y value if they don't all
   * resolve in a valid way (yet).
   */
  function collectResolutions(references: string[], functionList: TypedReference[], signatureMap: Record<string, TypedReference>): TypedReference[] | false {
    const resolvedReferences: TypedReference[] = []

    let reference
    for (reference of references) {
      let resolution = signatureMap[reference]
      if (typeof resolution !== "number") {
        throw new TypeError(
          'No definition for referenced signature "' + reference + '"'
        )
      }
      resolution = functionList[resolution]
      if (typeof resolution !== "function") {
        return false
      }
      resolvedReferences.push(resolution)
    }
    return resolvedReferences
  }

  /**
   * Resolve any references in the functionList for the typed function
   * itself. The signatureMap tells which index in the functionList a
   * given signature should be mapped to (for use in resolving typed.referTo)
   * and self provides the destions of a typed.referToSelf.
   *
   * @param self  The typed-function itself
   * @return The list of resolved functions
   */
  function resolveReferences(functionList: TypedReference[], signatureMap:  Record<string, TypedReference>, self: TypedFunction) {
    let resolvedFunctions = clearResolutions(functionList)
    let leftUnresolved = true
    while (leftUnresolved) {
      leftUnresolved = false
      let nothingResolved = true
      for (var i = 0; i < resolvedFunctions.length; ++i) {
        const fn = resolvedFunctions[i]

        if (isReferToSelf(fn)) {
          resolvedFunctions[i] = fn.referToSelf.callback(self)
          // Preserve reference in case signature is reused someday:
          resolvedFunctions[i].referToSelf = fn.referToSelf
          nothingResolved = false
        } else if (isReferTo(fn)) {
          const resolvedReferences = collectResolutions(
            fn.referTo.references,
            resolvedFunctions,
            signatureMap
          )
          if (resolvedReferences) {
            resolvedFunctions[i] = fn.referTo.callback.apply(
              this,
              resolvedReferences
            )
            // Preserve reference in case signature is reused someday:
            resolvedFunctions[i].referTo = fn.referTo
            nothingResolved = false
          } else {
            leftUnresolved = true
          }
        }
      }

      if (nothingResolved && leftUnresolved) {
        throw new SyntaxError(
          "Circular reference detected in resolving typed.referTo"
        )
      }
    }

    return resolvedFunctions
  }

  /**
   * Validate whether any of the function bodies contains a self-reference
   * usage like `this(...)` or `this.signatures`. This self-referencing is
   * deprecated since typed-function v3. It has been replaced with
   * the functions typed.referTo and typed.referToSelf.
   * @param {Object.<string, function>} signaturesMap
   */
  function validateDeprecatedThis(signaturesMap) {
    // TODO: remove this deprecation warning logic some day (it's introduced in v3)

    // match occurrences like 'this(' and 'this.signatures'
    var deprecatedThisRegex = /\bthis(\(|\.signatures\b)/

    Object.keys(signaturesMap).forEach((signature) => {
      var fn = signaturesMap[signature]

      if (deprecatedThisRegex.test(fn.toString())) {
        throw new SyntaxError(
          "Using `this` to self-reference a function " +
            "is deprecated since typed-function@3. " +
            "Use typed.referTo and typed.referToSelf instead."
        )
      }
    })
  }

  /**
   * Create a typed function
   * @param {String} name               The name for the typed function
   * @param {Object.<string, function>} signaturesMap
   *                                    An object with one or
   *                                    multiple signatures as key, and the
   *                                    function corresponding to the
   *                                    signature as value.
   * @return {function}  Returns the created typed function.
   */
  function createTypedFunction(name, rawSignaturesMap) {
    typed.createCount++

    if (Object.keys(rawSignaturesMap).length === 0) {
      throw new SyntaxError("No signatures provided")
    }

    if (typed.warnAgainstDeprecatedThis) {
      validateDeprecatedThis(rawSignaturesMap)
    }

    // Main processing loop for signatures
    const parsedParams = []
    const originalFunctions = []
    const signaturesMap = {}
    const preliminarySignatures = [] // may have duplicates from conversions
    let signature
    for (signature in rawSignaturesMap) {
      // A) Protect against polluted Object prototype:
      if (!Object.prototype.hasOwnProperty.call(rawSignaturesMap, signature)) {
        continue
      }
      // B) Parse the signature
      const params = parseSignature(signature)
      if (!params) continue
      // C) Check for conflicts
      parsedParams.forEach(function (pp) {
        if (conflicting(pp, params)) {
          throw new TypeError(
            'Conflicting signatures "' +
              stringifyParams(pp) +
              '" and "' +
              stringifyParams(params) +
              '".'
          )
        }
      })
      parsedParams.push(params)
      // D) Store the provided function and add conversions
      const functionIndex = originalFunctions.length
      originalFunctions.push(rawSignaturesMap[signature])
      const conversionParams = params.map(expandParam)
      // E) Split the signatures and collect them up
      let sp
      for (sp of splitParams(conversionParams)) {
        const spName = stringifyParams(sp)
        preliminarySignatures.push({
          params: sp,
          name: spName,
          fn: functionIndex,
        })
        if (sp.every((p) => !p.hasConversion)) {
          signaturesMap[spName] = functionIndex
        }
      }
    }

    preliminarySignatures.sort(compareSignatures)

    // Note the forward reference to the_typed_fn
    const resolvedFunctions = resolveReferences(
      originalFunctions,
      signaturesMap,
      the_typed_fn
    )

    // Fill in the proper function for each signature
    let s
    for (s in signaturesMap) {
      if (Object.prototype.hasOwnProperty.call(signaturesMap, s)) {
        signaturesMap[s] = resolvedFunctions[signaturesMap[s]]
      }
    }
    const signatures = []
    const internalSignatureMap = new Map() // benchmarks faster than object
    for (s of preliminarySignatures) {
      // Note it's only safe to eliminate duplicates like this
      // _after_ the signature sorting step above; otherwise we might
      // remove the wrong one.
      if (!internalSignatureMap.has(s.name)) {
        s.fn = resolvedFunctions[s.fn]
        signatures.push(s)
        internalSignatureMap.set(s.name, s)
      }
    }

    // we create a highly optimized checks for the first couple of signatures with max 2 arguments
    const ok0 =
      signatures[0] &&
      signatures[0].params.length <= 2 &&
      !hasRestParam(signatures[0].params)
    const ok1 =
      signatures[1] &&
      signatures[1].params.length <= 2 &&
      !hasRestParam(signatures[1].params)
    const ok2 =
      signatures[2] &&
      signatures[2].params.length <= 2 &&
      !hasRestParam(signatures[2].params)
    const ok3 =
      signatures[3] &&
      signatures[3].params.length <= 2 &&
      !hasRestParam(signatures[3].params)
    const ok4 =
      signatures[4] &&
      signatures[4].params.length <= 2 &&
      !hasRestParam(signatures[4].params)
    const ok5 =
      signatures[5] &&
      signatures[5].params.length <= 2 &&
      !hasRestParam(signatures[5].params)
    const allOk = ok0 && ok1 && ok2 && ok3 && ok4 && ok5

    // compile the tests
    for (var i = 0; i < signatures.length; ++i) {
      signatures[i].test = compileTests(signatures[i].params)
    }

    const test00 = ok0 ? compileTest(signatures[0].params[0]) : notOk
    const test10 = ok1 ? compileTest(signatures[1].params[0]) : notOk
    const test20 = ok2 ? compileTest(signatures[2].params[0]) : notOk
    const test30 = ok3 ? compileTest(signatures[3].params[0]) : notOk
    const test40 = ok4 ? compileTest(signatures[4].params[0]) : notOk
    const test50 = ok5 ? compileTest(signatures[5].params[0]) : notOk

    const test01 = ok0 ? compileTest(signatures[0].params[1]) : notOk
    const test11 = ok1 ? compileTest(signatures[1].params[1]) : notOk
    const test21 = ok2 ? compileTest(signatures[2].params[1]) : notOk
    const test31 = ok3 ? compileTest(signatures[3].params[1]) : notOk
    const test41 = ok4 ? compileTest(signatures[4].params[1]) : notOk
    const test51 = ok5 ? compileTest(signatures[5].params[1]) : notOk

    // compile the functions
    for (var i = 0; i < signatures.length; ++i) {
      signatures[i].implementation = compileArgsPreprocessing(
        signatures[i].params,
        signatures[i].fn
      )
    }

    const fn0 = ok0 ? signatures[0].implementation : undef
    const fn1 = ok1 ? signatures[1].implementation : undef
    const fn2 = ok2 ? signatures[2].implementation : undef
    const fn3 = ok3 ? signatures[3].implementation : undef
    const fn4 = ok4 ? signatures[4].implementation : undef
    const fn5 = ok5 ? signatures[5].implementation : undef

    const len0 = ok0 ? signatures[0].params.length : -1
    const len1 = ok1 ? signatures[1].params.length : -1
    const len2 = ok2 ? signatures[2].params.length : -1
    const len3 = ok3 ? signatures[3].params.length : -1
    const len4 = ok4 ? signatures[4].params.length : -1
    const len5 = ok5 ? signatures[5].params.length : -1

    // simple and generic, but also slow
    const iStart = allOk ? 6 : 0
    const iEnd = signatures.length
    // de-reference ahead for execution speed:
    const tests = signatures.map((s) => s.test)
    const fns = signatures.map((s) => s.implementation)
    const generic = function generic() {
      "use strict"

      for (var i = iStart; i < iEnd; i++) {
        if (tests[i](arguments)) {
          return fns[i].apply(this, arguments)
        }
      }

      return typed.onMismatch(name, arguments, signatures)
    }

    // create the typed function
    // fast, specialized version. Falls back to the slower, generic one if needed
    function the_typed_fn(arg0, arg1) {
      "use strict"

      if (arguments.length === len0 && test00(arg0) && test01(arg1)) {
        return fn0.apply(this, arguments)
      }
      if (arguments.length === len1 && test10(arg0) && test11(arg1)) {
        return fn1.apply(this, arguments)
      }
      if (arguments.length === len2 && test20(arg0) && test21(arg1)) {
        return fn2.apply(this, arguments)
      }
      if (arguments.length === len3 && test30(arg0) && test31(arg1)) {
        return fn3.apply(this, arguments)
      }
      if (arguments.length === len4 && test40(arg0) && test41(arg1)) {
        return fn4.apply(this, arguments)
      }
      if (arguments.length === len5 && test50(arg0) && test51(arg1)) {
        return fn5.apply(this, arguments)
      }

      return generic.apply(this, arguments)
    }

    // attach name the typed function
    try {
      Object.defineProperty(the_typed_fn, "name", { value: name })
    } catch (err) {
      // old browsers do not support Object.defineProperty and some don't support setting the name property
      // the function name is not essential for the functioning, it's mostly useful for debugging,
      // so it's fine to have unnamed functions.
    }

    // attach signatures to the function.
    // This property is close to the original collection of signatures
    // used to create the typed-function, just with unions split:
    the_typed_fn.signatures = signaturesMap

    // Store internal data for functions like resolve, find, etc.
    // Also serves as the flag that this is a typed-function
    the_typed_fn._typedFunctionData = {
      signatures: signatures,
      signatureMap: internalSignatureMap,
    }

    return the_typed_fn
  }

  /**
   * Action to take on mismatch
   * @param {string} name      Name of function that was attempted to be called
   * @param {Array} args       Actual arguments to the call
   * @param {Array} signatures Known signatures of the named typed-function
   */
  function _onMismatch(name, args, signatures) {
    throw createError(name, args, signatures)
  }

  /**
   * Return all but the last items of an array or function Arguments
   * @param {Array | Arguments} arr
   * @return {Array}
   */
  function initial(arr) {
    return slice(arr, 0, arr.length - 1)
  }

  /**
   * return the last item of an array or function Arguments
   * @param {Array | Arguments} arr
   * @return {*}
   */
  function last(arr) {
    return arr[arr.length - 1]
  }

  /**
   * Slice an array or function Arguments
   * @param {Array | Arguments | IArguments} arr
   * @param {number} start
   * @param {number} [end]
   * @return {Array}
   */
  function slice(arr, start, end) {
    return Array.prototype.slice.call(arr, start, end)
  }

  /**
   * Return the first item from an array for which test(arr[i]) returns true
   * @param {Array} arr
   * @param {function} test
   * @return {* | undefined} Returns the first matching item
   *                         or undefined when there is no match
   */
  function findInArray(arr, test) {
    for (var i = 0; i < arr.length; i++) {
      if (test(arr[i])) {
        return arr[i]
      }
    }
    return undefined
  }

  /**
   * Flat map the result invoking a callback for every item in an array.
   * https://gist.github.com/samgiles/762ee337dff48623e729
   * @param {Array} arr
   * @param {function} callback
   * @return {Array}
   */
  function flatMap(arr, callback) {
    return Array.prototype.concat.apply([], arr.map(callback))
  }

  /**
   * Create a reference callback to one or multiple signatures
   *
   * Syntax:
   *
   *     typed.referTo(signature1, signature2, ..., function callback(fn1, fn2, ...) {
   *       // ...
   *     })
   *
   * @returns {{referTo: {references: string[], callback}}}
   */
  function referTo() {
    let references = initial(arguments).map((s) =>
      stringifyParams(parseSignature(s))
    )
    const callback = last(arguments)

    if (typeof callback !== "function") {
      throw new TypeError("Callback function expected as last argument")
    }

    return makeReferTo(references, callback)
  }

  function makeReferTo(references, callback) {
    return { referTo: { references: references, callback: callback } }
  }

  /**
   * Create a reference callback to the typed-function itself
   *
   * @param {(self: function) => function} callback
   * @returns {{referToSelf: { callback: function }}}
   */
  function referToSelf(callback: (self: Function) => Function): TypedReference {
    if (typeof callback !== "function") {
      throw new TypeError("Callback function expected as first argument")
    }

    return { referToSelf: { callback: callback } }
  }

  /**
   * Test whether something is a referTo object, holding a list with reference
   * signatures and a callback.
   *
   * @param {Object | function} objectOrFn
   * @returns {boolean}
   */
  function isReferTo(objectOrFn) {
    return (
      objectOrFn &&
      typeof objectOrFn.referTo === "object" &&
      Array.isArray(objectOrFn.referTo.references) &&
      typeof objectOrFn.referTo.callback === "function"
    )
  }

  /**
   * Test whether something is a referToSelf object, holding a callback where
   * to pass `self`.
   */
  function isReferToSelf(objectOrFn: { referToSelf: { callback: any } | Object }) {
    if (!objectOrFn) return false

    if (typeof objectOrFn.referToSelf === "object") return true

    return false
  }

  /**
   * Check if name is (A) new, (B) a match, or (C) a mismatch; and throw
   * an error in case (C).
   * @returns updated name
   */
  function checkName(nameSoFar: string | undefined, newName: string | undefined) {
    if (!nameSoFar) {
      return newName
    }
    if (newName && newName != nameSoFar) {
      const err = new TypedFunctionError(
        "Function names do not match (expected: " +
          nameSoFar +
          ", actual: " +
          newName +
          ")"
      )
      err.data = { actual: newName, expected: nameSoFar }
      throw err
    }
    return nameSoFar
  }

  /**
   * Retrieve the implied name from an object with signature keys
   * and function values, checking whether all value names match
   *
   * @param { {string: function} } obj
   */
  function getObjectName(obj: Record<string, Function>) {
    let name
    for (let key in obj) {
      // Only pay attention to own properties, and only if their values
      // are typed functions or functions with a signature property
      if (
        obj.hasOwnProperty(key) &&
        (isTypedFunction(obj[key]) || typeof obj[key].signature === "string")
      ) {
        name = checkName(name, obj[key].name)
      }
    }
    return name
  }

  /**
   * Copy all of the signatures from the second argument into the first,
   * which is modified by side effect, checking for conflicts
   */
  function mergeSignatures(dest: Record<string, Signature>, source: Record<string, Signature>) {
    let key
    for (key in source) {
      if (source.hasOwnProperty(key)) {
        if (key in dest) {
          if (source[key] !== dest[key]) {
            const err = new TypedFunctionError('Signature "' + key + '" is defined twice')
            err.data = {
              signature: key,
              sourceFunction: source[key],
              destFunction: dest[key],
            }
            throw err
          }
          // else: both signatures point to the same function, that's fine
        }
        dest[key] = source[key]
      }
    }
  }

  const saveTyped = typed
  /**
     * Originally the main function was a typed function itself, but then
     * it might not be able to generate error messages if the client
     * replaced the type system with different names.
     *
     * Main entry: typed([name], functions/objects with signatures...)
     *
     * Assembles and returns a new typed-function from the given items
     * that provide signatures and implementations, each of which may be
     * * a plain object mapping (string) signatures to implementing functions,
     * * a previously constructed typed function, or
     * * any other single function with a string-valued property `signature`.

     * The name of the resulting typed-function will be given by the
     * string-valued name argument if present, or if not, by the name
     * of any of the arguments that have one, as long as any that do are
     * consistent with each other. If no name is specified, the name will be
     * an empty string.
     */
  typed = function (maybeName?: any): TypedFunction {
    const named = typeof maybeName === "string"
    const start = named ? 1 : 0
    let name = named ? maybeName : ""
    const allSignatures = {}
    for (let i = start; i < arguments.length; ++i) {
      const item = arguments[i]
      let theseSignatures = {}
      let thisName
      if (typeof item === "function") {
        thisName = item.name
        if (typeof item.signature === "string") {
          // Case 1: Ordinary function with a string 'signature' property
          theseSignatures[item.signature] = item
        } else if (isTypedFunction(item)) {
          // Case 2: Existing typed function
          theseSignatures = item.signatures
        }
      } else if (isPlainObject(item)) {
        // Case 3: Plain object, assume keys = signatures, values = functions
        theseSignatures = item
        if (!named) {
          thisName = getObjectName(item)
        }
      }

      if (Object.keys(theseSignatures).length === 0) {
        const err = new TypeError(
          "Argument to 'typed' at index " +
            i +
            " is not a (typed) function, " +
            "nor an object with signatures as keys and functions as values."
        )
        err.data = { index: i, argument: item }
        throw err
      }

      if (!named) {
        name = checkName(name, thisName)
      }
      mergeSignatures(allSignatures, theseSignatures)
    }

    return createTypedFunction(name || "", allSignatures)
  }

  typed.create = create
  typed.createCount = saveTyped.createCount
  typed.onMismatch = _onMismatch
  typed.throwMismatchError = _onMismatch
  typed.createError = createError
  typed.clear = clear
  typed.clearConversions = clearConversions
  typed.addTypes = addTypes
  typed._findType = findType // For unit testing only
  typed.referTo = referTo
  typed.referToSelf = referToSelf
  typed.convert = convert
  typed.findSignature = findSignature
  typed.find = find
  typed.isTypedFunction = isTypedFunction
  typed.warnAgainstDeprecatedThis = true

  /**
   * add a type (convenience wrapper for typed.addTypes)
   * @param {{name: string, test: function}} type
   * @param {boolean} [beforeObjectTest=true]
   *                          If true, the new test will be inserted before
   *                          the test with name 'Object' (if any), since
   *                          tests for Object match Array and classes too.
   */
  typed.addType = function (type, beforeObjectTest) {
    let before = "any"
    if (beforeObjectTest !== false) {
      before = "Object"
    }
    typed.addTypes([type], before)
  }

  /**
   * Verify that the ConversionDef conversion has a valid format.
   *
   * @param {conversionDef} conversion
   * @return {void}
   * @throws {TypeError|SyntaxError}
   */
  function _validateConversion(conversion) {
    if (
      !conversion ||
      typeof conversion.from !== "string" ||
      typeof conversion.to !== "string" ||
      typeof conversion.convert !== "function"
    ) {
      throw new TypeError(
        "Object with properties {from: string, to: string, convert: function} expected"
      )
    }
    if (conversion.to === conversion.from) {
      throw new SyntaxError(
        'Illegal to define conversion from "' + conversion.from + '" to itself.'
      )
    }
  }

  /**
   * Add a conversion
   *
   * @param {ConversionDef} conversion
   * @returns {void}
   * @throws {TypeError}
   */
  typed.addConversion = function (conversion) {
    _validateConversion(conversion)

    const to = findType(conversion.to)
    if (
      to.conversionsTo.every(function (other) {
        return other.from !== conversion.from
      })
    ) {
      to.conversionsTo.push({
        from: conversion.from,
        convert: conversion.convert,
        index: nConversions++,
      })
    } else {
      throw new Error(
        'There is already a conversion from "' +
          conversion.from +
          '" to "' +
          to.name +
          '"'
      )
    }
  }

  /**
     * Convenience wrapper to call addConversion on each conversion in a list.
     *
     @param {ConversionDef[]} conversions
     @returns {void}
     @throws {TypeError}
     */
  typed.addConversions = function (conversions) {
    conversions.forEach(typed.addConversion)
  }

  /**
   * Remove the specified conversion. The format is the same as for
   * addConversion, and the convert function must match or an error
   * is thrown.
   *
   * @param {{from: string, to: string, convert: function}} conversion
   * @returns {void}
   * @throws {TypeError|SyntaxError|Error}
   */
  typed.removeConversion = function (conversion) {
    _validateConversion(conversion)
    const to = findType(conversion.to)
    const existingConversion = findInArray(
      to.conversionsTo,
      (c) => c.from === conversion.from
    )
    if (!existingConversion) {
      throw new Error(
        "Attempt to remove nonexistent conversion from " +
          conversion.from +
          " to " +
          conversion.to
      )
    }
    if (existingConversion.convert !== conversion.convert) {
      throw new Error("Conversion to remove does not match existing conversion")
    }
    const index = to.conversionsTo.indexOf(existingConversion)
    to.conversionsTo.splice(index, 1)
  }

  /**
   * Produce the specific signature that a typed function
   * will execute on the given arguments. Here, a "signature" is an
   * object with properties 'params', 'test', 'fn', and 'implementation'.
   * This last property is a function that converts params as necessary
   * and then calls 'fn'. Returns null if there is no matching signature.
   * @param {typed-function} tf
   * @param {any[]} argList
   * @returns {{params: string, test: function, fn: function, implementation: function}}
   */
  typed.resolve = function (tf, argList) {
    if (!isTypedFunction(tf)) {
      throw new TypeError(NOT_TYPED_FUNCTION)
    }
    const sigs = tf._typedFunctionData.signatures
    for (var i = 0; i < sigs.length; ++i) {
      if (sigs[i].test(argList)) {
        return sigs[i]
      }
    }
    return null
  }

  return typed
}

export default create
