// res = null, rej = null; p = new Promise((a, b) => { res = a; rej = b; });
// p = Promise.resolve(5);
// t = p.then(a =>{ console.log('then', a); return 't';});
// c = p.catch(a =>{ console.log('catch', a); return 'c';});
// res(5);

// on resolve(value),
// 	 invoke all then handlers with |value|
// 	 all then return promises are resolved with their handlers' return values
// 	 all catch return promises are resolved with |value|
// on reject(value),
// 	 invoke all catch handlers with |value|
// 	 all catch return promises are resolved with their handlers' return values
// 	 all then return promises are rejected with |value|
// then on resolved promise
//   invoke handler with resolved value
//   return resolved promise with handler response
// then on rejected promise
//   handler not invoked
//   return rejected promise with reject value
// catch on resolved promise
//   handler not invoked
//   return resolved promise with resolved value
// catch on rejected promise
//   handler invoked with rejected value
//   return resolved promise with handler response

class XMultiPromise {
	constructor(promise = undefined) {
		this.thens = [];
		this.catches = [];
		this.finallies = [];

		this.resolved = false;
		this.rejected = false;
		this.done = false;
		this.obj = null;

		promise?.then(obj => this.resolve(obj));
		promise?.catch(obj => this.reject(obj));
	}

	static resolve(obj) {
		let promise = new XMultiPromise();
		promise.resolve(obj);
		return promise;
	}

	static reject(obj) {
		let promise = new XMultiPromise();
		promise.reject(obj);
		return promise;
	}

	then(handler, catchHandler = undefined) {
		if (catchHandler)
			return this.thenCatchPair(handler, catchHandler);

		let nextPromise = new XMultiPromise();
		this.thens.push([handler, nextPromise]);
		if (this.resolved)
			XMultiPromise.invokeHandler(handler, nextPromise, this.obj);
		else if (this.rejected)
			XMultiPromise.nextPromise(nextPromise, this.obj, false);
		return nextPromise;
	}

	thenCatchPair(handler, catchHandler) {
		let nextPromise = new XMultiPromise();
		this.thens.push([handler, nextPromise]);
		this.catches.push([catchHandler, nextPromise]);
		if (this.resolved)
			XMultiPromise.invokeHandler(handler, nextPromise, this.obj);
		else if (this.rejected)
			XMultiPromise.invokeHandler(catchHandler, nextPromise, this.obj);
		return nextPromise;
	}

	catch(handler) {
		let nextPromise = new XMultiPromise();
		this.catches.push([handler, nextPromise]);
		if (this.rejected)
			XMultiPromise.invokeHandler(handler, nextPromise, this.obj);
		else if (this.resolved)
			XMultiPromise.nextPromise(nextPromise, this.obj, true);
		return nextPromise;
	}

	finally(handler) {
		let nextPromise = new XMultiPromise();
		this.finallies.push([handler, nextPromise]);
		if (this.done)
			XMultiPromise.invokeHandler(handler, nextPromise, this.obj);
		return nextPromise;
	}

	resolve(obj, onlyIfFirst = false) {
		if (onlyIfFirst && this.done) return;
		this.resolved = true;
		this.rejected = false;
		this.done = true;
		this.obj = obj;
		XMultiPromise.invokeHandlers(this.thens, obj);
		XMultiPromise.nextPromises(this.catches, obj, true);
		XMultiPromise.invokeHandlers(this.finallies, obj);
	}

	reject(obj, onlyIfFirst = false) {
		if (onlyIfFirst && this.done) return;
		this.resolved = false;
		this.rejected = true;
		this.done = true;
		this.obj = obj;
		XMultiPromise.nextPromises(this.thens, obj, false);
		XMultiPromise.invokeHandlers(this.catches, obj);
		XMultiPromise.invokeHandlers(this.finallies, obj);
	}

	static invokeHandlers(handlerPairs, obj) {
		handlerPairs.forEach(([handler, nextPromise]) =>
			XMultiPromise.invokeHandler(handler, nextPromise, obj));
	}

	static async invokeHandler(handler, nextPromise, obj) {
		let nextObj = handler(await obj);
		try {
			nextPromise.resolve(await nextObj);
		} catch (e) {
			nextPromise.reject(e);
		}
	}

	static async nextPromises(handlerPairs, obj, resolve) {
		handlerPairs.forEach(([_, nextPromise]) =>
			XMultiPromise.nextPromise(nextPromise, obj, resolve));
	}

	static async nextPromise(nextPromise, obj, resolve) {
		if (resolve)
			nextPromise.resolve(obj);
		else {
			nextPromise.reject(obj);
		}
	}
}

module.exports = XMultiPromise;
