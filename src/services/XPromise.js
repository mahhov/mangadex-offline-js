class XPromise {
	constructor(promise = undefined) {
		let resolve, reject;
		let xPromise = new Promise((res, rej) => {
			resolve = res;
			reject = rej;
		});
		xPromise.resolve = resolve;
		xPromise.reject = reject;

		xPromise.xThen = handler =>
			new XPromise(xPromise.then(handler));
		xPromise.xCatch = handler =>
			new XPromise(xPromise.catch(handler));

		xPromise.resolvedObj = null;
		xPromise.resolved = false;
		xPromise.then(obj => {
			xPromise.resolved = true;
			xPromise.resolvedObj = obj;
		});
		xPromise.rejectedObj = null;
		xPromise.rejected = false;
		xPromise.catch(obj => {
			xPromise.rejected = true;
			xPromise.rejectedObj = obj;
		});
		xPromise.done = false;
		xPromise.finally(() => xPromise.done = true);

		promise?.then(resolve);
		promise?.catch(reject);

		return xPromise;
	}
}

module.exports = XPromise;
