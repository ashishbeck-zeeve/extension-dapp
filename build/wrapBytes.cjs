"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.unwrapBytes = unwrapBytes;
exports.wrapBytes = wrapBytes;
exports.POSTFIX = exports.PREFIX = exports.ETHEREUM = void 0;

var _util = require("@axia-js/util");

// Copyright 2019-2021 @axia-js/extension authors & contributors
// SPDX-License-Identifier: Apache-2.0
const ETHEREUM = (0, _util.u8aToU8a)('\x19Ethereum Signed Message:\n');
exports.ETHEREUM = ETHEREUM;
const PREFIX = (0, _util.u8aToU8a)('<Bytes>');
exports.PREFIX = PREFIX;
const POSTFIX = (0, _util.u8aToU8a)('</Bytes>');
exports.POSTFIX = POSTFIX;
const WRAP_LEN = PREFIX.length + POSTFIX.length;

function isWrapped(u8a, withEthereum) {
  return u8a.length >= WRAP_LEN && (0, _util.u8aEq)(u8a.subarray(0, PREFIX.length), PREFIX) && (0, _util.u8aEq)(u8a.slice(-POSTFIX.length), POSTFIX) || withEthereum && u8a.length >= ETHEREUM.length && (0, _util.u8aEq)(u8a.subarray(0, ETHEREUM.length), ETHEREUM);
}

function unwrapBytes(bytes) {
  const u8a = (0, _util.u8aToU8a)(bytes); // we don't want to unwrap Ethereum-style wraps

  return isWrapped(u8a, false) ? u8a.subarray(PREFIX.length, u8a.length - POSTFIX.length) : u8a;
}

function wrapBytes(bytes) {
  const u8a = (0, _util.u8aToU8a)(bytes); // if Ethereum-wrapping, we don't add our wrapping bytes

  return isWrapped(u8a, true) ? u8a : (0, _util.u8aConcat)(PREFIX, u8a, POSTFIX);
}