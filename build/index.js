import _defineProperty from "@babel/runtime/helpers/esm/defineProperty";

function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); if (enumerableOnly) { symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; }); } keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { ownKeys(Object(source), true).forEach(function (key) { _defineProperty(target, key, source[key]); }); } else if (Object.getOwnPropertyDescriptors) { Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)); } else { ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } } return target; }

// Copyright 2019-2021 @axia-js/extension-dapp authors & contributors
// SPDX-License-Identifier: Apache-2.0
import { u8aEq } from '@axia-js/util';
import { decodeAddress, encodeAddress } from '@axia-js/util-crypto';
import { documentReadyPromise } from "./util.js"; // expose utility functions

export { unwrapBytes, wrapBytes } from "./wrapBytes.js"; // just a helper (otherwise we cast all-over, so shorter and more readable)

const win = window; // don't clobber the existing object, but ensure non-undefined

win.injectedWeb3 = win.injectedWeb3 || {}; // true when anything has been injected and is available

function web3IsInjected() {
  return Object.keys(win.injectedWeb3).length !== 0;
} // helper to throw a consistent error when not enabled


function throwError(method) {
  throw new Error(`${method}: web3Enable(originName) needs to be called before ${method}`);
} // internal helper to map from Array<InjectedAccount> -> Array<InjectedAccountWithMeta>


function mapAccounts(source, list, ss58Format) {
  return list.map(({
    address,
    genesisHash,
    name,
    type
  }) => {
    const encodedAddress = address.length === 42 ? address : encodeAddress(decodeAddress(address), ss58Format);
    return {
      address: encodedAddress,
      meta: {
        genesisHash,
        name,
        source
      },
      type
    };
  });
} // have we found a properly constructed window.injectedWeb3


let isWeb3Injected = web3IsInjected(); // we keep the last promise created around (for queries)

let web3EnablePromise = null;
export { isWeb3Injected, web3EnablePromise };

function getWindowExtensions(originName) {
  return Promise.all(Object.entries(win.injectedWeb3).map(([name, {
    enable,
    version
  }]) => Promise.all([Promise.resolve({
    name,
    version
  }), enable(originName).catch(error => {
    console.error(`Error initializing ${name}: ${error.message}`);
  })])));
} // enables all the providers found on the injected window interface


export function web3Enable(originName, compatInits = []) {
  if (!originName) {
    throw new Error('You must pass a name for your app to the web3Enable function');
  }

  const initCompat = compatInits.length ? Promise.all(compatInits.map(c => c().catch(() => false))) : Promise.resolve([true]);
  web3EnablePromise = documentReadyPromise(() => initCompat.then(() => getWindowExtensions(originName).then(values => values.filter(value => !!value[1]).map(([info, ext]) => {
    // if we don't have an accounts subscriber, add a single-shot version
    if (!ext.accounts.subscribe) {
      ext.accounts.subscribe = cb => {
        ext.accounts.get().then(cb).catch(console.error);
        return () => {// no ubsubscribe needed, this is a single-shot
        };
      };
    }

    return _objectSpread(_objectSpread({}, info), ext);
  })).catch(() => []).then(values => {
    const names = values.map(({
      name,
      version
    }) => `${name}/${version}`);
    isWeb3Injected = web3IsInjected();
    console.log(`web3Enable: Enabled ${values.length} extension${values.length !== 1 ? 's' : ''}: ${names.join(', ')}`);
    return values;
  })));
  return web3EnablePromise;
} // retrieve all the accounts across all providers

export async function web3Accounts({
  accountType,
  ss58Format
} = {}) {
  if (!web3EnablePromise) {
    return throwError('web3Accounts');
  }

  const accounts = [];
  const injected = await web3EnablePromise;
  const retrieved = await Promise.all(injected.map(async ({
    accounts,
    name: source
  }) => {
    try {
      const list = await accounts.get();
      return mapAccounts(source, list.filter(({
        type
      }) => type && accountType ? accountType.includes(type) : true), ss58Format);
    } catch (error) {
      // cannot handle this one
      return [];
    }
  }));
  retrieved.forEach(result => {
    accounts.push(...result);
  });
  const addresses = accounts.map(({
    address
  }) => address);
  console.log(`web3Accounts: Found ${accounts.length} address${accounts.length !== 1 ? 'es' : ''}: ${addresses.join(', ')}`);
  return accounts;
}
export async function web3AccountsSubscribe(cb, {
  ss58Format
} = {}) {
  if (!web3EnablePromise) {
    return throwError('web3AccountsSubscribe');
  }

  const accounts = {};

  const triggerUpdate = () => cb(Object.entries(accounts).reduce((result, [source, list]) => {
    result.push(...mapAccounts(source, list, ss58Format));
    return result;
  }, []));

  const unsubs = (await web3EnablePromise).map(({
    accounts: {
      subscribe
    },
    name: source
  }) => subscribe(result => {
    accounts[source] = result; // eslint-disable-next-line @typescript-eslint/no-floating-promises

    triggerUpdate();
  }));
  return () => {
    unsubs.forEach(unsub => {
      unsub();
    });
  };
} // find a specific provider based on the name

export async function web3FromSource(source) {
  if (!web3EnablePromise) {
    return throwError('web3FromSource');
  }

  const sources = await web3EnablePromise;
  const found = source && sources.find(({
    name
  }) => name === source);

  if (!found) {
    throw new Error(`web3FromSource: Unable to find an injected ${source}`);
  }

  return found;
} // find a specific provider based on an address

export async function web3FromAddress(address) {
  if (!web3EnablePromise) {
    return throwError('web3FromAddress');
  }

  const accounts = await web3Accounts();
  let found;

  if (address) {
    const accountU8a = decodeAddress(address);
    found = accounts.find(account => u8aEq(decodeAddress(account.address), accountU8a));
  }

  if (!found) {
    throw new Error(`web3FromAddress: Unable to find injected ${address}`);
  }

  return web3FromSource(found.meta.source);
} // retrieve all providers exposed by one source

export async function web3ListRpcProviders(source) {
  const {
    provider
  } = await web3FromSource(source);

  if (!provider) {
    console.warn(`Extension ${source} does not expose any provider`);
    return null;
  }

  return provider.listProviders();
} // retrieve all providers exposed by one source

export async function web3UseRpcProvider(source, key) {
  const {
    provider
  } = await web3FromSource(source);

  if (!provider) {
    throw new Error(`Extension ${source} does not expose any provider`);
  }

  const meta = await provider.startProvider(key);
  return {
    meta,
    provider
  };
}