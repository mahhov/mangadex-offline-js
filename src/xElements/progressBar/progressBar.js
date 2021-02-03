const {importUtil, XElement} = require('xx-element');
const {template, name} = importUtil(__filename);

let round = value =>
	Math.round(value * 1000000) / 1000000;

customElements.define(name, class extends XElement {
	static get attributeTypes() {
		return {
			primary: {type: XElement.PropertyTypes.number},
			secondary: {type: XElement.PropertyTypes.number},
		};
	}

	static get htmlTemplate() {
		return template;
	}

	connectedCallback() {
	}

	set primary(value) {
		this.$('#fill-primary').style.width = round(value) * 100 + '%';
	}

	set secondary(value) {
		value = round(value);
		this.$('#fill-secondary').style.width = value * 100 + '%';
		this.classList.toggle('done', value >= 1);
	}
});
