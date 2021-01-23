class Progress {
	constructor() {
		this.success = 0;
		this.fail = 0;
		this.total = 0;
	}

	addSuccess(count = 1) {
		this.success += count;
	}

	addFail(count = 1) {
		this.fail += count;
	}

	addTotal(count = 1) {
		this.total += count;
	}

	get percentSuccess() {
		return this.total ? this.success / this.total : 0;
	}

	get percentFail() {
		return this.total ? this.fail / this.total : 0;
	}
}
