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
		this.$('#retry').addEventListener('click', async () =>
			this.chapter?.retry());
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

	changeZoom(delta) {
		let zoom = this.zoom + delta * Number(this.$('#zoom').step);
		zoom = Math.round(zoom * 10) / 10;
		this.zoom = Math.max(Math.min(
			zoom,
			Number(this.$('#zoom').max)),
			Number(this.$('#zoom').min))
	}

	set mangaPromise(mangaPromise) {
		this.chaptersListened?.cancel();
		this.classList.remove('loaded-chapters');
		this.clearChildren('#images-container');
		mangaPromise.then(manga => {
			if (!manga) return;
			manga.setHighPriority();
			this.classList.add('loaded-chapters');
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
		this.clearChildren('#images-container');
		if (!chapter) return; // can be undefined for mangas with 0 chapters
		chapter.setHighPriority();
		this.pagesListened = chapter.pagesStream.on(pages => {
			this.clearChildren('#images-container');
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
