Add-Type -AssemblyName System.Drawing
$filePath = "c:\Users\Dell\OneDrive\Desktop\medcore\auth screen.png"
$img = [System.Drawing.Image]::FromFile($filePath)
Write-Host "Image Dimensions: Width=$($img.Width), Height=$($img.Height)"
$img.Dispose()
