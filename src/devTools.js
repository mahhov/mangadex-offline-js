const {ipcRenderer} = require('electron');

document.addEventListener('keydown', e => {
	if (e.ctrlKey && e.shiftKey && ['c', 'i', 'j'].includes(e.key.toLowerCase()))
		ipcRenderer.send('open-dev-tools');
});
