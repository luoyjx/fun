import { extract } from 'tar';
import pipe from 'promisepipe';
import fetch from 'node-fetch';
import createDebug from 'debug';
import { createGunzip } from 'zlib';
import { basename, join } from 'path';
import { createWriteStream, createReadStream, mkdirp, exists } from 'fs-extra';
import { unzip, zipFromFile } from './unzip';

const debug = createDebug('@zeit/fun:install-node');

export function generateNodeTarballUrl(
	version: string,
	platform: string = process.platform,
	arch: string = process.arch
): string {
	if (!version.startsWith('v')) {
		version = `v${version}`;
	}
	let ext: string;
	let plat: string = platform;
	if (platform === 'win32') {
		ext = 'zip';
		plat = 'win';
	} else {
		ext = 'tar.gz';
	}

	let mirror = process.env.ZEIT_FUN_MIRRORS_NODE;

	if (!mirror) {
		mirror = 'https://nodejs.org/dist';
	}

	return `${mirror}/${version}/node-${version}-${plat}-${arch}.${ext}`;
}

export async function installNode(
	dest: string,
	version: string,
	platform: string = process.platform,
	arch: string = process.arch
): Promise<void> {
	const tarballUrl = generateNodeTarballUrl(version, platform, arch);
	let nodeTarballStream = null;

	const localTarballDir = process.env.ZEIT_FUN_NODEJS_TARBALL_DIR;
	// Support local tarball file when networking unavailable
	if (localTarballDir) {
		debug('Use local tarball ', localTarballDir);
		const tarballFilePath = join(localTarballDir, basename(tarballUrl));
		let localTarballExists = await exists(tarballFilePath);

		debug('Check local tarbal exists : ', tarballFilePath);
		if (localTarballExists) {
			nodeTarballStream = createReadStream(tarballFilePath);
		}
	}

	// Try download from mirror if no local tarball
	if (!nodeTarballStream) {
		debug('Downloading Node.js %s tarball %o', version, tarballUrl);
		const res = await fetch(tarballUrl);

		if (!res.ok) {
			throw new Error(`HTTP request failed: ${res.status}`);
		}

		nodeTarballStream = res.body;
	}

	if (platform === 'win32') {
		// Put it in the `bin` dir for consistency with the tarballs
		const finalDest = join(dest, 'bin');
		const zipName = basename(tarballUrl);
		const zipPath = join(dest, zipName);

		debug('Saving Node.js %s zip file to %o', version, zipPath);
		await pipe(
			nodeTarballStream,
			createWriteStream(zipPath)
		);

		debug('Extracting Node.js %s zip file to %o', version, finalDest);
		const zipFile = await zipFromFile(zipPath);
		await unzip(zipFile, finalDest, { strip: 1 });
	} else {
		debug('Extracting Node.js %s tarball to %o', version, dest);
		await pipe(
			nodeTarballStream,
			createGunzip(),
			extract({ strip: 1, C: dest })
		);
	}
}
