import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkDeviceCapabilities } from '../src/lib/deviceCapabilities.js';

test('checkDeviceCapabilities: 全対応の端末を模したオブジェクトでは全てtrue', () => {
  const win = { BarcodeDetector: function () {}, RTCPeerConnection: function () {} };
  const nav = {
    mediaDevices: { getUserMedia: () => {} },
    share: () => {},
    clipboard: { writeText: () => {} },
  };
  const caps = checkDeviceCapabilities(win, nav);
  assert.deepEqual(caps, { camera: true, barcodeDetector: true, webrtc: true, shareApi: true, clipboard: true });
});

test('checkDeviceCapabilities: 非対応（iPhone Safari相当）では該当項目がfalse', () => {
  const win = { RTCPeerConnection: function () {} }; // BarcodeDetectorなし
  const nav = { mediaDevices: { getUserMedia: () => {} } }; // share/clipboardなし
  const caps = checkDeviceCapabilities(win, nav);
  assert.equal(caps.barcodeDetector, false);
  assert.equal(caps.shareApi, false);
  assert.equal(caps.clipboard, false);
  assert.equal(caps.webrtc, true);
  assert.equal(caps.camera, true);
});

test('checkDeviceCapabilities: 空オブジェクトでも例外を投げない', () => {
  const caps = checkDeviceCapabilities({}, {});
  assert.deepEqual(caps, { camera: false, barcodeDetector: false, webrtc: false, shareApi: false, clipboard: false });
});
