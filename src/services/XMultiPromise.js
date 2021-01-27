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

	then(handler) {
		let nextPromise = new XMultiPromise();
		this.thens.push([handler, nextPromise]);
		if (this.resolved)
			XMultiPromise.invokeHandler(handler, nextPromise, this.obj);
		return nextPromise;
	}

	catch(handler) {
		let nextPromise = new XMultiPromise();
		this.catches.push([handler, nextPromise]);
		if (this.rejected)
			XMultiPromise.invokeHandler(handler, promise, this.obj);
		return nextPromise;
	}

	finally(handler) {
		let nextPromise = new XMultiPromise();
		this.finallies.push([handler, nextPromise]);
		if (this.done)
			XMultiPromise.invokeHandler(handler, promise, this.obj);
		return nextPromise;
	}

	resolve(obj, onlyIfFirst = false) {
		if (onlyIfFirst && this.done) return;
		this.resolved = true;
		this.rejected = false;
		this.done = true;
		this.obj = obj;
		XMultiPromise.invokeHandlers(this.thens, obj);
		XMultiPromise.invokeHandlers(this.finallies, obj);
	}

	reject(obj, onlyIfFirst = false) {
		if (onlyIfFirst && this.done) return;
		this.resolved = false;
		this.rejected = true;
		this.done = true;
		this.obj = obj;
		XMultiPromise.invokeHandlers(this.catches, obj);
		XMultiPromise.invokeHandlers(this.finallies, obj);
	}

	static invokeHandlers(handlerPairs, obj) {
		handlerPairs.forEach(([handler, nextPromise]) =>
			XMultiPromise.invokeHandler(handler, nextPromise, obj));
	}

	static async invokeHandler(handler, nextPromise, obj) {
		nextPromise.resolve(handler(await obj));
	}
}

module.exports = XMultiPromise;
