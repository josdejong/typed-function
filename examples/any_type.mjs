import typed from '../src/typed-function.mjs';

// create a typed function with an any type argument
const log = typed({
  'string, any': function (event, data) {
    console.log('event: ' + event + ', data: ' + JSON.stringify(data));
  }
});

// use the typed function
log('start', {count: 2});   // output: 'event: start, data: {"count":2}'
log('end', 'success!');     // output: 'event: start, data: "success!"
