const assert = require('assert');
const Stream = require('./Stream');

const matchers = {
	func: 'func',
}

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
		// let message =
		assert.strictEqual(this.calls.length, paramSets.length, '# of calls');
		paramSets.forEach((paramSet, i) => {
			assert.strictEqual(this.calls[i].length, paramSet.length, `# of params for call ${i}`);
			paramSet.forEach((param, j) => {
				let message = `equality of param ${j}, call ${i}`;
				switch (param) {
					case matchers.func:
						assert.strictEqual(typeof this.calls[i][j], 'function', message);
						break;
					default:
						assert.deepStrictEqual(this.calls[i][j], param, message);
				}
			});
		});
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
dc.testOne(5, matchers.func);
stream.add([5, 6]);
dc.testOne([5, 6], matchers.func);
stream.add();
dc.testOne(undefined, matchers.func);
stream.add(7);
dc.testOne(7, matchers.func);

// on with existing value
stream = new Stream();
stream.add(6);
stream.add(7);
stream.on(dc.func);
dc.testOne(7, matchers.func);
stream = new Stream();
stream.add(undefined);
stream.on(dc.func);
dc.testOne(undefined, matchers.func);
stream.add(undefined);
dc.testOne(undefined, matchers.func);

// multiple on
stream = new Stream();
stream.on(dc.func);
stream.on(dc.func);
stream.add(8);
dc.test([8, matchers.func], [8, matchers.func]);

// chained on
stream = new Stream();
stream.on(dc.func);
stream1 = stream.on(([a, b]) => a + b);
stream1.on(dc.func);
stream2 = stream1.on(a => a + 1);
stream2.on(dc.func);
stream.add([10, 20]);
dc.test([[10, 20], matchers.func], [30, matchers.func], [31, matchers.func]);

// on with cancel
stream = new Stream();
stream.on((value, cancel) => {
	dc.func(value + 1, cancel);
	if (value === 5)
		cancel();
});
stream.on(dc.func);
stream.add(10);
dc.test([11, matchers.func], [10, matchers.func]);
stream.add(5);
dc.test([6, matchers.func], [5, matchers.func]);
stream.add(0);
dc.testOne(0, matchers.func);

// inital values
stream = new Stream(undefined, 10);
stream.on(dc.func);
dc.testOne(10, matchers.func);
stream = new Stream(undefined, 30, 31, 32);
stream.on(dc.func);
dc.testOne(30, matchers.func);

// initializer
stream = new Stream(add => {
	add(12);
	add(13);
}, 11);
stream.on(dc.func);
dc.testOne(13, matchers.func);

// mix
stream1 = new Stream();
stream1.add(5, 6);
stream2 = new Stream();
stream = Stream.mix(stream1, stream2);
stream.on(dc.func);
dc.testOne([5, undefined], matchers.func);
stream1.add(6);
dc.testOne([6, undefined], matchers.func);
stream2.add(7);
dc.testOne([6, 7], matchers.func);

// async initializer
{
	let dc = new DummyCall();
	let stream;
	let resolve;
	let promise = new Promise(r => resolve = r);
	stream = new Stream(async add => {
		await promise;
		add(21);
		dc.testOne(21, matchers.func);
		add(22);
		dc.testOne(22, matchers.func);
		// console.log('async initializer tested');
	}, 20);
	stream.on(dc.func);
	dc.testOne(20, matchers.func);
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
