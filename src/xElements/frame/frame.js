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
		this.$('#add-input').addEventListener('keydown', ({key}) => {
			if (key === 'Enter')
				this.addInputtedManga();
		});

		this.$('#add-button').addEventListener('click', () =>
			this.addInputtedManga());

		(await Storage.writtenMangas).forEach(manga =>
			this.addMangaPromise(Promise.resolve(manga)));

		this.addEventListener('wheel', e => {
			if (e.shiftKey) return;
			e.preventDefault();
			let down = e.deltaY > 0;
			if (e.ctrlKey && down)
				this.$('#view').changeZoom(-1);
			else if (e.ctrlKey)
				this.$('#view').changeZoom(1);
			else if (down)
				window.scrollBy(0, 300);
			else
				window.scrollBy(0, -300);
		});
	}

	addInputtedManga() {
		let endpoint = this.$('#add-input').value;

		let mangaFromChapterEndpoint = Manga.fromSampleChapterEndpoint(endpoint, Storage.dataDir);
		if (mangaFromChapterEndpoint)
			this.addMangaPromise(Manga.fromSampleChapterEndpoint(endpoint, Storage.dataDir), endpoint);

		let mangaFromSampleMangaEndpoint = Manga.fromSampleMangaEndpoint(endpoint, Storage.dataDir);
		if (mangaFromSampleMangaEndpoint)
			this.addMangaPromise(Manga.fromSampleMangaEndpoint(endpoint, Storage.dataDir), endpoint);
	}

	async addMangaPromise(mangaPromise, tempTitle = '') {
		let mangaProgress = document.createElement('x-manga-progress');
		mangaProgress.title = tempTitle;
		mangaProgress.addEventListener('view', () => {
			this.$('#view').mangaPromise = mangaPromise;
			[...this.$('#list').children].forEach(mangaProgressI =>
				mangaProgressI.selected = mangaProgressI === mangaProgress)
		});
		mangaProgress.addEventListener('remove', async () => {
			mangaProgress.remove();
			await (await mangaPromise).removeWritten(Storage.dataDir);
		});
		this.$('#list').appendChild(mangaProgress);
		if (this.$('#list').children.length === 1)
			this.$('#view').mangaPromise = mangaPromise;

		mangaProgress.setMangaPromise(mangaPromise);
	}
});
