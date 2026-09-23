Add-Type -AssemblyName System.Drawing

$authImg = [System.Drawing.Image]::FromFile((Resolve-Path 'apps/os/public/authos.png'))

# 1. Left hero: x=0, y=0, width=880, height=1024
$hero = New-Object System.Drawing.Bitmap 880, 1024
$g = [System.Drawing.Graphics]::FromImage($hero)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$srcRect = New-Object System.Drawing.Rectangle 0, 0, 880, 1024
$dstRect = New-Object System.Drawing.Rectangle 0, 0, 880, 1024
$g.DrawImage($authImg, $dstRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
$hero.Save((Join-Path (Resolve-Path 'apps/os/public') 'auth-hero.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose()
$hero.Dispose()

# 2. Extract Card Logo with comfortable margins: x=990, y=125, width=340, height=190
$logo = New-Object System.Drawing.Bitmap 340, 190
$g2 = [System.Drawing.Graphics]::FromImage($logo)
$g2.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$srcRect2 = New-Object System.Drawing.Rectangle 990, 125, 340, 190
$dstRect2 = New-Object System.Drawing.Rectangle 0, 0, 340, 190
$g2.DrawImage($authImg, $dstRect2, $srcRect2, [System.Drawing.GraphicsUnit]::Pixel)
$logo.Save((Join-Path (Resolve-Path 'apps/os/public') 'card-logo.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$g2.Dispose()
$logo.Dispose()

# 3. Extract Main Hospital OS logo with comfortable padding: x=320, y=170, width=900, height=540
$hosImg = [System.Drawing.Image]::FromFile((Resolve-Path 'apps/os/public/hosos.png'))
$mainLogo = New-Object System.Drawing.Bitmap 900, 540
$g3 = [System.Drawing.Graphics]::FromImage($mainLogo)
$g3.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$srcRect3 = New-Object System.Drawing.Rectangle 320, 170, 900, 540
$dstRect3 = New-Object System.Drawing.Rectangle 0, 0, 900, 540
$g3.DrawImage($hosImg, $dstRect3, $srcRect3, [System.Drawing.GraphicsUnit]::Pixel)
$mainLogo.Save((Join-Path (Resolve-Path 'apps/os/public') 'hospital-os-main-brand.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$g3.Dispose()
$mainLogo.Dispose()

$authImg.Dispose()
$hosImg.Dispose()

Write-Host "All assets cropped with perfection!"
