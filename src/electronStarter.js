const path = require('path');
const {app, BrowserWindow, ipcMain} = require('electron');

app.on('ready', () => {
	let window = new BrowserWindow({width: 1800, height: 1000, webPreferences: {nodeIntegration: true}});
	window.setMenu(null);
	window.loadFile(path.resolve(__dirname, 'index.html'));

	ipcMain.on('open-dev-tools', () =>
		window.webContents.toggleDevTools());
});

app.once('window-all-closed', app.quit);
