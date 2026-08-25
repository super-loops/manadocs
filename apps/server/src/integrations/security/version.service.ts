import { Injectable } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const packageJson = require('./../../../package.json');

@Injectable()
export class VersionService {
  constructor() {}

  async getVersion() {
    const url = `https://api.github.com/repos/super-loops/manadocs/releases/latest`;

    // GitHub 조회가 실패해도 currentVersion 은 돌려준다.
    // 예전에는 여기서 undefined 를 반환해 클라 쿼리가
    // Query data cannot be undefined (queryKey: version) 로 터졌다.
    let latestVersion: string | number = 0;
    try {
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        latestVersion = data?.tag_name?.replace('v', '') ?? 0;
      }
    } catch (err) {
      /* empty */
    }

    return {
      currentVersion: packageJson?.version,
      latestVersion: latestVersion,
      releaseUrl: 'https://github.com/super-loops/manadocs/releases',
    };
  }
}
