// Copyright 2019-2021 @axia-js/extension-dapp authors & contributors
// SPDX-License-Identifier: Apache-2.0
export function documentReadyPromise(creator) {
  return new Promise(resolve => {
    if (document.readyState === 'complete') {
      resolve(creator());
    } else {
      window.addEventListener('load', () => resolve(creator()));
    }
  });
}