const {importUtil, XElement} = require('xx-element');
const {template, name} = importUtil(__filename);
const storage = require('../../services/storage');
const Manga = require('../../services/Manga');

customElements.define(name, class extends XElement {
	static get attributeTypes() {
		return {
			// mangas: {type: XElement.PropertyTypes.object},
		};
	}

	static get htmlTemplate() {
		return template;
	}

	async connectedCallback() {
		this.mangas = [];

		this.$('#add-button').addEventListener('click', () => {
			let chapterEndpoint = this.$('#add-input').value;
			let mangaPromise = Manga.fromSampleChapterEndpoint(chapterEndpoint);
			this.addManga(mangaPromise, chapterEndpoint);
		});

		(await storage.writtenMangas).forEach(manga => manga
			.then(manga => this.addManga(manga))
			.catch(() => 0));
	}

	async addManga(mangaPromise, tempTitle = '') {
		let mangaProgress = document.createElement('x-manga-progress');
		mangaProgress.title = tempTitle;
		mangaProgress.addEventListener('remove', async () => {
			let manga = await mangaPromise;
			manga.abort();
			mangaProgress.remove();
		});
		this.$('#list').appendChild(mangaProgress);

		let manga = await mangaPromise;
		mangaProgress.title = await manga.mangaTitlePromise;
		manga.write(storage.dataDir);
		mangaProgress.setManga(manga);
	}
});
