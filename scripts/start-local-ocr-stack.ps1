param(
    [string]$OcrApiKey = "your-strong-token",
    [string]$DeepseekOcrToken = "your-deepseek-token",
    [string]$DeepseekVllmToken = "your-deepseek-vllm-token",
    [string]$DeepseekOcrChatEndpoint = "http://127.0.0.1:8000/v1/chat/completions",
    [string]$DeepseekVllmChatEndpoint = "http://127.0.0.1:8000/v1/chat/completions",
    [string]$DeepseekOcrUpstreamKey = "",
    [string]$DeepseekVllmUpstreamKey = "",
    [string]$CloudflaredUrl = "http://127.0.0.1:10000",
    [string]$CloudflaredTunnelName = "",
    [string]$CloudflaredConfigPath = ""
)

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$paddleRoot = Join-Path $repoRoot "services/paddleocr-home-api"
$deepseekRoot = Join-Path $repoRoot "services/deepseek-ocr-vllm-api"

function Ensure-Venv {
    param(
        [string]$WorkingDirectory
    )

    Push-Location $WorkingDirectory
    try {
        if (-not (Test-Path ".\.venv\Scripts\python.exe")) {
            Write-Host "Creating venv in $WorkingDirectory..." -ForegroundColor Yellow
            py -3.11 -m venv .venv
        }

        Write-Host "Installing requirements in $WorkingDirectory..." -ForegroundColor Yellow
        .\.venv\Scripts\python.exe -m pip install -r requirements.txt
    } finally {
        Pop-Location
    }
}

function Start-OcrProcess {
    param(
        [string]$Name,
        [string]$WorkingDirectory,
        [string]$Command
    )

    $processCommand = @"
if (Test-Path ".\.venv\Scripts\Activate.ps1") { . .\.venv\Scripts\Activate.ps1 }
$Command
"@

    Write-Host "Starting $Name..." -ForegroundColor Cyan
    Start-Process -FilePath "powershell" `
        -ArgumentList @("-NoExit", "-Command", $processCommand) `
        -WorkingDirectory $WorkingDirectory | Out-Null
}

$paddleCommand = @(
    "`$env:OCR_API_KEY=`"$OcrApiKey`"",
    "`$env:OCR_MAX_SIDE=`"1800`"",
    "`$env:OCR_DET_LIMIT_SIDE_LEN=`"1280`"",
    "`$env:OCR_MAX_IMAGE_BYTES=`"5242880`"",
    "`$env:OCR_MAX_CONCURRENCY=`"1`"",
    "`$env:OCR_TIMEOUT_SECONDS=`"15`"",
    "`$env:OCR_HIGH_MAX_SIDE=`"2200`"",
    "`$env:OCR_HIGH_DET_LIMIT_SIDE_LEN=`"1600`"",
    "`$env:DEEPSEEK_OCR_ENDPOINT=`"http://127.0.0.1:12000/ocr`"",
    "`$env:DEEPSEEK_OCR_TOKEN=`"$DeepseekOcrToken`"",
    "`$env:DEEPSEEK_VLLM_ENDPOINT=`"http://127.0.0.1:13000/ocr`"",
    "`$env:DEEPSEEK_VLLM_TOKEN=`"$DeepseekVllmToken`"",
    "uvicorn app:app --host 127.0.0.1 --port 10000"
) -join "`r`n"

$deepseekOcrCommand = @(
    "`$env:OCR_API_KEY=`"$DeepseekOcrToken`"",
    "`$env:VLLM_CHAT_ENDPOINT=`"$DeepseekOcrChatEndpoint`"",
    "`$env:VLLM_API_KEY=`"$DeepseekOcrUpstreamKey`"",
    "uvicorn app:app --host 127.0.0.1 --port 12000"
) -join "`r`n"

$deepseekVllmCommand = @(
    "`$env:OCR_API_KEY=`"$DeepseekVllmToken`"",
    "`$env:VLLM_CHAT_ENDPOINT=`"$DeepseekVllmChatEndpoint`"",
    "`$env:VLLM_API_KEY=`"$DeepseekVllmUpstreamKey`"",
    "uvicorn app:app --host 127.0.0.1 --port 13000"
) -join "`r`n"

Ensure-Venv -WorkingDirectory $paddleRoot
Ensure-Venv -WorkingDirectory $deepseekRoot

Start-OcrProcess -Name "PaddleOCR Home API" -WorkingDirectory $paddleRoot -Command $paddleCommand
Start-OcrProcess -Name "DeepSeek OCR API" -WorkingDirectory $deepseekRoot -Command $deepseekOcrCommand
Start-OcrProcess -Name "DeepSeek OCR vLLM API" -WorkingDirectory $deepseekRoot -Command $deepseekVllmCommand

Write-Host "Starting Cloudflare Tunnel..." -ForegroundColor Cyan
if ($CloudflaredTunnelName) {
    if ($CloudflaredConfigPath) {
        Start-Process -FilePath "powershell" `
            -ArgumentList @("-NoExit", "-Command", "cloudflared tunnel --config `"$CloudflaredConfigPath`" run $CloudflaredTunnelName") | Out-Null
    } else {
        Start-Process -FilePath "powershell" `
            -ArgumentList @("-NoExit", "-Command", "cloudflared tunnel run $CloudflaredTunnelName") | Out-Null
    }
} else {
    Start-Process -FilePath "powershell" `
        -ArgumentList @("-NoExit", "-Command", "cloudflared tunnel --url $CloudflaredUrl") | Out-Null
}
