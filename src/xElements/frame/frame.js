const {importUtil, XElement} = require('xx-element');
const {template, name} = importUtil(__filename);
const Storage = require('../../services/Storage');
const Manga = require('../../services/Manga');

customElements.define(name, class extends XElement {
	static get attributeTypes() {
		return {};
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

		(await Storage.writtenMangas).forEach(manga => manga
			.then(manga => this.addManga(manga))
			.catch(() => 0));
	}

	async addManga(mangaPromise, tempTitle = '') {
		let mangaProgress = document.createElement('x-manga-progress');
		mangaProgress.title = tempTitle;
		// todo indicate which manga is selected with background color
		mangaProgress.addEventListener('view', async () =>
			this.$('#view').manga = await mangaPromise);
		mangaProgress.addEventListener('remove', async () => {
			// todo clear manga view when removing selected manga
			await (await mangaPromise).removeWritten(Storage.dataDir);
			mangaProgress.remove();
		});
		this.$('#list').appendChild(mangaProgress);

		let manga = await mangaPromise;
		mangaProgress.title = await manga.mangaTitlePromise;
		manga.write(Storage.dataDir);
		mangaProgress.setManga(manga);
	}
});
