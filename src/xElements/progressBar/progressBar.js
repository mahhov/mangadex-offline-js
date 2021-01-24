const {importUtil, XElement} = require('xx-element');
const {template, name} = importUtil(__filename);

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
		this.$('#fill-primary').style.width = value * 100 + '%';
		this.classList.toggle('primary-done', value >= 1);
	}

	set secondary(value) {
		this.$('#fill-secondary').style.width = value * 100 + '%';
		this.classList.toggle('secondary-done', value >= 1);
	}
});
