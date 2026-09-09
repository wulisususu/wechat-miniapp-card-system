/// <reference path="../typings/types/wx/index.d.ts" />

import { buildGrantRequest, grantPrecondition } from '../miniprogram/services/yuuki';

declare function require(path: string): any;

function assertEqual(label: string, actual: unknown, expected: unknown): void {
  const actualText = JSON.stringify(actual);
  const expectedText = JSON.stringify(expected);
  if (actualText !== expectedText) {
    throw new Error(`${label}: expected ${expectedText}, received ${actualText}`);
  }
}

function testGrantPreconditions(): void {
  // avatars / lightcones 需要先过邮箱验证，并且要有 UID/服务器
  assertEqual('avatars', grantPrecondition('avatars'), { needVerify: true, needUid: true });
  assertEqual('lightcones', grantPrecondition('lightcones'), { needVerify: true, needUid: true });
  // unlock 需要邮箱验证，但 UID 由后端自行探测
  assertEqual('unlock', grantPrecondition('unlock'), { needVerify: true, needUid: false });
  // unstuck 后端 require_verify=False，也不需要 UID 前置条件
  assertEqual('unstuck', grantPrecondition('unstuck'), { needVerify: false, needUid: false });
}

function testGrantRequestContract(): void {
  // 后端 YuukiGrantRequest 只有 username / by 两个字段
  assertEqual('unlock request', buildGrantRequest('unlock', 'user01'), {
    path: '/api/yuuki-pool/grant/unlock',
    data: { username: 'user01', by: 'miniapp' }
  });
  assertEqual('unstuck request', buildGrantRequest('unstuck', 'user01'), {
    path: '/api/yuuki-pool/grant/unstuck',
    data: { username: 'user01', by: 'miniapp' }
  });
  assertEqual('avatars request', buildGrantRequest('avatars', 'user01'), {
    path: '/api/yuuki-pool/grant/avatars',
    data: { username: 'user01', by: 'miniapp' }
  });
}

testGrantPreconditions();
testGrantRequestContract();
