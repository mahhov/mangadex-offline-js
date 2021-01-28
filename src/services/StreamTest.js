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
let stream, stream1, stream2; // to avoid accidental redeclarations

// add
stream = new Stream();
stream.on(dc.func);
dc.test();
stream.add(5, 6);
dc.testOne(5);
stream.add([5, 6]);
dc.testOne([5, 6]);
stream.add();
dc.testOne(undefined);
stream.add(7);
dc.testOne(7);

// on with existing value
stream = new Stream();
stream.add(6);
stream.add(7);
stream.on(dc.func);
dc.testOne(7);
stream = new Stream();
stream.add(undefined);
stream.on(dc.func);
dc.testOne(undefined);
stream.add(undefined);
dc.testOne(undefined);

// multiple on
stream = new Stream();
stream.on(dc.func);
stream.on(dc.func);
stream.add(8);
dc.test([8], [8]);

// chained on
stream = new Stream();
stream.on(dc.func);
stream1 = stream.on(([a, b]) => a + b);
stream1.on(dc.func);
stream2 = stream1.on(a => a + 1);
stream2.on(dc.func);
stream.add([10, 20]);
dc.test([[10, 20]], [30], [31]);

// inital values
stream = new Stream(undefined, 10);
stream.on(dc.func);
dc.testOne(10);
stream = new Stream(undefined, 30, 31, 32);
stream.on(dc.func);
dc.testOne(30);

// initializer
stream = new Stream(add => {
	add(12);
	add(13);
}, 11);
stream.on(dc.func);
dc.testOne(13);

// mix
stream1 = new Stream();
stream1.add(5, 6);
stream2 = new Stream();
stream = Stream.mix(stream1, stream2);
stream.on(dc.func);
dc.testOne([5, undefined]);
stream1.add(6);
dc.testOne([6, undefined]);
stream2.add(7);
dc.testOne([6, 7]);

// async initializer
{
	let dc = new DummyCall();
	let stream;
	let resolve;
	let promise = new Promise(r => resolve = r);
	stream = new Stream(async add => {
		await promise;
		add(21);
		dc.testOne(21);
		add(22);
		dc.testOne(22);
		// console.log('async initializer tested');
	}, 20);
	stream.on(dc.func);
	dc.testOne(20);
	resolve();
}

// promise
{
	let dc = new DummyCall();
	let stream;
	stream = new Stream();
	stream.promise.then(dc.func);
	dc.test();
	stream.add(5);
	stream.add(6);
	setTimeout(() => {
		dc.testOne(5);
		// console.log('async promise tested')
	}, 0);
}

// promise already resolved
{
	let dc = new DummyCall();
	let stream;
	stream = new Stream(undefined, 5);
	stream.add(6);
	stream.promise.then(dc.func);
	dc.test();
	setTimeout(() => {
		dc.testOne(6);
		// console.log('async promise tested')
	}, 0);
}
