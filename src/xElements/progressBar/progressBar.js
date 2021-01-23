const {importUtil, XElement} = require('xx-element');
const {template, name} = importUtil(__filename);

customElements.define(name, class extends XElement {
	static get attributeTypes() {
		return {preValue: false, postValue: false, progress: false};
	}

	static get htmlTemplate() {
		return template;
	}

	connectedCallback() {
		this.addEventListener('click', e => this.onProgressClick_(e))
	}

	set preValue(value) {
		this.$(`#pre-value`).textContent = value;
	}

	set postValue(value) {
		this.$(`#post-value`).textContent = value;
	}

	set progress(value) {
		this.$('#fill').style.width = value * 100 + '%';
	}

	onProgressClick_({offsetX}) {
		let percentage = offsetX / this.clientWidth;
		this.emit('progress-set', percentage);
	}
});
