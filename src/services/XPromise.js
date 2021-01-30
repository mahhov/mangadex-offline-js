class XPromise {
	constructor(promise = undefined) {
		let resolve, reject;
		let xPromise = new Promise((res, rej) => {
			resolve = res;
			reject = rej;
		});

		xPromise.resolved = false;
		xPromise.rejected = false;
		xPromise.done = false;
		xPromise.obj = undefined;

		xPromise.resolve = obj => {
			if (xPromise.done) return;
			xPromise.resolved = true;
			xPromise.obj = obj;
			xPromise.done = true;
			resolve(obj);
		};

		xPromise.reject = obj => {
			if (xPromise.done) return;
			xPromise.rejected = true;
			xPromise.obj = obj;
			xPromise.done = true;
			reject(obj);
		};

		xPromise.xThen = handler =>
			new XPromise(xPromise.then(handler));
		xPromise.xCatch = handler =>
			new XPromise(xPromise.catch(handler));

		promise?.then(obj => xPromise.resolve(obj));
		promise?.catch(obj => xPromise.reject(obj));

		return xPromise;
	}
}

module.exports = XPromise;
