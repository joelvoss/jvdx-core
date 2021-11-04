const webWorker = new Worker(new URL('./worker.js', import.meta.url), {
	type: 'module',
});

webWorker.onmessage = message => message.data === 'foobar';
webWorker.postMessage('foo');
