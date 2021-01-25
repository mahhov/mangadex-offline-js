const {importUtil, XElement} = require('xx-element');
const {template, name} = importUtil(__filename);

customElements.define(name, class extends XElement {
	static get attributeTypes() {
		return {
			options: {type: XElement.PropertyTypes.object},
		};
	}

	static get htmlTemplate() {
		return template;
	}

	async connectedCallback() {
	}

	set options(value) {
		this.clearChildren('#container');
		value.forEach(async (option, i) => {
			let label = document.createElement('label');
			this.$('#container').appendChild(label);

			let radio = document.createElement('input');
			radio.type = 'radio';
			radio.name = 'options';
			radio.checked = !i;
			label.appendChild(radio);

			let span = document.createElement('span');
			label.appendChild(span);

			let optionResolved = await option;
			radio.value = optionResolved;
			radio.addEventListener('input', () => this.emit('select', [optionResolved, i]));
			span.textContent = optionResolved;
		});
	}
});
