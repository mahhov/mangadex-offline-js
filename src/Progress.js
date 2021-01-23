let percent = decimal => `${Math.round(decimal * 100)}%`;

class Progress {
	constructor(onChange = undefined) {
		this.success = 0;
		this.fail = 0;
		this.total = 0;
		this.onChange = onChange;
	}

	addSuccess(count = 1) {
		this.success += count;
		this.onChange?.(this);
	}

	addFail(count = 1) {
		this.fail += count;
		this.onChange?.(this);
	}

	addTotal(count = 1) {
		this.total += count;
		this.onChange?.(this);
	}

	get percentSuccess() {
		return percent(this.success / this.total);
	}

	get percentFail() {
		return percent(this.fail / this.total);
	}

}

module.exports = Progress;
