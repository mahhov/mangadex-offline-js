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

		this.$('#add-input').addEventListener('keydown', ({key}) => {
			if (key === 'Enter')
				this.addInputedManga();
		});

		this.$('#add-button').addEventListener('click', () =>
			this.addInputedManga());

		(await Storage.writtenMangas).forEach(manga => manga
			.then(manga => this.addManga(manga))
			.catch(() => 0));
	}

	addInputedManga() {
		let chapterEndpoint = this.$('#add-input').value;
		let mangaPromise = Manga.fromSampleChapterEndpoint(chapterEndpoint);
		this.addManga(mangaPromise, chapterEndpoint);
	}

	async addManga(mangaPromise, tempTitle = '') {
		let mangaProgress = document.createElement('x-manga-progress');
		mangaProgress.title = tempTitle;
		mangaProgress.addEventListener('view', async () => {
			this.$('#view').manga = await mangaPromise;
			[...this.$('#list').children].forEach(mangaProgressI =>
				mangaProgressI.selected = mangaProgressI === mangaProgress)
		});
		mangaProgress.addEventListener('remove', async () => {
			if (mangaProgress.selected)
				this.$('#view').manga = null;
			await (await mangaPromise).removeWritten(Storage.dataDir);
			mangaProgress.remove();
		});
		this.$('#list').appendChild(mangaProgress);

		let manga = await mangaPromise;
		manga.write(Storage.dataDir);
		mangaProgress.setManga(manga);
	}
});
