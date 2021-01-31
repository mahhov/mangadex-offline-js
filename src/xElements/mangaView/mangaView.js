const {importUtil, XElement} = require('xx-element');
const {template, name} = importUtil(__filename);
const path = require('path');
const Storage = require('../../services/Storage');
const Manga = require('../../services/Manga');

customElements.define(name, class extends XElement {
	static get attributeTypes() {
		return {
			zoom: {type: XElement.PropertyTypes.number},
			mangaPromise: {type: XElement.PropertyTypes.object},
			chapter: {type: XElement.PropertyTypes.object, allowRedundantAssignment: true},
			chapterIndex: {type: XElement.PropertyTypes.number, allowRedundantAssignment: true},
		};
	}

	static get htmlTemplate() {
		return template;
	}

	async connectedCallback() {
		this.zoom = 1;
		this.mangaPromise = Promise.resolve(null);

		this.$('#chapter-selector').addEventListener('select', e =>
			this.chapterIndex = e.detail);
		this.$('#retry').addEventListener('click', async () => {
			// todo
			// let manga = await this.mangaPromise;
			// if (!manga) return;
			// let chapter = (await (manga).chaptersPromise)[this.chapterIndex];
			// await chapter.retry();
			// this.chapterIndex = this.chapterIndex;
		});
		this.$('#zoom').addEventListener('input', () => this.zoom = this.$('#zoom').value);
		this.$('#next').addEventListener('click', () => {
			this.$('#chapter-selector').selectedIndex = ++this.chapterIndex;
			this.$('#images-container').scrollIntoView();
		});
	}

	set zoom(value) {
		this.$('#zoom-label').textContent = `x${value}`;
		this.$('#images-container').style.zoom = value;
	}

	set mangaPromise(mangaPromise) {
		this.classList.remove('loaded-chapters');
		this.chaptersListened?.cancel();
		mangaPromise.then(manga => {
			if (!manga || mangaPromise !== this.mangaPromise) return;
			this.classList.add('loaded-chapters');
			manga.setHighPriority();
			this.chaptersListened = manga.chaptersStream.on(chapters => {
				this.$('#chapter-selector').options = chapters.map(chapter => chapter.title);
				if (!this.chapter)
					this.chapterIndex = 0;
			});
			this.chapterIndex = 0;
		});
	}

	set chapter(chapter) {
		this.pagesListened?.cancel();
		if (!chapter) return; // can be undefined for mangas with 0 chapters
		chapter.setHighPriority();
		this.clearChildren('#images-container');
		this.pagesListened = chapter.pagesStream.on(pages => {
			if (chapter === this.chapter)
				pages.forEach(async page => {
					let image = document.createElement('img');
					this.$('#images-container').appendChild(image);
					image.src = await page.imageSrc;
				});
		});
	}

	set chapterIndex(chapterIndex) {
		this.mangaPromise.then(manga => {
			if (chapterIndex === this.chapterIndex && manga)
				this.chapter = manga.chaptersStream.value[chapterIndex];
		});
	}
});
