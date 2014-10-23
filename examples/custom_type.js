var compose = require('../function-composer');

// create a prototype
function Person(params) {
  this.name = params.name;
  this.age = params.age;
}

// register a test for this new type
compose.tests['Person'] = function (x) {
  return x instanceof Person;
};

// compose a function
var stringify = compose({
  'Person': function (person) {
    return JSON.stringify(person);
  },
  'Person,number': function (person, indentation) {
    return JSON.stringify(person, null, indentation);
  }
});

// use the function
var person = new Person({name: 'John', age: 28});

console.log(stringify(person));
// outputs: '{"name":"John","age":28}'

console.log(stringify(person, 2));
// outputs with indentation:
//   '{
//     "name": "John",
//     "age": 28
//   }'

// calling the function with a non-supported type signature will throw an error
try {
  stringify('ooops');
}
catch (err) {
  console.log(err.toString()); // outputs: 'TypeError: Wrong function signature'
}
