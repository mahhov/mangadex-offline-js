class XMultiPromise {
	constructor(promise = undefined) {
		this.thens = [];
		this.catches = [];
		this.finalies = [];

		this.resolved = false;
		this.rejected = false;
		this.done = false;
		this.obj = null;

		promise?.then(obj => this.resolve(obj));
		promise?.catch(obj => this.reject(obj));
	}

	then(handler) {
		let promise = new XMultiPromise();
		this.thens.push([handler, promise]);
		if (this.resolved)
			XMultiPromise.invokeHandler(handler, promise, this.obj);
		return promise;
	}

	catch(handler) {
		let nextPromise = new XMultiPromise();
		this.catches.push([handler, nextPromise]);
		if (this.rejected)
			XMultiPromise.invokeHandler(handler, promise, this.obj);
		return nextPromise;
	}

	finaly(handler) {
		let nextPromise = new XMultiPromise();
		this.finalies.push([handler, nextPromise]);
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
		XMultiPromise.invokeHandlers(this.finalies, obj);
	}

	reject(obj, onlyIfFirst = false) {
		if (onlyIfFirst && this.done) return;
		this.resolved = false;
		this.rejected = true;
		this.done = true;
		this.obj = obj;
		XMultiPromise.invokeHandlers(this.catches, obj);
		XMultiPromise.invokeHandlers(this.finalies, obj);
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
