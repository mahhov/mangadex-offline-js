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
		this.mangaPromises = [];

		this.$('#add-input').addEventListener('keydown', ({key}) => {
			if (key === 'Enter')
				this.addInputtedManga();
		});

		this.$('#add-button').addEventListener('click', () =>
			this.addInputtedManga());

		(await Storage.writtenMangas).forEach(manga => manga
			.then(manga => this.addMangaPromise(Promise.resolve(manga)))
			.catch(() => 0));
	}

	addInputtedManga() {
		let chapterEndpoint = this.$('#add-input').value;
		let mangaPromise = Manga.fromSampleChapterEndpoint(chapterEndpoint);
		this.addMangaPromise(mangaPromise, chapterEndpoint);
	}

	async addMangaPromise(mangaPromise, tempTitle = '') {
		this.mangaPromises.push(mangaPromise);

		let mangaProgress = document.createElement('x-manga-progress');
		mangaProgress.title = tempTitle;
		mangaProgress.addEventListener('view', () => {
			this.$('#view').mangaPromise = mangaPromise;
			[...this.$('#list').children].forEach(mangaProgressI =>
				mangaProgressI.selected = mangaProgressI === mangaProgress)
		});
		mangaProgress.addEventListener('remove', async () => {
			if (mangaProgress.selected)
				this.$('#view').mangaPromise = this.mangaPromises[0];
			await (await mangaPromise).removeWritten(Storage.dataDir);
			mangaProgress.remove();
		});
		this.$('#list').appendChild(mangaProgress);
		if (this.$('#list').children.length === 1)
			this.$('#view').mangaPromise = mangaPromise;

		mangaProgress.setMangaPromise(mangaPromise);
		(await mangaPromise).write(Storage.dataDir);
	}
});
