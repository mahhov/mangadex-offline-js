const fs = require('fs').promises;
const path = require('path');
const dataDir = require('env-paths')('mangadex-offline').data;
const axios = require('axios');
const RateLimitedRetryQueue = require('./RateLimitedRetryQueue');
const Progress = require('./Progress');
const XPromise = require('./XPromise');

let getQueue1 = new RateLimitedRetryQueue(100, undefined, 10);
let getQueue2 = new RateLimitedRetryQueue(100, undefined, 10);
let get = (endpoint, options = undefined, queue = getQueue1) =>
	queue.add(async () => {
		try {
			console.log('Got', endpoint);
			return (await axios.get(endpoint, options)).data;
		} catch {
			console.error('Failed to get', endpoint);
			return {};
		}
	});

let getImage = async endpoint => (await axios.get(endpoint, {responseType: 'arraybuffer'})).data;

let chapterEndpoint = chapterId => `https://mangadex.org/api/v2/chapter/${chapterId}`;
let mangaEndpoint = mangaId => `https://mangadex.org/api/v2/manga/${mangaId}/chapters`;
let imageEndpoint = (server, hash, page) => `${server}${hash}/${page}`;

let getChapterImages = async chapterId => {
	let response = await get(chapterEndpoint(chapterId));
	let {server, hash, pages} = response.data;
	return pages.map(page =>
		[page, get(imageEndpoint(server, hash, page), {responseType: 'arraybuffer'}, getQueue2)]);
};

//
// class MangaProgress {
// 	constructor() {
// 		// chapters received response for
// 		this.chapterResponseProgress = new Progress(p => console.log(`chapter response ${p.percentSuccess}`));
// 		// chapters received response for all contained images
// 		this.chapterImageProgress = new Progress(p => console.log(`chapter image ${p.percentSuccess}`));
// 		// images received response for
// 		this.imageProgress = new Progress(p => console.log(`image ${p.percentSuccess}`));
// 		this.imageProgressPerChapter = [];
// 		// images written
// 		this.imageWriteProgress = new Progress(p => console.log(`image write ${p.percentSuccess}`));
// 		this.imageWriteProgressPerChapter = [];
// 	}
//
//
//
// }

let main = async startEndpoint => {
	let chapterResponseProgress = new Progress(p => console.log(`chapter response ${p.percentSuccess}`));
	let chapterImageProgress = new Progress(p => console.log(`chapter image ${p.percentSuccess}`));
	let imageProgress = new Progress(p => console.log(`image ${p.percentSuccess}`));
	let imageWriteProgress = new Progress(p => console.log(`image write ${p.percentSuccess}`));

	let start = 'https://mangadex.org/chapter/144329/1';
	let chapterId = startEndpoint.match(/chapter\/(\d+)/i)[1];

	// parse start chapter response
	let startChapterResponse = await get(chapterEndpoint(chapterId));
	let mangaId = startChapterResponse.data.mangaId;
	let language = startChapterResponse.data.language;

	// parse manga response
	let mangaResponse = await get(mangaEndpoint(mangaId));
	let chapters = mangaResponse.data.chapters
		.filter(chapter => chapter.language === language)
		// .filter(chapter => Number(chapter.volume) < 6) // TODO REMOVE
		.map((chapter, i) => {
			// let status = new XPromise();
			let images = getChapterImages(chapter.id);
			images.then(images => {
				chapterResponseProgress.addSuccess();
				imageProgress.addTotal(images.length);
				imageWriteProgress.addTotal(images.length);
				Promise.all(images.map(async ([_, image]) => {
					await image;
					imageProgress.addSuccess();
				})).then(() => chapterImageProgress.addSuccess());
			});
			return {
				mangaTitle: chapter.mangaTitle,
				id: chapter.id,
				title: `${chapter.volume} ${chapter.chapter} (${i})`,
				images,
				status,
			};
		});
	chapterResponseProgress.addTotal(chapters.length);
	chapterImageProgress.addTotal(chapters.length);

	chapters.forEach(async chapter => {
		let chapterDir = path.resolve(dataDir, chapter.mangaTitle, chapter.title);
		await fs.mkdir(chapterDir, {recursive: true});
		(await chapter.images).forEach(async ([imageName, image]) => {
			await fs.writeFile(path.resolve(chapterDir, imageName), await image);
			imageWriteProgress.addSuccess();
			console.log('wrote', path.resolve(chapterDir, imageName))
		});
	});
}

main('https://mangadex.org/chapter/95001/1');

// progress bar
// viewer
// only bother for 1 chapter version per chapter (i.e. ignore multiple translations)
// skip already downloaded
