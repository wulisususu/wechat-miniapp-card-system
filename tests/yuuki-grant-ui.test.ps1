param(
  [string]$TemplatePath = (Join-Path $PSScriptRoot '..\miniprogram\pages\yuuki\index.wxml')
)

# 「高级功能」弹窗必须包含 web 后台的全部发放/解锁动作，且共用同一个处理函数。
$template = Get-Content -Raw -Encoding UTF8 $TemplatePath

$requiredFragments = @(
  @{
    Fragment = 'data-kind="avatars" bindtap="grantFromPopup"'
    Reason = 'grant avatars button must be wired to the shared grant handler'
  },
  @{
    Fragment = 'data-kind="unlock" bindtap="grantFromPopup"'
    Reason = 'unlock story/quest button must be wired to the shared grant handler'
  },
  @{
    Fragment = 'data-kind="lightcones" bindtap="grantFromPopup"'
    Reason = 'grant lightcones button must be wired to the shared grant handler'
  },
  @{
    Fragment = 'data-kind="unstuck" bindtap="grantFromPopup"'
    Reason = 'unstuck button must be wired to the shared grant handler'
  }
)

foreach ($expectation in $requiredFragments) {
  if (-not $template.Contains($expectation.Fragment)) {
    throw "missing fragment: $($expectation.Fragment) ($($expectation.Reason))"
  }
}

# 每个 kind 只应出现一次，避免按钮重复或漏改
foreach ($expectation in $requiredFragments) {
  $count = ([regex]::Matches($template, [regex]::Escape($expectation.Fragment))).Count
  if ($count -ne 1) {
    throw "fragment must appear exactly once (found $count): $($expectation.Fragment)"
  }
}

# 旧的独立处理函数不应再被绑定
foreach ($legacy in @('grantAvatarsFromPopup', 'grantLightconesFromPopup')) {
  if ($template.Contains($legacy)) {
    throw "legacy handler still bound: $legacy"
  }
}
