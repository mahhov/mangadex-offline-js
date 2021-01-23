const fs = require('fs').promises;
const path = require('path');
const dataDir = require('env-paths')('mangadex-offline').data;
const axios = require('axios');
const RateLimitedRetryQueue = require('./RateLimitedRetryQueue');
const Progress = require('./Progress');

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
}

let main = async startEndpoint => {
	// TODO move down where used
	let chapterResponseProgress = new Progress();
	let chapterImageProgress = new Progress();
	let imageProgress = new Progress();

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
		.filter((_, i) => i < 2) // TODO REMOVE
		.map((chapter, i) => {
			let images = getChapterImages(chapter.id);
			images.then(images => {
				chapterResponseProgress.addSuccess();
				imageProgress.addTotal(images.length);
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
			};
		});
	chapterResponseProgress.addTotal(chapters.length);
	chapterImageProgress.addTotal(chapters.length);

	chapters.forEach(async chapter => {
		let chapterDir = path.resolve(dataDir, chapter.mangaTitle, chapter.title);
		await fs.mkdir(chapterDir, {recursive: true});
		(await chapter.images).forEach(async ([imageName, image]) => {
			await fs.writeFile(path.resolve(chapterDir, imageName), await image);
			console.log('wrote', path.resolve(chapterDir, imageName))
		});
	});
}

main('https://mangadex.org/chapter/144329/1');

// progress bar
// viewer
// only bother for 1 chapter version per chapter (i.e. ignore multiple translations)
