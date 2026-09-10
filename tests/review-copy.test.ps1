param(
  [string]$MiniprogramRoot = (Join-Path $PSScriptRoot '..\miniprogram')
)

# 审核守卫（《微信小程序平台运营规范》3.3：内容必须是正式的，不能以 Demo/测试形式提交）
# 1) 面向用户的 WXML/TS/JSON 文案不得出现「测试」字样
# 2) 不得残留微信官方模板页文案（Hello World / Weixin / 启动日志 / 获取头像昵称）
# 3) app.json 不得注册模板遗留页（pages/index、pages/logs）
$violations = @()

$root = (Resolve-Path $MiniprogramRoot).Path

$sourceFiles = Get-ChildItem -Path $root -Recurse -File -Include *.wxml, *.ts, *.json
foreach ($file in $sourceFiles) {
  $lines = Get-Content -Encoding UTF8 $file.FullName
  for ($i = 0; $i -lt $lines.Count; $i++) {
    $line = $lines[$i]
    # 注释里的说明文字不面向用户
    if ($line -match '^\s*(//|\*|/\*|<!--)') { continue }
    if ($line -match '测试') {
      $relative = $file.FullName.Substring($root.Length).TrimStart('\')
      $violations += "$relative`:$($i + 1) 面向用户文案含「测试」: $($line.Trim())"
    }
  }
}

$bannedPhrases = @('Hello World', 'Weixin', '查看启动日志', '获取头像昵称')
foreach ($phrase in $bannedPhrases) {
  $hits = Get-ChildItem -Path $root -Recurse -File -Include *.wxml, *.ts |
    Select-String -SimpleMatch $phrase
  foreach ($hit in $hits) {
    $relative = $hit.Path.Substring($root.Length).TrimStart('\')
    $violations += "残留模板文案「$phrase」: $relative`:$($hit.LineNumber)"
  }
}

$appJson = Get-Content -Raw -Encoding UTF8 (Join-Path $root 'app.json') | ConvertFrom-Json
foreach ($page in $appJson.pages) {
  if ($page -match '^pages/(index|logs)/') {
    $violations += "app.json 仍注册模板遗留页: $page"
  }
}

if ($violations.Count -gt 0) {
  throw ("审核文案守卫失败:`n" + ($violations -join "`n"))
}
