param(
  [string]$TemplatePath = (Join-Path $PSScriptRoot '..\miniprogram\pages\yuuki\index.wxml')
)

# 搜索结果与「最近账号」两个列表卡片必须互斥：
# 搜索激活（listActivated=true）时只显示搜索结果，「最近账号」不得占用同一位置。
$template = Get-Content -Raw -Encoding UTF8 $TemplatePath

$requiredFragments = @(
  @{
    Fragment = '<view wx:if="{{!listActivated}}" class="results-card recent-card">'
    Reason = 'recent accounts card must be hidden while search results are active'
  },
  @{
    Fragment = '<view wx:if="{{listActivated}}" class="results-card" id="search-results">'
    Reason = 'search results card must be the only list shown after a search and keep the scroll anchor id'
  }
)

foreach ($expectation in $requiredFragments) {
  if (-not $template.Contains($expectation.Fragment)) {
    throw "missing fragment: $($expectation.Fragment) ($($expectation.Reason))"
  }
}

if ($template.Contains('<view class="results-card recent-card">')) {
  throw 'recent accounts card must not be rendered unconditionally'
}
