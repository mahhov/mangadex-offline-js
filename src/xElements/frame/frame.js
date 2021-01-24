const {importUtil, XElement} = require('xx-element');
const {template, name} = importUtil(__filename);
const storage = require('../../services/storage');
const Manga = require('../../services/Manga');

customElements.define(name, class extends XElement {
	static get attributeTypes() {
		return [];
	}

	static get htmlTemplate() {
		return template;
	}

	connectedCallback() {
		this.mangaList = [];

		this.$('#add-input').addEventListener('click', () => 0)

		Manga.fromSampleChapterEndpoint('https://mangadex.org/chapter/1179911/1').then(manga => {
			manga.write(storage.dataDir);
			this.$('x-manga-progress').setManga(manga);
		});
	}

	set preValue(value) {
		this.$(`#pre-value`).textContent = value;
	}
});
