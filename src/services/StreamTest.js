const assert = require('assert');
const Stream = require('./Stream');

class DummyCall {
	constructor() {
		this.reset();
		this.func = (...params) =>
			this.calls.push(params);
	}

	reset() {
		this.calls = [];
	}

	test(...paramSets) {
		assert.deepStrictEqual(this.calls, paramSets);
		this.reset();
	}

	testOne(...params) {
		// tests invoked once and with the specified params
		// testOne(x, y, z) is equivalent to test([x, y, z])
		this.test(params)
	}
}

let dc = new DummyCall();
let stream = new Stream();
stream.on(dc.func);
dc.test();

stream.add(5, 6);
dc.testOne(5, 6);
stream.add();
dc.testOne();
stream.add(7);
dc.testOne(7);

stream.on(dc.func);
dc.testOne(7);

stream.add(8, 9);
dc.test([8, 9], [8, 9]);

stream = new Stream(undefined, 10);
stream.on(dc.func);
dc.testOne(10);
stream = new Stream(undefined, 30, 31, 32);
stream.on(dc.func);
dc.testOne(30, 31, 32);

stream = new Stream(add => {
	add(12);
	add(13);
}, 11);
stream.on(dc.func);
dc.testOne(13);

let stream1 = new Stream();
stream1.add(5, 6);
let stream2 = new Stream();
stream = Stream.mix(stream1, stream2);
stream.on(dc.func);
dc.testOne([5, 6], []);
stream1.add(6);
dc.testOne([6], []);
stream2.add(7);
dc.testOne([6], [7]);

// async
let resolve;
let promise = new Promise(r => resolve = r);
stream = new Stream(async add => {
	await promise;
	add(21);
	dc.testOne(21);
	add(22);
	dc.testOne(22);
	// console.log('async tested');
}, 20);
stream.on(dc.func);
dc.testOne(20);
resolve();
