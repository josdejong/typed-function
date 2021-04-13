/**
 * typed-function
 *
 * Type checking for JavaScript functions
 *
 * https://github.com/josdejong/typed-function
 */


function ok () {
    return true;
}

function notOk () {
    return false;
}

function undef () {
    return undefined;
}

interface Signature {
    params: Param[];
    fn: Function;
}

interface SignatureMap {
    [s: string]: Function;
}

interface Param {
    types: Type[];
    restParam: boolean;
}

interface Type {
    name: string;
    typeIndex: number;
    test: Test;
    conversion?: ConversionDef;
    conversionIndex: number;
}

interface ConversionDef {
    from: string;
    to: string;
    convert: Function;
}

interface TypeDef {
    name: string;
    test: Test;
}

interface TypedFunction {
    (...args: any[]): any;
    signatures: SignatureMap;
}

interface LegacyTypedFunction {
    (...args: any[]): any;
    signature: string;
}

interface Test {
    (x: any): boolean;
}

enum SignatureErrorCategory {
    WrongType = 'wrongType',
    TooFewArgs = 'tooFewArgs',
    TooManyArgs = 'tooManyArgs',
    TypeMismatch = 'mismatch',
    NameMismatch = 'nameMismatch',
    DefinedTwice = 'definedTwice',
}

interface SignatureErrorData {
    category: SignatureErrorCategory;
    fn: string;
    expected?: string | string[];
    expectedLength?: number;
    actual?: string | string[];
    index?: number;
    signature?: string;
}

class SignatureError extends TypeError {
    data: SignatureErrorData;

    constructor (message: string, data: SignatureErrorData) {
        super(message);
        this.data = data;
    }
}

type _typed = TypedFunction & {
    (name: string, signaturesMap: SignatureMap): TypedFunction;
    (signatureMap: SignatureMap): TypedFunction;
    (...fn: Array<TypedFunction | LegacyTypedFunction>): TypedFunction;
    (name: string, ...fns: Array<TypedFunction | LegacyTypedFunction>): TypedFunction;

    create (): _typed;
    convert (value: any, type: string): any;
    find (fn: TypedFunction, signature: string | string[]): Function;
    addType (type: TypeDef, beforeObjectTest: boolean): void;
    addConversion (conversion: ConversionDef): void;

    types: TypeDef[];
    conversions: ConversionDef[];
    ignore: string[];
}

interface _typeMap {
    'number': number;
    'string': string;
    'boolean': boolean;
    'Function': Function;
    'Array': any[];
    'Date': Date;
    'RegExp': RegExp;
    'Object': object;
}

