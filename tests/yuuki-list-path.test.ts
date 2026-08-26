/// <reference path="../typings/types/wx/index.d.ts" />

import { buildYuukiListPath } from '../miniprogram/services/yuuki';

declare function require(path: string): any;

function assertEqual(actual: string, expected: string): void {
  if (actual !== expected) {
    throw new Error(`expected ${expected}, received ${actual}`);
  }
}

function testListPathUsesEncodedQueryParameters(): void {
  assertEqual(
    buildYuukiListPath('discarded', '账号 & 备注', 2, 20),
    '/api/yuuki-pool/list?status=discarded&keyword=%E8%B4%A6%E5%8F%B7%20%26%20%E5%A4%87%E6%B3%A8&page=2&page_size=20'
  );
}

testListPathUsesEncodedQueryParameters();
