const axiaExtensionDapp = (function (exports, util, utilCrypto) {
  'use strict';

  const global = window;

  function _defineProperty(obj, key, value) {
    if (key in obj) {
      Object.defineProperty(obj, key, {
        value: value,
        enumerable: true,
        configurable: true,
        writable: true
      });
    } else {
      obj[key] = value;
    }

    return obj;
  }

  // Copyright 2019-2021 @axia-js/extension-dapp authors & contributors
  // SPDX-License-Identifier: Apache-2.0
  function documentReadyPromise(creator) {
    return new Promise(resolve => {
      if (document.readyState === 'complete') {
        resolve(creator());
      } else {
        window.addEventListener('load', () => resolve(creator()));
      }
    });
  }

  // Copyright 2019-2021 @axia-js/extension authors & contributors
  const ETHEREUM = util.u8aToU8a('\x19Ethereum Signed Message:\n');
  const PREFIX = util.u8aToU8a('<Bytes>');
  const POSTFIX = util.u8aToU8a('</Bytes>');
  const WRAP_LEN = PREFIX.length + POSTFIX.length;

  function isWrapped(u8a, withEthereum) {
    return u8a.length >= WRAP_LEN && util.u8aEq(u8a.subarray(0, PREFIX.length), PREFIX) && util.u8aEq(u8a.slice(-POSTFIX.length), POSTFIX) || withEthereum && u8a.length >= ETHEREUM.length && util.u8aEq(u8a.subarray(0, ETHEREUM.length), ETHEREUM);
  }

  function unwrapBytes(bytes) {
    const u8a = util.u8aToU8a(bytes); // we don't want to unwrap Ethereum-style wraps

    return isWrapped(u8a, false) ? u8a.subarray(PREFIX.length, u8a.length - POSTFIX.length) : u8a;
  }
  function wrapBytes(bytes) {
    const u8a = util.u8aToU8a(bytes); // if Ethereum-wrapping, we don't add our wrapping bytes

    return isWrapped(u8a, true) ? u8a : util.u8aConcat(PREFIX, u8a, POSTFIX);
  }

  function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); if (enumerableOnly) { symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; }); } keys.push.apply(keys, symbols); } return keys; }

  function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { ownKeys(Object(source), true).forEach(function (key) { _defineProperty(target, key, source[key]); }); } else if (Object.getOwnPropertyDescriptors) { Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)); } else { ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } } return target; }

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
      const encodedAddress = address.length === 42 ? address : utilCrypto.encodeAddress(utilCrypto.decodeAddress(address), ss58Format);
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


  exports.isWeb3Injected = web3IsInjected(); // we keep the last promise created around (for queries)

  exports.web3EnablePromise = null;

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


  function web3Enable(originName, compatInits = []) {
    if (!originName) {
      throw new Error('You must pass a name for your app to the web3Enable function');
    }

    const initCompat = compatInits.length ? Promise.all(compatInits.map(c => c().catch(() => false))) : Promise.resolve([true]);
    exports.web3EnablePromise = documentReadyPromise(() => initCompat.then(() => getWindowExtensions(originName).then(values => values.filter(value => !!value[1]).map(([info, ext]) => {
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
      exports.isWeb3Injected = web3IsInjected();
      console.log(`web3Enable: Enabled ${values.length} extension${values.length !== 1 ? 's' : ''}: ${names.join(', ')}`);
      return values;
    })));
    return exports.web3EnablePromise;
  } // retrieve all the accounts across all providers

  async function web3Accounts({
    accountType,
    ss58Format
  } = {}) {
    if (!exports.web3EnablePromise) {
      return throwError('web3Accounts');
    }

    const accounts = [];
    const injected = await exports.web3EnablePromise;
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
  async function web3AccountsSubscribe(cb, {
    ss58Format
  } = {}) {
    if (!exports.web3EnablePromise) {
      return throwError('web3AccountsSubscribe');
    }

    const accounts = {};

    const triggerUpdate = () => cb(Object.entries(accounts).reduce((result, [source, list]) => {
      result.push(...mapAccounts(source, list, ss58Format));
      return result;
    }, []));

    const unsubs = (await exports.web3EnablePromise).map(({
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

  async function web3FromSource(source) {
    if (!exports.web3EnablePromise) {
      return throwError('web3FromSource');
    }

    const sources = await exports.web3EnablePromise;
    const found = source && sources.find(({
      name
    }) => name === source);

    if (!found) {
      throw new Error(`web3FromSource: Unable to find an injected ${source}`);
    }

    return found;
  } // find a specific provider based on an address

  async function web3FromAddress(address) {
    if (!exports.web3EnablePromise) {
      return throwError('web3FromAddress');
    }

    const accounts = await web3Accounts();
    let found;

    if (address) {
      const accountU8a = utilCrypto.decodeAddress(address);
      found = accounts.find(account => util.u8aEq(utilCrypto.decodeAddress(account.address), accountU8a));
    }

    if (!found) {
      throw new Error(`web3FromAddress: Unable to find injected ${address}`);
    }

    return web3FromSource(found.meta.source);
  } // retrieve all providers exposed by one source

  async function web3ListRpcProviders(source) {
    const {
      provider
    } = await web3FromSource(source);

    if (!provider) {
      console.warn(`Extension ${source} does not expose any provider`);
      return null;
    }

    return provider.listProviders();
  } // retrieve all providers exposed by one source

  async function web3UseRpcProvider(source, key) {
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

  exports.unwrapBytes = unwrapBytes;
  exports.web3Accounts = web3Accounts;
  exports.web3AccountsSubscribe = web3AccountsSubscribe;
  exports.web3Enable = web3Enable;
  exports.web3FromAddress = web3FromAddress;
  exports.web3FromSource = web3FromSource;
  exports.web3ListRpcProviders = web3ListRpcProviders;
  exports.web3UseRpcProvider = web3UseRpcProvider;
  exports.wrapBytes = wrapBytes;

  Object.defineProperty(exports, '__esModule', { value: true });

  return exports;

})({}, axiaUtil, axiaUtilCrypto);