function create() {
    const _types: TypeDef[] = [
        { name: 'number',    test: (x: any) => typeof x === 'number' },
        { name: 'string',    test: (x: any) => typeof x === 'string' },
        { name: 'boolean',   test: (x: any) => typeof x === 'boolean' },
        { name: 'Function',  test: (x: any) => typeof x === 'function' },
        { name: 'Array',     test: Array.isArray },
        { name: 'Date',      test: (x: any) => x instanceof Date },
        { name: 'RegExp',    test: (x: any) => x instanceof RegExp },
        { name: 'Object',    test: function (x) {
            return typeof x === 'object' && x !== null && x.constructor === Object
        }},
        { name: 'null',      test: (x: any) => x === null },
        { name: 'undefined', test: (x: any) => x === undefined }
    ];

    const anyType: TypeDef = {
        name: 'any',
        test: ok
    };

    // types which need to be ignored
    const _ignore: string[] = [];

    // type conversions
    const _conversions: ConversionDef[] = [];

    // This is a temporary object, will be replaced with a typed function at the end
    let typed = {
        types: _types,
        conversions: _conversions,
        ignore: _ignore
    } as _typed;

    /**
     * Find the test function for a type
     * @param {String} typeName
     * @return {TypeDef} Returns the type definition when found,
     *                    Throws a TypeError otherwise
     */
    function findTypeByName (typeName: string): TypeDef {
        const entry = findInArray(typed.types, e => e.name === typeName);

        if (entry) {
            return entry;
        }

        if (typeName === 'any') { // special baked-in case 'any'
            return anyType;
        }

        const hint = findInArray(typed.types, e => e.name.toLowerCase() === typeName.toLowerCase())

        throw new TypeError('Unknown type "' + typeName + '"' +
            (hint ? ('. Did you mean "' + hint.name + '"?') : ''));
    }

    /**
     * Find the index of a type definition. Handles special case 'any'
     * @param {TypeDef} type
     * @return {number}
     */
    function findTypeIndex(type: TypeDef): number {
        if (type === anyType) {
            return 999;
        }

        return typed.types.indexOf(type);
    }

    /**
     * Find a type that matches a value.
     * @param {*} value
     * @return {string} Returns the name of the first type for which
     *                  the type test matches the value.
     */
    function findTypeName(value: any): string {
        const entry = findInArray(typed.types, e => e.test(value));

        if (entry) {
            return entry.name;
        }

        throw new TypeError('Value has unknown type. Value: ' + value);
    }

    /**
     * Find a specific signature from a (composed) typed function, for example:
     *
     *   typed.find(fn, ['number', 'string'])
     *   typed.find(fn, 'number, string')
     *
     * Function find only only works for exact matches.
     *
     * @param {Function} fn                   A typed-function
     * @param {string | string[]} signature   Signature to be found, can be
     *                                        an array or a comma separated string.
     * @return {Function}                     Returns the matching signature, or
     *                                        throws an error when no signature
     *                                        is found.
     */
    function find (fn: TypedFunction, signature: string | string[]): Function {
        if (!fn.signatures) {
            throw new TypeError('The function is not a typed function');
        }

        // normalize input
        let arr: string[];
        if (typeof signature === 'string') {
            arr = signature.split(',').map(s => s.trim());
        }
        else if (Array.isArray(signature)) {
            arr = signature;
        }
        else {
            throw new TypeError('String array or a comma separated string expected');
        }

        const str = arr.join(',');

        // find an exact match
        const match = fn.signatures[str];
        if (match) {
            return match;
        }

        // TODO: extend find to match non-exact signatures

        throw new TypeError('Signature not found (signature: ' + (fn.name || 'unnamed') + '(' + arr.join(', ') + '))');
    }

    /**
     * Convert a given value to another data type.
     * @param {*} value
     * @param {string} type
     */
    function convert (value: any, type: string): any {
        const from = findTypeName(value);

        // check conversion is needed
        if (type === from) {
            return value;
        }

        for (const conversion of typed.conversions) {
            if (conversion.from === from && conversion.to === type) {
                return conversion.convert(value);
            }
        }

        throw new Error('Cannot convert from ' + from + ' to ' + type);
    }

    /**
     * Stringify parameters in a normalized way
     * @param {Param[]} params
     * @return {string}
     */
    function stringifyParams (params: Param[]): string {
        return params.map(p => (p.restParam ? '...' : '') + p.types.map(getTypeName).join('|')).join(',');
    }

    /**
     * Parse a parameter, like "...number | boolean"
     * @param {string} param
     * @param {ConversionDef[]} conversions
     * @return {Param} param
     */
    function parseParam (param: string, conversions: ConversionDef[]): Param {
        const restParam = param.indexOf('...') === 0;
        const types = (!restParam)
            ? param
            : (param.length > 3)
                ? param.slice(3)
                : 'any';

        const typeNames = types.split('|').map(s => s.trim())
            .filter(notEmpty)
            .filter(notIgnore);

        const matchingConversions = filterConversions(conversions, typeNames);

        const exactTypes = typeNames.map(function (typeName) {
            const type = findTypeByName(typeName);

            return {
                name: typeName,
                typeIndex: findTypeIndex(type),
                test: type.test,
                conversion: null,
                conversionIndex: -1
            };
        });

        const convertibleTypes = matchingConversions.map(function (conversion) {
            const type = findTypeByName(conversion.from);

            return {
                name: conversion.from,
                typeIndex: findTypeIndex(type),
                test: type.test,
                conversion: conversion,
                conversionIndex: conversions.indexOf(conversion)
            };
        });

        return {
            types: exactTypes.concat(convertibleTypes),
            restParam: restParam
        };
    }

    /**
     * Parse a signature with comma separated parameters,
     * like "number | boolean, ...string"
     * @param {string} signature
     * @param {function} fn
     * @param {ConversionDef[]} conversions
     * @return {Signature | null} signature
     */
    function parseSignature (signature: string, fn: Function, conversions: ConversionDef[]): Signature | null {
        let params: Param[] = [];

        if (signature.trim() !== '') {
            params = signature
                .split(',')
                .map(s => s.trim())
                .map(function (param, index, array) {
                    const parsedParam = parseParam(param, conversions);

                    if (parsedParam.restParam && (index !== array.length - 1)) {
                        throw new SyntaxError('Unexpected rest parameter "' + param + '": ' +
                            'only allowed for the last parameter');
                    }

                    return parsedParam;
                });
        }

        if (params.some(isInvalidParam)) {
            // invalid signature: at least one parameter has no types
            // (they may have been filtered)
            return null;
        }

        return {
            params: params,
            fn: fn
        };
    }

    /**
     * Test whether a set of params contains a restParam
     * @param {Param[]} params
     * @return {boolean} Returns true when the last parameter is a restParam
     */
    function hasRestParam(params: Param[]): boolean {
        const param = last(params)
        return param ? param.restParam : false;
    }

    /**
     * Test whether a parameter contains conversions
     * @param {Param} param
     * @return {boolean} Returns true when at least one of the parameters
     *                   contains a conversion.
     */
    function hasConversions(param: Param): boolean {
        return param.types.some(function (type) {
            return type.conversion != null;
        });
    }

    /**
     * Create a type test for a single parameter, which can have one or multiple
     * types.
     * @param {Param} param
     * @return {function(x: *) : boolean} Returns a test function
     */
    function compileTest(param: Param): Test {
        if (!param || param.types.length === 0) {
            // nothing to do
            return ok;
        }
        else if (param.types.length === 1) {
            return findTypeByName(param.types[0].name).test;
        }
        else if (param.types.length === 2) {
            const test0 = findTypeByName(param.types[0].name).test;
            const test1 = findTypeByName(param.types[1].name).test;
            return function or(x) {
                return test0(x) || test1(x);
            }
        }
        else { // param.types.length > 2
            const tests = param.types.map(type => findTypeByName(type.name).test)

            return function or(x) {
                for (const test of tests) {
                    if (test(x)) {
                        return true;
                    }
                }
                return false;
            }
        }
    }

    /**
     * Create a test for all parameters of a signature
     * @param {Param[]} params
     * @return {function(args: Array<*>) : boolean}
     */
    function compileTests(params: Param[]): (...args: any[]) => boolean {

        if (hasRestParam(params)) {
            // variable arguments like '...number'
            const tests = initial(params).map(compileTest);
            const varIndex = tests.length;
            const lastTest = compileTest(last(params));

            function testRestParam (args) {
                for (let i = varIndex; i < args.length; i++) {
                    if (!lastTest(args[i])) {
                        return false;
                    }
                }
                return true;
            }

            return function testArgs(args) {
                for (let i = 0; i < tests.length; i++) {
                    if (!tests[i](args[i])) {
                        return false;
                    }
                }
                return testRestParam(args) && (args.length >= varIndex + 1);
            };
        }
        else {
            // no variable arguments
            if (params.length === 0) {
                return function testArgs(args) {
                    return args.length === 0;
                };
            }
            else if (params.length === 1) {
                const test = compileTest(params[0]);
                return function testArgs(args) {
                    return test(args[0]) && args.length === 1;
                };
            }
            else if (params.length === 2) {
                const test0 = compileTest(params[0]);
                const test1 = compileTest(params[1]);
                return function testArgs(args) {
                    return test0(args[0]) && test1(args[1]) && args.length === 2;
                };
            }
            else { // arguments.length > 2
                const tests = params.map(compileTest);
                return function testArgs(args) {
                    for (let i = 0; i < tests.length; i++) {
                        if (!tests[i](args[i])) {
                            return false;
                        }
                    }
                    return args.length === tests.length;
                };
            }
        }
    }

    /**
     * Find the parameter at a specific index of a signature.
     * Handles rest parameters.
     * @param {Signature} signature
     * @param {number} index
     * @return {Param | null} Returns the matching parameter when found,
     *                        null otherwise.
     */
    function getParamAtIndex(signature: Signature, index: number): Param | null {
        return index < signature.params.length
            ? signature.params[index]
            : hasRestParam(signature.params)
                ? last(signature.params)
                : null
    }

    /**
     * Get all type names of a parameter
     * @param {Signature} signature
     * @param {number} index
     * @param {boolean} excludeConversions
     * @return {string[]} Returns an array with type names
     */
    function getExpectedTypeNames (signature: Signature, index: number, excludeConversions: boolean): string[] {
        const param = getParamAtIndex(signature, index);
        const types = param
            ? excludeConversions
                    ? param.types.filter(isExactType)
                    : param.types
            : [];

        return types.map(getTypeName);
    }

    /**
     * Returns the name of a type
     * @param {Type} type
     * @return {string} Returns the type name
     */
    function getTypeName(type: Type): string {
        return type.name;
    }

    /**
     * Test whether a type is an exact type or conversion
     * @param {Type} type
     * @return {boolean} Returns true when
     */
    function isExactType(type: Type): boolean {
        return type.conversion === null || type.conversion === undefined;
    }

    /**
     * Helper function for creating error messages: create an array with
     * all available types on a specific argument index.
     * @param {Signature[]} signatures
     * @param {number} index
     * @return {string[]} Returns an array with available types
     */
    function mergeExpectedParams(signatures: Signature[], index: number): string[] {
        const typeNames = uniq(flatMap(signatures, s => getExpectedTypeNames(s, index, false)));

        return (typeNames.indexOf('any') !== -1) ? ['any'] : typeNames;
    }

    /**
     * Create
     * @param {string} name             The name of the function
     * @param {array.<*>} args          The actual arguments passed to the function
     * @param {Signature[]} signatures  A list with available signatures
     * @return {SignatureError} Returns a type error with additional data
     *                     attached to it in the property `data`
     */
    function createError(name: string, args: any[], signatures: Signature[]): SignatureError {
        const _name = name || 'unnamed';

        // test for wrong type at some index
        let matchingSignatures = signatures;

        let index: number;
        for (index = 0; index < args.length; index++) {
            var nextMatchingDefs = matchingSignatures.filter(function (signature) {
            var test = compileTest(getParamAtIndex(signature, index));
            return (index < signature.params.length || hasRestParam(signature.params)) &&
                test(args[index]);
            });

            if (nextMatchingDefs.length === 0) {
                // no matching signatures anymore, throw error "wrong type"
                const expected = mergeExpectedParams(matchingSignatures, index);
                if (expected.length > 0) {
                    var actualType = findTypeName(args[index]);

                    const message = 'Unexpected type of argument in function ' + _name +
                        ' (expected: ' + expected.join(' or ') +
                        ', actual: ' + actualType + ', index: ' + index + ')';

                    const data = {
                        category: SignatureErrorCategory.WrongType,
                        fn: _name,
                        index: index,
                        actual: [actualType],
                        expected: expected
                    }
                    return new SignatureError(message, data);
                }
            }
            else {
                matchingSignatures = nextMatchingDefs;
            }
        }

        // test for too few arguments
        const lengths = matchingSignatures.map(function (signature) {
            return hasRestParam(signature.params) ? Infinity : signature.params.length;
        });
        if (args.length < Math.min.apply(null, lengths)) {
            const expected = mergeExpectedParams(matchingSignatures, index);

            const message = 'Too few arguments in function ' + _name +
                ' (expected: ' + expected.join(' or ') +
                ', index: ' + args.length + ')';

            const data = {
                category: SignatureErrorCategory.TooFewArgs,
                fn: _name,
                index: args.length,
                expected: expected
            }
            return new SignatureError(message, data);
        }

        // test for too many arguments
        var maxLength = Math.max.apply(null, lengths);
        if (args.length > maxLength) {

            const message = 'Too many arguments in function ' + _name +
                ' (expected: ' + maxLength + ', actual: ' + args.length + ')';

            const data = {
                category: SignatureErrorCategory.TooManyArgs,
                fn: _name,
                index: args.length,
                expectedLength: maxLength
            }

            return new SignatureError(message, data);
        }

        const message = 'Arguments of type "' + args.join(', ') +
            '" do not match any of the defined signatures of function ' + _name + '.';

        const data = {
            category: SignatureErrorCategory.TypeMismatch,
            actual: args.map(findTypeName),
            fn: _name
        }

        return new SignatureError(message, data);
    }

    /**
     * Find the lowest index of all exact types of a parameter (no conversions)
     * @param {Param} param
     * @return {number} Returns the index of the lowest type in typed.types
     */
    function getLowestTypeIndex (param: Param): number {
        var min = 999;

        for (var i = 0; i < param.types.length; i++) {
            if (isExactType(param.types[i])) {
                min = Math.min(min, param.types[i].typeIndex);
            }
        }

        return min;
    }

    /**
     * Find the lowest index of the conversion of all types of the parameter
     * having a conversion
     * @param {Param} param
     * @return {number} Returns the lowest index of the conversions of this type
     */
    function getLowestConversionIndex (param: Param): number {
        var min = 999;

        for (var i = 0; i < param.types.length; i++) {
            if (!isExactType(param.types[i])) {
                min = Math.min(min, param.types[i].conversionIndex);
            }
        }

        return min;
    }

    /**
     * Compare two params
     * @param {Param} param1
     * @param {Param} param2
     * @return {number} returns a negative number when param1 must get a lower
     *                  index than param2, a positive number when the opposite,
     *                  or zero when both are equal
     */
    function compareParams (param1: Param, param2: Param): number {
        let c: number;

        // compare having a rest parameter or not
        c = +param1.restParam - +param2.restParam;
        if (c !== 0) {
            return c;
        }

        // compare having conversions or not
        c = +hasConversions(param1) - +hasConversions(param2);
        if (c !== 0) {
            return c;
        }

        // compare the index of the types
        c = getLowestTypeIndex(param1) - getLowestTypeIndex(param2);
        if (c !== 0) {
            return c;
        }

        // compare the index of any conversion
        return getLowestConversionIndex(param1) - getLowestConversionIndex(param2);
    }

    /**
     * Compare two signatures
     * @param {Signature} sign1
     * @param {Signature} sign2
     * @return {number} returns a negative number when param1 must get a lower
     *                  index than param2, a positive number when the opposite,
     *                  or zero when both are equal
     */
    function compareSignatures (sign1: Signature, sign2: Signature): number {
        const len = Math.min(sign1.params.length, sign2.params.length);
        let c: number;

        // compare whether the params have conversions at all or not
        c = +sign1.params.some(hasConversions) - +sign2.params.some(hasConversions)
        if (c !== 0) {
            return c;
        }

        // next compare whether the params have conversions one by one
        for (let i = 0; i < len; i++) {
            c = +hasConversions(sign1.params[i]) - +hasConversions(sign2.params[i]);
            if (c !== 0) {
                return c;
            }
        }

        // compare the types of the params one by one
        for (let i = 0; i < len; i++) {
            c = compareParams(sign1.params[i], sign2.params[i]);
            if (c !== 0) {
                return c;
            }
        }

        // compare the number of params
        return sign1.params.length - sign2.params.length;
    }

    /**
     * Get params containing all types that can be converted to the defined types.
     *
     * @param {ConversionDef[]} conversions
     * @param {string[]} typeNames
     * @return {ConversionDef[]} Returns the conversions that are available
     *                        for every type (if any)
     */
    function filterConversions(conversions: ConversionDef[], typeNames: string[]): ConversionDef[] {
        let matches = {};

        conversions.forEach(function (conversion) {
            if (typeNames.indexOf(conversion.from) === -1 &&
                typeNames.indexOf(conversion.to) !== -1 &&
                !matches[conversion.from])
            {
                matches[conversion.from] = conversion;
            }
        });

        return Object.keys(matches).map(from => matches[from]);
    }

    /**
     * Preprocess arguments before calling the original function:
     * - if needed convert the parameters
     * - in case of rest parameters, move the rest parameters into an Array
     * @param {Param[]} params
     * @param {function} fn
     * @return {function} Returns a wrapped function
     */
    function compileArgsPreprocessing(params: Param[], fn: Function): Function {
        let fnConvert = fn;

        // TODO: can we make this wrapper function smarter/simpler?

        if (params.some(hasConversions)) {
            const restParam = hasRestParam(params);
            const compiledConversions = params.map(compileArgConversion);

            fnConvert = function convertArgs() {
                const args = [];
                const last = restParam ? arguments.length - 1 : arguments.length;

                for (var i = 0; i < last; i++) {
                    args[i] = compiledConversions[i](arguments[i]);
                }

                if (restParam) {
                    args[last] = arguments[last].map(compiledConversions[last]);
                }

                return fn.apply(this, args);
            }
        }

        let fnPreprocess = fnConvert;
        if (hasRestParam(params)) {
            var offset = params.length - 1;

            fnPreprocess = function preprocessRestParams () {
                return fnConvert.apply(
                    this,
                    slice(arguments, 0, offset).concat([slice(arguments, offset)])
                );
            }
        }

        return fnPreprocess;
    }

    /**
     * Compile conversion for a parameter to the right type
     * @param {Param} param
     * @return {function} Returns the wrapped function that will convert arguments
     *
     */
    function compileArgConversion(param: Param): Function {
        let test0: Test, test1: Test;
        let conversion0: Function, conversion1: Function;
        let tests: Test[] = [];
        let conversions: Function[] = [];

        param.types.forEach(function (type) {
            if (type.conversion) {
                tests.push(findTypeByName(type.conversion.from).test);
                conversions.push(type.conversion.convert);
            }
        });

        // create optimized conversion functions depending on the number of conversions
        switch (conversions.length) {
            case 0:
                return function convertArg(arg) {
                    return arg;
                }

            case 1:
                test0 = tests[0];
                conversion0 = conversions[0];

                return function convertArg(arg) {
                    if (test0(arg)) {
                        return conversion0(arg)
                    }
                    return arg;
                }

            case 2:
                test0 = tests[0];
                test1 = tests[1];
                conversion0 = conversions[0];
                conversion1 = conversions[1];

                return function convertArg(arg) {
                    if (test0(arg)) {
                        return conversion0(arg)
                    }
                    if (test1(arg)) {
                        return conversion1(arg)
                    }
                    return arg;
                }

            default:
                return function convertArg(arg) {
                    for (let i = 0; i < conversions.length; i++) {
                        if (tests[i](arg)) {
                            return conversions[i](arg);
                        }
                    }
                    return arg;
                }
        }
    }

    /**
     * Convert an array with signatures into a map with signatures,
     * where signatures with union types are split into separate signatures
     *
     * Throws an error when there are conflicting types
     *
     * @param {Signature[]} signatures
     * @return {Object.<string, function>}  Returns a map with signatures
     *                                      as key and the original function
     *                                      of this signature as value.
     */
    function createSignaturesMap(signatures: Signature[]) {
        let signaturesMap: SignatureMap = {};

        signatures.forEach(function (signature) {
            if (!signature.params.some(hasConversions)) {
                splitParams(signature.params, true).forEach(
                    params => signaturesMap[stringifyParams(params)] = signature.fn
                );
            }
        });

        return signaturesMap;
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
     *
     * @param {Param[]} params
     * @param {boolean} ignoreConversionTypes
     * @return {Param[][]}
     */
    function splitParams(params: Param[], ignoreConversionTypes: boolean): Param[][] {
        function _splitParams(params: Param[], index: number, types: Type[][]) {
            if (index < params.length) {
                const param = params[index]
                const filteredTypes = ignoreConversionTypes
                    ? param.types.filter(isExactType)
                    : param.types;

                let typeGroups: Type[][]

                if (param.restParam) {
                    // split the types of a rest parameter in two:
                    // one with only exact types, and one with exact types and conversions
                    var exactTypes = filteredTypes.filter(isExactType)
                    typeGroups = exactTypes.length < filteredTypes.length
                        ? [exactTypes, filteredTypes]
                        : [filteredTypes]

                }
                else {
                    // split all the types of a regular parameter into one type per group
                    typeGroups = filteredTypes.map(type => [type])
                }

                // recurse over the groups with types
                return flatMap(typeGroups, typeGroup =>
                    _splitParams(params, index + 1, types.concat([typeGroup]))
                );

            }
            else {
                // we've reached the end of the parameters. Now build a new Param
                var splittedParams = types.map((types, typeIndex) =>
                    ({ types, restParam: (typeIndex === params.length - 1) && hasRestParam(params) })
                );

                return [splittedParams];
            }
        }

        return _splitParams(params, 0, []);
    }

    /**
     * Test whether two signatures have a conflicting signature
     * @param {Signature} signature1
     * @param {Signature} signature2
     * @return {boolean} Returns true when the signatures conflict, false otherwise.
     */
    function hasConflictingParams(signature1: Signature, signature2: Signature): boolean {
        const maxLen = Math.max(signature1.params.length, signature2.params.length);

        for (let i = 0; i < maxLen; i++) {
            const typesNames1 = getExpectedTypeNames(signature1, i, true);
            const typesNames2 = getExpectedTypeNames(signature2, i, true);

            if (!hasOverlap(typesNames1, typesNames2)) {
                return false;
            }
        }

        const len1 = signature1.params.length;
        const len2 = signature2.params.length;
        const restParam1 = hasRestParam(signature1.params);
        const restParam2 = hasRestParam(signature2.params);

        return restParam1
            ? restParam2 ? (len1 === len2) : (len2 >= len1)
            : restParam2 ? (len1 >= len2)  : (len1 === len2)
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
    function createTypedFunction(name: string, signaturesMap: SignatureMap): TypedFunction {
        if (Object.keys(signaturesMap).length === 0) {
            throw new SyntaxError('No signatures provided');
        }

        // parse the signatures, and check for conflicts
        const parsedSignatures = [];
        Object.keys(signaturesMap)
            .map(function (signature) {
                return parseSignature(signature, signaturesMap[signature], typed.conversions);
            })
            .filter(notNull)
            .forEach(function (parsedSignature) {
                // check whether this parameter conflicts with already parsed signatures
                const conflictingSignature = findInArray(parsedSignatures,
                    s =>  hasConflictingParams(s, parsedSignature)
                );
                if (conflictingSignature) {
                    throw new TypeError('Conflicting signatures "' +
                        stringifyParams(conflictingSignature.params) + '" and "' +
                        stringifyParams(parsedSignature.params) + '".');
                }

                parsedSignatures.push(parsedSignature);
            });

        // split and filter the types of the signatures, and then order them
        const signatures = flatMap(parsedSignatures, function (parsedSignature) {
            const params = parsedSignature ? splitParams(parsedSignature.params, false) : []

            return params.map(params =>
                ({
                    params: params,
                    fn: parsedSignature.fn
                })
            );
        }).filter(notNull);

        signatures.sort(compareSignatures);

        // we create a highly optimized checks for the first couple of signatures with max 2 arguments
        const ok0 = signatures[0] && signatures[0].params.length <= 2 && !hasRestParam(signatures[0].params);
        const ok1 = signatures[1] && signatures[1].params.length <= 2 && !hasRestParam(signatures[1].params);
        const ok2 = signatures[2] && signatures[2].params.length <= 2 && !hasRestParam(signatures[2].params);
        const ok3 = signatures[3] && signatures[3].params.length <= 2 && !hasRestParam(signatures[3].params);
        const ok4 = signatures[4] && signatures[4].params.length <= 2 && !hasRestParam(signatures[4].params);
        const ok5 = signatures[5] && signatures[5].params.length <= 2 && !hasRestParam(signatures[5].params);
        const allOk = ok0 && ok1 && ok2 && ok3 && ok4 && ok5;

        // compile the tests
        const tests = signatures.map(function (signature) {
            return compileTests(signature.params);
        });

        const test00 = ok0 ? compileTest(signatures[0].params[0]) : notOk;
        const test10 = ok1 ? compileTest(signatures[1].params[0]) : notOk;
        const test20 = ok2 ? compileTest(signatures[2].params[0]) : notOk;
        const test30 = ok3 ? compileTest(signatures[3].params[0]) : notOk;
        const test40 = ok4 ? compileTest(signatures[4].params[0]) : notOk;
        const test50 = ok5 ? compileTest(signatures[5].params[0]) : notOk;

        const test01 = ok0 ? compileTest(signatures[0].params[1]) : notOk;
        const test11 = ok1 ? compileTest(signatures[1].params[1]) : notOk;
        const test21 = ok2 ? compileTest(signatures[2].params[1]) : notOk;
        const test31 = ok3 ? compileTest(signatures[3].params[1]) : notOk;
        const test41 = ok4 ? compileTest(signatures[4].params[1]) : notOk;
        const test51 = ok5 ? compileTest(signatures[5].params[1]) : notOk;

        // compile the functions
        const fns = signatures.map(function(signature) {
            return compileArgsPreprocessing(signature.params, signature.fn);
        });

        const fn0 = ok0 ? fns[0] : undef;
        const fn1 = ok1 ? fns[1] : undef;
        const fn2 = ok2 ? fns[2] : undef;
        const fn3 = ok3 ? fns[3] : undef;
        const fn4 = ok4 ? fns[4] : undef;
        const fn5 = ok5 ? fns[5] : undef;

        const len0 = ok0 ? signatures[0].params.length : -1;
        const len1 = ok1 ? signatures[1].params.length : -1;
        const len2 = ok2 ? signatures[2].params.length : -1;
        const len3 = ok3 ? signatures[3].params.length : -1;
        const len4 = ok4 ? signatures[4].params.length : -1;
        const len5 = ok5 ? signatures[5].params.length : -1;

        // simple and generic, but also slow
        const iStart = allOk ? 6 : 0;
        const iEnd = signatures.length;
        var generic = function generic() {

            for (var i = iStart; i < iEnd; i++) {
                if (tests[i](arguments)) {
                    return fns[i].apply(this, arguments);
                }
            }

            throw createError(name, Array.from(arguments), signatures);
        }

        // create the typed function
        // fast, specialized version. Falls back to the slower, generic one if needed
        const fn: TypedFunction = function fn(arg0, arg1) {

            if (arguments.length === len0 && test00(arg0) && test01(arg1)) { return fn0.apply(fn, arguments); }
            if (arguments.length === len1 && test10(arg0) && test11(arg1)) { return fn1.apply(fn, arguments); }
            if (arguments.length === len2 && test20(arg0) && test21(arg1)) { return fn2.apply(fn, arguments); }
            if (arguments.length === len3 && test30(arg0) && test31(arg1)) { return fn3.apply(fn, arguments); }
            if (arguments.length === len4 && test40(arg0) && test41(arg1)) { return fn4.apply(fn, arguments); }
            if (arguments.length === len5 && test50(arg0) && test51(arg1)) { return fn5.apply(fn, arguments); }

            return generic.apply(fn, arguments);
        }

        // attach name the typed function
        try {
            Object.defineProperty(fn, 'name', {value: name});
        }
        catch (err) {
            // old browsers do not support Object.defineProperty and some don't support setting the name property
            // the function name is not essential for the functioning, it's mostly useful for debugging,
            // so it's fine to have unnamed functions.
        }

        // attach signatures to the function
        fn.signatures = createSignaturesMap(signatures);

        return fn;
    }

    /**
     * Test whether a type should be NOT be ignored
     * @param {string} typeName
     * @return {boolean}
     */
    function notIgnore(typeName: string): boolean {
        return typed.ignore.indexOf(typeName) === -1;
    }

    /**
     * Test whether a string is not empty
     * @param {string} str
     * @return {boolean}
     */
    function notEmpty(str: string): boolean {
        return !!str;
    }

    /**
     * test whether a value is not strict equal to null
     * @param {*} value
     * @return {boolean}
     */
    function notNull(value: any): boolean {
        return value !== null;
    }

    /**
     * Test whether a parameter has no types defined
     * @param {Param} param
     * @return {boolean}
     */
    function isInvalidParam (param: Param): boolean {
        return param.types.length === 0;
    }

    /**
     * Return all but the last items of an array
     * @param {Array} arr
     * @return {Array}
     */
    function initial<T>(arr: T[]): T[] {
        return arr.slice(0, arr.length - 1);
    }

    /**
     * return the last item of an array
     * @param {Array} arr
     * @return {*}
     */
    function last<T>(arr: T[]): T {
        return arr[arr.length - 1];
    }

    /**
     * Slice an array or function Arguments
     * @param {Array | Arguments | IArguments} arr
     * @param {number} start
     * @param {number} [end]
     * @return {Array}
     */
    function slice<T>(arr: T[], start: number, end?: number): T[];
    function slice(arr: IArguments, start: number, end?: number): any[];
    function slice(arr: Array<any> | IArguments, start: number, end?: number): Array<any> {
        return Array.prototype.slice.call(arr, start, end);
    }

    /**
     * Test whether an array contains some item
     * @param {Array} array
     * @param {*} item
     * @return {boolean} Returns true if array contains item, false if not.
     */
    function contains<T>(array: T[], item: T): boolean {
        return array.indexOf(item) !== -1;
    }

    /**
     * Test whether two arrays have overlapping items
     * @param {Array} array1
     * @param {Array} array2
     * @return {boolean} Returns true when at least one item exists in both arrays
     */
    function hasOverlap<T>(array1: T[], array2: T[]): boolean {
        for (const element1 of array1) {
            if (contains(array2, element1)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Return the first item from an array for which test(arr[i]) returns true
     * @param {Array} arr
     * @param {function} test
     * @return {* | undefined} Returns the first matching item
     *                         or undefined when there is no match
     */
    function findInArray<T>(arr: T[], test: (x: T) => boolean): T | undefined {
        for (var i = 0; i < arr.length; i++) {
            if (test(arr[i])) {
                return arr[i];
            }
        }
        return undefined;
    }

    /**
     * Filter unique items of an array with strings
     * @param {string[]} arr
     * @return {string[]}
     */
    function uniq(arr: string[]): string[] {
        var entries: { [s: string]: true } = Object.create(null)

        for (const el of arr) {
            entries[el] = true;
        }

        return Object.keys(entries);
    }

    /**
     * Flat map the result invoking a callback for every item in an array.
     * https://gist.github.com/samgiles/762ee337dff48623e729
     * @param {Array} arr
     * @param {function} callback
     * @return {Array}
     */
    function flatMap<S,T>(arr: S[], callback: (s: S) => T[]): T[] {
        return Array.prototype.concat.apply([], arr.map(callback));
    }

    /**
     * Retrieve the function name from a set of typed functions,
     * and check whether the name of all functions match (if given)
     * @param {function[]} fns
     */
    function getName (fns: (TypedFunction | LegacyTypedFunction)[]) {
        let name = '';

        for (var i = 0; i < fns.length; i++) {
            var fn = fns[i];

            // check whether the names are the same when defined
            if (('signatures' in fn && typeof fn.signatures === 'object' || 'signature' in fn && typeof fn.signature === 'string') && fn.name !== '') {
                if (name === '') {
                    name = fn.name;
                }
                else if (name !== fn.name) {
                    const message = 'Function names do not match (expected: ' + name + ', actual: ' + fn.name + ')';
                    const data = {
                        category: SignatureErrorCategory.NameMismatch,
                        fn: fn.name,
                        actual: fn.name,
                        expected: name
                    };
                    throw new SignatureError(message, data);
                }
            }
        }

        return name;
    }

    // extract and merge all signatures of a list with typed functions
    function extractSignatures(fns: (TypedFunction | LegacyTypedFunction)[]) {
        var signaturesMap: SignatureMap = {};

        function validateUnique(_signature: string, _fn: Function) {
            if (signaturesMap.hasOwnProperty(_signature) && _fn !== signaturesMap[_signature]) {
                const message = 'Signature "' + _signature + '" is defined twice';
                const data: SignatureErrorData = {
                    category: SignatureErrorCategory.DefinedTwice,
                    fn: _fn.name,
                    signature: _signature
                };
                throw new SignatureError(message, data);
                // else: both signatures point to the same function, that's fine
            }
        }

        for (var i = 0; i < fns.length; i++) {
            var fn = fns[i];

            // test whether this is a typed-function
            if ('signatures' in fn && typeof fn.signatures === 'object') {
                // merge the signatures
                for (const s of Object.keys(fn.signatures)) {
                    validateUnique(s, fn.signatures[s]);
                    signaturesMap[s] = fn.signatures[s];
                }
            }
            else if ('signature' in fn && typeof fn.signature === 'string') {
                validateUnique(fn.signature, fn);
                signaturesMap[fn.signature] = fn;
            }
            else {
                const err = new TypeError(`The function with index ${i} is not a typed function.`);
                (err as any).data = {index: i};
                throw err;
            }
        }

        return signaturesMap;
    }

    /**
     * add a type
     * @param {{name: string, test: function}} type
     * @param {boolean} [beforeObjectTest=true]
     *                          If true, the new test will be inserted before
     *                          the test with name 'Object' (if any), since
     *                          tests for Object match Array and classes too.
     */
    function addType (type: TypeDef, beforeObjectTest: boolean) {
        if (!type || typeof type.name !== 'string' || typeof type.test !== 'function') {
            throw new TypeError('Object with properties {name: string, test: function} expected');
        }

        if (beforeObjectTest !== false) {
            for (let i = 0; i < typed.types.length; i++) {
                if (typed.types[i].name === 'Object') {
                    typed.types.splice(i, 0, type);
                    return
                }
            }
        }

        typed.types.push(type);
    };

    function addConversion (conversion: ConversionDef) {
        if (!conversion
            || typeof conversion.from !== 'string'
            || typeof conversion.to !== 'string'
            || typeof conversion.convert !== 'function') {
            throw new TypeError('Object with properties {from: string, to: string, convert: function} expected');
        }

        typed.conversions.push(conversion);
    };

    typed = createTypedFunction('typed', {
        'string, Object': createTypedFunction,
        'Object': function (signaturesMap) {
            // find existing name
            var fns = [];
            for (var signature in signaturesMap) {
            if (signaturesMap.hasOwnProperty(signature)) {
                fns.push(signaturesMap[signature]);
            }
            }
            var name = getName(fns);
            return createTypedFunction(name, signaturesMap);
        },
        '...Function': function (fns) {
            return createTypedFunction(getName(fns), extractSignatures(fns));
        },
        'string, ...Function': function (name, fns) {
            return createTypedFunction(name, extractSignatures(fns));
        }
    }) as _typed;

    typed.create = create;
    typed.types = _types;
    typed.conversions = _conversions;
    typed.ignore = _ignore;
    typed.convert = convert;
    typed.find = find;
    typed.addType = addType;
    typed.addConversion = addConversion;

    return typed;
}

export const typed = create()
