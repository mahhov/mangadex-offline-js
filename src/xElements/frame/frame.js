const {importUtil, XElement} = require('xx-element');
const {template, name} = importUtil(__filename);

customElements.define(name, class extends XElement {
	static get attributeTypes() {
	}

	static get htmlTemplate() {
		return template;
	}

	connectedCallback() {
		this.mangaList=[];

		this.$('add-input').addEventListener('click', () => this.onProgressClick_(e))
	}

	set preValue(value) {
		this.$(`#pre-value`).textContent = value;
	}
});
