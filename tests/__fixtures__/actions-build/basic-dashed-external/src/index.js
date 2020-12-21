import tinyglob from 'tiny-glob';

import { two } from './two';
console.log(tinyglob);

export default async function (...args) {
	return [await two(...args), await two(...args)];
}
